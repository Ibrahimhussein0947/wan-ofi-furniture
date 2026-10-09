const { Order, Payment, Invoice, Supplier, PurchaseOrder, Worker } = require('../models');
const { nextNumber } = require('../models/Counter');
const ApiError = require('../utils/ApiError');
const { round2, paymentStatusFor } = require('../utils/money');
const { withTransaction } = require('../utils/transaction');
const { escapeRegex } = require('../utils/query');
const {
  ORDER_STATUS: O,
  AUDIT_ACTIONS,
  TRANSACTION_TYPES,
  PAYMENT_CATEGORIES,
} = require('../config/constants');
const { getSettings } = require('./settings.service');
const { recordLedgerEntry } = require('./ledger.service');
const { confirmOrderInTransaction } = require('./order.service');
const { audit } = require('./audit.service');
const notify = require('./notification.service');

const EPS = 0.001;

async function syncInvoices(order, session) {
  const status = order.balance <= 0 ? 'PAID' : order.amountPaid > 0 ? 'PARTIALLY_PAID' : 'ISSUED';
  await Invoice.updateMany(
    { order: order._id, status: { $ne: 'VOID' } },
    { $set: { amountPaid: order.amountPaid, balance: order.balance, total: order.total, status } },
    { session },
  );
}

function paymentKind(order, amount) {
  const first = order.amountPaid <= 0;
  const settles = amount + EPS >= order.balance;
  if (first && settles) return 'FULL';
  if (first) return 'DEPOSIT';
  return settles ? 'FINAL' : 'INSTALLMENT';
}

/**
 * Applies a customer payment to an order inside a transaction:
 * PAID + REMAINING = TOTAL is preserved, overpayment is rejected (unless enabled),
 * the order auto-confirms once the deposit is reached, and the ledger is updated.
 */
async function applyCustomerPayment(
  order,
  { amount, method, reference, notes, paidAt },
  { session, actor, afterCommit, existingPayment },
) {
  const settings = await getSettings();
  if (order.status === O.CANCELLED)
    throw ApiError.badRequest('Payments cannot be recorded on a cancelled order.');
  if (order.balance <= 0) throw ApiError.badRequest('This order is already fully paid.');
  if (amount - order.balance > EPS && !settings.allowOverpayment) {
    throw ApiError.badRequest(
      `Payment exceeds remaining balance (${order.balance.toLocaleString()}).`,
    );
  }

  const kind = paymentKind(order, amount);
  const previousPaid = order.amountPaid;
  const newPaid = round2(previousPaid + amount);
  const newBalance = round2(Math.max(order.total - newPaid, 0));

  // Optimistic concurrency: the write only succeeds if nobody changed amountPaid meanwhile.
  const updated = await Order.findOneAndUpdate(
    { _id: order._id, amountPaid: previousPaid, status: { $ne: O.CANCELLED } },
    {
      $set: {
        amountPaid: newPaid,
        balance: newBalance,
        paymentStatus: paymentStatusFor(order.total, newPaid),
        // The payment notice below already tells the customer what is left, so it counts as a reminder.
        lastPaymentReminderAt: new Date(),
      },
    },
    { new: true, session },
  );
  if (!updated)
    throw ApiError.conflict(
      'The order was updated at the same time. Please refresh and try again.',
    );

  const invoice = await Invoice.findOne({ order: order._id, status: { $ne: 'VOID' } })
    .session(session)
    .lean();
  let payment = existingPayment;
  if (payment) {
    payment.status = 'COMPLETED';
    payment.kind = kind;
    payment.receiptNumber = await nextNumber('RCT');
    payment.receivedBy = actor.user._id;
    payment.invoice = invoice?._id;
    await payment.save({ session });
  } else {
    [payment] = await Payment.create(
      [
        {
          paymentNumber: await nextNumber('PAY'),
          receiptNumber: await nextNumber('RCT'),
          category: PAYMENT_CATEGORIES.CUSTOMER_PAYMENT,
          amount: round2(amount),
          method,
          reference,
          notes,
          paidAt: paidAt || new Date(),
          order: order._id,
          invoice: invoice?._id,
          customer: order.customer,
          kind,
          receivedBy: actor.user._id,
        },
      ],
      { session },
    );
  }

  await recordLedgerEntry(
    {
      type: TRANSACTION_TYPES.CUSTOMER_PAYMENT,
      amount,
      method: payment.method,
      customer: order.customer,
      order: order._id,
      payment: payment._id,
      date: payment.paidAt,
      description: `${kind.toLowerCase()} payment for ${order.orderNumber}`,
      createdBy: actor.user._id,
    },
    session,
  );

  // Lifecycle effects of the payment.
  if (updated.status === O.PENDING && newPaid + EPS >= updated.depositRequired) {
    await confirmOrderInTransaction(updated, {
      session,
      actor,
      afterCommit,
      note: 'Confirmed automatically on deposit payment',
    });
  } else if (updated.status === O.CONFIRMED && updated.paymentStatus === 'PAID') {
    updated.status = O.PAID;
    updated.statusHistory.push({ status: O.PAID, note: 'Paid in full', changedBy: actor.user._id });
    await updated.save({ session });
  } else if (updated.status === O.DELIVERED && updated.balance <= 0) {
    updated.status = O.COMPLETED;
    updated.completedAt = new Date();
    updated.statusHistory.push({
      status: O.COMPLETED,
      note: 'Final balance paid',
      changedBy: actor.user._id,
    });
    await updated.save({ session });
  }
  await syncInvoices(updated, session);

  afterCommit(async () => {
    await audit(actor, {
      action: AUDIT_ACTIONS.PAYMENT,
      entity: 'Payment',
      entityId: payment._id,
      reference: updated.orderNumber,
      amount,
      description: `Customer payment (${payment.method}) — receipt ${payment.receiptNumber}`,
    });
    const currency = settings.currency;
    await notify.notifyCustomer(updated.customer, {
      type: 'PAYMENT_RECEIVED',
      title: `Payment received — ${updated.orderNumber}`,
      message: `We received ${amount.toLocaleString()} ${currency}. Paid so far: ${updated.amountPaid.toLocaleString()} of ${updated.total.toLocaleString()} ${currency}. Remaining balance: ${updated.balance.toLocaleString()} ${currency}.`,
      link: `/account/orders/${updated._id}`,
    });
    await notify.notifyFinance({
      type: 'PAYMENT_RECEIVED',
      title: `Payment received: ${amount.toLocaleString()} ${currency}`,
      message: `${updated.orderNumber} — ${payment.method.replace(/_/g, ' ').toLowerCase()}, balance ${updated.balance.toLocaleString()}`,
      link: `/app/orders/${updated._id}`,
    });
  });

  return { payment, order: updated };
}

/**
 * Reminds the customer what is still owed on an order (in-app, email and SMS) and stamps the order,
 * so the weekly job doesn't remind the same customer again within a week.
 */
async function sendBalanceReminder(orderOrId, actor) {
  const order = orderOrId._id ? orderOrId : await Order.findById(orderOrId).lean();
  if (!order) throw ApiError.notFound('Order not found.');
  if (order.status === O.CANCELLED) throw ApiError.badRequest('This order is cancelled.');
  if (!(order.balance > 0)) throw ApiError.badRequest('This order is fully paid.');
  const { currency } = await getSettings();
  const fmt = (n) => `${round2(n).toLocaleString()} ${currency}`;
  await notify.notifyCustomer(order.customer, {
    type: 'PAYMENT_REMINDER',
    title: `Payment reminder — ${order.orderNumber}`,
    message:
      order.amountPaid > 0
        ? `You have paid ${fmt(order.amountPaid)} of ${fmt(order.total)}. Remaining balance: ${fmt(order.balance)}.`
        : `A balance of ${fmt(order.balance)} is outstanding on your order.`,
    link: `/account/orders/${order._id}`,
  });
  const remindedAt = new Date();
  await Order.updateOne({ _id: order._id }, { $set: { lastPaymentReminderAt: remindedAt } });
  if (actor) {
    await audit(actor, {
      action: AUDIT_ACTIONS.UPDATE,
      entity: 'Order',
      entityId: order._id,
      reference: order.orderNumber,
      amount: order.balance,
      description: 'Payment reminder sent to customer',
    });
  }
  return { remindedAt, balance: order.balance };
}

async function recordCustomerPayment(input, actor) {
  return withTransaction(async (session, afterCommit) => {
    const order = await Order.findById(input.order).session(session);
    if (!order) throw ApiError.notFound('Order not found.');
    return applyCustomerPayment(order, input, { session, actor, afterCommit });
  });
}

/** A customer reports a payment made by bank/mobile transfer; staff verify it before it counts. */
async function submitCustomerPayment(
  { order: orderId, amount, method, reference, notes, screenshot, percent },
  customerId,
  actor,
) {
  const order = await Order.findOne({ _id: orderId, customer: customerId });
  if (!order) throw ApiError.notFound('Order not found.');
  if (order.status === O.CANCELLED) throw ApiError.badRequest('This order was cancelled.');
  // The same bank reference can't pay twice (unless an earlier submission was rejected).
  const duplicate = await Payment.exists({
    category: PAYMENT_CATEGORIES.CUSTOMER_PAYMENT,
    reference: new RegExp(`^${escapeRegex(reference.trim())}$`, 'i'),
    status: { $ne: 'REJECTED' },
  });
  if (duplicate) throw ApiError.conflict('This transaction reference has already been submitted. Check the number on your receipt.');
  const settings = await getSettings();
  const pending = await Payment.aggregate([
    { $match: { order: order._id, status: 'PENDING_VERIFICATION' } },
    { $group: { _id: null, total: { $sum: '$amount' } } },
  ]);
  const pendingTotal = pending[0]?.total || 0;
  if (amount + pendingTotal - order.balance > EPS && !settings.allowOverpayment) {
    throw ApiError.badRequest('Payment exceeds remaining balance.');
  }
  const payment = await Payment.create({
    paymentNumber: await nextNumber('PAY'),
    category: PAYMENT_CATEGORIES.CUSTOMER_PAYMENT,
    amount: round2(amount),
    method,
    reference,
    notes,
    screenshot,
    percent,
    order: order._id,
    customer: customerId,
    status: 'PENDING_VERIFICATION',
    submittedByCustomer: true,
  });
  await audit(actor, {
    action: AUDIT_ACTIONS.CREATE,
    entity: 'Payment',
    entityId: payment._id,
    reference: order.orderNumber,
    amount,
    description: 'Customer submitted payment for verification',
  });
  await notify.notifyFinance({
    type: 'PAYMENT_RECEIVED',
    title: `Payment to verify: ${order.orderNumber}`,
    message: `${amount.toLocaleString()} via ${method.replace(/_/g, ' ').toLowerCase()} (ref ${reference || '—'})`,
    link: '/app/payments?status=PENDING_VERIFICATION',
  });
  return payment;
}

// Lets a customer add (or replace) the receipt on a payment of theirs that is still awaiting verification.
async function attachCustomerReceipt(paymentId, screenshot, customerId, actor) {
  const payment = await Payment.findOneAndUpdate(
    { _id: paymentId, customer: customerId, submittedByCustomer: true, status: 'PENDING_VERIFICATION' },
    { $set: { screenshot } },
    { new: true },
  );
  if (!payment) throw ApiError.notFound('Payment not found, or it is no longer awaiting verification.');
  await audit(actor, {
    action: AUDIT_ACTIONS.UPDATE,
    entity: 'Payment',
    entityId: payment._id,
    amount: payment.amount,
    description: 'Customer uploaded a payment receipt',
  });
  await notify.notifyFinance({
    type: 'PAYMENT_RECEIVED',
    title: `Receipt uploaded: ${payment.paymentNumber}`,
    message: `The customer added a receipt (ref ${payment.reference || '—'}) — ready to verify.`,
    link: '/app/payments?status=PENDING_VERIFICATION',
  });
  return payment;
}

async function verifyCustomerPayment(paymentId, { approve, reason }, actor) {
  if (!approve) {
    const payment = await Payment.findOneAndUpdate(
      { _id: paymentId, status: 'PENDING_VERIFICATION' },
      { $set: { status: 'REJECTED', rejectionReason: reason, receivedBy: actor.user._id } },
      { new: true },
    );
    if (!payment) throw ApiError.badRequest('This payment is not awaiting verification.');
    await notify.notifyCustomer(payment.customer, {
      type: 'GENERAL',
      title: 'Payment could not be verified',
      message: reason || 'Please contact us about your payment.',
      link: `/account/orders/${payment.order}`,
    });
    await audit(actor, {
      action: AUDIT_ACTIONS.UPDATE,
      entity: 'Payment',
      entityId: payment._id,
      amount: payment.amount,
      description: `Payment rejected: ${reason || ''}`,
    });
    return { payment };
  }
  return withTransaction(async (session, afterCommit) => {
    const payment = await Payment.findOne({
      _id: paymentId,
      status: 'PENDING_VERIFICATION',
    }).session(session);
    if (!payment) throw ApiError.badRequest('This payment is not awaiting verification.');
    const order = await Order.findById(payment.order).session(session);
    return applyCustomerPayment(order, payment, {
      session,
      actor,
      afterCommit,
      existingPayment: payment,
    });
  });
}

/** Refunds money paid on an order (typically after a cancellation). */
async function recordRefund({ order: orderId, amount, method, reference, reason }, actor) {
  return withTransaction(async (session, afterCommit) => {
    const order = await Order.findById(orderId).session(session);
    if (!order) throw ApiError.notFound('Order not found.');
    if (amount - order.amountPaid > EPS)
      throw ApiError.badRequest(
        `Refund exceeds the amount paid (${order.amountPaid.toLocaleString()}).`,
      );

    const previousPaid = order.amountPaid;
    const newPaid = round2(previousPaid - amount);
    const cancelled = order.status === O.CANCELLED;
    const newBalance = cancelled ? 0 : round2(order.total - newPaid);
    const updated = await Order.findOneAndUpdate(
      { _id: order._id, amountPaid: previousPaid },
      {
        $set: {
          amountPaid: newPaid,
          balance: newBalance,
          paymentStatus:
            cancelled && newPaid <= 0 ? 'REFUNDED' : paymentStatusFor(order.total, newPaid),
        },
        $push: {
          statusHistory: {
            status: order.status,
            note: `Refund of ${amount}: ${reason}`,
            changedBy: actor.user._id,
          },
        },
      },
      { new: true, session },
    );
    if (!updated)
      throw ApiError.conflict(
        'The order was updated at the same time. Please refresh and try again.',
      );

    const [payment] = await Payment.create(
      [
        {
          paymentNumber: await nextNumber('PAY'),
          receiptNumber: await nextNumber('RFD'),
          category: PAYMENT_CATEGORIES.REFUND,
          kind: 'REFUND',
          amount: round2(amount),
          method,
          reference,
          notes: reason,
          order: order._id,
          customer: order.customer,
          receivedBy: actor.user._id,
        },
      ],
      { session },
    );
    await recordLedgerEntry(
      {
        type: TRANSACTION_TYPES.REFUND,
        amount,
        method,
        customer: order.customer,
        order: order._id,
        payment: payment._id,
        description: `Refund on ${order.orderNumber}: ${reason}`,
        createdBy: actor.user._id,
      },
      session,
    );
    if (!cancelled) await syncInvoices(updated, session);

    afterCommit(async () => {
      await audit(actor, {
        action: AUDIT_ACTIONS.REFUND,
        entity: 'Payment',
        entityId: payment._id,
        reference: order.orderNumber,
        amount,
        description: reason,
      });
      await notify.notifyCustomer(order.customer, {
        type: 'GENERAL',
        title: `Refund issued — ${order.orderNumber}`,
        message: `A refund of ${amount.toLocaleString()} has been issued.`,
        link: `/account/orders/${order._id}`,
      });
    });
    return { payment, order: updated };
  });
}

async function recordSupplierPayment(
  { supplier: supplierId, purchaseOrder: poId, amount, method, reference, notes, paidAt },
  actor,
) {
  const settings = await getSettings();
  return withTransaction(async (session, afterCommit) => {
    const supplier = await Supplier.findById(supplierId).session(session);
    if (!supplier) throw ApiError.notFound('Supplier not found.');

    let po = null;
    if (poId) {
      po = await PurchaseOrder.findOne({ _id: poId, supplier: supplier._id }).session(session);
      if (!po) throw ApiError.notFound('Purchase order not found for this supplier.');
      if (po.status === 'CANCELLED')
        throw ApiError.badRequest('Cannot pay a cancelled purchase order.');
      const outstanding = round2(po.total - po.amountPaid);
      if (amount - outstanding > EPS)
        throw ApiError.badRequest(
          `Payment exceeds the purchase order balance (${outstanding.toLocaleString()}).`,
        );
      po.amountPaid = round2(po.amountPaid + amount);
      po.paymentStatus = paymentStatusFor(po.total, po.amountPaid);
      await po.save({ session });
    } else if (amount - supplier.balance > EPS && !settings.allowOverpayment) {
      throw ApiError.badRequest(
        `Payment exceeds the amount owed to this supplier (${supplier.balance.toLocaleString()}).`,
      );
    }

    supplier.balance = round2(supplier.balance - amount);
    await supplier.save({ session });

    const [payment] = await Payment.create(
      [
        {
          paymentNumber: await nextNumber('PAY'),
          receiptNumber: await nextNumber('SPV'),
          category: PAYMENT_CATEGORIES.SUPPLIER_PAYMENT,
          kind: 'SUPPLIER',
          amount: round2(amount),
          method,
          reference,
          notes,
          paidAt: paidAt || new Date(),
          supplier: supplier._id,
          purchaseOrder: po?._id,
          receivedBy: actor.user._id,
        },
      ],
      { session },
    );
    await recordLedgerEntry(
      {
        type: TRANSACTION_TYPES.SUPPLIER_PAYMENT,
        amount,
        method,
        supplier: supplier._id,
        purchaseOrder: po?._id,
        payment: payment._id,
        date: payment.paidAt,
        description: `Payment to ${supplier.name}${po ? ` for ${po.poNumber}` : ''}`,
        createdBy: actor.user._id,
      },
      session,
    );
    afterCommit(async () => {
      await audit(actor, {
        action: AUDIT_ACTIONS.PAYMENT,
        entity: 'Payment',
        entityId: payment._id,
        reference: po?.poNumber || supplier.name,
        amount,
        description: `Supplier payment to ${supplier.name}`,
      });
      await notify.notifyFinance({
        type: 'SUPPLIER_PAYMENT',
        title: `Supplier paid: ${supplier.name}`,
        message: `${amount.toLocaleString()} via ${method.replace(/_/g, ' ').toLowerCase()}. Remaining owed: ${supplier.balance.toLocaleString()}`,
        link: `/app/suppliers/${supplier._id}`,
      });
    });
    return { payment, supplier };
  });
}

async function recordWorkerPayment(
  { worker: workerId, amount, method, kind = 'WAGE', reference, notes, paidAt, period, payPeriod },
  actor,
) {
  return withTransaction(async (session, afterCommit) => {
    const worker = await Worker.findById(workerId).populate('user', 'name').session(session);
    if (!worker) throw ApiError.notFound('Worker not found.');
    worker.totalPaid = round2((worker.totalPaid || 0) + amount);
    await worker.save({ session });

    const [payment] = await Payment.create(
      [
        {
          paymentNumber: await nextNumber('PAY'),
          receiptNumber: await nextNumber('WPV'),
          category: PAYMENT_CATEGORIES.WORKER_PAYMENT,
          kind,
          amount: round2(amount),
          method,
          reference,
          notes: [period && `Period: ${period}`, notes].filter(Boolean).join(' — '),
          paidAt: paidAt || new Date(),
          payPeriod,
          worker: worker._id,
          receivedBy: actor.user._id,
        },
      ],
      { session },
    );
    await recordLedgerEntry(
      {
        type: TRANSACTION_TYPES.WORKER_PAYMENT,
        amount,
        method,
        worker: worker._id,
        payment: payment._id,
        date: payment.paidAt,
        description: `${kind.toLowerCase()} payment to ${worker.user?.name || worker.employeeCode}${period ? ` (${period})` : ''}`,
        createdBy: actor.user._id,
      },
      session,
    );
    afterCommit(() =>
      audit(actor, {
        action: AUDIT_ACTIONS.PAYMENT,
        entity: 'Payment',
        entityId: payment._id,
        reference: worker.employeeCode,
        amount,
        description: `Worker ${kind.toLowerCase()} payment`,
      }),
    );
    return { payment, worker };
  });
}

module.exports = {
  applyCustomerPayment,
  sendBalanceReminder,
  recordCustomerPayment,
  submitCustomerPayment,
  attachCustomerReceipt,
  verifyCustomerPayment,
  recordRefund,
  recordSupplierPayment,
  recordWorkerPayment,
  syncInvoices,
};

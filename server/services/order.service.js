const { Order, Product, Customer, ProductionJob, Invoice } = require('../models');
const { nextNumber } = require('../models/Counter');
const ApiError = require('../utils/ApiError');
const { round2, calcOrderTotals, paymentStatusFor } = require('../utils/money');
const { withTransaction } = require('../utils/transaction');
const {
  ORDER_STATUS: O,
  PRODUCT_STATUS,
  PRODUCTION_STAGES: S,
  DELIVERY_METHODS,
  AUDIT_ACTIONS,
  INVENTORY_TX_TYPES,
  TRANSACTION_TYPES,
} = require('../config/constants');
const { getSettings } = require('./settings.service');
const { adjustStock, alertIfCrossed } = require('./inventory.service');
const { recordLedgerEntry } = require('./ledger.service');
const { createJobsForOrder, PRODUCTION_STARTED_STAGES } = require('./production.service');
const { audit, diff } = require('./audit.service');
const notify = require('./notification.service');

const DAY = 24 * 3600 * 1000;

const ORDER_POPULATE = [
  { path: 'customer', select: 'name email phone customerCode address user' },
  { path: 'items.product', select: 'name sku images slug' },
  { path: 'createdBy', select: 'name role' },
];

/**
 * Builds validated order lines from product ids. Prices always come from the
 * database — never from the client.
 */
async function buildItems(rawItems) {
  const ids = rawItems.map((i) => i.product);
  const products = await Product.find({ _id: { $in: ids } }).lean();
  const byId = new Map(products.map((p) => [String(p._id), p]));

  return rawItems.map((raw) => {
    const product = byId.get(String(raw.product));
    if (!product || [PRODUCT_STATUS.INACTIVE, PRODUCT_STATUS.DISCONTINUED].includes(product.status)) {
      throw ApiError.unprocessable(`Product is unavailable${product ? `: ${product.name}` : ''}.`);
    }
    const inStock = product.quantity >= raw.quantity;
    if (!inStock && !product.madeToOrder) {
      throw ApiError.conflict(`Insufficient inventory for ${product.name}. Only ${product.quantity} available.`);
    }
    if (raw.color && product.colors?.length && !product.colors.includes(raw.color)) {
      throw ApiError.badRequest(`${product.name} is not available in ${raw.color}.`);
    }
    if (raw.size && product.sizes?.length && !product.sizes.includes(raw.size)) {
      throw ApiError.badRequest(`${product.name} is not available in size ${raw.size}.`);
    }
    return {
      product: product._id,
      name: product.name,
      sku: product.sku,
      image: product.images?.[0],
      quantity: raw.quantity,
      unitPrice: product.sellingPrice,
      unitCost: product.costPrice,
      lineTotal: round2(product.sellingPrice * raw.quantity),
      color: raw.color,
      size: raw.size,
      options: raw.options,
      fulfillment: inStock ? 'STOCK' : 'PRODUCTION',
      productionDays: product.productionTimeDays || 7,
    };
  });
}

function expectedCompletion(items) {
  const needsProduction = items.some((i) => i.fulfillment === 'PRODUCTION');
  const days = needsProduction ? Math.max(...items.map((i) => (i.fulfillment === 'PRODUCTION' ? i.productionDays || 7 : 0))) : 2;
  return new Date(Date.now() + days * DAY);
}

async function createOrder(input, actor, { isStaff = false } = {}) {
  const settings = await getSettings();
  const customer = await Customer.findById(input.customer).lean();
  if (!customer) throw ApiError.notFound('Customer not found.');

  const items = await buildItems(input.items);
  const deliveryMethod = input.deliveryMethod || DELIVERY_METHODS.DELIVERY;
  // Customers cannot set their own discount or delivery fee.
  const discount = isStaff ? input.discount || 0 : 0;
  const deliveryFee =
    deliveryMethod === DELIVERY_METHODS.PICKUP ? 0 : isStaff && input.deliveryFee !== undefined ? input.deliveryFee : settings.defaultDeliveryFee;

  const taxRate = settings.taxRate || 0;
  const { subtotal, tax, total, balance } = calcOrderTotals({ items, discount, deliveryFee, taxRate });
  if (discount > subtotal) throw ApiError.badRequest('Discount cannot exceed the order subtotal.');

  // Staff orders belong to the chosen branch or the staff member's branch; online orders to the default branch.
  const branch = (isStaff && (input.branch || actor.user?.branch)) || settings.defaultBranch || null;

  const order = await Order.create({
    orderNumber: await nextNumber('WO'),
    customer: customer._id,
    branch,
    items: items.map(({ productionDays, ...rest }) => rest),
    subtotal,
    discount,
    deliveryFee,
    taxRate,
    tax,
    total,
    depositRequired: round2((total * settings.depositPercent) / 100),
    amountPaid: 0,
    balance,
    paymentStatus: 'UNPAID',
    status: O.PENDING,
    productionStatus: items.some((i) => i.fulfillment === 'PRODUCTION') ? S.PENDING : 'NOT_REQUIRED',
    deliveryMethod,
    deliveryAddress: deliveryMethod === DELIVERY_METHODS.DELIVERY ? input.deliveryAddress || customer.address : undefined,
    contactPhone: input.contactPhone || customer.phone,
    expectedCompletionDate: expectedCompletion(items),
    notes: input.notes,
    internalNotes: isStaff ? input.internalNotes : undefined,
    source: isStaff ? 'STAFF' : 'ONLINE',
    statusHistory: [{ status: O.PENDING, note: 'Order placed', changedBy: actor.user?._id }],
    createdBy: actor.user?._id,
  });

  await audit(actor, {
    action: AUDIT_ACTIONS.CREATE,
    entity: 'Order',
    entityId: order._id,
    reference: order.orderNumber,
    amount: order.total,
    description: `Order created for ${customer.name}`,
  });
  await notify.notifyOwners({
    type: 'NEW_ORDER',
    title: `New order ${order.orderNumber}`,
    message: `${customer.name} placed an order worth ${order.total.toLocaleString()} ${settings.currency}.`,
    link: `/app/orders/${order._id}`,
  });
  await notify.notifyCustomer(customer._id, {
    type: 'GENERAL',
    title: `Order ${order.orderNumber} received`,
    message: `Thank you! Pay the deposit of ${order.depositRequired.toLocaleString()} ${settings.currency} to confirm your order.`,
    link: `/account/orders/${order._id}`,
  });
  if (input.autoConfirm && isStaff) return confirmOrder(order._id, actor);
  return order;
}

/**
 * Confirms a pending order inside an existing transaction: reserves finished stock,
 * creates production jobs for everything else and books the sale.
 */
async function confirmOrderInTransaction(order, { session, actor, afterCommit, note }) {
  if (order.status !== O.PENDING) throw ApiError.badRequest('Only pending orders can be confirmed.');

  for (const item of order.items) {
    if (item.fulfillment !== 'STOCK' || item.stockDeducted) continue;
    try {
      const result = await adjustStock({
        itemType: 'PRODUCT',
        itemId: item.product,
        delta: -item.quantity,
        type: INVENTORY_TX_TYPES.SALE,
        reference: { model: 'Order', id: order._id, number: order.orderNumber },
        note: `Sold on ${order.orderNumber}`,
        userId: actor.user?._id,
        session,
      });
      alertIfCrossed(result, 'PRODUCT', afterCommit);
      item.stockDeducted = true;
    } catch (err) {
      if (err.statusCode !== 409) throw err;
      // Stock ran out since the order was placed: build it instead, if the product allows it.
      const product = await Product.findById(item.product).select('madeToOrder name').session(session).lean();
      if (!product?.madeToOrder) throw err;
      item.fulfillment = 'PRODUCTION';
    }
  }

  const jobs = await createJobsForOrder(order, { session, actor, afterCommit });
  const needsProduction = order.items.some((i) => i.fulfillment === 'PRODUCTION');

  order.productionStatus = needsProduction ? S.PENDING : 'NOT_REQUIRED';
  order.status = needsProduction ? O.CONFIRMED : O.READY;
  order.statusHistory.push({ status: O.CONFIRMED, note: note || 'Order confirmed', changedBy: actor.user?._id });
  if (!needsProduction) {
    order.statusHistory.push({ status: O.READY, note: 'All items available from stock', changedBy: actor.user?._id });
  } else if (order.paymentStatus === 'PAID') {
    order.status = O.PAID;
  }
  await order.save({ session });

  await recordLedgerEntry(
    {
      type: TRANSACTION_TYPES.SALE,
      amount: order.total,
      customer: order.customer,
      order: order._id,
      description: `Sale ${order.orderNumber}`,
      createdBy: actor.user?._id,
    },
    session
  );

  afterCommit(async () => {
    await audit(actor, {
      action: AUDIT_ACTIONS.STATUS_CHANGE,
      entity: 'Order',
      entityId: order._id,
      reference: order.orderNumber,
      description: `Order confirmed${jobs.length ? ` — ${jobs.length} production job(s) created` : ''}`,
    });
    await notify.notifyCustomer(order.customer, {
      type: 'ORDER_CONFIRMED',
      title: `Order ${order.orderNumber} confirmed`,
      message: needsProduction
        ? 'Your order is confirmed and has been scheduled for production.'
        : 'Your order is confirmed and ready for delivery/pickup once fully paid.',
      link: `/account/orders/${order._id}`,
    });
  });
  return order;
}

async function confirmOrder(orderId, actor, note) {
  return withTransaction(async (session, afterCommit) => {
    const order = await Order.findById(orderId).session(session);
    if (!order) throw ApiError.notFound('Order not found.');
    return confirmOrderInTransaction(order, { session, actor, afterCommit, note });
  });
}

async function productionHasStarted(orderId, session) {
  const jobs = await ProductionJob.find({ order: orderId, stage: { $ne: S.CANCELLED } }).session(session).lean();
  return jobs.some(
    (j) => PRODUCTION_STARTED_STAGES.includes(j.stage) || (j.requiredMaterials || []).some((m) => m.quantityIssued > 0)
  );
}

async function cancelOrder(orderId, { reason }, actor, { asCustomer = false } = {}) {
  return withTransaction(async (session, afterCommit) => {
    const order = await Order.findById(orderId).session(session);
    if (!order) throw ApiError.notFound('Order not found.');
    if ([O.CANCELLED, O.COMPLETED, O.DELIVERED, O.OUT_FOR_DELIVERY].includes(order.status)) {
      throw ApiError.badRequest(`An order that is ${order.status.toLowerCase().replace(/_/g, ' ')} cannot be cancelled.`);
    }
    if (asCustomer && order.status !== O.PENDING) {
      throw ApiError.badRequest('Confirmed orders can only be cancelled by contacting us.');
    }
    if (await productionHasStarted(order._id, session)) {
      throw ApiError.badRequest('Order cannot be cancelled after production has started.');
    }

    for (const item of order.items) {
      if (!item.stockDeducted) continue;
      await adjustStock({
        itemType: 'PRODUCT',
        itemId: item.product,
        delta: item.quantity,
        type: INVENTORY_TX_TYPES.RETURN,
        reference: { model: 'Order', id: order._id, number: order.orderNumber },
        note: `Order ${order.orderNumber} cancelled`,
        userId: actor.user?._id,
        session,
      });
      item.stockDeducted = false;
    }
    await ProductionJob.updateMany(
      { order: order._id, stage: { $ne: S.CANCELLED } },
      { $set: { stage: S.CANCELLED, progress: 0 }, $push: { stageHistory: { to: S.CANCELLED, by: actor.user?._id, note: 'Order cancelled' } } },
      { session }
    );

    order.status = O.CANCELLED;
    order.productionStatus = S.CANCELLED;
    order.cancelledAt = new Date();
    order.cancellationReason = reason;
    // Nothing more is owed on a cancelled order; money already paid is handled by a refund.
    order.balance = 0;
    order.statusHistory.push({ status: O.CANCELLED, note: reason, changedBy: actor.user?._id });
    await order.save({ session });
    await Invoice.updateMany({ order: order._id, status: { $ne: 'VOID' } }, { $set: { status: 'VOID', balance: 0 } }, { session });

    afterCommit(async () => {
      await audit(actor, {
        action: AUDIT_ACTIONS.STATUS_CHANGE,
        entity: 'Order',
        entityId: order._id,
        reference: order.orderNumber,
        description: `Order cancelled: ${reason || 'no reason given'}`,
      });
      await notify.notifyOwners({
        type: 'GENERAL',
        title: `Order ${order.orderNumber} cancelled`,
        message: `${reason || 'No reason given'}${order.amountPaid > 0 ? ` — ${order.amountPaid.toLocaleString()} already paid may need a refund.` : ''}`,
        link: `/app/orders/${order._id}`,
      });
      if (!asCustomer) {
        await notify.notifyCustomer(order.customer, {
          type: 'GENERAL',
          title: `Order ${order.orderNumber} cancelled`,
          message: reason || 'Your order has been cancelled.',
          link: `/account/orders/${order._id}`,
        });
      }
    });
    return order;
  });
}

/** Applies (or changes) the order discount. The new total may not drop below what was already paid. */
async function applyDiscount(orderId, { discount, reason }, actor) {
  return withTransaction(async (session, afterCommit) => {
    const order = await Order.findById(orderId).session(session);
    if (!order) throw ApiError.notFound('Order not found.');
    if ([O.CANCELLED, O.COMPLETED].includes(order.status)) throw ApiError.badRequest('This order can no longer be changed.');
    if (discount > order.subtotal) throw ApiError.badRequest('Discount cannot exceed the order subtotal.');

    const previous = order.discount;
    const { tax, total, balance } = calcOrderTotals({ items: order.items, discount, deliveryFee: order.deliveryFee, amountPaid: order.amountPaid, taxRate: order.taxRate });
    if (total < order.amountPaid) throw ApiError.badRequest('Discount would make the total lower than the amount already paid.');

    order.discount = discount;
    order.tax = tax;
    order.total = total;
    order.balance = balance;
    order.paymentStatus = paymentStatusFor(total, order.amountPaid);
    order.statusHistory.push({ status: order.status, note: `Discount changed ${previous} → ${discount}: ${reason}`, changedBy: actor.user._id });
    await order.save({ session });
    await Invoice.updateMany(
      { order: order._id, status: { $ne: 'VOID' } },
      { $set: { discount, tax, total, balance, status: balance <= 0 ? 'PAID' : order.amountPaid > 0 ? 'PARTIALLY_PAID' : 'ISSUED' } },
      { session }
    );
    await recordLedgerEntry(
      {
        type: TRANSACTION_TYPES.DISCOUNT,
        amount: Math.abs(discount - previous),
        customer: order.customer,
        order: order._id,
        description: `Discount on ${order.orderNumber} changed from ${previous} to ${discount}: ${reason}`,
        createdBy: actor.user._id,
      },
      session
    );
    afterCommit(() =>
      audit(actor, {
        action: AUDIT_ACTIONS.UPDATE,
        entity: 'Order',
        entityId: order._id,
        reference: order.orderNumber,
        amount: discount,
        description: `Discount applied: ${reason}`,
        changes: { discount: { from: previous, to: discount } },
      })
    );
    return order;
  });
}

/**
 * Replaces the items of a pending order. Once an order is confirmed, stock and
 * production depend on its items, so it must be cancelled and re-placed instead.
 */
async function updateOrderItems(orderId, { items: rawItems, reason }, actor) {
  const order = await Order.findById(orderId);
  if (!order) throw ApiError.notFound('Order not found.');
  if (order.status !== O.PENDING) throw ApiError.badRequest('Items can only be changed while the order is pending. Cancel and re-create confirmed orders.');

  const items = await buildItems(rawItems);
  const { subtotal, tax, total, balance } = calcOrderTotals({
    items,
    discount: order.discount,
    deliveryFee: order.deliveryFee,
    amountPaid: order.amountPaid,
    taxRate: order.taxRate,
  });
  if (order.discount > subtotal) throw ApiError.badRequest('The existing discount is larger than the new subtotal. Reduce the discount first.');
  if (total < order.amountPaid) throw ApiError.badRequest('The new total would be lower than the amount already paid.');

  const settings = await getSettings();
  const before = order.items.map((i) => `${i.name} × ${i.quantity}`).join(', ');
  order.items = items.map(({ productionDays, ...rest }) => rest);
  order.subtotal = subtotal;
  order.tax = tax;
  order.total = total;
  order.balance = balance;
  order.depositRequired = round2((total * settings.depositPercent) / 100);
  order.paymentStatus = paymentStatusFor(total, order.amountPaid);
  order.productionStatus = items.some((i) => i.fulfillment === 'PRODUCTION') ? S.PENDING : 'NOT_REQUIRED';
  order.expectedCompletionDate = expectedCompletion(items);
  order.statusHistory.push({ status: order.status, note: `Items changed: ${reason}`, changedBy: actor.user._id });
  await order.save();
  await Invoice.updateMany(
    { order: order._id, status: { $ne: 'VOID' } },
    { $set: { status: 'VOID', notes: 'Voided: order items changed' } }
  );

  await audit(actor, {
    action: AUDIT_ACTIONS.UPDATE,
    entity: 'Order',
    entityId: order._id,
    reference: order.orderNumber,
    amount: total,
    description: `Items changed: ${reason}`,
    changes: { items: { from: before, to: order.items.map((i) => `${i.name} × ${i.quantity}`).join(', ') } },
  });
  await notify.notifyCustomer(order.customer, {
    type: 'GENERAL',
    title: `Order ${order.orderNumber} updated`,
    message: `Your order was updated. New total: ${total.toLocaleString()} ${settings.currency}.`,
    link: `/account/orders/${order._id}`,
  });
  return order;
}

// Manual lifecycle moves staff may make; everything else happens automatically.
const MANUAL_TRANSITIONS = {
  [O.CONFIRMED]: [O.READY],
  [O.PAID]: [O.READY],
  [O.IN_PRODUCTION]: [O.READY],
  [O.READY]: [O.DELIVERED],
  [O.DELIVERED]: [O.COMPLETED],
};

async function changeStatus(orderId, { status, note }, actor) {
  if (status === O.CONFIRMED) return confirmOrder(orderId, actor, note);
  if (status === O.CANCELLED) return cancelOrder(orderId, { reason: note }, actor);

  return withTransaction(async (session, afterCommit) => {
    const order = await Order.findById(orderId).session(session);
    if (!order) throw ApiError.notFound('Order not found.');
    const allowed = MANUAL_TRANSITIONS[order.status] || [];
    if (!allowed.includes(status)) throw ApiError.badRequest(`Cannot change order status from ${order.status} to ${status}.`);

    if (status === O.READY) {
      const openJobs = await ProductionJob.countDocuments({
        order: order._id,
        stage: { $nin: [S.READY_FOR_DELIVERY, S.DELIVERED, S.CANCELLED] },
      }).session(session);
      if (openJobs) throw ApiError.badRequest('Some items are still in production or quality control.');
    }
    if (status === O.DELIVERED) {
      if (order.deliveryMethod !== DELIVERY_METHODS.PICKUP) {
        throw ApiError.badRequest('Delivery orders are completed from the Deliveries module.');
      }
      const settings = await getSettings();
      if (settings.requireFullPaymentBeforeDelivery && order.balance > 0) {
        throw ApiError.badRequest('The remaining balance must be paid before the furniture is handed over.');
      }
      order.deliveryStatus = 'DELIVERED';
      await ProductionJob.updateMany(
        { order: order._id, stage: S.READY_FOR_DELIVERY },
        { $set: { stage: S.DELIVERED, progress: 100 } },
        { session }
      );
    }
    if (status === O.COMPLETED && order.balance > 0) {
      throw ApiError.badRequest('Order cannot be completed while a balance is outstanding.');
    }

    const from = order.status;
    order.status = status;
    order.statusHistory.push({ status, note, changedBy: actor.user._id });
    if (status === O.DELIVERED && order.balance <= 0) {
      order.status = O.COMPLETED;
      order.completedAt = new Date();
      order.statusHistory.push({ status: O.COMPLETED, note: 'Collected and fully paid', changedBy: actor.user._id });
    }
    if (status === O.COMPLETED) order.completedAt = new Date();
    await order.save({ session });

    afterCommit(async () => {
      await audit(actor, {
        action: AUDIT_ACTIONS.STATUS_CHANGE,
        entity: 'Order',
        entityId: order._id,
        reference: order.orderNumber,
        description: `Status ${from} → ${order.status}`,
      });
      if ([O.READY, O.DELIVERED, O.COMPLETED].includes(status)) {
        await notify.notifyCustomer(order.customer, {
          type: status === O.READY ? 'READY_FOR_DELIVERY' : 'DELIVERED',
          title: `Order ${order.orderNumber} ${status === O.READY ? 'is ready' : 'handed over'}`,
          message: status === O.READY ? 'Your furniture is ready.' : 'Thank you for choosing Wan Ofi Furniture!',
          link: `/account/orders/${order._id}`,
        });
      }
    });
    return order;
  });
}

async function updateOrderDetails(orderId, changes, actor) {
  const order = await Order.findById(orderId);
  if (!order) throw ApiError.notFound('Order not found.');
  if ([O.CANCELLED, O.COMPLETED].includes(order.status)) throw ApiError.badRequest('This order can no longer be changed.');
  const before = order.toObject();
  ['notes', 'internalNotes', 'expectedCompletionDate', 'deliveryAddress', 'contactPhone'].forEach((k) => {
    if (changes[k] !== undefined) order[k] = changes[k];
  });
  await order.save();
  await audit(actor, {
    action: AUDIT_ACTIONS.UPDATE,
    entity: 'Order',
    entityId: order._id,
    reference: order.orderNumber,
    changes: diff(before, order.toObject(), ['notes', 'internalNotes', 'expectedCompletionDate', 'contactPhone']),
  });
  return order;
}

module.exports = {
  ORDER_POPULATE,
  buildItems,
  createOrder,
  confirmOrder,
  confirmOrderInTransaction,
  cancelOrder,
  applyDiscount,
  changeStatus,
  updateOrderDetails,
  updateOrderItems,
  productionHasStarted,
};

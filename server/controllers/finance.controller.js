const { Payment, Invoice, Expense, FinancialTransaction, Order } = require('../models');
const crypto = require('crypto');
const env = require('../config/env');
const paymentService = require('../services/payment.service');
const onlinePayments = require('../services/onlinePayment.service');
const invoiceService = require('../services/invoice.service');
const expenseService = require('../services/expense.service');
const { recordLedgerEntry } = require('../services/ledger.service');
const { getSettings, customerBankAccounts } = require('../services/settings.service');
const { audit, actorFrom } = require('../services/audit.service');
const { asyncHandler, sendSuccess, sendCreated } = require('../utils/http');
const { paginate, pickFilters, dateRangeFilter, searchFilter } = require('../utils/query');
const ApiError = require('../utils/ApiError');
const { assertFound, customerOf, isCustomer, assertVerifiedCustomer } = require('./helpers');
const { AUDIT_ACTIONS, TRANSACTION_TYPES } = require('../config/constants');

// ---------- Payments ----------
exports.listPayments = asyncHandler(async (req, res) => {
  const filter = {
    ...pickFilters(
      req.query,
      ['category', 'method', 'status', 'kind', 'order', 'customer', 'supplier', 'worker'],
      ['order', 'customer', 'supplier', 'worker'],
    ),
    ...dateRangeFilter('paidAt', req.query.from, req.query.to),
    ...searchFilter(req.query.search, ['paymentNumber', 'receiptNumber', 'reference']),
  };
  if (isCustomer(req)) {
    filter.customer = (await customerOf(req))._id;
    filter.category = { $in: ['CUSTOMER_PAYMENT', 'REFUND'] };
  }
  const { items, pagination } = await paginate(Payment, filter, req.query, {
    populate: [
      { path: 'order', select: 'orderNumber' },
      { path: 'customer', select: 'name' },
      { path: 'supplier', select: 'name' },
      { path: 'worker', select: 'employeeCode user', populate: { path: 'user', select: 'name' } },
      { path: 'receivedBy', select: 'name' },
    ],
    allowedSort: ['paidAt', 'amount'],
    sort: { paidAt: -1 },
  });
  sendSuccess(res, {
    data: isCustomer(req) ? items.map(({ receivedBy, worker, supplier, ...p }) => p) : items,
    pagination,
  });
});

// Payment receipt (customers can open their own).
exports.getPayment = asyncHandler(async (req, res) => {
  const filter = { _id: req.params.id };
  if (isCustomer(req)) filter.customer = (await customerOf(req))._id;
  const payment = assertFound(
    await Payment.findOne(filter)
      .populate('order', 'orderNumber total amountPaid balance')
      .populate('customer', 'name phone email address')
      .populate('supplier', 'name phone')
      .populate({
        path: 'worker',
        select: 'employeeCode user',
        populate: { path: 'user', select: 'name' },
      })
      .populate('receivedBy', 'name')
      .populate('purchaseOrder', 'poNumber')
      .lean(),
    'Payment not found.',
  );
  sendSuccess(res, { data: { ...payment, company: await companyInfo() } });
});

exports.recordCustomerPayment = asyncHandler(async (req, res) => {
  const { payment, order } = await paymentService.recordCustomerPayment(req.body, actorFrom(req));
  sendCreated(
    res,
    { payment, order },
    `Payment recorded. Remaining balance: ${order.balance.toLocaleString()}`,
  );
});

exports.submitPayment = asyncHandler(async (req, res) => {
  await assertVerifiedCustomer(req);
  const customer = await customerOf(req);
  // The receipt can be attached now or later (POST /payments/:id/receipt).
  const screenshot = req.uploadedFiles?.[0];
  const payment = await paymentService.submitCustomerPayment(
    { ...req.body, screenshot },
    customer._id,
    actorFrom(req),
  );
  sendCreated(
    res,
    payment,
    'Payment submitted. It will reflect on your order once our accounts team verifies it.',
  );
});

exports.attachReceipt = asyncHandler(async (req, res) => {
  await assertVerifiedCustomer(req);
  const customer = await customerOf(req);
  const screenshot = req.uploadedFiles?.[0];
  if (!screenshot) throw ApiError.badRequest('Please attach a photo or screenshot of your payment receipt.');
  const payment = await paymentService.attachCustomerReceipt(req.params.id, screenshot, customer._id, actorFrom(req));
  sendSuccess(res, { data: payment, message: 'Receipt uploaded. Our accounts team will check it shortly.' });
});

exports.initiateMobilePayment = asyncHandler(async (req, res) => {
  await assertVerifiedCustomer(req);
  const customer = await customerOf(req);
  const intent = await onlinePayments.initiatePayment(req.body, customer, req.user);
  sendCreated(res, intent, 'Check your phone and enter your PIN to approve the payment.');
});

exports.getMobilePayment = asyncHandler(async (req, res) => {
  const customerId = isCustomer(req) ? (await customerOf(req))._id : undefined;
  sendSuccess(res, { data: await onlinePayments.getIntent(req.params.reference, customerId) });
});

/** Provider callback. The shared secret in the URL proves the call comes from our registered callback. */
exports.paymentWebhook = asyncHandler(async (req, res) => {
  const expected = Buffer.from(env.PAYMENT_WEBHOOK_SECRET || '');
  const given = Buffer.from(String(req.params.secret || ''));
  if (
    !expected.length ||
    expected.length !== given.length ||
    !crypto.timingSafeEqual(expected, given)
  )
    throw ApiError.notFound('Route not found.');
  const intent = await onlinePayments.handleCallback(req.params.gateway, req.body);
  sendSuccess(res, { data: { reference: intent.reference, status: intent.status } });
});

exports.verifyPayment = asyncHandler(async (req, res) => {
  const result = await paymentService.verifyCustomerPayment(
    req.params.id,
    req.body,
    actorFrom(req),
  );
  sendSuccess(res, {
    data: result,
    message: req.body.approve ? 'Payment verified and applied' : 'Payment rejected',
  });
});

exports.recordSupplierPayment = asyncHandler(async (req, res) => {
  sendCreated(
    res,
    await paymentService.recordSupplierPayment(req.body, actorFrom(req)),
    'Supplier payment recorded',
  );
});

exports.recordWorkerPayment = asyncHandler(async (req, res) => {
  sendCreated(
    res,
    await paymentService.recordWorkerPayment(req.body, actorFrom(req)),
    'Worker payment recorded',
  );
});

exports.recordRefund = asyncHandler(async (req, res) => {
  sendCreated(res, await paymentService.recordRefund(req.body, actorFrom(req)), 'Refund recorded');
});

// ---------- Invoices ----------
async function companyInfo() {
  const s = await getSettings();
  return {
    name: s.companyName,
    email: s.companyEmail,
    phone: s.companyPhone,
    address: s.companyAddress,
    currency: s.currency,
    paymentInstructions: s.paymentInstructions,
    bankAccounts: customerBankAccounts(s),
  };
}

exports.listInvoices = asyncHandler(async (req, res) => {
  const filter = {
    ...pickFilters(req.query, ['status', 'customer', 'order'], ['customer', 'order']),
    ...dateRangeFilter('issueDate', req.query.from, req.query.to),
    ...searchFilter(req.query.search, ['invoiceNumber']),
  };
  if (isCustomer(req)) filter.customer = (await customerOf(req))._id;
  if (req.query.overdue === 'true') {
    filter.status = { $in: ['ISSUED', 'PARTIALLY_PAID'] };
    filter.dueDate = { $lt: new Date() };
  }
  const { items, pagination } = await paginate(Invoice, filter, req.query, {
    populate: [
      { path: 'customer', select: 'name' },
      { path: 'order', select: 'orderNumber' },
    ],
    allowedSort: ['issueDate', 'dueDate', 'total', 'balance'],
    sort: { issueDate: -1 },
  });
  sendSuccess(res, { data: items, pagination });
});

exports.getInvoice = asyncHandler(async (req, res) => {
  const filter = { _id: req.params.id };
  if (isCustomer(req)) filter.customer = (await customerOf(req))._id;
  const invoice = assertFound(
    await Invoice.findOne(filter)
      .populate('customer', 'name phone email address customerCode')
      .populate('order', 'orderNumber orderDate deliveryAddress')
      .lean(),
    'Invoice not found.',
  );
  const payments = await Payment.find({
    order: invoice.order._id,
    status: 'COMPLETED',
    category: 'CUSTOMER_PAYMENT',
  })
    .select('receiptNumber paidAt amount method')
    .sort({ paidAt: 1 })
    .lean();
  sendSuccess(res, { data: { ...invoice, payments, company: await companyInfo() } });
});

exports.createInvoice = asyncHandler(async (req, res) => {
  const invoice = await invoiceService.issueInvoice(req.body.order, req.body, actorFrom(req));
  sendCreated(res, invoice, 'Invoice issued');
});

// Customers can generate the invoice for their own order.
exports.customerInvoice = asyncHandler(async (req, res) => {
  const customer = await customerOf(req);
  assertFound(
    await Order.exists({ _id: req.body.order, customer: customer._id }),
    'Order not found.',
  );
  const invoice = await invoiceService.issueInvoice(req.body.order, {}, null);
  sendSuccess(res, { data: invoice });
});

exports.voidInvoice = asyncHandler(async (req, res) => {
  sendSuccess(res, {
    data: await invoiceService.voidInvoice(req.params.id, req.body.reason, actorFrom(req)),
    message: 'Invoice voided',
  });
});

// ---------- Expenses ----------
exports.listExpenses = asyncHandler(async (req, res) => {
  const filter = {
    ...pickFilters(req.query, ['category', 'status', 'method', 'branch'], ['branch']),
    ...dateRangeFilter('date', req.query.from, req.query.to),
    ...searchFilter(req.query.search, ['expenseNumber', 'description', 'vendor']),
  };
  const { items, pagination } = await paginate(Expense, filter, req.query, {
    populate: [
      { path: 'createdBy', select: 'name' },
      { path: 'approvedBy', select: 'name' },
      { path: 'branch', select: 'name code' },
    ],
    allowedSort: ['date', 'amount'],
    sort: { date: -1 },
  });
  sendSuccess(res, { data: items, pagination });
});

exports.getExpense = asyncHandler(async (req, res) => {
  const expense = assertFound(
    await Expense.findById(req.params.id).populate('createdBy approvedBy', 'name').lean(),
    'Expense not found.',
  );
  sendSuccess(res, { data: expense });
});

exports.createExpense = asyncHandler(async (req, res) => {
  const expense = await expenseService.createExpense(
    { ...req.body, receiptImage: req.uploadedFiles?.[0] },
    actorFrom(req),
  );
  sendCreated(
    res,
    expense,
    expense.status === 'PENDING' ? 'Expense submitted for owner approval' : 'Expense recorded',
  );
});

exports.updateExpense = asyncHandler(async (req, res) => {
  sendSuccess(res, {
    data: await expenseService.updateExpense(req.params.id, req.body, actorFrom(req)),
    message: 'Expense updated',
  });
});

exports.decideExpense = asyncHandler(async (req, res) => {
  const expense = await expenseService.decideExpense(req.params.id, req.body, actorFrom(req));
  sendSuccess(res, { data: expense, message: `Expense ${expense.status.toLowerCase()}` });
});

exports.deleteExpense = asyncHandler(async (req, res) => {
  await expenseService.deleteExpense(req.params.id, actorFrom(req));
  sendSuccess(res, { message: 'Expense removed' });
});

// ---------- Ledger ----------
exports.listTransactions = asyncHandler(async (req, res) => {
  const filter = {
    ...pickFilters(
      req.query,
      ['type', 'direction', 'method', 'customer', 'order', 'supplier'],
      ['customer', 'order', 'supplier'],
    ),
    ...dateRangeFilter('date', req.query.from, req.query.to),
    ...searchFilter(req.query.search, ['transactionNumber', 'description']),
  };
  const { items, pagination } = await paginate(FinancialTransaction, filter, req.query, {
    populate: [
      { path: 'customer', select: 'name' },
      { path: 'order', select: 'orderNumber' },
      { path: 'supplier', select: 'name' },
      { path: 'createdBy', select: 'name' },
    ],
    allowedSort: ['date', 'amount'],
    sort: { date: -1 },
  });
  sendSuccess(res, { data: items, pagination });
});

exports.recordOtherIncome = asyncHandler(async (req, res) => {
  const entry = await recordLedgerEntry(
    {
      ...req.body,
      type: TRANSACTION_TYPES.OTHER_INCOME,
      customer: req.body.customer || undefined,
      createdBy: req.user._id,
    },
    null,
  );
  await audit(actorFrom(req), {
    action: AUDIT_ACTIONS.CREATE,
    entity: 'FinancialTransaction',
    entityId: entry._id,
    reference: entry.transactionNumber,
    amount: entry.amount,
    description: entry.description,
  });
  sendCreated(res, entry, 'Income recorded');
});

exports.companyInfo = companyInfo;

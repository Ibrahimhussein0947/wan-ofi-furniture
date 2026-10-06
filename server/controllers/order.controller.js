const { Order, Payment, Invoice, Delivery, ProductionJob } = require('../models');
const orderService = require('../services/order.service');
const paymentService = require('../services/payment.service');
const productionService = require('../services/production.service');
const { actorFrom } = require('../services/audit.service');
const { asyncHandler, sendSuccess, sendCreated } = require('../utils/http');
const { paginate, searchFilter, pickFilters, dateRangeFilter } = require('../utils/query');
const { assertFound, customerOf, isCustomer, assertVerifiedCustomer } = require('./helpers');

// Internal fields hidden from customers.
function toCustomerOrder(order) {
  const { internalNotes, createdBy, ...rest } = order;
  return {
    ...rest,
    items: (rest.items || []).map(({ unitCost, ...item }) => item),
    statusHistory: (rest.statusHistory || []).map(({ status, changedAt, note }) => ({ status, changedAt, note: /refund|discount/i.test(note || '') ? note : undefined })),
  };
}

exports.list = asyncHandler(async (req, res) => {
  const filter = {
    ...pickFilters(req.query, ['status', 'paymentStatus', 'deliveryStatus', 'orderType', 'customer', 'branch'], ['customer', 'branch']),
    ...dateRangeFilter('orderDate', req.query.from, req.query.to),
  };
  if (isCustomer(req)) filter.customer = (await customerOf(req))._id;
  if (req.query.search) Object.assign(filter, searchFilter(req.query.search, ['orderNumber', 'items.name', 'contactPhone']));
  if (req.query.withBalance === 'true') filter.balance = { $gt: 0 };

  const { items, pagination } = await paginate(Order, filter, req.query, {
    populate: [
      { path: 'customer', select: 'name phone customerCode' },
      { path: 'branch', select: 'name code' },
    ],
    allowedSort: ['orderDate', 'total', 'balance', 'orderNumber', 'expectedCompletionDate'],
    sort: { orderDate: -1 },
  });
  sendSuccess(res, { data: isCustomer(req) ? items.map(toCustomerOrder) : items, pagination });
});

exports.get = asyncHandler(async (req, res) => {
  const filter = { _id: req.params.id };
  if (isCustomer(req)) filter.customer = (await customerOf(req))._id;
  const order = assertFound(await Order.findOne(filter).populate(orderService.ORDER_POPULATE).populate('branch', 'name code address phone').populate('statusHistory.changedBy', 'name').lean(), 'Order not found.');

  const [payments, invoices, deliveries, production] = await Promise.all([
    Payment.find({ order: order._id }).sort({ paidAt: -1 }).populate('receivedBy', 'name').lean(),
    Invoice.find({ order: order._id }).sort({ issueDate: -1 }).lean(),
    Delivery.find({ order: order._id }).sort({ createdAt: -1 }).populate('deliveryPerson', 'name phone').lean(),
    isCustomer(req)
      ? productionService.customerProgress(order._id)
      : ProductionJob.find({ order: order._id }).select('jobNumber title stage progress assignedWorkers expectedCompletionDate qcStatus').populate('assignedWorkers', 'name').lean(),
  ]);

  const data = isCustomer(req)
    ? { ...toCustomerOrder(order), payments: payments.map(({ receivedBy, notes, ...p }) => p), invoices, deliveries: deliveries.map(({ history, createdBy, ...d }) => d), production }
    : { ...order, payments, invoices, deliveries, production };
  sendSuccess(res, { data });
});

exports.createByCustomer = asyncHandler(async (req, res) => {
  await assertVerifiedCustomer(req);
  const customer = await customerOf(req);
  const order = await orderService.createOrder({ ...req.body, customer: customer._id }, actorFrom(req), { isStaff: false });
  sendCreated(res, toCustomerOrder(order.toObject()), 'Order placed successfully');
});

exports.createByStaff = asyncHandler(async (req, res) => {
  const order = await orderService.createOrder(req.body, actorFrom(req), { isStaff: true });
  sendCreated(res, order, 'Order created');
});

exports.update = asyncHandler(async (req, res) => {
  sendSuccess(res, { data: await orderService.updateOrderDetails(req.params.id, req.body, actorFrom(req)), message: 'Order updated' });
});

exports.updateItems = asyncHandler(async (req, res) => {
  sendSuccess(res, { data: await orderService.updateOrderItems(req.params.id, req.body, actorFrom(req)), message: 'Order items updated' });
});

exports.changeStatus = asyncHandler(async (req, res) => {
  const order = await orderService.changeStatus(req.params.id, req.body, actorFrom(req));
  sendSuccess(res, { data: order, message: `Order ${order.status.toLowerCase().replace(/_/g, ' ')}` });
});

exports.confirm = asyncHandler(async (req, res) => {
  sendSuccess(res, { data: await orderService.confirmOrder(req.params.id, actorFrom(req), req.body?.note), message: 'Order confirmed' });
});

exports.cancel = asyncHandler(async (req, res) => {
  if (isCustomer(req)) {
    const customer = await customerOf(req);
    assertFound(await Order.exists({ _id: req.params.id, customer: customer._id }), 'Order not found.');
  }
  const order = await orderService.cancelOrder(req.params.id, req.body, actorFrom(req), { asCustomer: isCustomer(req) });
  sendSuccess(res, { data: isCustomer(req) ? toCustomerOrder(order.toObject()) : order, message: 'Order cancelled' });
});

exports.discount = asyncHandler(async (req, res) => {
  sendSuccess(res, { data: await orderService.applyDiscount(req.params.id, req.body, actorFrom(req)), message: 'Discount applied' });
});

/** Sends the customer a reminder of what is still owed on the order. */
exports.remindBalance = asyncHandler(async (req, res) => {
  const result = await paymentService.sendBalanceReminder(req.params.id, actorFrom(req));
  sendSuccess(res, { data: result, message: 'Reminder sent to the customer' });
});

exports.toCustomerOrder = toCustomerOrder;

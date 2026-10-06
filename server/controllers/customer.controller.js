const mongoose = require('mongoose');
const { Customer, Order, Payment, Invoice, CustomFurnitureRequest } = require('../models');
const { nextNumber } = require('../models/Counter');
const { audit, actorFrom, diff } = require('../services/audit.service');
const { asyncHandler, sendSuccess, sendCreated } = require('../utils/http');
const { paginate, searchFilter, pickFilters } = require('../utils/query');
const { round2 } = require('../utils/money');
const ApiError = require('../utils/ApiError');
const { assertFound } = require('./helpers');
const { AUDIT_ACTIONS, ORDER_STATUS } = require('../config/constants');

async function balancesFor(customerIds) {
  const rows = await Order.aggregate([
    { $match: { customer: { $in: customerIds }, status: { $ne: ORDER_STATUS.CANCELLED } } },
    {
      $group: {
        _id: '$customer',
        balance: { $sum: '$balance' },
        spent: { $sum: '$total' },
        paid: { $sum: '$amountPaid' },
        orders: { $sum: 1 },
      },
    },
  ]);
  return new Map(rows.map((r) => [String(r._id), r]));
}

exports.list = asyncHandler(async (req, res) => {
  const filter = {
    ...pickFilters(req.query, ['source']),
    ...searchFilter(req.query.search, ['name', 'email', 'phone', 'customerCode', 'company']),
  };
  if (req.query.withDebt === 'true') {
    const debtors = await Order.distinct('customer', {
      status: { $ne: ORDER_STATUS.CANCELLED },
      balance: { $gt: 0 },
    });
    filter._id = { $in: debtors };
  }
  const { items, pagination } = await paginate(Customer, filter, req.query, {
    allowedSort: ['name', 'createdAt', 'customerCode'],
  });
  const stats = await balancesFor(items.map((c) => c._id));
  const data = items.map((c) => {
    const s = stats.get(String(c._id));
    return {
      ...c,
      balance: round2(s?.balance || 0),
      totalSpent: round2(s?.spent || 0),
      orderCount: s?.orders || 0,
    };
  });
  sendSuccess(res, { data, pagination });
});

exports.get = asyncHandler(async (req, res) => {
  const customer = assertFound(
    await Customer.findById(req.params.id).populate('user', 'email isActive lastLoginAt').lean(),
    'Customer not found.',
  );
  const id = new mongoose.Types.ObjectId(req.params.id);
  const [orders, payments, invoices, customRequests, stats] = await Promise.all([
    Order.find({ customer: id })
      .sort({ orderDate: -1 })
      .limit(50)
      .select('orderNumber orderDate status paymentStatus total amountPaid balance')
      .lean(),
    Payment.find({ customer: id })
      .sort({ paidAt: -1 })
      .limit(50)
      .select('paymentNumber receiptNumber paidAt amount method category status')
      .lean(),
    Invoice.find({ customer: id })
      .sort({ issueDate: -1 })
      .limit(20)
      .select('invoiceNumber issueDate total balance status')
      .lean(),
    CustomFurnitureRequest.find({ customer: id })
      .sort({ createdAt: -1 })
      .limit(20)
      .select('requestNumber furnitureType status quotedPrice createdAt')
      .lean(),
    balancesFor([id]),
  ]);
  const s = stats.get(String(id));
  sendSuccess(res, {
    data: {
      ...customer,
      summary: {
        balance: round2(s?.balance || 0),
        totalSpent: round2(s?.spent || 0),
        totalPaid: round2(s?.paid || 0),
        orderCount: s?.orders || 0,
      },
      orders,
      payments,
      invoices,
      customRequests,
    },
  });
});

exports.create = asyncHandler(async (req, res) => {
  if (req.body.email && (await Customer.exists({ email: req.body.email })))
    throw ApiError.conflict('A customer with this email already exists.');
  const customer = await Customer.create({
    ...req.body,
    source: req.body.source || 'WALK_IN',
    customerCode: await nextNumber('CUS', { yearly: false, pad: 5 }),
  });
  await audit(actorFrom(req), {
    action: AUDIT_ACTIONS.CREATE,
    entity: 'Customer',
    entityId: customer._id,
    reference: customer.customerCode,
  });
  sendCreated(res, customer, 'Customer created');
});

exports.update = asyncHandler(async (req, res) => {
  const customer = assertFound(await Customer.findById(req.params.id), 'Customer not found.');
  const before = customer.toObject();
  Object.assign(customer, req.body);
  await customer.save();
  await audit(actorFrom(req), {
    action: AUDIT_ACTIONS.UPDATE,
    entity: 'Customer',
    entityId: customer._id,
    reference: customer.customerCode,
    changes: diff(before, customer.toObject(), [
      'name',
      'email',
      'phone',
      'address',
      'company',
      'notes',
      'bankAccounts',
    ]),
  });
  sendSuccess(res, { data: customer, message: 'Customer updated' });
});

exports.remove = asyncHandler(async (req, res) => {
  const customer = assertFound(await Customer.findById(req.params.id), 'Customer not found.');
  const open = await Order.exists({
    customer: customer._id,
    $or: [{ balance: { $gt: 0 } }, { status: { $nin: ['COMPLETED', 'CANCELLED'] } }],
  });
  if (open) throw ApiError.badRequest('This customer has open orders or an outstanding balance.');
  await customer.softDelete(req.user._id);
  await audit(actorFrom(req), {
    action: AUDIT_ACTIONS.DELETE,
    entity: 'Customer',
    entityId: customer._id,
    reference: customer.customerCode,
  });
  sendSuccess(res, { message: 'Customer removed' });
});

const mongoose = require('mongoose');
const {
  Order,
  Expense,
  FinancialTransaction,
  Payment,
  Supplier,
  Customer,
  ProductionJob,
  Product,
  Material,
  InventoryTransaction,
} = require('../models');
const { round2 } = require('../utils/money');
const { isObjectId } = require('../utils/query');
const { ORDER_STATUS: O, PRODUCTION_STAGES: S } = require('../config/constants');
const { getSettings } = require('./settings.service');

const { ObjectId } = mongoose.Types;
const DAY = 24 * 3600 * 1000;

const PERIOD_FORMATS = { daily: '%Y-%m-%d', weekly: '%G-W%V', monthly: '%Y-%m', annual: '%Y' };
const SOLD_STATUSES = [O.CONFIRMED, O.PAID, O.IN_PRODUCTION, O.READY, O.OUT_FOR_DELIVERY, O.DELIVERED, O.COMPLETED];
const INCOME_TYPES = ['CUSTOMER_PAYMENT', 'OTHER_INCOME'];
const COST_TYPES = ['EXPENSE', 'SUPPLIER_PAYMENT', 'WORKER_PAYMENT'];

function range({ from, to } = {}, fallbackDays = 30) {
  const end = to ? new Date(to) : new Date();
  if (to && /^\d{4}-\d{2}-\d{2}$/.test(String(to))) end.setUTCHours(23, 59, 59, 999);
  const start = from ? new Date(from) : new Date(end.getTime() - fallbackDays * DAY);
  return { $gte: start, $lte: end, start, end };
}
const dateMatch = (r) => ({ $gte: r.$gte, $lte: r.$lte });
const oid = (v) => (isObjectId(String(v)) ? new ObjectId(String(v)) : undefined);

async function groupExpr(field, period) {
  const { timezone } = await getSettings();
  return { $dateToString: { format: PERIOD_FORMATS[period] || PERIOD_FORMATS.daily, date: `$${field}`, timezone } };
}

const sumRows = (rows, keys) => Object.fromEntries(keys.map((k) => [k, round2(rows.reduce((s, r) => s + (r[k] || 0), 0))]));

// ---------- Sales ----------
async function salesReport(q) {
  const r = range(q, q.period === 'annual' ? 365 * 3 : q.period === 'monthly' ? 365 : 30);
  const match = { status: { $in: SOLD_STATUSES }, orderDate: dateMatch(r) };
  if (oid(q.customer)) match.customer = oid(q.customer);
  if (oid(q.branch)) match.branch = oid(q.branch);
  const period = await groupExpr('orderDate', q.period);

  if (oid(q.product)) {
    const rows = await Order.aggregate([
      { $match: match },
      { $unwind: '$items' },
      { $match: { 'items.product': oid(q.product) } },
      { $group: { _id: period, orders: { $addToSet: '$_id' }, quantity: { $sum: '$items.quantity' }, revenue: { $sum: '$items.lineTotal' } } },
      { $project: { _id: 0, period: '$_id', orders: { $size: '$orders' }, quantity: 1, revenue: 1 } },
      { $sort: { period: 1 } },
    ]);
    return { rows, totals: sumRows(rows, ['orders', 'quantity', 'revenue']), range: r };
  }

  const rows = await Order.aggregate([
    { $match: match },
    {
      $group: {
        _id: period,
        orders: { $sum: 1 },
        grossSales: { $sum: '$subtotal' },
        discounts: { $sum: '$discount' },
        deliveryFees: { $sum: '$deliveryFee' },
        tax: { $sum: { $ifNull: ['$tax', 0] } },
        revenue: { $sum: '$total' },
        collected: { $sum: '$amountPaid' },
        outstanding: { $sum: '$balance' },
      },
    },
    { $project: { _id: 0, period: '$_id', orders: 1, grossSales: 1, discounts: 1, deliveryFees: 1, tax: 1, revenue: 1, collected: 1, outstanding: 1 } },
    { $sort: { period: 1 } },
  ]);
  return { rows, totals: sumRows(rows, ['orders', 'grossSales', 'discounts', 'deliveryFees', 'tax', 'revenue', 'collected', 'outstanding']), range: r };
}

async function productSalesReport(q) {
  const r = range(q, 365);
  const match = { status: { $in: SOLD_STATUSES }, orderDate: dateMatch(r) };
  if (oid(q.customer)) match.customer = oid(q.customer);
  if (oid(q.branch)) match.branch = oid(q.branch);
  const rows = await Order.aggregate([
    { $match: match },
    { $unwind: '$items' },
    ...(oid(q.product) ? [{ $match: { 'items.product': oid(q.product) } }] : []),
    {
      $group: {
        _id: { $ifNull: ['$items.product', '$items.name'] },
        name: { $first: '$items.name' },
        sku: { $first: '$items.sku' },
        quantity: { $sum: '$items.quantity' },
        revenue: { $sum: '$items.lineTotal' },
        cost: { $sum: { $multiply: ['$items.quantity', { $ifNull: ['$items.unitCost', 0] }] } },
        orders: { $addToSet: '$_id' },
      },
    },
    {
      $project: {
        _id: 0,
        product: '$_id',
        name: 1,
        sku: 1,
        quantity: 1,
        revenue: 1,
        cost: 1,
        profit: { $subtract: ['$revenue', '$cost'] },
        orders: { $size: '$orders' },
      },
    },
    { $sort: { revenue: -1 } },
  ]);
  rows.forEach((row) => {
    row.margin = row.revenue ? round2((row.profit / row.revenue) * 100) : 0;
  });
  return { rows, totals: sumRows(rows, ['quantity', 'revenue', 'cost', 'profit']), range: r };
}

// ---------- Finance ----------
async function expenseReport(q) {
  const r = range(q, 30);
  const match = { status: 'APPROVED', date: dateMatch(r), deletedAt: null };
  if (q.category) match.category = q.category;
  if (q.method) match.method = q.method;
  if (oid(q.branch)) match.branch = oid(q.branch);
  const [byCategory, rows] = await Promise.all([
    Expense.aggregate([
      { $match: match },
      { $group: { _id: '$category', amount: { $sum: '$amount' }, count: { $sum: 1 } } },
      { $project: { _id: 0, category: '$_id', amount: 1, count: 1 } },
      { $sort: { amount: -1 } },
    ]),
    Expense.find(match).sort({ date: -1 }).limit(1000).select('expenseNumber date category description vendor method amount').lean(),
  ]);
  return { rows, byCategory, totals: sumRows(rows, ['amount']), range: r };
}

async function profitLossReport(q) {
  const r = range(q, 365);
  const period = await groupExpr('date', q.period || 'monthly');
  const ledger = await FinancialTransaction.aggregate([
    { $match: { date: dateMatch(r) } },
    { $group: { _id: { period, type: '$type' }, amount: { $sum: '$amount' } } },
  ]);
  const byPeriod = new Map();
  for (const { _id, amount } of ledger) {
    const row = byPeriod.get(_id.period) || { period: _id.period, sales: 0, income: 0, refunds: 0, expenses: 0, supplierPayments: 0, workerPayments: 0 };
    if (_id.type === 'SALE') row.sales += amount;
    if (INCOME_TYPES.includes(_id.type)) row.income += amount;
    if (_id.type === 'REFUND') row.refunds += amount;
    if (_id.type === 'EXPENSE') row.expenses += amount;
    if (_id.type === 'SUPPLIER_PAYMENT') row.supplierPayments += amount;
    if (_id.type === 'WORKER_PAYMENT') row.workerPayments += amount;
    byPeriod.set(_id.period, row);
  }
  const rows = [...byPeriod.values()]
    .sort((a, b) => a.period.localeCompare(b.period))
    .map((row) => {
      const netIncome = row.income - row.refunds;
      const totalCosts = row.expenses + row.supplierPayments + row.workerPayments;
      return { ...row, netIncome: round2(netIncome), totalCosts: round2(totalCosts), profit: round2(netIncome - totalCosts) };
    });

  // Accrual view: sales revenue less the recorded cost of goods sold.
  const cogs = await Order.aggregate([
    { $match: { status: { $in: SOLD_STATUSES }, orderDate: dateMatch(r) } },
    { $unwind: '$items' },
    { $group: { _id: null, cost: { $sum: { $multiply: ['$items.quantity', { $ifNull: ['$items.unitCost', 0] }] } }, revenue: { $sum: '$items.lineTotal' } } },
  ]);
  const totals = sumRows(rows, ['sales', 'income', 'refunds', 'netIncome', 'expenses', 'supplierPayments', 'workerPayments', 'totalCosts', 'profit']);
  totals.grossProfit = round2((cogs[0]?.revenue || 0) - (cogs[0]?.cost || 0));
  totals.costOfGoods = round2(cogs[0]?.cost || 0);
  return { rows, totals, range: r };
}

async function customerDebtReport(q) {
  const match = { status: { $ne: O.CANCELLED }, balance: { $gt: 0 } };
  if (oid(q.customer)) match.customer = oid(q.customer);
  const rows = await Order.aggregate([
    { $match: match },
    {
      $group: {
        _id: '$customer',
        orders: { $sum: 1 },
        totalBilled: { $sum: '$total' },
        paid: { $sum: '$amountPaid' },
        balance: { $sum: '$balance' },
        oldestOrder: { $min: '$orderDate' },
        orderNumbers: { $push: '$orderNumber' },
      },
    },
    { $lookup: { from: 'customers', localField: '_id', foreignField: '_id', as: 'customer' } },
    { $unwind: '$customer' },
    {
      $project: {
        _id: 0,
        customerId: '$_id',
        customer: '$customer.name',
        phone: '$customer.phone',
        orders: 1,
        orderNumbers: 1,
        totalBilled: 1,
        paid: 1,
        balance: 1,
        oldestOrder: 1,
        daysOutstanding: { $dateDiff: { startDate: '$oldestOrder', endDate: '$$NOW', unit: 'day' } },
      },
    },
    { $sort: { balance: -1 } },
  ]);
  return { rows, totals: sumRows(rows, ['orders', 'totalBilled', 'paid', 'balance']) };
}

async function supplierDebtReport() {
  const rows = await Supplier.find({ balance: { $gt: 0 } })
    .select('name phone email paymentTerms balance')
    .sort({ balance: -1 })
    .lean();
  return { rows: rows.map((s) => ({ supplierId: s._id, supplier: s.name, phone: s.phone, paymentTerms: s.paymentTerms, balance: s.balance })), totals: sumRows(rows, ['balance']) };
}

async function paymentReport(q) {
  const r = range(q, 30);
  const match = { paidAt: dateMatch(r), status: 'COMPLETED' };
  if (q.method) match.method = q.method;
  if (q.category) match.category = q.category;
  if (oid(q.customer)) match.customer = oid(q.customer);
  const [rows, byMethod] = await Promise.all([
    Payment.find(match)
      .sort({ paidAt: -1 })
      .limit(2000)
      .populate('customer', 'name')
      .populate('supplier', 'name')
      .populate('order', 'orderNumber')
      .select('paymentNumber receiptNumber paidAt category kind method amount reference customer supplier order')
      .lean(),
    Payment.aggregate([
      { $match: match },
      { $group: { _id: { method: '$method', category: '$category' }, amount: { $sum: '$amount' }, count: { $sum: 1 } } },
      { $project: { _id: 0, method: '$_id.method', category: '$_id.category', amount: 1, count: 1 } },
      { $sort: { amount: -1 } },
    ]),
  ]);
  const flat = rows.map((p) => ({
    paymentNumber: p.paymentNumber,
    receiptNumber: p.receiptNumber,
    date: p.paidAt,
    category: p.category,
    kind: p.kind,
    method: p.method,
    party: p.customer?.name || p.supplier?.name || '',
    order: p.order?.orderNumber || '',
    reference: p.reference,
    amount: p.amount,
  }));
  return { rows: flat, byMethod, totals: sumRows(flat, ['amount']), range: r };
}

async function transactionsReport(q) {
  const r = range(q, 30);
  const match = { date: dateMatch(r) };
  if (q.type) match.type = { $in: String(q.type).split(',') };
  if (q.method) match.method = q.method;
  if (oid(q.customer)) match.customer = oid(q.customer);
  const rows = await FinancialTransaction.find(match)
    .sort({ date: -1 })
    .limit(2000)
    .populate('customer', 'name')
    .populate('order', 'orderNumber')
    .populate('createdBy', 'name')
    .lean();
  const flat = rows.map((t) => ({
    transactionNumber: t.transactionNumber,
    date: t.date,
    type: t.type,
    direction: t.direction,
    method: t.method,
    customer: t.customer?.name || '',
    order: t.order?.orderNumber || '',
    description: t.description,
    createdBy: t.createdBy?.name,
    amount: t.amount,
  }));
  const moneyIn = round2(flat.filter((t) => t.direction === 'IN').reduce((s, t) => s + t.amount, 0));
  const moneyOut = round2(flat.filter((t) => t.direction === 'OUT').reduce((s, t) => s + t.amount, 0));
  return { rows: flat, totals: { moneyIn, moneyOut, net: round2(moneyIn - moneyOut) }, range: r };
}

// ---------- Production ----------
async function productionReport(q) {
  const r = range(q, 90);
  const now = new Date();
  const open = { $nin: [S.READY_FOR_DELIVERY, S.DELIVERED, S.CANCELLED] };
  const [byStage, completed, delayed, workload] = await Promise.all([
    ProductionJob.aggregate([{ $match: { stage: { $ne: S.CANCELLED } } }, { $group: { _id: '$stage', count: { $sum: 1 } } }, { $project: { _id: 0, stage: '$_id', count: 1 } }]),
    ProductionJob.aggregate([
      { $match: { actualCompletionDate: dateMatch(r) } },
      {
        $project: {
          jobNumber: 1,
          title: 1,
          quantity: 1,
          reworkCount: 1,
          startDate: 1,
          actualCompletionDate: 1,
          expectedCompletionDate: 1,
          productionDays: { $dateDiff: { startDate: { $ifNull: ['$startDate', '$createdAt'] }, endDate: '$actualCompletionDate', unit: 'day' } },
          onTime: { $lte: ['$actualCompletionDate', { $ifNull: ['$expectedCompletionDate', '$actualCompletionDate'] }] },
        },
      },
      { $sort: { actualCompletionDate: -1 } },
    ]),
    ProductionJob.find({ stage: open, expectedCompletionDate: { $lt: now } })
      .select('jobNumber title stage progress expectedCompletionDate assignedWorkers')
      .populate('assignedWorkers', 'name')
      .sort({ expectedCompletionDate: 1 })
      .lean(),
    ProductionJob.aggregate([
      { $match: { stage: { $ne: S.CANCELLED } } },
      { $unwind: '$assignedWorkers' },
      {
        $group: {
          _id: '$assignedWorkers',
          activeJobs: { $sum: { $cond: [{ $in: ['$stage', [S.READY_FOR_DELIVERY, S.DELIVERED]] }, 0, 1] } },
          completedInRange: {
            $sum: { $cond: [{ $and: [{ $gte: ['$actualCompletionDate', r.$gte] }, { $lte: ['$actualCompletionDate', r.$lte] }] }, 1, 0] },
          },
          overdue: { $sum: { $cond: [{ $and: [{ $lt: ['$expectedCompletionDate', now] }, { $not: [{ $in: ['$stage', [S.READY_FOR_DELIVERY, S.DELIVERED]] }] }] }, 1, 0] } },
          reworks: { $sum: '$reworkCount' },
        },
      },
      { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'user' } },
      { $unwind: '$user' },
      { $project: { _id: 0, workerId: '$_id', worker: '$user.name', position: '$user.workerRole', activeJobs: 1, completedInRange: 1, overdue: 1, reworks: 1 } },
      { $sort: { activeJobs: -1 } },
    ]),
  ]);
  const avgDays = completed.length ? round2(completed.reduce((s, j) => s + (j.productionDays || 0), 0) / completed.length) : 0;
  const onTimeRate = completed.length ? round2((completed.filter((j) => j.onTime).length / completed.length) * 100) : 0;
  return {
    byStage,
    completed,
    delayed: delayed.map((j) => ({ ...j, daysLate: Math.ceil((now - new Date(j.expectedCompletionDate)) / DAY) })),
    workload,
    totals: { completed: completed.length, delayed: delayed.length, averageProductionDays: avgDays, onTimeRate },
    range: r,
  };
}

// ---------- Inventory ----------
async function inventoryReport(q) {
  const r = range(q, 30);
  const [products, materials, usage, movement] = await Promise.all([
    Product.find().select('name sku quantity minStock costPrice sellingPrice soldQuantity damagedQuantity status madeToOrder').sort({ name: 1 }).lean(),
    Material.find().select('name code category unit quantity minStock unitCost').populate('supplier', 'name').sort({ name: 1 }).lean(),
    InventoryTransaction.aggregate([
      { $match: { itemType: 'MATERIAL', type: { $in: ['PRODUCTION_ISSUE', 'PRODUCTION_RETURN'] }, createdAt: dateMatch(r) } },
      { $group: { _id: '$material', used: { $sum: { $multiply: ['$quantity', -1] } } } },
      { $lookup: { from: 'materials', localField: '_id', foreignField: '_id', as: 'm' } },
      { $unwind: '$m' },
      { $project: { _id: 0, materialId: '$_id', material: '$m.name', unit: '$m.unit', used: 1, cost: { $multiply: ['$used', '$m.unitCost'] } } },
      { $sort: { cost: -1 } },
    ]),
    InventoryTransaction.aggregate([
      { $match: { createdAt: dateMatch(r) } },
      { $group: { _id: { itemType: '$itemType', type: '$type' }, quantity: { $sum: '$quantity' }, entries: { $sum: 1 } } },
      { $project: { _id: 0, itemType: '$_id.itemType', type: '$_id.type', quantity: 1, entries: 1 } },
      { $sort: { itemType: 1, type: 1 } },
    ]),
  ]);
  // Made-to-order products are built on demand, so zero stock is not a shortage.
  const productRows = products.map((p) => ({ ...p, stockValue: round2(p.quantity * p.costPrice), lowStock: !p.madeToOrder && p.quantity <= p.minStock }));
  const materialRows = materials.map((m) => ({ ...m, supplier: m.supplier?.name, stockValue: round2(m.quantity * m.unitCost), lowStock: m.quantity <= m.minStock }));
  return {
    products: productRows,
    materials: materialRows,
    lowStock: [...productRows.filter((p) => p.lowStock).map((p) => ({ type: 'Product', name: p.name, quantity: p.quantity, minStock: p.minStock })), ...materialRows.filter((m) => m.lowStock).map((m) => ({ type: 'Material', name: m.name, quantity: m.quantity, minStock: m.minStock, unit: m.unit }))],
    usage,
    movement,
    totals: {
      productStockValue: round2(productRows.reduce((s, p) => s + p.stockValue, 0)),
      materialStockValue: round2(materialRows.reduce((s, m) => s + m.stockValue, 0)),
      lowStockCount: productRows.filter((p) => p.lowStock).length + materialRows.filter((m) => m.lowStock).length,
    },
    range: r,
  };
}

// ---------- Customers ----------
async function customerReport(q) {
  const r = range(q, 90);
  const [newCustomers, orderStats] = await Promise.all([
    Customer.find({ createdAt: dateMatch(r) }).select('name email phone customerCode source createdAt').sort({ createdAt: -1 }).lean(),
    Order.aggregate([
      { $match: { status: { $ne: O.CANCELLED } } },
      { $group: { _id: '$customer', orders: { $sum: 1 }, spent: { $sum: '$total' }, balance: { $sum: '$balance' }, lastOrder: { $max: '$orderDate' } } },
      { $lookup: { from: 'customers', localField: '_id', foreignField: '_id', as: 'c' } },
      { $unwind: '$c' },
      { $project: { _id: 0, customerId: '$_id', customer: '$c.name', phone: '$c.phone', orders: 1, spent: 1, balance: 1, lastOrder: 1 } },
      { $sort: { spent: -1 } },
    ]),
  ]);
  let history = [];
  if (oid(q.customer)) {
    history = await Order.find({ customer: oid(q.customer) })
      .select('orderNumber orderDate status total amountPaid balance paymentStatus')
      .sort({ orderDate: -1 })
      .lean();
  }
  return {
    newCustomers,
    repeatCustomers: orderStats.filter((c) => c.orders >= 2),
    topCustomers: orderStats.slice(0, 20),
    outstanding: orderStats.filter((c) => c.balance > 0).sort((a, b) => b.balance - a.balance),
    history,
    totals: {
      newCustomers: newCustomers.length,
      repeatCustomers: orderStats.filter((c) => c.orders >= 2).length,
      totalCustomers: await Customer.countDocuments(),
    },
    range: r,
  };
}

module.exports = {
  range,
  groupExpr,
  SOLD_STATUSES,
  INCOME_TYPES,
  COST_TYPES,
  salesReport,
  productSalesReport,
  expenseReport,
  profitLossReport,
  customerDebtReport,
  supplierDebtReport,
  paymentReport,
  transactionsReport,
  productionReport,
  inventoryReport,
  customerReport,
};

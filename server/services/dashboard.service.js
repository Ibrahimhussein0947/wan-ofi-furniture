const {
  Order,
  FinancialTransaction,
  Expense,
  Material,
  Product,
  ProductionJob,
  ProductionTask,
  Customer,
  Supplier,
  Payment,
  Notification,
  Invoice,
  CustomFurnitureRequest,
  Worker,
  InventoryTransaction,
  Delivery,
} = require('../models');
const { round2 } = require('../utils/money');
const { ORDER_STATUS: O, PRODUCTION_STAGES: S } = require('../config/constants');
const { getSettings } = require('./settings.service');
const { SOLD_STATUSES, INCOME_TYPES, COST_TYPES, groupExpr, productSalesReport } = require('./report.service');

const DAY = 24 * 3600 * 1000;
const ACTIVE_STAGES = [S.PENDING, S.APPROVED, S.MATERIALS_REQUIRED, S.MATERIALS_READY, S.IN_PRODUCTION, S.ASSEMBLY, S.FINISHING, S.QUALITY_CHECK];

function periodStarts() {
  const now = new Date();
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const month = new Date(now.getFullYear(), now.getMonth(), 1);
  const yearAgo = new Date(now.getFullYear() - 1, now.getMonth() + 1, 1);
  return { now, today, month, yearAgo };
}

async function sumOrders(match) {
  const [r] = await Order.aggregate([{ $match: match }, { $group: { _id: null, total: { $sum: '$total' }, count: { $sum: 1 } } }]);
  return { total: round2(r?.total || 0), count: r?.count || 0 };
}

async function ledgerTotals(since) {
  const match = since ? { date: { $gte: since } } : {};
  const rows = await FinancialTransaction.aggregate([{ $match: match }, { $group: { _id: '$type', amount: { $sum: '$amount' } } }]);
  const get = (types) => round2(rows.filter((r) => types.includes(r._id)).reduce((s, r) => s + r.amount, 0));
  const income = round2(get(INCOME_TYPES) - get(['REFUND']));
  const expenses = get(COST_TYPES);
  return { income, expenses, profit: round2(income - expenses), operatingExpenses: get(['EXPENSE']) };
}

async function monthlySeries(since) {
  const period = await groupExpr('date', 'monthly');
  const orderPeriod = await groupExpr('orderDate', 'monthly');
  const [ledger, sales] = await Promise.all([
    FinancialTransaction.aggregate([
      { $match: { date: { $gte: since } } },
      { $group: { _id: { period, type: '$type' }, amount: { $sum: '$amount' } } },
    ]),
    Order.aggregate([
      { $match: { status: { $in: SOLD_STATUSES }, orderDate: { $gte: since } } },
      { $group: { _id: orderPeriod, sales: { $sum: '$total' }, orders: { $sum: 1 } } },
    ]),
  ]);
  const months = [];
  const cursor = new Date(since);
  const now = new Date();
  while (cursor <= now) {
    months.push(`${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}`);
    cursor.setMonth(cursor.getMonth() + 1);
  }
  return months.map((m) => {
    const of = (types) => ledger.filter((l) => l._id.period === m && types.includes(l._id.type)).reduce((s, l) => s + l.amount, 0);
    const income = round2(of(INCOME_TYPES) - of(['REFUND']));
    const expenses = round2(of(COST_TYPES));
    const sale = sales.find((s) => s._id === m);
    return { period: m, sales: round2(sale?.sales || 0), orders: sale?.orders || 0, income, expenses, profit: round2(income - expenses) };
  });
}

async function dailySales(days = 30) {
  const since = new Date(Date.now() - days * DAY);
  since.setHours(0, 0, 0, 0);
  const period = await groupExpr('orderDate', 'daily');
  const rows = await Order.aggregate([
    { $match: { status: { $in: SOLD_STATUSES }, orderDate: { $gte: since } } },
    { $group: { _id: period, sales: { $sum: '$total' }, orders: { $sum: 1 } } },
    { $sort: { _id: 1 } },
  ]);
  return rows.map((r) => ({ date: r._id, sales: round2(r.sales), orders: r.orders }));
}

async function debtTotals() {
  const [customer] = await Order.aggregate([
    { $match: { status: { $ne: O.CANCELLED }, balance: { $gt: 0 } } },
    { $group: { _id: null, total: { $sum: '$balance' }, orders: { $sum: 1 }, customers: { $addToSet: '$customer' } } },
  ]);
  const [supplier] = await Supplier.aggregate([{ $match: { balance: { $gt: 0 } } }, { $group: { _id: null, total: { $sum: '$balance' }, count: { $sum: 1 } } }]);
  return {
    customerDebt: round2(customer?.total || 0),
    debtorOrders: customer?.orders || 0,
    debtorCustomers: customer?.customers?.length || 0,
    supplierDebt: round2(supplier?.total || 0),
    suppliersOwed: supplier?.count || 0,
  };
}

const recentTransactions = (limit = 8) =>
  FinancialTransaction.find({ type: { $ne: 'DISCOUNT' } })
    .sort({ date: -1, createdAt: -1 })
    .limit(limit)
    .populate('customer', 'name')
    .populate('order', 'orderNumber')
    .select('transactionNumber type direction amount date method description customer order')
    .lean();

async function ownerDashboard() {
  const { today, month, yearAgo } = periodStarts();
  const settings = await getSettings();
  const [
    totalSales,
    todaySales,
    monthSales,
    allTime,
    thisMonth,
    orderCounts,
    productionByStage,
    lowStockMaterials,
    lowStockProducts,
    debts,
    txns,
    recentOrders,
    revenueSeries,
    expenseByCategory,
    salesTrend,
    customers,
    workers,
    pendingApprovals,
    pendingCustomRequests,
  ] = await Promise.all([
    sumOrders({ status: { $in: SOLD_STATUSES } }),
    sumOrders({ status: { $in: SOLD_STATUSES }, orderDate: { $gte: today } }),
    sumOrders({ status: { $in: SOLD_STATUSES }, orderDate: { $gte: month } }),
    ledgerTotals(),
    ledgerTotals(month),
    Order.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
    ProductionJob.aggregate([{ $match: { stage: { $nin: [S.CANCELLED, S.DELIVERED] } } }, { $group: { _id: '$stage', count: { $sum: 1 } } }]),
    Material.find({ $expr: { $lte: ['$quantity', '$minStock'] } }).select('name quantity minStock unit').sort({ quantity: 1 }).limit(10).lean(),
    Product.countDocuments({ $expr: { $lte: ['$quantity', '$minStock'] }, madeToOrder: false }),
    debtTotals(),
    recentTransactions(),
    Order.find().sort({ orderDate: -1 }).limit(8).populate('customer', 'name').select('orderNumber orderDate total balance status paymentStatus customer').lean(),
    monthlySeries(yearAgo),
    Expense.aggregate([
      { $match: { status: 'APPROVED', date: { $gte: new Date(new Date().getFullYear(), 0, 1) } } },
      { $group: { _id: '$category', amount: { $sum: '$amount' } } },
      { $project: { _id: 0, category: '$_id', amount: 1 } },
      { $sort: { amount: -1 } },
    ]),
    dailySales(30),
    Customer.countDocuments(),
    Worker.countDocuments({ isActive: true }),
    Expense.countDocuments({ status: 'PENDING' }),
    CustomFurnitureRequest.countDocuments({ status: { $in: ['SUBMITTED', 'UNDER_REVIEW', 'ESTIMATED'] } }),
  ]);

  const statusCount = (statuses) => orderCounts.filter((o) => statuses.includes(o._id)).reduce((s, o) => s + o.count, 0);
  const delayedJobs = await ProductionJob.countDocuments({ stage: { $in: ACTIVE_STAGES }, expectedCompletionDate: { $lt: new Date() } });

  return {
    currency: settings.currency,
    kpis: {
      totalSales: totalSales.total,
      todaySales: todaySales.total,
      todayOrders: todaySales.count,
      monthlySales: monthSales.total,
      monthlyOrders: monthSales.count,
      totalIncome: allTime.income,
      totalExpenses: allTime.expenses,
      netProfit: allTime.profit,
      monthIncome: thisMonth.income,
      monthExpenses: thisMonth.expenses,
      monthProfit: thisMonth.profit,
      pendingOrders: statusCount([O.PENDING]),
      activeOrders: statusCount([O.CONFIRMED, O.PAID, O.IN_PRODUCTION, O.READY, O.OUT_FOR_DELIVERY]),
      completedOrders: statusCount([O.COMPLETED, O.DELIVERED]),
      activeProductionJobs: productionByStage.filter((p) => ACTIVE_STAGES.includes(p._id)).reduce((s, p) => s + p.count, 0),
      delayedJobs,
      lowStockMaterials: lowStockMaterials.length,
      lowStockProducts,
      customerDebt: debts.customerDebt,
      debtorCustomers: debts.debtorCustomers,
      supplierDebt: debts.supplierDebt,
      customers,
      workers,
      pendingApprovals,
      pendingCustomRequests,
    },
    productionStatus: productionByStage.map((p) => ({ stage: p._id, count: p.count })),
    lowStock: lowStockMaterials,
    recentTransactions: txns,
    recentOrders,
    revenueSeries,
    expenseByCategory,
    salesTrend,
  };
}

async function analytics() {
  const { yearAgo } = periodStarts();
  const monthPeriod = (field) => groupExpr(field, 'monthly');
  const [series, productSales, materialUse, completion, customerGrowth, collection, debt] = await Promise.all([
    monthlySeries(yearAgo),
    productSalesReport({ from: yearAgo.toISOString() }),
    InventoryTransaction.aggregate([
      { $match: { itemType: 'MATERIAL', type: { $in: ['PRODUCTION_ISSUE', 'PRODUCTION_RETURN'] }, createdAt: { $gte: yearAgo } } },
      { $group: { _id: '$material', used: { $sum: { $multiply: ['$quantity', -1] } } } },
      { $lookup: { from: 'materials', localField: '_id', foreignField: '_id', as: 'm' } },
      { $unwind: '$m' },
      { $project: { _id: 0, material: '$m.name', unit: '$m.unit', used: 1, cost: { $multiply: ['$used', '$m.unitCost'] } } },
      { $sort: { cost: -1 } },
      { $limit: 10 },
    ]),
    ProductionJob.aggregate([
      { $match: { createdAt: { $gte: yearAgo }, stage: { $ne: S.CANCELLED } } },
      {
        $group: {
          _id: await monthPeriod('createdAt'),
          started: { $sum: 1 },
          completed: { $sum: { $cond: [{ $in: ['$stage', [S.READY_FOR_DELIVERY, S.DELIVERED]] }, 1, 0] } },
        },
      },
      { $project: { _id: 0, period: '$_id', started: 1, completed: 1 } },
      { $sort: { period: 1 } },
    ]),
    Customer.aggregate([
      { $match: { createdAt: { $gte: yearAgo } } },
      { $group: { _id: await monthPeriod('createdAt'), newCustomers: { $sum: 1 } } },
      { $project: { _id: 0, period: '$_id', newCustomers: 1 } },
      { $sort: { period: 1 } },
    ]),
    Payment.aggregate([
      { $match: { category: 'CUSTOMER_PAYMENT', status: 'COMPLETED', paidAt: { $gte: yearAgo } } },
      { $group: { _id: await monthPeriod('paidAt'), collected: { $sum: '$amount' } } },
      { $project: { _id: 0, period: '$_id', collected: 1 } },
      { $sort: { period: 1 } },
    ]),
    debtTotals(),
  ]);
  const collectionSeries = series.map((s) => ({
    period: s.period,
    sales: s.sales,
    collected: round2(collection.find((c) => c.period === s.period)?.collected || 0),
  }));
  return {
    revenueSeries: series,
    mostSold: [...productSales.rows].sort((a, b) => b.quantity - a.quantity).slice(0, 10),
    mostProfitable: [...productSales.rows].sort((a, b) => b.profit - a.profit).slice(0, 10),
    materialConsumption: materialUse,
    productionCompletion: completion,
    customerGrowth,
    paymentCollection: collectionSeries,
    outstandingDebt: debt,
  };
}

async function accountantDashboard() {
  const { today, month } = periodStarts();
  const [todayTotals, monthTotals, debts, txns, byMethod, pendingVerification, pendingExpenses, overdueInvoices, topDebtors] = await Promise.all([
    ledgerTotals(today),
    ledgerTotals(month),
    debtTotals(),
    recentTransactions(10),
    Payment.aggregate([
      { $match: { category: 'CUSTOMER_PAYMENT', status: 'COMPLETED', paidAt: { $gte: month } } },
      { $group: { _id: '$method', amount: { $sum: '$amount' }, count: { $sum: 1 } } },
      { $project: { _id: 0, method: '$_id', amount: 1, count: 1 } },
    ]),
    Payment.countDocuments({ status: 'PENDING_VERIFICATION' }),
    Expense.countDocuments({ status: 'PENDING' }),
    Invoice.countDocuments({ status: { $in: ['ISSUED', 'PARTIALLY_PAID'] }, dueDate: { $lt: new Date() } }),
    Order.aggregate([
      { $match: { status: { $ne: O.CANCELLED }, balance: { $gt: 0 } } },
      { $group: { _id: '$customer', balance: { $sum: '$balance' }, orders: { $sum: 1 } } },
      { $sort: { balance: -1 } },
      { $limit: 5 },
      { $lookup: { from: 'customers', localField: '_id', foreignField: '_id', as: 'c' } },
      { $unwind: '$c' },
      { $project: { _id: 0, customerId: '$_id', name: '$c.name', phone: '$c.phone', balance: 1, orders: 1 } },
    ]),
  ]);
  const settings = await getSettings();
  return {
    currency: settings.currency,
    kpis: {
      todayIncome: todayTotals.income,
      monthIncome: monthTotals.income,
      monthExpenses: monthTotals.expenses,
      netProfit: monthTotals.profit,
      outstandingCustomer: debts.customerDebt,
      outstandingSupplier: debts.supplierDebt,
      pendingVerification,
      pendingExpenses,
      overdueInvoices,
    },
    paymentStats: byMethod,
    recentTransactions: txns,
    topDebtors,
    revenueSeries: await monthlySeries(new Date(new Date().getFullYear(), new Date().getMonth() - 5, 1)),
  };
}

async function workerDashboard(user) {
  const now = new Date();
  const soon = new Date(Date.now() + 3 * DAY);
  const jobs = await ProductionJob.find({ assignedWorkers: user._id, stage: { $nin: [S.CANCELLED, S.DELIVERED] } })
    .select('jobNumber title quantity stage progress priority expectedCompletionDate requiredMaterials order problems')
    .populate('order', 'orderNumber')
    .sort({ expectedCompletionDate: 1 })
    .lean();
  const active = jobs.filter((j) => j.stage !== S.READY_FOR_DELIVERY);
  const [tasks, notifications, deliveries] = await Promise.all([
    ProductionTask.find({ assignedTo: user._id, status: { $ne: 'DONE' } }).populate('job', 'jobNumber title').sort({ dueDate: 1 }).limit(20).lean(),
    Notification.find({ recipient: user._id }).sort({ createdAt: -1 }).limit(8).lean(),
    Delivery.find({ deliveryPerson: user._id, status: { $in: ['PENDING', 'SCHEDULED', 'OUT_FOR_DELIVERY'] } })
      .populate('order', 'orderNumber')
      .populate('customer', 'name')
      .sort({ scheduledDate: 1 })
      .lean(),
  ]);
  const materialNeeds = active
    .flatMap((j) =>
      (j.requiredMaterials || [])
        .filter((m) => m.quantityIssued < m.quantityRequired)
        .map((m) => ({ job: j.jobNumber, name: m.name, unit: m.unit, outstanding: round2(m.quantityRequired - m.quantityIssued) }))
    )
    .slice(0, 20);
  return {
    kpis: {
      assignedJobs: active.length,
      dueSoon: active.filter((j) => j.expectedCompletionDate && j.expectedCompletionDate <= soon && j.expectedCompletionDate >= now).length,
      overdue: active.filter((j) => j.expectedCompletionDate && j.expectedCompletionDate < now).length,
      openTasks: tasks.length,
      readyForDelivery: jobs.filter((j) => j.stage === S.READY_FOR_DELIVERY).length,
      deliveries: deliveries.length,
    },
    jobs: active.map((j) => ({ ...j, openProblems: (j.problems || []).filter((p) => !p.resolved).length, problems: undefined, requiredMaterials: undefined })),
    tasks,
    materialNeeds,
    deliveries,
    notifications,
  };
}

async function customerDashboard(customerId, userId) {
  const [orders, notifications, invoices, customRequests, pendingPayments] = await Promise.all([
    Order.find({ customer: customerId })
      .sort({ orderDate: -1 })
      .select('orderNumber orderDate status paymentStatus productionStatus deliveryStatus total amountPaid balance depositRequired items.name items.image items.quantity expectedCompletionDate')
      .lean(),
    Notification.find({ recipient: userId }).sort({ createdAt: -1 }).limit(8).lean(),
    Invoice.find({ customer: customerId, status: { $ne: 'VOID' } }).sort({ issueDate: -1 }).limit(5).select('invoiceNumber issueDate total balance status').lean(),
    CustomFurnitureRequest.find({ customer: customerId }).sort({ createdAt: -1 }).limit(5).select('requestNumber furnitureType status quotedPrice createdAt').lean(),
    Payment.countDocuments({ customer: customerId, status: 'PENDING_VERIFICATION' }),
  ]);
  const open = orders.filter((o) => ![O.CANCELLED, O.COMPLETED].includes(o.status));
  return {
    kpis: {
      totalOrders: orders.length,
      activeOrders: open.length,
      balanceDue: round2(open.reduce((s, o) => s + o.balance, 0)),
      completedOrders: orders.filter((o) => o.status === O.COMPLETED).length,
      pendingPayments,
    },
    activeOrders: open.slice(0, 5),
    recentOrders: orders.slice(0, 5),
    invoices,
    customRequests,
    notifications,
  };
}

module.exports = { ownerDashboard, accountantDashboard, workerDashboard, customerDashboard, analytics, debtTotals };

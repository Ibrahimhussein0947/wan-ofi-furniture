const reports = require('../services/report.service');
const dashboards = require('../services/dashboard.service');
const { asyncHandler, sendSuccess } = require('../utils/http');
const { customerOf } = require('./helpers');
const { ROLES } = require('../config/constants');
const ApiError = require('../utils/ApiError');

const REPORTS = {
  sales: reports.salesReport,
  'product-sales': reports.productSalesReport,
  expenses: reports.expenseReport,
  'profit-loss': reports.profitLossReport,
  'customer-debts': reports.customerDebtReport,
  'supplier-debts': reports.supplierDebtReport,
  payments: reports.paymentReport,
  transactions: reports.transactionsReport,
  production: reports.productionReport,
  inventory: reports.inventoryReport,
  customers: reports.customerReport,
};

exports.FINANCIAL_REPORTS = ['sales', 'product-sales', 'expenses', 'profit-loss', 'customer-debts', 'supplier-debts', 'payments', 'transactions', 'customers'];
exports.OPERATIONS_REPORTS = ['production', 'inventory'];

exports.run = asyncHandler(async (req, res) => {
  const handler = REPORTS[req.params.name];
  if (!handler) throw ApiError.notFound('Unknown report.');
  sendSuccess(res, { data: await handler(req.query) });
});

exports.dashboard = asyncHandler(async (req, res) => {
  const { role } = req.user;
  let data;
  if (role === ROLES.OWNER) data = await dashboards.ownerDashboard();
  else if (role === ROLES.ACCOUNTANT) data = await dashboards.accountantDashboard();
  else if (role === ROLES.WORKER) data = await dashboards.workerDashboard(req.user);
  else data = await dashboards.customerDashboard((await customerOf(req))._id, req.user._id);
  sendSuccess(res, { data: { role, ...data } });
});

exports.analytics = asyncHandler(async (_req, res) => {
  sendSuccess(res, { data: await dashboards.analytics() });
});

const express = require('express');
const { z } = require('zod');
const { requirePermission, requireRole } = require('../middleware/rbac');
const { customerOr, byRole } = require('../middleware/access');
const validate = require('../middleware/validate');
const { uploadImages, parseMultipartJson } = require('../middleware/upload');
const ApiError = require('../utils/ApiError');
const { hasPermission, PERMISSIONS: P } = require('../config/permissions');
const { ROLES } = require('../config/constants');
const { idParam, listQuery } = require('../validators/common');
const v = require('../validators/finance.validator');
const orderV = require('../validators/order.validator');
const finance = require('../controllers/finance.controller');
const reports = require('../controllers/report.controller');

const id = validate({ params: idParam });
const list = validate({ query: listQuery });

const payments = express.Router();
payments.get('/', customerOr(P.PAYMENTS_READ), list, finance.listPayments);
payments.post(
  '/mobile',
  requireRole(ROLES.CUSTOMER),
  validate({ body: v.mobilePayment }),
  finance.initiateMobilePayment,
);
payments.get(
  '/mobile/:reference',
  customerOr(P.PAYMENTS_READ),
  validate({ params: z.object({ reference: z.string().regex(/^[A-Z0-9]{6,40}$/) }) }),
  finance.getMobilePayment,
);
payments.get('/:id', customerOr(P.PAYMENTS_READ), id, finance.getPayment);
payments.post(
  '/customer',
  requirePermission(P.PAYMENTS_WRITE),
  validate({ body: v.customerPayment }),
  finance.recordCustomerPayment,
);
// Customers may attach a transfer receipt screenshot to speed up verification.
payments.post(
  '/submit',
  requireRole(ROLES.CUSTOMER),
  uploadImages('screenshot', { maxCount: 1, folder: 'payments' }),
  parseMultipartJson,
  validate({ body: orderV.customerPayment }),
  finance.submitPayment,
);
// A customer who paid first can add the receipt afterwards.
payments.post(
  '/:id/receipt',
  requireRole(ROLES.CUSTOMER),
  id,
  uploadImages('screenshot', { maxCount: 1, folder: 'payments' }),
  finance.attachReceipt,
);
payments.post(
  '/:id/verify',
  requirePermission(P.PAYMENTS_WRITE),
  id,
  validate({ body: v.verifyPayment }),
  finance.verifyPayment,
);
payments.post(
  '/supplier',
  requirePermission(P.PAYMENTS_WRITE),
  validate({ body: v.supplierPayment }),
  finance.recordSupplierPayment,
);
payments.post(
  '/worker',
  requirePermission(P.PAYMENTS_WRITE),
  validate({ body: v.workerPayment }),
  finance.recordWorkerPayment,
);
payments.post(
  '/refund',
  requirePermission(P.REFUNDS_WRITE),
  validate({ body: v.refund }),
  finance.recordRefund,
);

const invoices = express.Router();
invoices.get('/', customerOr(P.INVOICES_READ), list, finance.listInvoices);
invoices.get('/:id', customerOr(P.INVOICES_READ), id, finance.getInvoice);
invoices.post(
  '/',
  customerOr(P.INVOICES_WRITE),
  validate({ body: v.invoice }),
  byRole(finance.customerInvoice, finance.createInvoice),
);
invoices.post(
  '/:id/void',
  requirePermission(P.INVOICES_WRITE),
  id,
  validate({ body: orderV.reason }),
  finance.voidInvoice,
);

const expenses = express.Router();
expenses.get('/', requirePermission(P.EXPENSES_READ), list, finance.listExpenses);
expenses.get('/:id', requirePermission(P.EXPENSES_READ), id, finance.getExpense);
expenses.post(
  '/',
  requirePermission(P.EXPENSES_WRITE),
  uploadImages('receipt', { maxCount: 1, folder: 'expenses' }),
  parseMultipartJson,
  validate({ body: v.expense }),
  finance.createExpense,
);
expenses.patch(
  '/:id',
  requirePermission(P.EXPENSES_WRITE),
  id,
  validate({ body: v.updateExpense }),
  finance.updateExpense,
);
expenses.post(
  '/:id/decision',
  requirePermission(P.EXPENSES_APPROVE),
  id,
  validate({ body: v.decision }),
  finance.decideExpense,
);
expenses.delete('/:id', requirePermission(P.EXPENSES_WRITE), id, finance.deleteExpense);

const accounting = express.Router();
accounting.get(
  '/transactions',
  requirePermission(P.ACCOUNTING_READ),
  list,
  finance.listTransactions,
);
accounting.post(
  '/income',
  requirePermission(P.ACCOUNTING_WRITE),
  validate({ body: v.otherIncome }),
  finance.recordOtherIncome,
);

const reportRoutes = express.Router();
const reportAccess = (req, _res, next) => {
  const needed = reports.OPERATIONS_REPORTS.includes(req.params.name)
    ? P.REPORTS_OPERATIONS
    : P.REPORTS_FINANCIAL;
  return hasPermission(req.user, needed) ? next() : next(ApiError.forbidden());
};
reportRoutes.get('/:name', reportAccess, list, reports.run);

const dashboard = express.Router();
dashboard.get('/', reports.dashboard);
dashboard.get('/analytics', requirePermission(P.ANALYTICS_READ), reports.analytics);

module.exports = { payments, invoices, expenses, accounting, reports: reportRoutes, dashboard };

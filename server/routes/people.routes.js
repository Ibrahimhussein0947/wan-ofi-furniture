const express = require('express');
const { requirePermission } = require('../middleware/rbac');
const validate = require('../middleware/validate');
const { uploadDocument, parseMultipartJson } = require('../middleware/upload');
const ApiError = require('../utils/ApiError');
const { hasPermission, PERMISSIONS: P } = require('../config/permissions');
const { idParam, listQuery } = require('../validators/common');
const v = require('../validators/people.validator');
const users = require('../controllers/user.controller');
const customers = require('../controllers/customer.controller');
const workers = require('../controllers/worker.controller');
const payrollService = require('../services/payroll.service');
const { z } = require('zod');
const { asyncHandler, sendSuccess } = require('../utils/http');

const id = validate({ params: idParam });
const list = validate({ query: listQuery });

// Changing roles or permissions is a separate, owner-level right.
const guardAccessChanges = (req, _res, next) => {
  const touchesAccess = ['role', 'workerRole', 'permissions'].some((k) => req.body[k] !== undefined);
  if (touchesAccess && !hasPermission(req.user, P.PERMISSIONS_MANAGE)) return next(ApiError.forbidden());
  return next();
};

const userRoutes = express.Router();
userRoutes.get('/permissions', requirePermission(P.USERS_READ), users.permissionCatalog);
userRoutes.get('/', requirePermission(P.USERS_READ), list, users.list);
userRoutes.get('/:id', requirePermission(P.USERS_READ), id, users.get);
userRoutes.post('/', requirePermission(P.USERS_WRITE), validate({ body: v.createUser }), guardAccessChanges, users.create);
userRoutes.patch('/:id', requirePermission(P.USERS_WRITE), id, validate({ body: v.updateUser }), guardAccessChanges, users.update);
userRoutes.delete('/:id', requirePermission(P.USERS_WRITE), id, users.remove);

const customerRoutes = express.Router();
customerRoutes.get('/', requirePermission(P.CUSTOMERS_READ), list, customers.list);
customerRoutes.get('/:id', requirePermission(P.CUSTOMERS_READ), id, customers.get);
customerRoutes.post('/', requirePermission(P.CUSTOMERS_WRITE), validate({ body: v.customer }), customers.create);
customerRoutes.patch('/:id', requirePermission(P.CUSTOMERS_WRITE), id, validate({ body: v.updateCustomer }), customers.update);
customerRoutes.delete('/:id', requirePermission(P.CUSTOMERS_WRITE), id, customers.remove);

const workerRoutes = express.Router();
// Accountants list workers to record wage payments.
workerRoutes.get('/', requirePermission(P.WORKERS_READ, P.PAYMENTS_WRITE), list, workers.list);
// Monthly pay calculated from each worker's wage type, tasks and logged hours.
workerRoutes.get(
  '/payroll',
  requirePermission(P.PAYMENTS_READ),
  validate({ query: z.object({ month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Month must look like 2026-09') }) }),
  asyncHandler(async (req, res) => sendSuccess(res, { data: await payrollService.monthlyPayroll(req.query.month) }))
);
workerRoutes.get('/:id', requirePermission(P.WORKERS_READ), id, workers.get);
// Worker files (ID, contract…) hold personal data: only staff who manage workers can see or change them.
const docId = validate({ params: z.object({ id: idParam.shape.id, docId: idParam.shape.id }) });
workerRoutes.get('/:id/documents', requirePermission(P.WORKERS_WRITE), id, workers.listDocuments);
workerRoutes.post('/:id/documents', requirePermission(P.WORKERS_WRITE), id, uploadDocument('file'), parseMultipartJson, validate({ body: v.workerDocument }), workers.uploadDocument);
workerRoutes.get('/:id/documents/:docId/file', requirePermission(P.WORKERS_WRITE), docId, workers.documentFile);
workerRoutes.delete('/:id/documents/:docId', requirePermission(P.WORKERS_WRITE), docId, workers.removeDocument);
workerRoutes.patch('/:id', requirePermission(P.WORKERS_WRITE), id, validate({ body: v.updateWorker }), workers.update);
workerRoutes.delete('/:id', requirePermission(P.USERS_WRITE), id, workers.remove);

module.exports = { users: userRoutes, customers: customerRoutes, workers: workerRoutes };

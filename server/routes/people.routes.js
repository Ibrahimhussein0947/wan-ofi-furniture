const express = require('express');
const { requirePermission } = require('../middleware/rbac');
const validate = require('../middleware/validate');
const ApiError = require('../utils/ApiError');
const { hasPermission, PERMISSIONS: P } = require('../config/permissions');
const { idParam, listQuery } = require('../validators/common');
const v = require('../validators/people.validator');
const users = require('../controllers/user.controller');
const customers = require('../controllers/customer.controller');
const workers = require('../controllers/worker.controller');

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
workerRoutes.get('/:id', requirePermission(P.WORKERS_READ), id, workers.get);
workerRoutes.patch('/:id', requirePermission(P.WORKERS_WRITE), id, validate({ body: v.updateWorker }), workers.update);

module.exports = { users: userRoutes, customers: customerRoutes, workers: workerRoutes };

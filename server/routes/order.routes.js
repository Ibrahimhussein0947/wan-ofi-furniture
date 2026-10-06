const express = require('express');
const { requirePermission, requireRole } = require('../middleware/rbac');
const { customerOr, byRole } = require('../middleware/access');
const validate = require('../middleware/validate');
const { uploadImages, parseMultipartJson } = require('../middleware/upload');
const ApiError = require('../utils/ApiError');
const { hasPermission, PERMISSIONS: P } = require('../config/permissions');
const { ROLES } = require('../config/constants');
const { idParam, listQuery } = require('../validators/common');
const v = require('../validators/order.validator');
const orders = require('../controllers/order.controller');
const customOrders = require('../controllers/customRequest.controller');

const id = validate({ params: idParam });
const list = validate({ query: listQuery });

const validateOrderBody = (req, res, next) =>
  validate({ body: req.user.role === ROLES.CUSTOMER ? v.customerOrder : v.staffOrder })(req, res, next);

const onlyOwnerConfirms = (req, _res, next) => {
  if (req.body.status === 'CONFIRMED' && !hasPermission(req.user, P.ORDERS_APPROVE)) {
    return next(ApiError.forbidden('Only the owner can approve orders manually.'));
  }
  return next();
};

const orderRoutes = express.Router();
orderRoutes.get('/', customerOr(P.ORDERS_READ), list, orders.list);
orderRoutes.get('/:id', customerOr(P.ORDERS_READ), id, orders.get);
orderRoutes.post('/', customerOr(P.ORDERS_WRITE), validateOrderBody, byRole(orders.createByCustomer, orders.createByStaff));
orderRoutes.patch('/:id', requirePermission(P.ORDERS_WRITE), id, validate({ body: v.updateOrder }), orders.update);
orderRoutes.put('/:id/items', requirePermission(P.ORDERS_WRITE), id, validate({ body: v.updateItems }), orders.updateItems);
orderRoutes.post('/:id/confirm', requirePermission(P.ORDERS_APPROVE), id, validate({ body: v.note }), orders.confirm);
orderRoutes.post('/:id/status', requirePermission(P.ORDERS_WRITE), id, validate({ body: v.orderStatus }), onlyOwnerConfirms, orders.changeStatus);
orderRoutes.post('/:id/cancel', customerOr(P.ORDERS_WRITE), id, validate({ body: v.cancel }), orders.cancel);
orderRoutes.post('/:id/remind', requirePermission(P.PAYMENTS_WRITE), id, orders.remindBalance);
orderRoutes.post('/:id/discount', requirePermission(P.DISCOUNTS_WRITE), id, validate({ body: v.discount }), orders.discount);

const customRoutes = express.Router();
const referenceImages = uploadImages('referenceImages', { maxCount: 6, folder: 'custom-requests' });
const manage = requirePermission(P.CUSTOM_REQUESTS_MANAGE);
customRoutes.get('/', customerOr(P.CUSTOM_REQUESTS_MANAGE, P.ORDERS_READ), list, customOrders.list);
customRoutes.get('/:id', customerOr(P.CUSTOM_REQUESTS_MANAGE, P.ORDERS_READ), id, customOrders.get);
customRoutes.post('/', requireRole(ROLES.CUSTOMER), referenceImages, parseMultipartJson, validate({ body: v.customRequest }), customOrders.submit);
customRoutes.post('/:id/review', manage, id, validate({ body: v.note }), customOrders.review);
customRoutes.post('/:id/estimate', manage, id, validate({ body: v.estimate }), customOrders.estimate);
customRoutes.post('/:id/quote', manage, id, validate({ body: v.quote }), customOrders.quote);
customRoutes.post('/:id/reject', manage, id, validate({ body: v.reason }), customOrders.reject);
customRoutes.post('/:id/respond', requireRole(ROLES.CUSTOMER), id, validate({ body: v.quoteResponse }), customOrders.respond);
customRoutes.post('/:id/cancel', requireRole(ROLES.CUSTOMER), id, customOrders.cancel);

module.exports = { orders: orderRoutes, customOrders: customRoutes };

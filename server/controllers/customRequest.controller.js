const { CustomFurnitureRequest } = require('../models');
const service = require('../services/customRequest.service');
const { actorFrom } = require('../services/audit.service');
const { asyncHandler, sendSuccess, sendCreated } = require('../utils/http');
const { paginate, searchFilter, pickFilters, dateRangeFilter } = require('../utils/query');
const { assertFound, customerOf, isCustomer, assertVerifiedCustomer } = require('./helpers');
const { toCustomerOrder } = require('./order.controller');

exports.list = asyncHandler(async (req, res) => {
  const filter = {
    ...pickFilters(req.query, ['status', 'customer'], ['customer']),
    ...searchFilter(req.query.search, ['requestNumber', 'furnitureType', 'description']),
    ...dateRangeFilter('createdAt', req.query.from, req.query.to),
  };
  if (isCustomer(req)) filter.customer = (await customerOf(req))._id;
  const { items, pagination } = await paginate(CustomFurnitureRequest, filter, req.query, {
    populate: [
      { path: 'customer', select: 'name phone' },
      { path: 'order', select: 'orderNumber status' },
    ],
    allowedSort: ['createdAt', 'requiredDate', 'budget'],
  });
  sendSuccess(res, { data: isCustomer(req) ? items.map(service.toCustomerView) : items, pagination });
});

exports.get = asyncHandler(async (req, res) => {
  const filter = { _id: req.params.id };
  if (isCustomer(req)) filter.customer = (await customerOf(req))._id;
  const request = assertFound(
    await CustomFurnitureRequest.findOne(filter)
      .populate('customer', 'name phone email address')
      .populate('order', 'orderNumber status total balance')
      .populate('reviewedBy', 'name')
      .populate('history.by', 'name')
      .lean(),
    'Custom furniture request not found.'
  );
  sendSuccess(res, { data: isCustomer(req) ? service.toCustomerView(request) : request });
});

exports.submit = asyncHandler(async (req, res) => {
  await assertVerifiedCustomer(req);
  const customer = await customerOf(req);
  const request = await service.submitRequest({ ...req.body, referenceImages: req.uploadedFiles || [] }, customer._id, actorFrom(req));
  sendCreated(res, service.toCustomerView(request), 'Your request has been submitted. We will get back to you with a quote.');
});

exports.review = asyncHandler(async (req, res) => {
  sendSuccess(res, { data: await service.startReview(req.params.id, req.body.note, actorFrom(req)), message: 'Request under review' });
});

exports.estimate = asyncHandler(async (req, res) => {
  sendSuccess(res, { data: await service.saveEstimate(req.params.id, req.body, actorFrom(req)), message: 'Estimate saved' });
});

exports.quote = asyncHandler(async (req, res) => {
  sendSuccess(res, { data: await service.sendQuote(req.params.id, req.body, actorFrom(req)), message: 'Quote sent to customer' });
});

exports.reject = asyncHandler(async (req, res) => {
  sendSuccess(res, { data: await service.rejectRequest(req.params.id, req.body.reason, actorFrom(req)), message: 'Request rejected' });
});

exports.respond = asyncHandler(async (req, res) => {
  const customer = await customerOf(req);
  const { request, order } = await service.respondToQuote(req.params.id, customer._id, req.body, actorFrom(req));
  sendSuccess(res, {
    data: { request: service.toCustomerView(request), order: order ? toCustomerOrder(order.toObject()) : null },
    message: req.body.approve ? 'Quote approved — your order has been created. Pay the deposit to start production.' : 'Quote declined',
  });
});

exports.cancel = asyncHandler(async (req, res) => {
  const customer = await customerOf(req);
  const request = await service.cancelByCustomer(req.params.id, customer._id, actorFrom(req));
  sendSuccess(res, { data: service.toCustomerView(request), message: 'Request cancelled' });
});

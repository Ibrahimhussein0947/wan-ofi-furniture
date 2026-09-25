const { Delivery } = require('../models');
const service = require('../services/delivery.service');
const { actorFrom } = require('../services/audit.service');
const { asyncHandler, sendSuccess, sendCreated } = require('../utils/http');
const { paginate, pickFilters, dateRangeFilter } = require('../utils/query');
const { hasPermission, PERMISSIONS } = require('../config/permissions');
const ApiError = require('../utils/ApiError');
const { assertFound } = require('./helpers');

const canSeeAll = (user) => hasPermission(user, PERMISSIONS.DELIVERIES_MANAGE) || hasPermission(user, PERMISSIONS.ORDERS_READ);

exports.list = asyncHandler(async (req, res) => {
  const filter = {
    ...pickFilters(req.query, ['status', 'deliveryPerson', 'order'], ['deliveryPerson', 'order']),
    ...dateRangeFilter('scheduledDate', req.query.from, req.query.to),
  };
  if (!canSeeAll(req.user) || req.query.mine === 'true') filter.deliveryPerson = req.user._id;
  const { items, pagination } = await paginate(Delivery, filter, req.query, {
    populate: [
      { path: 'order', select: 'orderNumber balance total' },
      { path: 'customer', select: 'name phone' },
      { path: 'deliveryPerson', select: 'name phone' },
    ],
    allowedSort: ['scheduledDate', 'createdAt'],
    sort: { scheduledDate: 1 },
  });
  sendSuccess(res, { data: items, pagination });
});

exports.get = asyncHandler(async (req, res) => {
  const delivery = assertFound(
    await Delivery.findById(req.params.id)
      .populate('order', 'orderNumber items total amountPaid balance status deliveryMethod')
      .populate('customer', 'name phone email')
      .populate('deliveryPerson', 'name phone')
      .populate('history.by', 'name')
      .lean(),
    'Delivery not found.'
  );
  if (!canSeeAll(req.user) && String(delivery.deliveryPerson?._id) !== String(req.user._id)) throw ApiError.forbidden('This delivery is not assigned to you.');
  sendSuccess(res, { data: delivery });
});

exports.create = asyncHandler(async (req, res) => {
  sendCreated(res, await service.scheduleDelivery(req.body, actorFrom(req)), 'Delivery created');
});

exports.update = asyncHandler(async (req, res) => {
  const delivery = await service.updateDelivery(req.params.id, req.body, actorFrom(req));
  sendSuccess(res, { data: delivery, message: 'Delivery updated' });
});

exports.proof = asyncHandler(async (req, res) => {
  const files = req.uploadedFiles || [];
  if (!files.length) throw ApiError.badRequest('Please attach a photo or signature.');
  const isSignature = req.body?.kind === 'signature';
  const delivery = await service.addProof(
    req.params.id,
    { images: isSignature ? files.slice(1) : files, signature: isSignature ? files[0] : undefined },
    req.body?.receivedBy,
    actorFrom(req)
  );
  sendSuccess(res, { data: delivery, message: 'Proof of delivery saved' });
});

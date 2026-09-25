const { Supplier, PurchaseOrder, Payment, Material } = require('../models');
const purchaseService = require('../services/purchase.service');
const { audit, actorFrom, diff } = require('../services/audit.service');
const { asyncHandler, sendSuccess, sendCreated } = require('../utils/http');
const { paginate, searchFilter, pickFilters, dateRangeFilter } = require('../utils/query');
const ApiError = require('../utils/ApiError');
const { assertFound } = require('./helpers');
const { AUDIT_ACTIONS } = require('../config/constants');

exports.list = asyncHandler(async (req, res) => {
  const filter = searchFilter(req.query.search, ['name', 'contactPerson', 'phone', 'email', 'materialsSupplied']);
  if (req.query.withBalance === 'true') filter.balance = { $gt: 0 };
  const { items, pagination } = await paginate(Supplier, filter, req.query, { allowedSort: ['name', 'balance', 'createdAt'], sort: { name: 1 } });
  sendSuccess(res, { data: items, pagination });
});

exports.get = asyncHandler(async (req, res) => {
  const supplier = assertFound(await Supplier.findById(req.params.id).lean(), 'Supplier not found.');
  const [purchases, payments, materials] = await Promise.all([
    PurchaseOrder.find({ supplier: supplier._id }).sort({ orderDate: -1 }).limit(50).lean(),
    Payment.find({ supplier: supplier._id }).sort({ paidAt: -1 }).limit(50).populate('purchaseOrder', 'poNumber').lean(),
    Material.find({ supplier: supplier._id }).select('name unit quantity unitCost').lean(),
  ]);
  // Transaction history: goods received increase what we owe, payments reduce it.
  const history = [
    ...purchases.filter((p) => p.receivedValue > 0).map((p) => ({ date: p.receivedDate || p.updatedAt, type: 'PURCHASE', reference: p.poNumber, debit: p.receivedValue, credit: 0 })),
    ...payments.map((p) => ({ date: p.paidAt, type: 'PAYMENT', reference: p.paymentNumber, debit: 0, credit: p.amount, method: p.method })),
  ].sort((a, b) => new Date(b.date) - new Date(a.date));
  sendSuccess(res, { data: { ...supplier, purchases, payments, materials, history } });
});

exports.create = asyncHandler(async (req, res) => {
  const supplier = await Supplier.create(req.body);
  await audit(actorFrom(req), { action: AUDIT_ACTIONS.CREATE, entity: 'Supplier', entityId: supplier._id, reference: supplier.name });
  sendCreated(res, supplier, 'Supplier created');
});

exports.update = asyncHandler(async (req, res) => {
  const supplier = assertFound(await Supplier.findById(req.params.id), 'Supplier not found.');
  const before = supplier.toObject();
  Object.assign(supplier, req.body);
  await supplier.save();
  await audit(actorFrom(req), {
    action: AUDIT_ACTIONS.UPDATE,
    entity: 'Supplier',
    entityId: supplier._id,
    reference: supplier.name,
    changes: diff(before, supplier.toObject(), ['name', 'phone', 'email', 'paymentTerms', 'isActive']),
  });
  sendSuccess(res, { data: supplier, message: 'Supplier updated' });
});

exports.remove = asyncHandler(async (req, res) => {
  const supplier = assertFound(await Supplier.findById(req.params.id), 'Supplier not found.');
  if (supplier.balance !== 0) throw ApiError.badRequest('Settle the supplier balance before removing this supplier.');
  if (await PurchaseOrder.exists({ supplier: supplier._id, status: { $in: ['ORDERED', 'PARTIALLY_RECEIVED'] } })) {
    throw ApiError.badRequest('This supplier has open purchase orders.');
  }
  await supplier.softDelete(req.user._id);
  await audit(actorFrom(req), { action: AUDIT_ACTIONS.DELETE, entity: 'Supplier', entityId: supplier._id, reference: supplier.name });
  sendSuccess(res, { message: 'Supplier removed' });
});

// ---------- Purchase orders ----------
exports.listPurchases = asyncHandler(async (req, res) => {
  const filter = {
    ...pickFilters(req.query, ['supplier', 'status', 'paymentStatus'], ['supplier']),
    ...searchFilter(req.query.search, ['poNumber']),
    ...dateRangeFilter('orderDate', req.query.from, req.query.to),
  };
  const { items, pagination } = await paginate(PurchaseOrder, filter, req.query, {
    populate: { path: 'supplier', select: 'name' },
    allowedSort: ['orderDate', 'total', 'poNumber'],
    sort: { orderDate: -1 },
  });
  sendSuccess(res, { data: items, pagination });
});

exports.getPurchase = asyncHandler(async (req, res) => {
  const po = assertFound(
    await PurchaseOrder.findById(req.params.id).populate('supplier', 'name phone email balance').populate('items.material', 'name unit quantity').populate('createdBy', 'name').lean(),
    'Purchase order not found.'
  );
  const payments = await Payment.find({ purchaseOrder: po._id }).sort({ paidAt: -1 }).lean();
  sendSuccess(res, { data: { ...po, payments } });
});

exports.createPurchase = asyncHandler(async (req, res) => {
  sendCreated(res, await purchaseService.createPurchaseOrder(req.body, actorFrom(req)), 'Purchase order created');
});

exports.receivePurchase = asyncHandler(async (req, res) => {
  const po = await purchaseService.receivePurchaseOrder(req.params.id, req.body, actorFrom(req));
  sendSuccess(res, { data: po, message: 'Goods received and stock updated' });
});

exports.cancelPurchase = asyncHandler(async (req, res) => {
  const po = await purchaseService.cancelPurchaseOrder(req.params.id, req.body.reason, actorFrom(req));
  sendSuccess(res, { data: po, message: 'Purchase order cancelled' });
});

exports.markOrdered = asyncHandler(async (req, res) => {
  const po = await PurchaseOrder.findOneAndUpdate({ _id: req.params.id, status: 'DRAFT' }, { $set: { status: 'ORDERED', orderDate: new Date() } }, { new: true });
  if (!po) throw ApiError.badRequest('Only draft purchase orders can be placed.');
  await audit(actorFrom(req), { action: AUDIT_ACTIONS.STATUS_CHANGE, entity: 'PurchaseOrder', entityId: po._id, reference: po.poNumber, description: 'Placed with supplier' });
  sendSuccess(res, { data: po, message: 'Purchase order placed' });
});

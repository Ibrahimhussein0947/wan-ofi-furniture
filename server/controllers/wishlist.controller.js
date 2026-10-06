const mongoose = require('mongoose');
const { Customer, Product } = require('../models');
const ApiError = require('../utils/ApiError');
const { asyncHandler, sendSuccess } = require('../utils/http');
const { PRODUCT_STATUS } = require('../config/constants');
const { customerOf } = require('./helpers');
const { toPublicProduct } = require('./catalog.controller');
const { defaultBranchId } = require('../services/inventory.service');

const MAX_ITEMS = 200;
const VISIBLE = [PRODUCT_STATUS.ACTIVE, PRODUCT_STATUS.OUT_OF_STOCK];

/** The customer's saved products, newest first, skipping any no longer for sale. */
async function wishlistOf(customerId) {
  const customer = await Customer.findById(customerId).select('wishlist').lean();
  const entries = customer?.wishlist || [];
  const products = await Product.find({ _id: { $in: entries.map((e) => e.product) }, status: { $in: VISIBLE } })
    .populate('category', 'name slug')
    .lean();
  const byId = new Map(products.map((p) => [String(p._id), p]));
  const online = await defaultBranchId();
  return entries.filter((e) => byId.has(String(e.product))).map((e) => ({ ...toPublicProduct(byId.get(String(e.product)), online), savedAt: e.addedAt }));
}

exports.list = asyncHandler(async (req, res) => {
  const customer = await customerOf(req);
  sendSuccess(res, { data: await wishlistOf(customer._id) });
});

exports.add = asyncHandler(async (req, res) => {
  const customer = await customerOf(req);
  const productId = req.params.productId;
  if (!(await Product.exists({ _id: productId, status: { $in: VISIBLE } }))) throw ApiError.notFound('Product not found.');
  // Move to the front if already saved; keep the list bounded.
  await Customer.updateOne({ _id: customer._id }, { $pull: { wishlist: { product: productId } } });
  await Customer.updateOne({ _id: customer._id }, { $push: { wishlist: { $each: [{ product: productId, addedAt: new Date() }], $position: 0, $slice: MAX_ITEMS } } });
  sendSuccess(res, { data: await wishlistOf(customer._id), message: 'Saved to your wishlist' });
});

exports.remove = asyncHandler(async (req, res) => {
  const customer = await customerOf(req);
  await Customer.updateOne({ _id: customer._id }, { $pull: { wishlist: { product: req.params.productId } } });
  sendSuccess(res, { data: await wishlistOf(customer._id), message: 'Removed from your wishlist' });
});

// Products a visitor saved before logging in move into their account.
exports.merge = asyncHandler(async (req, res) => {
  const customer = await customerOf(req);
  const ids = [...new Set(req.body.productIds.map(String))].filter((id) => mongoose.isValidObjectId(id));
  const existing = await Product.find({ _id: { $in: ids }, status: { $in: VISIBLE } }).select('_id').lean();
  const current = new Set(((await Customer.findById(customer._id).select('wishlist').lean())?.wishlist || []).map((e) => String(e.product)));
  const toAdd = existing.filter((p) => !current.has(String(p._id))).map((p) => ({ product: p._id, addedAt: new Date() }));
  if (toAdd.length) {
    await Customer.updateOne({ _id: customer._id }, { $push: { wishlist: { $each: toAdd, $position: 0, $slice: MAX_ITEMS } } });
  }
  sendSuccess(res, { data: await wishlistOf(customer._id) });
});

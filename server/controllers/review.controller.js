const { Product } = require('../models');
const reviewService = require('../services/review.service');
const { actorFrom } = require('../services/audit.service');
const { asyncHandler, sendSuccess, sendCreated } = require('../utils/http');
const { isObjectId } = require('../utils/query');
const { assertFound, customerOf, isCustomer } = require('./helpers');

/** Products are addressed by id or slug on the storefront. */
async function productIdFrom(param) {
  const query = isObjectId(param) ? { _id: param } : { slug: String(param).toLowerCase() };
  const product = assertFound(await Product.findOne(query).select('_id').lean(), 'Product not found.');
  return product._id;
}

// Public list. A logged-in customer also learns whether they may write a review.
exports.listForProduct = asyncHandler(async (req, res) => {
  const productId = await productIdFrom(req.params.id);
  const data = await reviewService.listForProduct(productId, req.query);
  if (isCustomer(req)) {
    const customer = await customerOf(req);
    const { canReview, existing } = await reviewService.eligibility(customer._id, productId);
    data.canReview = canReview;
    data.myReview = existing || null;
  } else {
    data.canReview = false;
  }
  sendSuccess(res, { data });
});

exports.create = asyncHandler(async (req, res) => {
  const customer = await customerOf(req);
  const productId = await productIdFrom(req.params.id);
  const review = await reviewService.createReview(customer._id, productId, req.body, actorFrom(req));
  sendCreated(res, review, 'Thank you for your review!');
});

exports.listForModeration = asyncHandler(async (req, res) => {
  const { items, pagination } = await reviewService.listForModeration(req.query);
  sendSuccess(res, { data: items, pagination });
});

exports.setStatus = asyncHandler(async (req, res) => {
  const review = await reviewService.setStatus(req.params.id, req.body.status, actorFrom(req));
  sendSuccess(res, { data: review, message: review.status === 'HIDDEN' ? 'Review hidden' : 'Review published' });
});

const { Review, Product, Order } = require('../models');
const ApiError = require('../utils/ApiError');
const { ORDER_STATUS, AUDIT_ACTIONS } = require('../config/constants');
const { audit } = require('./audit.service');

// Customers can review a product once an order containing it has reached them.
const RECEIVED = [ORDER_STATUS.DELIVERED, ORDER_STATUS.COMPLETED];

/** The customer's delivered order containing this product, or null. */
function receivedOrder(customerId, productId) {
  return Order.findOne({ customer: customerId, status: { $in: RECEIVED }, 'items.product': productId }).select('_id orderNumber').sort({ createdAt: -1 }).lean();
}

/** Keeps the product's average rating and review count in step with its published reviews. */
async function refreshProductRating(productId) {
  const [stats] = await Review.aggregate([
    { $match: { product: productId, status: 'PUBLISHED' } },
    { $group: { _id: null, avg: { $avg: '$rating' }, count: { $sum: 1 } } },
  ]);
  await Product.updateOne({ _id: productId }, { $set: { rating: stats ? Math.round(stats.avg * 10) / 10 : 0, reviewCount: stats?.count || 0 } });
}

async function listForProduct(productId, { page = 1, limit = 10 } = {}) {
  const filter = { product: productId, status: 'PUBLISHED' };
  const [items, total, breakdown] = await Promise.all([
    Review.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('customer', 'name')
      .lean(),
    Review.countDocuments(filter),
    Review.aggregate([{ $match: filter }, { $group: { _id: '$rating', count: { $sum: 1 } } }]),
  ]);
  return {
    // Only the reviewer's first name and initial are shown publicly.
    items: items.map(({ customer, ...r }) => ({ ...r, author: shortName(customer?.name) })),
    pagination: { page, limit, total, pages: Math.max(1, Math.ceil(total / limit)) },
    breakdown: Object.fromEntries([5, 4, 3, 2, 1].map((n) => [n, breakdown.find((b) => b._id === n)?.count || 0])),
  };
}

function shortName(name = '') {
  const [first, last] = name.trim().split(/\s+/);
  return first ? `${first}${last ? ` ${last[0]}.` : ''}` : 'Customer';
}

/** Whether this customer may review the product now, and their existing review if any. */
async function eligibility(customerId, productId) {
  const [existing, order] = await Promise.all([Review.findOne({ product: productId, customer: customerId }).lean(), receivedOrder(customerId, productId)]);
  return { canReview: Boolean(order) && !existing, existing };
}

async function createReview(customerId, productId, { rating, title, comment }, actor) {
  const product = await Product.findById(productId).select('_id name').lean();
  if (!product) throw ApiError.notFound('Product not found.');
  const order = await receivedOrder(customerId, productId);
  if (!order) throw ApiError.forbidden('You can review a product after your order with it has been delivered.');
  if (await Review.exists({ product: productId, customer: customerId })) throw ApiError.conflict('You have already reviewed this product.');

  const review = await Review.create({ product: productId, customer: customerId, order: order._id, rating, title, comment });
  await refreshProductRating(product._id);
  await audit(actor, { action: AUDIT_ACTIONS.CREATE, entity: 'Review', entityId: review._id, reference: product.name, description: `${rating}-star review` });
  return review;
}

async function listForModeration({ status, page = 1, limit = 20 } = {}) {
  const filter = status ? { status } : {};
  const [items, total] = await Promise.all([
    Review.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('product', 'name slug')
      .populate('customer', 'name customerCode')
      .lean(),
    Review.countDocuments(filter),
  ]);
  return { items, pagination: { page, limit, total, pages: Math.max(1, Math.ceil(total / limit)) } };
}

async function setStatus(reviewId, status, actor) {
  const review = await Review.findById(reviewId);
  if (!review) throw ApiError.notFound('Review not found.');
  review.status = status;
  review.moderatedBy = actor?.user?._id;
  await review.save();
  await refreshProductRating(review.product);
  await audit(actor, { action: AUDIT_ACTIONS.UPDATE, entity: 'Review', entityId: review._id, description: `Review ${status === 'HIDDEN' ? 'hidden' : 'published'}` });
  return review;
}

module.exports = { listForProduct, eligibility, createReview, listForModeration, setStatus, refreshProductRating };

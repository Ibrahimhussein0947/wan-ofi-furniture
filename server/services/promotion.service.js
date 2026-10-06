const { Promotion, Order } = require('../models');
const ApiError = require('../utils/ApiError');
const { round2 } = require('../utils/money');
const { ORDER_STATUS } = require('../config/constants');

const normalize = (code) => String(code || '').trim().toUpperCase();

/** Orders that count as a use of the code (cancelled orders give the use back). */
const usesFilter = (code, extra = {}) => ({ promoCode: code, status: { $ne: ORDER_STATUS.CANCELLED }, ...extra });

function discountFor(promotion, subtotal) {
  let amount = promotion.type === 'PERCENT' ? (subtotal * promotion.value) / 100 : promotion.value;
  if (promotion.type === 'PERCENT' && promotion.maxDiscount > 0) amount = Math.min(amount, promotion.maxDiscount);
  return round2(Math.min(amount, subtotal));
}

/**
 * Checks a code against an order subtotal and customer and returns the discount it gives.
 * Throws a 422 with a customer-friendly reason when the code can't be used.
 */
async function evaluate(rawCode, { subtotal, customerId, session } = {}) {
  const code = normalize(rawCode);
  const promotion = await Promotion.findOne({ code }).session(session || null).lean();
  const now = new Date();
  if (!promotion || !promotion.isActive) throw ApiError.unprocessable('This promo code is not valid.');
  if (promotion.startsAt && promotion.startsAt > now) throw ApiError.unprocessable('This promo code is not active yet.');
  if (promotion.endsAt && promotion.endsAt < now) throw ApiError.unprocessable('This promo code has expired.');
  if (subtotal < (promotion.minSubtotal || 0)) {
    throw ApiError.unprocessable(`This code needs an order of at least ${promotion.minSubtotal.toLocaleString()}.`);
  }
  if (promotion.usageLimit > 0 && (await Order.countDocuments(usesFilter(code)).session(session || null)) >= promotion.usageLimit) {
    throw ApiError.unprocessable('This promo code has been fully used.');
  }
  if (customerId && promotion.perCustomerLimit > 0) {
    const used = await Order.countDocuments(usesFilter(code, { customer: customerId })).session(session || null);
    if (used >= promotion.perCustomerLimit) throw ApiError.unprocessable('You have already used this promo code.');
  }
  return { promotion, code, discount: discountFor(promotion, subtotal) };
}

async function withUsage(promotions) {
  const counts = await Order.aggregate([
    { $match: { promoCode: { $in: promotions.map((p) => p.code) }, status: { $ne: ORDER_STATUS.CANCELLED } } },
    { $group: { _id: '$promoCode', uses: { $sum: 1 }, discountGiven: { $sum: '$promoDiscount' } } },
  ]);
  const byCode = new Map(counts.map((c) => [c._id, c]));
  return promotions.map((p) => ({ ...p, uses: byCode.get(p.code)?.uses || 0, discountGiven: byCode.get(p.code)?.discountGiven || 0 }));
}

/** A code "ending" on a date stays valid until the end of that day. */
function withEndOfDay(input) {
  if (input.endsAt) {
    const end = new Date(input.endsAt);
    if (end.getUTCHours() === 0 && end.getUTCMinutes() === 0) end.setUTCHours(23, 59, 59, 999);
    input.endsAt = end;
  }
  return input;
}

async function list() {
  return withUsage(await Promotion.find().sort({ createdAt: -1 }).lean());
}

async function create(input, actor) {
  const code = normalize(input.code);
  if (await Promotion.exists({ code })) throw ApiError.conflict('A promotion with this code already exists.');
  return Promotion.create({ ...withEndOfDay(input), code, createdBy: actor.user?._id });
}

async function update(id, input) {
  const promotion = await Promotion.findById(id);
  if (!promotion) throw ApiError.notFound('Promotion not found.');
  if (input.code && normalize(input.code) !== promotion.code) {
    // Renaming a used code would orphan its usage history.
    if (await Order.exists({ promoCode: promotion.code })) throw ApiError.badRequest('This code has been used, so it cannot be renamed. Create a new code instead.');
    if (await Promotion.exists({ code: normalize(input.code), _id: { $ne: id } })) throw ApiError.conflict('A promotion with this code already exists.');
    input.code = normalize(input.code);
  }
  promotion.set(withEndOfDay(input));
  await promotion.save();
  return promotion;
}

module.exports = { evaluate, list, create, update, discountFor, normalize };

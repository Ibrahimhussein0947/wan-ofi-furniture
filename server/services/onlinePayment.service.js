const crypto = require('crypto');
const { Order, PaymentIntent } = require('../models');
const ApiError = require('../utils/ApiError');
const logger = require('../utils/logger');
const { round2 } = require('../utils/money');
const { withTransaction } = require('../utils/transaction');
const { ORDER_STATUS: O, AUDIT_ACTIONS } = require('../config/constants');
const { activeGateway, GATEWAYS } = require('./gateways');
const { normalisePhone } = require('./channels/sms');
const { applyCustomerPayment } = require('./payment.service');
const { getSettings } = require('./settings.service');
const { audit } = require('./audit.service');
const notify = require('./notification.service');

const EPS = 0.001;

/** Asks the mobile-money provider to push a payment prompt to the customer's phone. */
async function initiatePayment({ order: orderId, amount, network, phone, percent }, customer, user) {
  const gateway = activeGateway();
  if (!gateway) throw ApiError.badRequest('Online payments are not enabled. Please pay by bank transfer or at the showroom.');

  const order = await Order.findOne({ _id: orderId, customer: customer._id });
  if (!order) throw ApiError.notFound('Order not found.');
  if (order.status === O.CANCELLED) throw ApiError.badRequest('This order was cancelled.');
  if (order.balance <= 0) throw ApiError.badRequest('This order is already fully paid.');

  // Prompts still waiting for the customer count against the balance too.
  const pending = await PaymentIntent.aggregate([
    { $match: { order: order._id, status: { $in: ['PENDING', 'PROCESSING'] }, createdAt: { $gt: new Date(Date.now() - 15 * 60 * 1000) } } },
    { $group: { _id: null, total: { $sum: '$amount' } } },
  ]);
  if (round2(amount) + (pending[0]?.total || 0) - order.balance > EPS) {
    throw ApiError.badRequest(`Payment exceeds remaining balance (${order.balance.toLocaleString()}).`);
  }

  const msisdn = normalisePhone(phone);
  if (!msisdn || !/^\+251\d{9}$/.test(msisdn)) throw ApiError.badRequest('Enter a valid Ethiopian mobile number, e.g. 0911 345 678.');

  const settings = await getSettings();
  const intent = await PaymentIntent.create({
    reference: `WOP${Date.now().toString(36).toUpperCase()}${crypto.randomBytes(3).toString('hex').toUpperCase()}`,
    order: order._id,
    customer: customer._id,
    user: user._id,
    amount: round2(amount),
    percent,
    currency: settings.currency,
    gateway: gateway.name,
    network,
    phone: msisdn,
  });

  try {
    const { providerReference } = await gateway.initiate(intent, { onSimulatedCallback: (body) => handleCallback(gateway.name, body) });
    if (providerReference) await PaymentIntent.updateOne({ _id: intent._id }, { $set: { providerReference } });
  } catch (err) {
    logger.error('Payment initiation failed:', err.message);
    await PaymentIntent.updateOne({ _id: intent._id }, { $set: { status: 'FAILED', failureReason: 'Could not reach the payment provider' } });
    throw ApiError.badRequest('We could not start the mobile payment. Please try again or use another method.');
  }
  await audit({ user, ip: 'customer' }, { action: AUDIT_ACTIONS.CREATE, entity: 'PaymentIntent', entityId: intent._id, reference: order.orderNumber, amount: intent.amount, description: `${network} prompt sent to ${msisdn}` });
  return PaymentIntent.findById(intent._id).lean();
}

/**
 * Processes a provider callback. Idempotent: repeated callbacks for the same
 * reference apply the payment at most once.
 */
async function handleCallback(gatewayName, body) {
  const gateway = GATEWAYS[gatewayName];
  if (!gateway) throw ApiError.notFound('Unknown payment provider.');
  const result = gateway.parseCallback(body || {});
  if (!result.reference) throw ApiError.badRequest('Missing payment reference.');

  const intent = await PaymentIntent.findOneAndUpdate(
    { reference: result.reference, gateway: gatewayName, status: 'PENDING' },
    { $set: { status: 'PROCESSING', callbackPayload: body, providerReference: result.providerReference } },
    { new: true }
  );
  if (!intent) {
    // Already handled (duplicate callback) or unknown reference.
    const existing = await PaymentIntent.findOne({ reference: result.reference }).lean();
    if (!existing) throw ApiError.notFound('Unknown payment reference.');
    return existing;
  }

  const fail = async (reason) => {
    await PaymentIntent.updateOne({ _id: intent._id }, { $set: { status: 'FAILED', failureReason: reason, completedAt: new Date() } });
    await notify.notifyUsers([intent.user], {
      type: 'GENERAL',
      title: 'Mobile payment not completed',
      message: reason,
      link: `/account/orders/${intent.order}`,
    });
    return PaymentIntent.findById(intent._id).lean();
  };

  if (!result.success) return fail(result.reason || 'The payment was declined or timed out.');
  if (Number.isFinite(result.amount) && Math.abs(result.amount - intent.amount) > EPS) {
    logger.error(`Payment ${intent.reference}: amount mismatch (${result.amount} vs ${intent.amount})`);
    await notify.notifyFinance({ type: 'GENERAL', title: `Payment amount mismatch: ${intent.reference}`, message: `Provider reported ${result.amount}, expected ${intent.amount}. Check and record manually.`, link: '/app/payments' });
    return fail('The amount received did not match. Our accounts team will contact you.');
  }

  const actor = { user: { _id: intent.user, name: 'Online payment', role: 'CUSTOMER' }, ip: gatewayName, userAgent: 'payment-webhook' };
  try {
    const { payment } = await withTransaction(async (session, afterCommit) => {
      const order = await Order.findById(intent.order).session(session);
      return applyCustomerPayment(
        order,
        { amount: intent.amount, method: 'MOBILE_PAYMENT', reference: result.providerReference || intent.reference, notes: `${intent.network} ${intent.phone} (${intent.reference})`, percent: intent.percent },
        { session, actor, afterCommit }
      );
    });
    await PaymentIntent.updateOne({ _id: intent._id }, { $set: { status: 'SUCCEEDED', payment: payment._id, completedAt: new Date() } });
  } catch (err) {
    // Money was taken but could not be applied (e.g. the order was paid meanwhile): flag for a manual refund.
    logger.error(`Payment ${intent.reference} could not be applied:`, err.message);
    await notify.notifyFinance({ type: 'GENERAL', title: `Online payment needs attention: ${intent.reference}`, message: `${intent.amount.toLocaleString()} received but not applied: ${err.message}`, link: '/app/payments' });
    return fail('We received your payment but could not apply it automatically. Our accounts team will contact you.');
  }
  return PaymentIntent.findById(intent._id).lean();
}

async function getIntent(reference, customerId) {
  const intent = await PaymentIntent.findOne({ reference, ...(customerId && { customer: customerId }) })
    .select('-callbackPayload')
    .lean();
  if (!intent) throw ApiError.notFound('Payment not found.');
  return intent;
}

module.exports = { initiatePayment, handleCallback, getIntent };

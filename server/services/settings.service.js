const Setting = require('../models/Setting');
const env = require('../config/env');

let cache = null;
let cachedAt = 0;
const TTL_MS = 30 * 1000;

async function getSettings({ fresh = false } = {}) {
  if (!fresh && cache && Date.now() - cachedAt < TTL_MS) return cache;
  let doc = await Setting.findOne({ key: 'global' }).lean();
  if (!doc) doc = (await Setting.create({ key: 'global' })).toObject();
  cache = doc;
  cachedAt = Date.now();
  return doc;
}

async function updateSettings(changes, userId) {
  const doc = await Setting.findOneAndUpdate(
    { key: 'global' },
    { $set: { ...changes, updatedBy: userId } },
    { new: true, upsert: true, runValidators: true }
  ).lean();
  cache = doc;
  cachedAt = Date.now();
  return doc;
}

// Public subset safe to expose to the storefront.
async function getPublicSettings() {
  const s = await getSettings();
  return {
    companyName: s.companyName,
    companyEmail: s.companyEmail,
    companyPhone: s.companyPhone,
    companyAddress: s.companyAddress,
    currency: s.currency,
    depositPercent: s.depositPercent,
    defaultDeliveryFee: s.defaultDeliveryFee,
    paymentInstructions: s.paymentInstructions,
    taxRate: s.taxRate,
    requireEmailVerification: s.requireEmailVerification,
    onlinePayments: env.PAYMENT_PROVIDER !== 'manual',
    mobileNetworks: env.PAYMENT_PROVIDER === 'manual' ? [] : ['MPESA', 'TIGO', 'AIRTEL', 'HALOPESA'],
  };
}

const clearSettingsCache = () => {
  cache = null;
};

module.exports = { getSettings, updateSettings, getPublicSettings, clearSettingsCache };

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

// Confirmation links only reach customers when real email is set up. A production server still on the
// "console" driver can't deliver them, so enforcing the setting there would lock every new customer out.
const emailDeliverable = () => !(env.NODE_ENV === 'production' && env.EMAIL_DRIVER === 'console');
const emailVerificationRequired = (settings) => Boolean(settings?.requireEmailVerification) && emailDeliverable();

async function updateSettings({ socialLinks, ...changes }, userId) {
  // Social links are set one by one, so saving only Telegram doesn't clear Facebook.
  const social = Object.fromEntries(Object.entries(socialLinks || {}).map(([k, v]) => [`socialLinks.${k}`, v]));
  const doc = await Setting.findOneAndUpdate(
    { key: 'global' },
    { $set: { ...changes, ...social, updatedBy: userId } },
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
    socialLinks: {
      facebook: s.socialLinks?.facebook || '',
      telegram: s.socialLinks?.telegram || '',
      whatsapp: s.socialLinks?.whatsapp || '',
      instagram: s.socialLinks?.instagram || '',
    },
    currency: s.currency,
    depositPercent: s.depositPercent,
    defaultDeliveryFee: s.defaultDeliveryFee,
    paymentInstructions: s.paymentInstructions,
    bankAccounts: customerBankAccounts(s),
    taxRate: s.taxRate,
    customWarrantyMonths: s.customWarrantyMonths,
    requireEmailVerification: emailVerificationRequired(s),
    emailDelivery: emailDeliverable(),
    onlinePayments: env.PAYMENT_PROVIDER !== 'manual',
    mobileNetworks: env.PAYMENT_PROVIDER === 'manual' ? [] : ['TELEBIRR', 'CBE_BIRR', 'AMOLE', 'MPESA'],
  };
}

const clearSettingsCache = () => {
  cache = null;
};

// The bank accounts customers may transfer to: active ones only, without internal flags.
function customerBankAccounts(settings) {
  return (settings?.bankAccounts || [])
    .filter((a) => a.isActive !== false)
    .map(({ type, bankName, accountName, accountNumber, branch, notes }) => ({ type: type || 'BANK', bankName, accountName, accountNumber, branch, notes }));
}

module.exports = { emailVerificationRequired, getSettings, updateSettings, getPublicSettings, clearSettingsCache, customerBankAccounts };

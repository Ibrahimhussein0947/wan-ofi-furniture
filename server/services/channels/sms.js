const env = require('../../config/env');
const logger = require('../../utils/logger');

const outbox = [];

/** Normalises Tanzanian numbers to international format: 0712… → +255712… */
function normalisePhone(phone) {
  if (!phone) return null;
  const digits = String(phone).replace(/[^\d+]/g, '');
  if (digits.startsWith('+')) return digits;
  if (digits.startsWith('255')) return `+${digits}`;
  if (digits.startsWith('0') && digits.length === 10) return `+255${digits.slice(1)}`;
  return digits.length >= 9 ? `+${digits}` : null;
}

async function sendViaAfricasTalking(to, message) {
  const body = new URLSearchParams({ username: env.AT_USERNAME, to, message });
  if (env.AT_SENDER_ID) body.set('from', env.AT_SENDER_ID);
  const host = env.AT_USERNAME === 'sandbox' ? 'https://api.sandbox.africastalking.com' : 'https://api.africastalking.com';
  const res = await fetch(`${host}/version1/messaging`, {
    method: 'POST',
    headers: { apiKey: env.AT_API_KEY, Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  if (!res.ok) throw new Error(`Africa's Talking responded ${res.status}`);
}

/** Sends an SMS (max ~160 chars recommended). Never throws. */
async function sendSms({ to, message }) {
  const phone = normalisePhone(to);
  if (!phone) return false;
  const text = String(message).slice(0, 459);
  try {
    if (env.isTest) {
      outbox.push({ to: phone, message: text });
      return true;
    }
    if (process.env.MUTE_OUTBOUND === '1') return true;
    if (env.SMS_DRIVER === 'console') {
      logger.info(`[sms → ${phone}] ${text}`);
      return true;
    }
    await sendViaAfricasTalking(phone, text);
    return true;
  } catch (err) {
    logger.error(`SMS to ${phone} failed:`, err.message);
    return false;
  }
}

module.exports = { sendSms, normalisePhone, outbox };

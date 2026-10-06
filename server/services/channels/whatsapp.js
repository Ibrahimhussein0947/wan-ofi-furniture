const env = require('../../config/env');
const logger = require('../../utils/logger');
const { normalisePhone } = require('./sms');

const outbox = [];

/**
 * Sends a WhatsApp message through Meta's WhatsApp Cloud API. Business-initiated messages
 * must use a pre-approved template; ours takes two body variables: {{1}} title, {{2}} details.
 * Never throws.
 */
async function sendWhatsApp({ to, title, message }) {
  const phone = normalisePhone(to);
  if (!phone) return false;
  try {
    if (env.isTest) {
      outbox.push({ to: phone, title, message });
      return true;
    }
    if (process.env.MUTE_OUTBOUND === '1') return true;
    if (env.WHATSAPP_DRIVER !== 'cloud') {
      logger.info(`[whatsapp → ${phone}] ${title}${message ? ` — ${message}` : ''}`);
      return true;
    }
    const res = await fetch(`https://graph.facebook.com/v20.0/${env.WHATSAPP_PHONE_NUMBER_ID}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${env.WHATSAPP_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: phone.replace('+', ''),
        type: 'template',
        template: {
          name: env.WHATSAPP_TEMPLATE,
          language: { code: env.WHATSAPP_TEMPLATE_LANG },
          components: [
            {
              type: 'body',
              // Template variables cannot contain newlines or more than four spaces in a row.
              parameters: [title, message || '-'].map((text) => ({ type: 'text', text: String(text).replace(/\s+/g, ' ').slice(0, 1000) })),
            },
          ],
        },
      }),
    });
    if (!res.ok) throw new Error(`WhatsApp responded ${res.status}`);
    return true;
  } catch (err) {
    logger.error(`WhatsApp to ${phone} failed:`, err.message);
    return false;
  }
}

const isEnabled = () => env.WHATSAPP_DRIVER === 'cloud';

module.exports = { sendWhatsApp, isEnabled, outbox };

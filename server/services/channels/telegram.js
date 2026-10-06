const env = require('../../config/env');
const logger = require('../../utils/logger');

const outbox = [];
const api = (method) => `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/${method}`;

const escapeHtml = (s) => String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]);

/**
 * Sends a Telegram message to a linked chat, with an optional "open" button. Never throws.
 * Links only work as buttons over https, so local development links are sent as text.
 */
async function sendTelegram({ chatId, title, message, url }) {
  if (!chatId) return false;
  const text = [`<b>${escapeHtml(title)}</b>`, message && escapeHtml(message)].filter(Boolean).join('\n').slice(0, 4000);
  try {
    if (env.isTest) {
      outbox.push({ chatId, title, message, url });
      return true;
    }
    if (process.env.MUTE_OUTBOUND === '1') return true;
    if (env.TELEGRAM_DRIVER !== 'bot') {
      logger.info(`[telegram → ${chatId}] ${title}${message ? ` — ${message}` : ''}`);
      return true;
    }
    const body = { chat_id: chatId, text, parse_mode: 'HTML', disable_web_page_preview: true };
    if (url?.startsWith('https://')) body.reply_markup = { inline_keyboard: [[{ text: 'Open in Wan Ofi', url }]] };
    const res = await fetch(api('sendMessage'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    if (!res.ok) throw new Error(`Telegram responded ${res.status}`);
    return true;
  } catch (err) {
    logger.error(`Telegram to ${chatId} failed:`, err.message);
    return false;
  }
}

/** Deep link that opens the bot with a one-time code the webhook uses to link the account. */
const linkUrl = (code) => (env.TELEGRAM_BOT_USERNAME ? `https://t.me/${env.TELEGRAM_BOT_USERNAME}?start=${code}` : null);

const isEnabled = () => env.TELEGRAM_DRIVER === 'bot' && Boolean(env.TELEGRAM_BOT_USERNAME);

module.exports = { sendTelegram, linkUrl, isEnabled, outbox };

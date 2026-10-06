const crypto = require('crypto');
const env = require('../config/env');
const { User } = require('../models');
const logger = require('../utils/logger');
const { asyncHandler, sendSuccess } = require('../utils/http');
const telegram = require('../services/channels/telegram');
const whatsapp = require('../services/channels/whatsapp');

const LINK_TTL_MS = 15 * 60 * 1000;

/** Which chat channels are set up, and whether this user's Telegram is connected. */
exports.status = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id).select('+telegramChatId phone notificationPrefs').lean();
  sendSuccess(res, {
    data: {
      telegram: { available: telegram.isEnabled(), connected: Boolean(user.telegramChatId), enabled: user.notificationPrefs?.telegram !== false },
      whatsapp: { available: whatsapp.isEnabled(), hasPhone: Boolean(user.phone), enabled: user.notificationPrefs?.whatsapp === true },
    },
  });
});

/** A one-time deep link that opens the bot; the bot's webhook completes the link. */
exports.createLink = asyncHandler(async (req, res) => {
  const code = crypto.randomBytes(12).toString('hex');
  await User.updateOne({ _id: req.user._id }, { $set: { telegramLinkCode: code, telegramLinkExpires: new Date(Date.now() + LINK_TTL_MS) } });
  sendSuccess(res, { data: { url: telegram.linkUrl(code), expiresInMinutes: LINK_TTL_MS / 60000 } });
});

exports.disconnect = asyncHandler(async (req, res) => {
  await User.updateOne({ _id: req.user._id }, { $unset: { telegramChatId: 1, telegramLinkCode: 1, telegramLinkExpires: 1 } });
  sendSuccess(res, { message: 'Telegram disconnected' });
});

/**
 * Bot webhook. Telegram posts every message the bot receives; only "/start <code>" (link)
 * and "/stop" (unlink) are acted on. Always answers 200 so Telegram doesn't retry.
 */
exports.webhook = async (req, res) => {
  if (!env.TELEGRAM_WEBHOOK_SECRET || req.params.secret !== env.TELEGRAM_WEBHOOK_SECRET) return res.sendStatus(404);
  res.sendStatus(200);
  try {
    const msg = req.body?.message;
    const chatId = msg?.chat?.id && String(msg.chat.id);
    const text = String(msg?.text || '').trim();
    if (!chatId) return;

    if (text.startsWith('/start')) {
      const code = text.split(/\s+/)[1];
      const user = code && (await User.findOne({ telegramLinkCode: code, telegramLinkExpires: { $gt: new Date() } }).select('name'));
      if (!user) {
        await telegram.sendTelegram({ chatId, title: 'Link expired', message: 'Open Wan Ofi → Profile → Notifications and tap "Connect Telegram" again.' });
        return;
      }
      // One Telegram chat belongs to one account.
      await User.updateMany({ telegramChatId: chatId, _id: { $ne: user._id } }, { $unset: { telegramChatId: 1 } });
      await User.updateOne({ _id: user._id }, { $set: { telegramChatId: chatId, 'notificationPrefs.telegram': true }, $unset: { telegramLinkCode: 1, telegramLinkExpires: 1 } });
      await telegram.sendTelegram({ chatId, title: `Connected, ${user.name.split(' ')[0]}!`, message: 'You will get Wan Ofi updates here. Send /stop to turn them off.' });
    } else if (text === '/stop') {
      await User.updateMany({ telegramChatId: chatId }, { $unset: { telegramChatId: 1 } });
      await telegram.sendTelegram({ chatId, title: 'Disconnected', message: 'You will no longer get Wan Ofi updates here.' });
    }
  } catch (err) {
    logger.error('Telegram webhook failed:', err.message);
  }
};

const Notification = require('../models/Notification');
const User = require('../models/User');
const Customer = require('../models/Customer');
const env = require('../config/env');
const { ROLES, WORKER_ROLES } = require('../config/constants');
const { sendEmail } = require('./channels/email');
const { sendSms } = require('./channels/sms');
const { sendTelegram } = require('./channels/telegram');
const { sendWhatsApp } = require('./channels/whatsapp');
const { publish } = require('./events.service');
const logger = require('../utils/logger');

// Notification types that also leave the app, and through which channel.
const EXTERNAL = {
  ORDER_CONFIRMED: { email: true, sms: true },
  PAYMENT_RECEIVED: { email: true, sms: false },
  PRODUCTION_STARTED: { email: true, sms: false },
  PRODUCTION_COMPLETED: { email: true, sms: false },
  READY_FOR_DELIVERY: { email: true, sms: true },
  DELIVERED: { email: true, sms: true },
  PAYMENT_REMINDER: { email: true, sms: true },
  QUOTE_READY: { email: true, sms: true },
  LOW_STOCK: { email: true, sms: false },
  APPROVAL_REQUIRED: { email: true, sms: false },
  LARGE_EXPENSE: { email: true, sms: false },
  PRODUCTION_DELAY: { email: true, sms: false },
  JOB_ASSIGNED: { email: false, sms: true },
  PRODUCTION_PROBLEM: { email: false, sms: true },
};

async function deliverExternally(recipients, { type, title, message, link }) {
  const channels = EXTERNAL[type];
  if (!channels) return;
  const users = await User.find({ _id: { $in: recipients }, isActive: true }).select('email phone notificationPrefs +telegramChatId').lean();
  const url = link ? `${env.APP_URL}${link}` : undefined;
  await Promise.all(
    users.flatMap((u) => {
      const jobs = [];
      if (channels.email && u.notificationPrefs?.email !== false && u.email) {
        jobs.push(sendEmail({ to: u.email, subject: title, title, lines: [message].filter(Boolean), action: link ? { label: 'Open in Wan Ofi', url: `${env.APP_URL}${link}` } : undefined }));
      }
      if (channels.sms && u.notificationPrefs?.sms !== false && u.phone) {
        jobs.push(sendSms({ to: u.phone, message: `Wan Ofi: ${title}${message ? ` - ${message}` : ''}` }));
      }
      // Chat apps get every event that goes out externally, when the user has them switched on.
      if (u.telegramChatId && u.notificationPrefs?.telegram !== false) {
        jobs.push(sendTelegram({ chatId: u.telegramChatId, title, message, url }));
      }
      if (u.phone && u.notificationPrefs?.whatsapp === true) {
        jobs.push(sendWhatsApp({ to: u.phone, title, message }));
      }
      return jobs;
    })
  );
}

async function notifyUsers(userIds, { type = 'GENERAL', title, message, link, data }) {
  const unique = [...new Set((userIds || []).filter(Boolean).map(String))];
  if (!unique.length) return [];
  try {
    const docs = await Notification.insertMany(unique.map((recipient) => ({ recipient, type, title, message, link, data })));
    unique.forEach((id) => publish(id, { kind: 'notification', type, title }));
    // Email/SMS go out in the background so a slow provider never delays the request.
    deliverExternally(unique, { type, title, message, link }).catch((err) => logger.error('External notification failed:', err.message));
    return docs;
  } catch (err) {
    logger.error('Notification failed:', err.message);
    return [];
  }
}

async function userIdsFor({ roles = [], workerRoles = [] }) {
  const or = [];
  if (roles.length) or.push({ role: { $in: roles } });
  if (workerRoles.length) or.push({ role: ROLES.WORKER, workerRole: { $in: workerRoles } });
  if (!or.length) return [];
  const users = await User.find({ $or: or, isActive: true }).select('_id').lean();
  return users.map((u) => u._id);
}

const notifyRoles = async (target, payload) => notifyUsers(await userIdsFor(target), payload);

const notifyOwners = (payload) => notifyRoles({ roles: [ROLES.OWNER] }, payload);
const notifyAccountants = (payload) => notifyRoles({ roles: [ROLES.ACCOUNTANT] }, payload);
const notifyFinance = (payload) => notifyRoles({ roles: [ROLES.OWNER, ROLES.ACCOUNTANT] }, payload);
const notifySupervisors = (payload) =>
  notifyRoles({ roles: [ROLES.OWNER], workerRoles: [WORKER_ROLES.SUPERVISOR] }, payload);

/**
 * Notifies a customer. Walk-in customers without an online account still get
 * email/SMS for important updates when we have their contact details.
 */
async function notifyCustomer(customerId, payload) {
  const customer = await Customer.findById(customerId).select('user email phone').lean();
  if (!customer) return [];
  if (customer.user) return notifyUsers([customer.user], payload);
  const channels = EXTERNAL[payload.type];
  if (channels?.email && customer.email) await sendEmail({ to: customer.email, subject: payload.title, title: payload.title, lines: [payload.message].filter(Boolean) });
  if (channels?.sms && customer.phone) await sendSms({ to: customer.phone, message: `Wan Ofi: ${payload.title}${payload.message ? ` - ${payload.message}` : ''}` });
  return [];
}

module.exports = {
  EXTERNAL,
  notifyUsers,
  notifyRoles,
  notifyOwners,
  notifyAccountants,
  notifyFinance,
  notifySupervisors,
  notifyCustomer,
};

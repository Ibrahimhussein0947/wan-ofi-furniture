const mongoose = require('mongoose');
const { Message, User, Order, Customer } = require('../models');
const ApiError = require('../utils/ApiError');
const { ROLES, WORKER_ROLES } = require('../config/constants');
const { notifyUsers } = require('./notification.service');
const { publish } = require('./events.service');

/**
 * Who may talk to whom:
 *   Customer ↔ Company (owner, accountants, supervisors)
 *   Worker ↔ Supervisor / Owner
 *   Accountant ↔ Owner (and customers, for payment follow-up)
 *   Owner ↔ anyone
 */
function canMessage(sender, receiver) {
  if (!receiver || !receiver.isActive || String(sender._id) === String(receiver._id)) return false;
  const isSupervisor = (u) => u.role === ROLES.WORKER && u.workerRole === WORKER_ROLES.SUPERVISOR;
  const companyContact = (u) => u.role === ROLES.OWNER || u.role === ROLES.ACCOUNTANT || isSupervisor(u);

  if (sender.role === ROLES.OWNER || receiver.role === ROLES.OWNER) return true;
  if (sender.role === ROLES.CUSTOMER) return companyContact(receiver);
  if (receiver.role === ROLES.CUSTOMER) return companyContact(sender);
  if (sender.role === ROLES.WORKER && receiver.role === ROLES.WORKER) return isSupervisor(sender) || isSupervisor(receiver);
  if (sender.role === ROLES.ACCOUNTANT && receiver.role === ROLES.ACCOUNTANT) return true;
  return false;
}

async function contactsFor(user) {
  const candidates = await User.find({ isActive: true, _id: { $ne: user._id } })
    .select('name role workerRole avatar')
    .sort({ role: 1, name: 1 })
    .lean();
  let allowed = candidates.filter((c) => canMessage(user, { ...c, isActive: true }));
  // Customers see "the company" as a short list of business contacts only.
  if (user.role === ROLES.CUSTOMER) allowed = allowed.map((c) => ({ ...c, name: `${c.name} (Wan Ofi ${c.role === ROLES.OWNER ? 'Management' : c.role === ROLES.ACCOUNTANT ? 'Accounts' : 'Production'})` }));
  // Staff can find customers they may message via search, but the list is capped.
  return allowed.slice(0, 200);
}

async function sendMessage(sender, { receiver: receiverId, body = '', order: orderId, attachments = [] }) {
  if (!body.trim() && !attachments.length) throw ApiError.badRequest('Write a message or attach a photo.');
  let receiver;
  if (!receiverId && sender.role === ROLES.CUSTOMER) {
    // "Contact the business": route to the first active owner.
    receiver = await User.findOne({ role: ROLES.OWNER, isActive: true }).sort({ createdAt: 1 }).lean();
  } else {
    receiver = await User.findById(receiverId).lean();
  }
  if (!receiver) throw ApiError.notFound('Recipient not found.');
  if (!canMessage(sender, receiver)) throw ApiError.forbidden('You cannot send messages to this person.');

  if (orderId) {
    const order = await Order.findById(orderId).select('customer').lean();
    if (!order) throw ApiError.notFound('Order not found.');
    if (sender.role === ROLES.CUSTOMER) {
      const customer = await Customer.findOne({ user: sender._id }).select('_id').lean();
      if (!customer || String(order.customer) !== String(customer._id)) throw ApiError.forbidden();
    }
  }

  const message = await Message.create({
    conversationKey: Message.keyFor(sender._id, receiver._id),
    sender: sender._id,
    receiver: receiver._id,
    body,
    attachments,
    order: orderId || null,
  });
  publish(sender._id, { kind: 'message' });
  publish(receiver._id, { kind: 'message' });
  await notifyUsers([receiver._id], {
    type: 'MESSAGE',
    title: `New message from ${sender.name}`,
    message: body ? body.slice(0, 140) : '📷 Photo',
    link: receiver.role === ROLES.CUSTOMER ? `/account/messages?with=${sender._id}` : `/app/messages?with=${sender._id}`,
  });
  return message;
}

async function conversations(user) {
  const me = new mongoose.Types.ObjectId(String(user._id));
  const rows = await Message.aggregate([
    { $match: { $or: [{ sender: me }, { receiver: me }] } },
    { $sort: { createdAt: -1 } },
    {
      $group: {
        _id: '$conversationKey',
        lastMessage: { $first: { $cond: [{ $gt: [{ $strLenCP: { $ifNull: ['$body', ''] } }, 0] }, '$body', '📷 Photo'] } },
        lastAt: { $first: '$createdAt' },
        lastSender: { $first: '$sender' },
        other: { $first: { $cond: [{ $eq: ['$sender', me] }, '$receiver', '$sender'] } },
        unread: { $sum: { $cond: [{ $and: [{ $eq: ['$receiver', me] }, { $eq: ['$isRead', false] }] }, 1, 0] } },
      },
    },
    { $sort: { lastAt: -1 } },
    { $limit: 100 },
    { $lookup: { from: 'users', localField: 'other', foreignField: '_id', as: 'user' } },
    { $unwind: '$user' },
    { $project: { _id: 0, key: '$_id', lastMessage: 1, lastAt: 1, unread: 1, fromMe: { $eq: ['$lastSender', me] }, user: { _id: '$user._id', name: '$user.name', role: '$user.role', workerRole: '$user.workerRole' } } },
  ]);
  return rows;
}

async function thread(user, otherId, { before, limit = 50 } = {}) {
  const key = Message.keyFor(user._id, otherId);
  const filter = { conversationKey: key };
  if (before) filter.createdAt = { $lt: new Date(before) };
  const messages = await Message.find(filter)
    .sort({ createdAt: -1 })
    .limit(Math.min(Number(limit) || 50, 100))
    .populate('order', 'orderNumber')
    .lean();
  await Message.updateMany({ conversationKey: key, receiver: user._id, isRead: false }, { $set: { isRead: true, readAt: new Date() } });
  const other = await User.findById(otherId).select('name role workerRole').lean();
  return { other, messages: messages.reverse() };
}

const unreadCount = (userId) => Message.countDocuments({ receiver: userId, isRead: false });

module.exports = { canMessage, contactsFor, sendMessage, conversations, thread, unreadCount };

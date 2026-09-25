const crypto = require('crypto');
const { EventEmitter } = require('events');

/**
 * In-process event bus for live updates (Server-Sent Events).
 * Works for a single API instance; run several instances behind a load balancer
 * only after replacing this with a shared broker (e.g. Redis pub/sub).
 */
const bus = new EventEmitter();
bus.setMaxListeners(0);

const publish = (userId, event) => bus.emit(`user:${userId}`, event);
const subscribe = (userId, handler) => {
  bus.on(`user:${userId}`, handler);
  return () => bus.off(`user:${userId}`, handler);
};

// EventSource cannot send an Authorization header, so clients first exchange their
// access token for a one-time ticket valid for 60 seconds.
const tickets = new Map();
const TICKET_TTL_MS = 60 * 1000;

function issueTicket(userId) {
  const ticket = crypto.randomBytes(24).toString('hex');
  tickets.set(ticket, { userId: String(userId), expires: Date.now() + TICKET_TTL_MS });
  return ticket;
}

function redeemTicket(ticket) {
  const entry = tickets.get(ticket);
  tickets.delete(ticket);
  if (!entry || entry.expires < Date.now()) return null;
  return entry.userId;
}

setInterval(() => {
  const now = Date.now();
  tickets.forEach((v, k) => v.expires < now && tickets.delete(k));
}, 5 * 60 * 1000).unref();

module.exports = { publish, subscribe, issueTicket, redeemTicket };

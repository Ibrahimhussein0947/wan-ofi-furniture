const os = require('os');
const mongoose = require('mongoose');
const { User, Order, Product, Customer, Payment, Setting } = require('../models');
const ApiError = require('../utils/ApiError');
const settingsService = require('./settings.service');
const { audit } = require('./audit.service');
const { AUDIT_ACTIONS } = require('../config/constants');
const { SWITCHES } = require('../middleware/systemGate');

const DB_STATES = ['disconnected', 'connected', 'connecting', 'disconnecting'];

async function getSystems() {
  const { systems = {} } = await settingsService.getSettings({ fresh: true });
  return Object.fromEntries(SWITCHES.map((k) => [k, systems[k] !== false]));
}

async function setSystems(changes, actor) {
  const before = await getSystems();
  const $set = {};
  SWITCHES.forEach((k) => typeof changes[k] === 'boolean' && ($set[`systems.${k}`] = changes[k]));
  if (!Object.keys($set).length) throw ApiError.badRequest('Nothing to change.');
  await Setting.findOneAndUpdate({ key: 'global' }, { $set }, { upsert: true });
  settingsService.clearSettingsCache();
  const after = await getSystems();
  const changed = SWITCHES.filter((k) => before[k] !== after[k]).map((k) => `${k} ${after[k] ? 'on' : 'off'}`);
  await audit(actor, { action: AUDIT_ACTIONS.UPDATE, entity: 'System', reference: 'systems', description: `Systems: ${changed.join(', ') || 'no change'}` });
  return after;
}

async function overview() {
  const [systems, usersByRole, orders, products, customers, payments] = await Promise.all([
    getSystems(),
    User.aggregate([{ $match: { deletedAt: null } }, { $group: { _id: '$role', count: { $sum: 1 } } }]),
    Order.countDocuments(),
    Product.countDocuments(),
    Customer.countDocuments(),
    Payment.countDocuments(),
  ]);
  const mem = process.memoryUsage();
  return {
    systems,
    health: {
      api: 'ok',
      database: DB_STATES[mongoose.connection.readyState] || 'unknown',
      uptimeSeconds: Math.round(process.uptime()),
      node: process.version,
      environment: process.env.NODE_ENV || 'development',
      memoryMb: Math.round(mem.rss / 1024 / 1024),
      cpuLoad: Math.round((os.loadavg()[0] || 0) * 100) / 100,
      serverTime: new Date().toISOString(),
    },
    counts: { orders, products, customers, payments, usersByRole: Object.fromEntries(usersByRole.map((r) => [r._id, r.count])) },
  };
}

module.exports = { getSystems, setSystems, overview };

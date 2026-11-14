const jwt = require('jsonwebtoken');
const env = require('../config/env');
const { User } = require('../models');
const { ROLES } = require('../config/constants');
const settingsService = require('../services/settings.service');

const SWITCHES = ['master', 'storefront', 'customers', 'staff'];
const isOn = (systems, key) => systems?.[key] !== false;

// Always reachable so the super admin can sign in and the host can health-check. Payment and bot
// webhooks stay open too, so money confirmations are not lost while the site is switched off.
const OPEN = [/^\/health$/, /^\/auth\/(login|refresh|logout)$/, /^\/payments\/webhooks\//, /^\/telegram\/webhook\//];

async function roleOf(req) {
  const header = req.headers.authorization || '';
  if (!header.startsWith('Bearer ')) return null;
  try {
    const payload = jwt.verify(header.slice(7), env.JWT_SECRET);
    const user = await User.findById(payload.sub).select('role isActive').lean();
    return user?.isActive ? user.role : null;
  } catch {
    return null;
  }
}

/** Switches the API off for everyone except the super admin, answering with a deliberately vague 503. */
async function systemGate(req, res, next) {
  try {
    const { systems } = await settingsService.getSettings();
    if (SWITCHES.every((k) => isOn(systems, k))) return next();
    if (OPEN.some((re) => re.test(req.path))) return next();

    const role = await roleOf(req);
    if (role === ROLES.SUPER_ADMIN) return next();

    let blocked = !isOn(systems, 'master');
    if (!role) blocked = blocked || !isOn(systems, 'storefront');
    else if (role === ROLES.CUSTOMER) blocked = blocked || !isOn(systems, 'customers');
    else blocked = blocked || !isOn(systems, 'staff');
    if (!blocked) return next();
    return res.status(503).json({ success: false, message: 'Something went wrong', code: 'SYSTEM_OFF' });
  } catch (err) {
    return next(err);
  }
}

module.exports = { systemGate, SWITCHES };

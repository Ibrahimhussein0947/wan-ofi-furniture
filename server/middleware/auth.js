const jwt = require('jsonwebtoken');
const env = require('../config/env');
const User = require('../models/User');
const ApiError = require('../utils/ApiError');
const { getPermissionsFor } = require('../config/permissions');

function extractToken(req) {
  const header = req.headers.authorization || '';
  if (header.startsWith('Bearer ')) return header.slice(7);
  return null;
}

async function resolveUser(token) {
  let payload;
  try {
    payload = jwt.verify(token, env.JWT_SECRET);
  } catch (err) {
    throw ApiError.unauthorized(err.name === 'TokenExpiredError' ? 'Your session has expired.' : 'Invalid session.');
  }
  const user = await User.findById(payload.sub).lean();
  if (!user || !user.isActive) throw ApiError.unauthorized('Your account is not active.');
  if (user.passwordChangedAt && payload.iat * 1000 < user.passwordChangedAt.getTime() - 1000) {
    throw ApiError.unauthorized('Your password was changed. Please log in again.');
  }
  user.id = String(user._id);
  user.effectivePermissions = getPermissionsFor(user);
  return user;
}

const requireAuth = async (req, _res, next) => {
  try {
    const token = extractToken(req);
    if (!token) throw ApiError.unauthorized();
    req.user = await resolveUser(token);
    next();
  } catch (err) {
    next(err);
  }
};

// Attaches the user when a valid token is present but never blocks the request.
const optionalAuth = async (req, _res, next) => {
  const token = extractToken(req);
  if (!token) return next();
  try {
    req.user = await resolveUser(token);
  } catch {
    req.user = undefined;
  }
  return next();
};

module.exports = { requireAuth, optionalAuth };

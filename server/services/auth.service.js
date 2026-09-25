const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const env = require('../config/env');
const { User, Customer, RefreshToken } = require('../models');
const { nextNumber } = require('../models/Counter');
const ApiError = require('../utils/ApiError');
const { ROLES, AUDIT_ACTIONS } = require('../config/constants');
const { getPermissionsFor } = require('../config/permissions');
const { audit } = require('./audit.service');
const { notifyOwners } = require('./notification.service');
const { sendEmail } = require('./channels/email');

const MAX_FAILED_LOGINS = 5;
const LOCK_MINUTES = 15;
const INVALID_CREDENTIALS = 'Invalid login credentials.';

const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');

function signAccessToken(user) {
  return jwt.sign({ sub: String(user._id), role: user.role }, env.JWT_SECRET, { expiresIn: env.JWT_EXPIRES_IN });
}

async function issueRefreshToken(user, { family, ip, userAgent } = {}) {
  const token = crypto.randomBytes(48).toString('hex');
  const expiresAt = new Date(Date.now() + env.JWT_REFRESH_EXPIRES_DAYS * 24 * 3600 * 1000);
  await RefreshToken.create({
    user: user._id,
    tokenHash: hashToken(token),
    family: family || crypto.randomUUID(),
    expiresAt,
    ip,
    userAgent: userAgent?.slice(0, 300),
  });
  return { token, expiresAt };
}

function publicUser(user) {
  const u = typeof user.toJSON === 'function' ? user.toJSON() : { ...user };
  delete u.password;
  delete u.failedLoginAttempts;
  delete u.lockUntil;
  return { ...u, permissions: u.permissions || [], effectivePermissions: getPermissionsFor(u) };
}

async function buildSession(user, meta) {
  const accessToken = signAccessToken(user);
  const refresh = await issueRefreshToken(user, meta);
  return { user: publicUser(user), accessToken, refreshToken: refresh.token, refreshExpiresAt: refresh.expiresAt };
}

const HOUR = 3600 * 1000;

/** Creates a random single-use token; only its hash is stored. */
function createToken() {
  const token = crypto.randomBytes(32).toString('hex');
  return { token, hash: hashToken(token) };
}

async function sendVerificationEmail(user) {
  const { token, hash } = createToken();
  await User.updateOne({ _id: user._id }, { $set: { emailVerificationTokenHash: hash, emailVerificationExpires: new Date(Date.now() + 24 * HOUR) } });
  await sendEmail({
    to: user.email,
    subject: 'Confirm your email address',
    title: `Welcome to Wan Ofi Furniture, ${user.name.split(' ')[0]}!`,
    lines: ['Please confirm your email address to place orders and request custom furniture.', 'This link expires in 24 hours.'],
    action: { label: 'Confirm my email', url: `${env.APP_URL}/verify-email?token=${token}` },
  });
}

async function verifyEmail(token) {
  const user = await User.findOne({ emailVerificationTokenHash: hashToken(token), emailVerificationExpires: { $gt: new Date() } });
  if (!user) throw ApiError.badRequest('This verification link is invalid or has expired. Request a new one from your account.');
  user.emailVerified = true;
  user.emailVerificationTokenHash = undefined;
  user.emailVerificationExpires = undefined;
  await user.save({ validateBeforeSave: false });
  await audit({ user }, { action: AUDIT_ACTIONS.UPDATE, entity: 'User', entityId: user._id, description: 'Email verified' });
  return user;
}

async function resendVerification(userId) {
  const user = await User.findById(userId);
  if (!user) throw ApiError.notFound('User not found.');
  if (user.emailVerified) throw ApiError.badRequest('Your email is already verified.');
  await sendVerificationEmail(user);
}

/**
 * Starts a password reset. The response is identical whether or not the email exists,
 * so the endpoint cannot be used to discover accounts.
 */
async function requestPasswordReset(email, meta) {
  const user = await User.findOne({ email: email.toLowerCase(), isActive: true });
  if (!user) return;
  const { token, hash } = createToken();
  await User.updateOne({ _id: user._id }, { $set: { passwordResetTokenHash: hash, passwordResetExpires: new Date(Date.now() + HOUR) } });
  await sendEmail({
    to: user.email,
    subject: 'Reset your password',
    title: 'Reset your Wan Ofi password',
    lines: ['We received a request to reset your password. The link below expires in 1 hour.', "If you didn't ask for this, you can ignore this email — your password stays the same."],
    action: { label: 'Choose a new password', url: `${env.APP_URL}/reset-password?token=${token}` },
  });
  await audit({ user, ...meta }, { action: AUDIT_ACTIONS.UPDATE, entity: 'User', entityId: user._id, description: 'Password reset requested' });
}

async function resetPassword({ token, password }, meta) {
  const user = await User.findOne({ passwordResetTokenHash: hashToken(token), passwordResetExpires: { $gt: new Date() } }).select('+passwordResetTokenHash');
  if (!user) throw ApiError.badRequest('This reset link is invalid or has expired. Please request a new one.');
  user.password = password;
  user.passwordResetTokenHash = undefined;
  user.passwordResetExpires = undefined;
  user.failedLoginAttempts = 0;
  user.lockUntil = undefined;
  // Receiving the email proves the address works.
  user.emailVerified = true;
  await user.save();
  await revokeAllSessions(user._id);
  await audit({ user, ...meta }, { action: AUDIT_ACTIONS.UPDATE, entity: 'User', entityId: user._id, description: 'Password reset completed' });
  await sendEmail({
    to: user.email,
    subject: 'Your password was changed',
    title: 'Your password was changed',
    lines: ['Your Wan Ofi password was just reset and all devices were signed out.', 'If this was not you, contact us immediately.'],
  });
}

async function registerCustomer({ name, email, phone, password, address }, meta) {
  const exists = await User.exists({ email: email.toLowerCase() });
  if (exists) throw ApiError.conflict('An account with this email already exists.');

  const user = await User.create({ name, email, phone, password, role: ROLES.CUSTOMER, emailVerified: false });
  let customer;
  try {
    // Link to an existing walk-in customer record with the same email, if staff created one earlier.
    customer = await Customer.findOneAndUpdate(
      { email: email.toLowerCase(), user: null },
      { $set: { user: user._id, phone: phone || undefined } },
      { new: true }
    );
    if (!customer) {
      customer = await Customer.create({
        user: user._id,
        customerCode: await nextNumber('CUS', { yearly: false, pad: 5 }),
        name,
        email,
        phone,
        address,
        source: 'ONLINE',
      });
    }
  } catch (err) {
    await User.deleteOne({ _id: user._id });
    throw err;
  }

  await audit({ user, ...meta }, { action: AUDIT_ACTIONS.CREATE, entity: 'Customer', entityId: customer._id, description: 'Customer self-registration' });
  await sendVerificationEmail(user);
  await notifyOwners({
    type: 'NEW_CUSTOMER',
    title: 'New customer registered',
    message: `${name} (${email}) created an account.`,
    link: `/app/customers/${customer._id}`,
  });
  return buildSession(user, meta);
}

async function login({ email, password }, meta) {
  const user = await User.findOne({ email: email.toLowerCase() }).select('+password +failedLoginAttempts +lockUntil');
  if (!user) throw ApiError.unauthorized(INVALID_CREDENTIALS);
  if (user.isLocked()) throw ApiError.unauthorized('Account temporarily locked after too many failed attempts. Try again later.');

  const valid = await user.comparePassword(password);
  if (!valid) {
    user.failedLoginAttempts = (user.failedLoginAttempts || 0) + 1;
    if (user.failedLoginAttempts >= MAX_FAILED_LOGINS) {
      user.lockUntil = new Date(Date.now() + LOCK_MINUTES * 60 * 1000);
      user.failedLoginAttempts = 0;
    }
    await user.save({ validateBeforeSave: false });
    await audit({ user, ...meta }, { action: AUDIT_ACTIONS.LOGIN_FAILED, entity: 'User', entityId: user._id });
    throw ApiError.unauthorized(INVALID_CREDENTIALS);
  }
  if (!user.isActive) throw ApiError.forbidden('Your account has been deactivated. Please contact the administrator.');

  user.failedLoginAttempts = 0;
  user.lockUntil = undefined;
  user.lastLoginAt = new Date();
  await user.save({ validateBeforeSave: false });
  await audit({ user, ...meta }, { action: AUDIT_ACTIONS.LOGIN, entity: 'User', entityId: user._id });
  return buildSession(user, meta);
}

/**
 * Rotates the refresh token. Presenting a token that was already rotated means it
 * leaked, so the whole token family is revoked and the user must log in again.
 */
async function refresh(rawToken, meta) {
  if (!rawToken) throw ApiError.unauthorized('Session expired. Please log in again.');
  const stored = await RefreshToken.findOne({ tokenHash: hashToken(rawToken) });
  if (!stored || stored.expiresAt < new Date()) throw ApiError.unauthorized('Session expired. Please log in again.');

  if (stored.revokedAt) {
    await RefreshToken.updateMany({ family: stored.family, revokedAt: null }, { revokedAt: new Date() });
    throw ApiError.unauthorized('Session expired. Please log in again.');
  }

  const user = await User.findById(stored.user);
  if (!user || !user.isActive) throw ApiError.unauthorized('Your account is not active.');

  const accessToken = signAccessToken(user);
  const next = await issueRefreshToken(user, { ...meta, family: stored.family });
  stored.revokedAt = new Date();
  stored.replacedByHash = hashToken(next.token);
  await stored.save();

  return { user: publicUser(user), accessToken, refreshToken: next.token, refreshExpiresAt: next.expiresAt };
}

async function logout(rawToken, actor) {
  if (rawToken) {
    await RefreshToken.updateOne({ tokenHash: hashToken(rawToken), revokedAt: null }, { revokedAt: new Date() });
  }
  if (actor?.user) await audit(actor, { action: AUDIT_ACTIONS.LOGOUT, entity: 'User', entityId: actor.user._id });
}

async function revokeAllSessions(userId) {
  await RefreshToken.updateMany({ user: userId, revokedAt: null }, { revokedAt: new Date() });
}

async function changePassword(userId, { currentPassword, newPassword }, actor) {
  const user = await User.findById(userId).select('+password');
  if (!user) throw ApiError.notFound('User not found.');
  if (!(await user.comparePassword(currentPassword))) throw ApiError.badRequest('Current password is incorrect.');
  user.password = newPassword;
  await user.save();
  await revokeAllSessions(user._id);
  await audit(actor, { action: AUDIT_ACTIONS.UPDATE, entity: 'User', entityId: user._id, description: 'Password changed' });
  return buildSession(user, actor);
}

module.exports = {
  registerCustomer,
  verifyEmail,
  resendVerification,
  requestPasswordReset,
  resetPassword,
  sendVerificationEmail,
  login,
  refresh,
  logout,
  changePassword,
  revokeAllSessions,
  publicUser,
  hashToken,
};

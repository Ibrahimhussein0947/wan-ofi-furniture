const env = require('../config/env');
const authService = require('../services/auth.service');
const { actorFrom, audit } = require('../services/audit.service');
const { User, Customer } = require('../models');
const { asyncHandler, sendSuccess, sendCreated } = require('../utils/http');
const { AUDIT_ACTIONS, ROLES } = require('../config/constants');

const COOKIE_NAME = 'wo_rt';

function cookieOptions(expires) {
  return {
    httpOnly: true,
    secure: env.isProduction || env.COOKIE_SAMESITE === 'none',
    sameSite: env.COOKIE_SAMESITE,
    path: '/api/auth',
    expires,
  };
}

function respondWithSession(res, session, message, status = 200) {
  res.cookie(COOKIE_NAME, session.refreshToken, cookieOptions(session.refreshExpiresAt));
  const data = { user: session.user, accessToken: session.accessToken };
  return status === 201 ? sendCreated(res, data, message) : sendSuccess(res, { data, message });
}

const meta = (req) => ({ ip: req.ip, userAgent: req.get('user-agent') });

exports.register = asyncHandler(async (req, res) => {
  const session = await authService.registerCustomer(req.body, meta(req));
  respondWithSession(res, session, 'Account created successfully', 201);
});

exports.login = asyncHandler(async (req, res) => {
  const session = await authService.login(req.body, meta(req));
  respondWithSession(res, session, 'Logged in successfully');
});

exports.refresh = asyncHandler(async (req, res) => {
  try {
    const session = await authService.refresh(req.cookies?.[COOKIE_NAME], meta(req));
    respondWithSession(res, session, 'Session refreshed');
  } catch (err) {
    res.clearCookie(COOKIE_NAME, cookieOptions());
    throw err;
  }
});

exports.logout = asyncHandler(async (req, res) => {
  await authService.logout(req.cookies?.[COOKIE_NAME], req.user ? actorFrom(req) : null);
  res.clearCookie(COOKIE_NAME, cookieOptions());
  sendSuccess(res, { message: 'Logged out' });
});

exports.me = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id);
  const data = { user: authService.publicUser(user) };
  if (user.role === ROLES.CUSTOMER) data.customer = await Customer.findOne({ user: user._id }).lean();
  sendSuccess(res, { data });
});

exports.updateProfile = asyncHandler(async (req, res) => {
  const { name, phone, address, company, notificationPrefs } = req.body;
  const user = await User.findById(req.user._id);
  if (name) user.name = name;
  if (phone !== undefined) user.phone = phone;
  if (notificationPrefs) user.notificationPrefs = { ...(user.notificationPrefs?.toObject?.() || {}), ...notificationPrefs };
  await user.save();
  let customer;
  if (user.role === ROLES.CUSTOMER) {
    customer = await Customer.findOneAndUpdate(
      { user: user._id },
      { $set: { ...(name && { name }), ...(phone !== undefined && { phone }), ...(address && { address }), ...(company !== undefined && { company }) } },
      { new: true }
    ).lean();
  }
  await audit(actorFrom(req), { action: AUDIT_ACTIONS.UPDATE, entity: 'User', entityId: user._id, description: 'Profile updated' });
  sendSuccess(res, { data: { user: authService.publicUser(user), customer }, message: 'Profile updated' });
});

exports.forgotPassword = asyncHandler(async (req, res) => {
  await authService.requestPasswordReset(req.body.email, meta(req));
  sendSuccess(res, { message: 'If an account exists for that email, we have sent a link to reset the password.' });
});

exports.resetPassword = asyncHandler(async (req, res) => {
  await authService.resetPassword(req.body, meta(req));
  res.clearCookie(COOKIE_NAME, cookieOptions());
  sendSuccess(res, { message: 'Password updated. You can now log in with your new password.' });
});

exports.verifyEmail = asyncHandler(async (req, res) => {
  await authService.verifyEmail(req.body.token);
  sendSuccess(res, { message: 'Thank you — your email address is confirmed.' });
});

exports.resendVerification = asyncHandler(async (req, res) => {
  await authService.resendVerification(req.user._id);
  sendSuccess(res, { message: 'We sent a new confirmation link to your email.' });
});

exports.changePassword = asyncHandler(async (req, res) => {
  const session = await authService.changePassword(req.user._id, req.body, actorFrom(req));
  respondWithSession(res, session, 'Password changed. Other sessions have been signed out.');
});

exports.COOKIE_NAME = COOKIE_NAME;

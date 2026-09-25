const { Customer } = require('../models');
const ApiError = require('../utils/ApiError');
const { ROLES } = require('../config/constants');

/** Loads the Customer record behind a logged-in customer account. */
async function customerOf(req) {
  if (req.user.role !== ROLES.CUSTOMER) throw ApiError.forbidden();
  if (!req.customer) {
    req.customer = await Customer.findOne({ user: req.user._id }).lean();
    if (!req.customer) throw ApiError.notFound('Customer profile not found.');
  }
  return req.customer;
}

const isCustomer = (req) => req.user?.role === ROLES.CUSTOMER;

/** Online customers must confirm their email before ordering or paying (configurable). */
async function assertVerifiedCustomer(req) {
  if (!isCustomer(req) || req.user.emailVerified) return;
  const { getSettings } = require('../services/settings.service');
  const settings = await getSettings();
  if (settings.requireEmailVerification) {
    throw ApiError.forbidden('Please confirm your email address first. Check your inbox or request a new link from your account.');
  }
}

function assertFound(doc, message = 'Resource not found.') {
  if (!doc) throw ApiError.notFound(message);
  return doc;
}

module.exports = { customerOf, isCustomer, assertFound, assertVerifiedCustomer };

const rateLimit = require('express-rate-limit');
const env = require('../config/env');

const message = (text) => ({ success: false, message: text });
const skip = () => env.isTest;

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 1000,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skip,
  message: message('Too many requests. Please slow down and try again shortly.'),
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  skip,
  message: message('Too many login attempts. Please try again in 15 minutes.'),
});

const publicFormLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skip,
  message: message('Too many submissions. Please try again later.'),
});

module.exports = { apiLimiter, authLimiter, publicFormLimiter };

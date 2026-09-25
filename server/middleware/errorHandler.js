const multer = require('multer');
const env = require('../config/env');
const logger = require('../utils/logger');
const ApiError = require('../utils/ApiError');

const notFound = (req, _res, next) => next(ApiError.notFound(`Route not found: ${req.method} ${req.originalUrl}`));

function normalise(err) {
  if (err instanceof ApiError) return err;

  if (err instanceof multer.MulterError) {
    const message =
      err.code === 'LIMIT_FILE_SIZE'
        ? `File is too large. Maximum size is ${env.MAX_UPLOAD_MB} MB.`
        : err.code === 'LIMIT_FILE_COUNT' || err.code === 'LIMIT_UNEXPECTED_FILE'
          ? 'Too many files uploaded.'
          : 'File upload failed.';
    return ApiError.badRequest(message);
  }

  if (err.name === 'ValidationError' && err.errors) {
    const details = Object.values(err.errors).map((e) => ({ field: e.path, message: e.message }));
    return ApiError.badRequest(details[0]?.message || 'Invalid data.', details);
  }

  if (err.name === 'CastError') return ApiError.badRequest(`Invalid value for ${err.path}.`);

  if (err.code === 11000) {
    const field = Object.keys(err.keyValue || err.keyPattern || {})[0] || 'field';
    return ApiError.conflict(`A record with this ${field} already exists.`);
  }

  if (err.type === 'entity.parse.failed') return ApiError.badRequest('Malformed JSON body.');
  if (err.type === 'entity.too.large') return ApiError.badRequest('Request body is too large.');

  // http-errors from Express internals (e.g. static file 404s) mark safe client errors with `expose`.
  if (err.expose && err.status >= 400 && err.status < 500) {
    return new ApiError(err.status, err.status === 404 ? 'File not found.' : err.message);
  }

  return null;
}

const errorHandler = (err, req, res, _next) => {
  const known = normalise(err);
  const status = known ? known.statusCode : 500;

  if (!known) logger.error(`${req.method} ${req.originalUrl}`, err);

  const body = {
    success: false,
    message: known ? known.message : 'Something went wrong. Please try again later.',
  };
  if (known?.details) body.errors = known.details;
  // Stack traces only ever leave the server in development.
  if (!known && env.NODE_ENV === 'development') body.stack = err.stack;

  res.status(status).json(body);
};

module.exports = { notFound, errorHandler };

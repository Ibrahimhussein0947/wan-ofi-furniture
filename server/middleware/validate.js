const ApiError = require('../utils/ApiError');

/**
 * Validates and normalises request data with Zod schemas.
 * Unknown body keys are stripped so clients cannot set protected fields
 * (e.g. `role`, `amountPaid`) by sneaking them into the payload.
 */
const validate = (schemas) => (req, _res, next) => {
  for (const part of ['params', 'query', 'body']) {
    if (!schemas[part]) continue;
    const result = schemas[part].safeParse(req[part] ?? {});
    if (!result.success) {
      const details = result.error.issues.map((i) => ({ field: i.path.join('.'), message: i.message }));
      const first = details[0];
      return next(ApiError.badRequest(first ? `${first.field ? `${first.field}: ` : ''}${first.message}` : 'Invalid input.', details));
    }
    req[part] = result.data;
  }
  return next();
};

module.exports = validate;

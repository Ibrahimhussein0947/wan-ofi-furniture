const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

function sendSuccess(res, { data = null, message = 'Operation completed successfully', pagination, status = 200 } = {}) {
  const body = { success: true, message, data };
  if (pagination) body.pagination = pagination;
  return res.status(status).json(body);
}

const sendCreated = (res, data, message = 'Created successfully') => sendSuccess(res, { data, message, status: 201 });

module.exports = { asyncHandler, sendSuccess, sendCreated };

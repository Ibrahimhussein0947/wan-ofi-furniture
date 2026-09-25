const ApiError = require('../utils/ApiError');
const { hasPermission } = require('../config/permissions');
const { ROLES } = require('../config/constants');

const requireRole =
  (...roles) =>
  (req, _res, next) => {
    if (!req.user) return next(ApiError.unauthorized());
    if (!roles.includes(req.user.role)) return next(ApiError.forbidden());
    return next();
  };

// Passes when the user holds ANY of the listed permissions.
const requirePermission =
  (...permissions) =>
  (req, _res, next) => {
    if (!req.user) return next(ApiError.unauthorized());
    if (!permissions.some((p) => hasPermission(req.user, p))) return next(ApiError.forbidden());
    return next();
  };

const requireStaff = requireRole(ROLES.OWNER, ROLES.ACCOUNTANT, ROLES.WORKER);

module.exports = { requireRole, requirePermission, requireStaff };

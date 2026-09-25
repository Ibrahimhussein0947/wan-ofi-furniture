const ApiError = require('../utils/ApiError');
const { hasPermission } = require('../config/permissions');
const { ROLES } = require('../config/constants');

/** Customers pass (controllers scope them to their own records); staff need one of the permissions. */
const customerOr =
  (...permissions) =>
  (req, _res, next) => {
    if (req.user?.role === ROLES.CUSTOMER) return next();
    if (permissions.some((p) => hasPermission(req.user, p))) return next();
    return next(ApiError.forbidden());
  };

/** Dispatches to a customer-specific or staff-specific handler. */
const byRole = (customerHandler, staffHandler) => (req, res, next) =>
  req.user.role === ROLES.CUSTOMER ? customerHandler(req, res, next) : staffHandler(req, res, next);

module.exports = { customerOr, byRole };

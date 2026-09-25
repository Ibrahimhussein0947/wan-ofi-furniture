const { User } = require('../models');
const userService = require('../services/user.service');
const { actorFrom } = require('../services/audit.service');
const { asyncHandler, sendSuccess, sendCreated } = require('../utils/http');
const { paginate, searchFilter, pickFilters } = require('../utils/query');
const { assertFound } = require('./helpers');
const { ALL_PERMISSIONS, ROLE_PERMISSIONS, WORKER_ROLE_PERMISSIONS, WORKER_STAGE_PERMISSIONS, getPermissionsFor } = require('../config/permissions');

exports.list = asyncHandler(async (req, res) => {
  const filter = { ...pickFilters(req.query, ['role', 'workerRole']), ...searchFilter(req.query.search, ['name', 'email', 'phone']) };
  if (req.query.isActive) filter.isActive = req.query.isActive === 'true';
  const { items, pagination } = await paginate(User, filter, req.query, { allowedSort: ['name', 'email', 'role', 'createdAt', 'lastLoginAt'] });
  sendSuccess(res, { data: items.map((u) => ({ ...u, password: undefined })), pagination });
});

exports.get = asyncHandler(async (req, res) => {
  const user = assertFound(await User.findById(req.params.id).lean(), 'User not found.');
  sendSuccess(res, { data: { ...user, effectivePermissions: getPermissionsFor(user) } });
});

exports.create = asyncHandler(async (req, res) => {
  const user = await userService.createStaffUser(req.body, actorFrom(req));
  sendCreated(res, user, 'User created');
});

exports.update = asyncHandler(async (req, res) => {
  const user = await userService.updateUser(req.params.id, req.body, actorFrom(req));
  sendSuccess(res, { data: user, message: 'User updated' });
});

exports.remove = asyncHandler(async (req, res) => {
  await userService.deleteUser(req.params.id, actorFrom(req));
  sendSuccess(res, { message: 'User removed' });
});

exports.permissionCatalog = asyncHandler(async (_req, res) => {
  sendSuccess(res, {
    data: { permissions: ALL_PERMISSIONS, rolePermissions: ROLE_PERMISSIONS, workerRolePermissions: WORKER_ROLE_PERMISSIONS, workerStagePermissions: WORKER_STAGE_PERMISSIONS },
  });
});

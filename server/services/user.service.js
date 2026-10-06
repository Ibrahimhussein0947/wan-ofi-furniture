const { User, Worker, Customer } = require('../models');
const { nextNumber } = require('../models/Counter');
const ApiError = require('../utils/ApiError');
const { ROLES, AUDIT_ACTIONS } = require('../config/constants');
const { ALL_PERMISSIONS } = require('../config/permissions');
const { audit, diff } = require('./audit.service');
const { revokeAllSessions } = require('./auth.service');

async function createStaffUser(input, actor) {
  const { name, email, phone, password, role, workerRole, permissions = [], worker = {} } = input;
  if (role === ROLES.CUSTOMER) throw ApiError.badRequest('Customers are created from the Customers module.');
  if (role === ROLES.WORKER && !workerRole) throw ApiError.badRequest('Workers need a position (worker role).');
  if (await User.exists({ email: email.toLowerCase() })) throw ApiError.conflict('An account with this email already exists.');
  const invalid = permissions.filter((p) => !ALL_PERMISSIONS.includes(p));
  if (invalid.length) throw ApiError.badRequest(`Unknown permissions: ${invalid.join(', ')}`);

  const user = await User.create({
    name,
    email,
    phone,
    password,
    role,
    workerRole: role === ROLES.WORKER ? workerRole : null,
    permissions,
    branch: input.branch || null,
    // The owner creates staff accounts with addresses they know.
    emailVerified: true,
  });
  if (role === ROLES.WORKER) {
    try {
      await Worker.create({
        user: user._id,
        employeeCode: await nextNumber('EMP', { yearly: false, pad: 4 }),
        position: workerRole,
        phone,
        hireDate: worker.hireDate || new Date(),
        wageType: worker.wageType,
        wageRate: worker.wageRate,
        taxRate: worker.taxRate,
        skills: worker.skills,
      });
    } catch (err) {
      await User.deleteOne({ _id: user._id });
      throw err;
    }
  }
  await audit(actor, { action: AUDIT_ACTIONS.CREATE, entity: 'User', entityId: user._id, reference: user.email, description: `Created ${role.toLowerCase()} account` });
  return user;
}

async function assertNotLastOwner(user) {
  if (user.role !== ROLES.OWNER) return;
  const owners = await User.countDocuments({ role: ROLES.OWNER, isActive: true, _id: { $ne: user._id } });
  if (!owners) throw ApiError.badRequest('The last active owner account cannot be removed or demoted.');
}

async function updateUser(id, changes, actor) {
  const user = await User.findById(id);
  if (!user) throw ApiError.notFound('User not found.');
  if (user.role === ROLES.CUSTOMER && changes.role && changes.role !== ROLES.CUSTOMER) {
    throw ApiError.badRequest('Customer accounts cannot be converted to staff accounts.');
  }
  const before = user.toObject();

  if ((changes.role && changes.role !== ROLES.OWNER) || changes.isActive === false) await assertNotLastOwner(user);
  if (String(user._id) === String(actor.user._id) && (changes.isActive === false || (changes.role && changes.role !== user.role))) {
    throw ApiError.badRequest('You cannot deactivate your own account or change your own role.');
  }
  if (changes.permissions) {
    const invalid = changes.permissions.filter((p) => !ALL_PERMISSIONS.includes(p));
    if (invalid.length) throw ApiError.badRequest(`Unknown permissions: ${invalid.join(', ')}`);
  }

  if (changes.email && changes.email.toLowerCase() !== user.email) {
    if (user.role === ROLES.CUSTOMER) throw ApiError.badRequest('Customers change their own email from their account.');
    if (await User.exists({ email: changes.email.toLowerCase(), _id: { $ne: user._id } })) throw ApiError.conflict('An account with this email already exists.');
    user.email = changes.email;
  }
  ['name', 'phone', 'role', 'workerRole', 'permissions', 'isActive', 'branch'].forEach((k) => {
    if (changes[k] !== undefined) user[k] = changes[k];
  });
  if (user.role !== ROLES.WORKER) user.workerRole = null;
  if (user.role === ROLES.WORKER && !user.workerRole) throw ApiError.badRequest('Workers need a position (worker role).');
  if (changes.password) user.password = changes.password;
  await user.save();

  if (user.role === ROLES.WORKER) {
    const existing = await Worker.findOne({ user: user._id }).setOptions({ withDeleted: true });
    if (existing) {
      existing.position = user.workerRole;
      existing.isActive = user.isActive;
      existing.deletedAt = null;
      await existing.save();
    } else {
      await Worker.create({ user: user._id, employeeCode: await nextNumber('EMP', { yearly: false, pad: 4 }), position: user.workerRole, phone: user.phone });
    }
  }
  if (changes.isActive === false || changes.password || (changes.role && changes.role !== before.role)) await revokeAllSessions(user._id);

  const permissionChanged = JSON.stringify(before.permissions) !== JSON.stringify(user.permissions) || before.role !== user.role || before.workerRole !== user.workerRole;
  await audit(actor, {
    action: permissionChanged ? AUDIT_ACTIONS.PERMISSION_CHANGE : AUDIT_ACTIONS.UPDATE,
    entity: 'User',
    entityId: user._id,
    reference: user.email,
    changes: diff(before, user.toObject(), ['name', 'email', 'phone', 'role', 'workerRole', 'permissions', 'isActive']),
  });
  return user;
}

async function deleteUser(id, actor) {
  const user = await User.findById(id);
  if (!user) throw ApiError.notFound('User not found.');
  if (String(user._id) === String(actor.user._id)) throw ApiError.badRequest('You cannot delete your own account.');
  await assertNotLastOwner(user);
  user.isActive = false;
  await user.save();
  await user.softDelete(actor.user._id);
  await Worker.updateOne({ user: user._id }, { $set: { isActive: false, deletedAt: new Date() } });
  if (user.role === ROLES.CUSTOMER) await Customer.updateOne({ user: user._id }, { $set: { user: null } });
  await revokeAllSessions(user._id);
  await audit(actor, { action: AUDIT_ACTIONS.DELETE, entity: 'User', entityId: user._id, reference: user.email });
}

module.exports = { createStaffUser, updateUser, deleteUser };

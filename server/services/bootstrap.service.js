const { z } = require('zod');
const { User } = require('../models');
const ApiError = require('../utils/ApiError');
const { ROLES } = require('../config/constants');
const { email, password } = require('../validators/common');

const ownerInput = z.object({ name: z.string().trim().min(2, 'Name must be at least 2 characters').max(120), email, password });

/**
 * Creates the business owner's account on a fresh database. Sign-up only creates customers and the
 * seed refuses to run in production, so this is how a live install gets its first staff login.
 * Refuses once any owner exists, so it can never be used to take over an install.
 */
async function createFirstOwner(input) {
  const parsed = ownerInput.safeParse(input);
  if (!parsed.success) throw ApiError.badRequest(parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '));
  if (await User.exists({ role: ROLES.OWNER })) throw ApiError.conflict('An owner account already exists.');
  if (await User.exists({ email: parsed.data.email })) throw ApiError.conflict('That email is already used by another account.');
  return User.create({ ...parsed.data, role: ROLES.OWNER, emailVerified: true });
}

/** On start-up, creates the owner from OWNER_EMAIL / OWNER_PASSWORD when the database has none yet. */
async function ensureOwnerFromEnv(env, logger) {
  if (!env.OWNER_EMAIL || !env.OWNER_PASSWORD) return null;
  if (await User.exists({ role: ROLES.OWNER })) return null;
  try {
    const owner = await createFirstOwner({ name: env.OWNER_NAME, email: env.OWNER_EMAIL, password: env.OWNER_PASSWORD });
    logger.info(`Created the owner account ${owner.email}. You can now remove OWNER_PASSWORD from the environment.`);
    return owner;
  } catch (err) {
    // A bad OWNER_* value must not keep the whole site offline; fix the variable and restart.
    logger.error(`Could not create the owner account from OWNER_EMAIL/OWNER_PASSWORD: ${err.message}`);
    return null;
  }
}

/** On start-up, creates the super admin from SUPERADMIN_EMAIL / SUPERADMIN_PASSWORD when none exists yet. */
async function ensureSuperAdminFromEnv(env, logger) {
  if (!env.SUPERADMIN_EMAIL || !env.SUPERADMIN_PASSWORD) return null;
  if (await User.exists({ role: ROLES.SUPER_ADMIN })) return null;
  try {
    const parsed = ownerInput.parse({ name: 'Super Admin', email: env.SUPERADMIN_EMAIL, password: env.SUPERADMIN_PASSWORD });
    if (await User.exists({ email: parsed.email })) throw new Error('That email is already used by another account.');
    const admin = await User.create({ ...parsed, role: ROLES.SUPER_ADMIN, emailVerified: true });
    logger.info(`Created the super admin account ${admin.email}. You can now remove SUPERADMIN_PASSWORD from the environment.`);
    return admin;
  } catch (err) {
    logger.error(`Could not create the super admin from SUPERADMIN_EMAIL/SUPERADMIN_PASSWORD: ${err.message}`);
    return null;
  }
}

module.exports = { createFirstOwner, ensureOwnerFromEnv, ensureSuperAdminFromEnv };

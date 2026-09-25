const { z, email, password, phone, address, trimmed, optionalText, optionalDate, money, stringList } = require('./common');
const { ROLES, WORKER_ROLES } = require('../config/constants');

const staffRoles = [ROLES.OWNER, ROLES.ACCOUNTANT, ROLES.WORKER];
// Omitted = unchanged; empty string or null = no branch.
const branchField = z.union([z.string().regex(/^[a-f\d]{24}$/i, 'Invalid id'), z.literal(''), z.null()]).optional().transform((v) => (v === '' ? null : v));

const createUser = z.object({
  name: trimmed(120).min(2),
  email,
  phone,
  password,
  role: z.enum(staffRoles),
  workerRole: z.enum(Object.values(WORKER_ROLES)).optional().nullable(),
  permissions: z.array(z.string().max(60)).max(60).optional(),
  branch: branchField,
  worker: z
    .object({
      hireDate: optionalDate,
      wageType: z.enum(['DAILY', 'WEEKLY', 'MONTHLY', 'PER_JOB']).optional(),
      wageRate: money.optional(),
      skills: stringList().optional(),
    })
    .optional(),
});

const updateUser = z.object({
  name: trimmed(120).min(2).optional(),
  phone,
  role: z.enum(Object.values(ROLES)).optional(),
  workerRole: z.enum(Object.values(WORKER_ROLES)).optional().nullable(),
  permissions: z.array(z.string().max(60)).max(60).optional(),
  isActive: z.boolean().optional(),
  branch: branchField,
  password: password.optional(),
});

const customer = z.object({
  name: trimmed(120).min(2),
  email: email.optional().or(z.literal('').transform(() => undefined)),
  phone,
  address,
  company: optionalText(120),
  notes: optionalText(2000),
  source: z.enum(['ONLINE', 'WALK_IN', 'REFERRAL', 'OTHER']).optional(),
});

const updateWorker = z.object({
  position: z.enum(Object.values(WORKER_ROLES)).optional(),
  skills: stringList().optional(),
  phone,
  hireDate: optionalDate,
  wageType: z.enum(['DAILY', 'WEEKLY', 'MONTHLY', 'PER_JOB']).optional(),
  wageRate: money.optional(),
  isActive: z.boolean().optional(),
  notes: optionalText(2000),
});

module.exports = { createUser, updateUser, customer, updateCustomer: customer.partial(), updateWorker };

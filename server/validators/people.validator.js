const {
  z,
  email,
  password,
  phone,
  address,
  trimmed,
  optionalText,
  optionalDate,
  money,
  stringList,
} = require('./common');
const { ROLES, WORKER_ROLES } = require('../config/constants');
const { accountNumberError } = require('../utils/bankAccount');

const staffRoles = [ROLES.OWNER, ROLES.ACCOUNTANT, ROLES.WORKER];
// Omitted = unchanged; empty string or null = no branch.
const branchField = z
  .union([z.string().regex(/^[a-f\d]{24}$/i, 'Invalid id'), z.literal(''), z.null()])
  .optional()
  .transform((v) => (v === '' ? null : v));

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
      wageType: z.enum(['HOURLY', 'DAILY', 'WEEKLY', 'MONTHLY', 'PER_JOB']).optional(),
      wageRate: money.optional(),
      taxRate: z.coerce.number().min(0).max(100).optional(),
      skills: stringList().optional(),
    })
    .optional(),
});

const updateUser = z.object({
  name: trimmed(120).min(2).optional(),
  email: email.optional(),
  phone,
  role: z.enum(Object.values(ROLES)).optional(),
  workerRole: z.enum(Object.values(WORKER_ROLES)).optional().nullable(),
  permissions: z.array(z.string().max(60)).max(60).optional(),
  isActive: z.boolean().optional(),
  branch: branchField,
  password: password.optional(),
});

// The customer's own bank account, recorded by staff (e.g. to send refunds to).
const customerBankAccount = z.object({
  bankName: trimmed(120).min(1, 'Bank or wallet name is required'),
  accountName: trimmed(120).min(1, 'Account name is required'),
  accountNumber: trimmed(60)
    .min(1, 'Account number is required')
    .superRefine((val, ctx) => {
      const error = accountNumberError(val);
      if (error) ctx.addIssue({ code: z.ZodIssueCode.custom, message: error });
    }),
  branch: trimmed(120)
    .optional()
    .or(z.literal('').transform(() => undefined)),
  notes: trimmed(300)
    .optional()
    .or(z.literal('').transform(() => undefined)),
});

const customer = z.object({
  name: trimmed(120).min(2),
  email: email.optional().or(z.literal('').transform(() => undefined)),
  phone,
  address,
  company: optionalText(120),
  notes: optionalText(2000),
  source: z.enum(['ONLINE', 'WALK_IN', 'REFERRAL', 'OTHER']).optional(),
  bankAccounts: z
    .array(customerBankAccount)
    .max(5, 'Up to 5 bank accounts per customer')
    .optional(),
});

const updateWorker = z.object({
  position: z.enum(Object.values(WORKER_ROLES)).optional(),
  skills: stringList().optional(),
  phone,
  hireDate: optionalDate,
  wageType: z.enum(['HOURLY', 'DAILY', 'WEEKLY', 'MONTHLY', 'PER_JOB']).optional(),
  wageRate: money.optional(),
  // Percent of earnings withheld as tax (set by the administrator).
  taxRate: z.coerce.number().min(0).max(100).optional(),
  isActive: z.boolean().optional(),
  notes: optionalText(2000),
});

const workerDocument = z.object({
  title: z.string().trim().min(1, 'Give the document a title').max(120),
  category: z.enum(['ID', 'CONTRACT', 'CERTIFICATE', 'CV', 'MEDICAL', 'OTHER']).default('OTHER'),
  notes: z.string().trim().max(500).optional(),
});

module.exports = {
  workerDocument,
  createUser,
  updateUser,
  customer,
  updateCustomer: customer.partial(),
  updateWorker,
};

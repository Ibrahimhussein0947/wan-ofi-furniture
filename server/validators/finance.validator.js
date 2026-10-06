const {
  z,
  objectId,
  optionalId,
  money,
  positiveMoney,
  trimmed,
  optionalText,
  optionalDate,
} = require('./common');
const { PAYMENT_METHODS, EXPENSE_CATEGORIES } = require('../config/constants');
const { accountNumberError } = require('../utils/bankAccount');

const method = z.enum(Object.values(PAYMENT_METHODS));

const customerPayment = z.object({
  order: objectId,
  amount: positiveMoney,
  method,
  reference: optionalText(120),
  notes: optionalText(1000),
  paidAt: optionalDate,
});

const supplierPayment = z.object({
  supplier: objectId,
  purchaseOrder: optionalId,
  amount: positiveMoney,
  method,
  reference: optionalText(120),
  notes: optionalText(1000),
  paidAt: optionalDate,
});

const workerPayment = z.object({
  worker: objectId,
  amount: positiveMoney,
  method,
  kind: z.enum(['WAGE', 'BONUS', 'ADVANCE']).default('WAGE'),
  period: optionalText(60),
  // Payroll month the wage covers, e.g. 2026-09.
  payPeriod: z
    .string()
    .regex(/^\d{4}-(0[1-9]|1[0-2])$/)
    .optional(),
  reference: optionalText(120),
  notes: optionalText(1000),
  paidAt: optionalDate,
});

const refund = z.object({
  order: objectId,
  amount: positiveMoney,
  method,
  reference: optionalText(120),
  reason: trimmed(500).min(3, 'Please give a reason for the refund'),
});

const mobilePayment = z.object({
  order: objectId,
  amount: positiveMoney,
  network: z.enum(['TELEBIRR', 'CBE_BIRR', 'AMOLE', 'MPESA', 'BYBILS']),
  phone: trimmed(20).min(9, 'Enter your mobile number'),
});

const verifyPayment = z.object({ approve: z.boolean(), reason: optionalText(500) });

const expense = z.object({
  category: z.enum(Object.values(EXPENSE_CATEGORIES)),
  amount: positiveMoney,
  date: optionalDate,
  description: trimmed(1000).min(3, 'Description is required'),
  vendor: optionalText(150),
  method: method.optional(),
  reference: optionalText(120),
  branch: optionalId,
});

const updateExpense = expense.partial();
const decision = z.object({ approve: z.boolean(), reason: optionalText(500) });

const otherIncome = z.object({
  amount: positiveMoney,
  method,
  date: optionalDate,
  description: trimmed(1000).min(3),
  customer: optionalId,
});

const invoice = z.object({ order: objectId, dueDate: optionalDate, notes: optionalText(2000) });

// One bank or mobile-money account customers transfer to (set by the administrator).
const bankAccount = z.object({
  type: z.enum(['BANK', 'MOBILE_WALLET']).default('BANK'),
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
  isActive: z.boolean().default(true),
});

// A username, phone number or web link — never another URL scheme such as javascript:.
const socialHandle = z
  .string()
  .trim()
  .max(200)
  .refine((v) => !/^[a-z][a-z0-9+.-]*:/i.test(v) || /^https?:\/\//i.test(v), 'Use a username, phone number or an https:// link');

const settings = z
  .object({
    companyName: trimmed(120),
    companyEmail: z.string().email().max(160),
    companyPhone: trimmed(40),
    companyAddress: trimmed(300),
    socialLinks: z.object({ facebook: socialHandle, telegram: socialHandle, whatsapp: socialHandle, instagram: socialHandle }).partial(),
    currency: trimmed(8),
    timezone: trimmed(60),
    taxRate: z.coerce.number().min(0).max(100),
    depositPercent: z.coerce.number().min(0).max(100),
    largeExpenseThreshold: money,
    allowOverpayment: z.boolean(),
    requireEmailVerification: z.boolean(),
    defaultBranch: z.union([objectId, z.literal(''), z.null()]).transform((v) => v || null),
    requireFullPaymentBeforeDelivery: z.boolean(),
    defaultDeliveryFee: money,
    invoiceDueDays: z.coerce.number().int().min(0).max(365),
    customWarrantyMonths: z.coerce.number().int().min(0).max(120),
    paymentInstructions: trimmed(1000),
    bankAccounts: z.array(bankAccount).max(10, 'Up to 10 bank accounts can be listed'),
  })
  .partial();

module.exports = {
  customerPayment,
  supplierPayment,
  workerPayment,
  refund,
  mobilePayment,
  verifyPayment,
  expense,
  updateExpense,
  decision,
  otherIncome,
  invoice,
  settings,
};

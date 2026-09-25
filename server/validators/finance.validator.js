const { z, objectId, optionalId, money, positiveMoney, trimmed, optionalText, optionalDate } = require('./common');
const { PAYMENT_METHODS, EXPENSE_CATEGORIES } = require('../config/constants');

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
  network: z.enum(['MPESA', 'TIGO', 'AIRTEL', 'HALOPESA', 'AZAMPESA']),
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

const settings = z
  .object({
    companyName: trimmed(120),
    companyEmail: z.string().email().max(160),
    companyPhone: trimmed(40),
    companyAddress: trimmed(300),
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
    paymentInstructions: trimmed(1000),
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

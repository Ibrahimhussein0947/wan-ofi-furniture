const {
  z,
  objectId,
  money,
  positiveMoney,
  intQuantity,
  trimmed,
  optionalText,
  optionalDate,
  address,
  dimensions,
} = require('./common');
const { ORDER_STATUS, DELIVERY_METHODS, PAYMENT_METHODS } = require('../config/constants');

const orderItem = z.object({
  product: objectId,
  quantity: intQuantity,
  color: optionalText(40),
  size: optionalText(40),
  options: optionalText(500),
});

const customerOrder = z.object({
  items: z.array(orderItem).min(1, 'Your cart is empty').max(50),
  deliveryMethod: z.enum(Object.values(DELIVERY_METHODS)).default('DELIVERY'),
  deliveryAddress: address,
  contactPhone: optionalText(30),
  notes: optionalText(2000),
  promoCode: z
    .string()
    .trim()
    .max(30)
    .optional()
    .or(z.literal('').transform(() => undefined)),
});

const staffOrder = customerOrder.extend({
  customer: objectId,
  discount: money.optional(),
  deliveryFee: money.optional(),
  internalNotes: optionalText(2000),
  autoConfirm: z.boolean().optional(),
  branch: z
    .string()
    .regex(/^[a-f\d]{24}$/i)
    .optional()
    .or(z.literal('').transform(() => undefined)),
});

const orderStatus = z.object({
  status: z.enum(Object.values(ORDER_STATUS)),
  note: optionalText(500),
});

const updateItems = z.object({
  items: z.array(orderItem).min(1, 'An order needs at least one item.').max(50),
  reason: trimmed(500).min(3, 'Please give a reason'),
});

const cancel = z.object({ reason: trimmed(500).min(3, 'Please give a reason') });
const discount = z.object({
  discount: money,
  reason: trimmed(500).min(3, 'Please give a reason for the discount'),
});

const updateOrder = z.object({
  notes: optionalText(2000),
  internalNotes: optionalText(2000),
  expectedCompletionDate: optionalDate,
  deliveryAddress: address,
  contactPhone: optionalText(30),
});

const customRequest = z.object({
  furnitureType: trimmed(80).min(2, 'Furniture type is required'),
  description: trimmed(5000).min(10, 'Please describe what you need (at least 10 characters)'),
  dimensions,
  preferredMaterial: optionalText(120),
  preferredColor: optionalText(60),
  fabric: optionalText(120),
  designRequirements: optionalText(5000),
  quantity: intQuantity.default(1),
  budget: money.optional(),
  requiredDate: optionalDate.refine(
    (d) => !d || d > new Date(),
    'Delivery date must be in the future',
  ),
  additionalNotes: optionalText(2000),
  deliveryMethod: z.enum(Object.values(DELIVERY_METHODS)).optional(),
});

const estimate = z.object({
  materialCost: money.default(0),
  laborCost: money.default(0),
  otherCost: money.default(0),
  productionDays: z.coerce.number().int().min(1).max(365).optional(),
  notes: optionalText(2000),
});

const quote = z.object({
  quotedPrice: positiveMoney,
  depositRequired: money.optional(),
  quoteNotes: optionalText(2000),
  quoteValidUntil: optionalDate,
  productionDays: z.coerce.number().int().min(1).max(365).optional(),
});

const quoteResponse = z.object({ approve: z.boolean(), note: optionalText(1000) });
const note = z.object({ note: optionalText(1000) });
const reason = z.object({ reason: trimmed(1000).min(3, 'Please give a reason') });

const customerPayment = z.object({
  order: objectId,
  amount: positiveMoney,
  method: z.enum(Object.values(PAYMENT_METHODS)),
  // The bank / mobile-money transaction reference staff match against their statement.
  reference: trimmed(120).min(3, 'Enter the transaction reference from your receipt'),
  notes: optionalText(1000),
  // Which "pay X%" option the customer picked; informational, the amount is what counts.
  percent: z.coerce.number().int().min(1).max(100).optional(),
  // Set automatically from the uploaded receipt (required by the controller).
  screenshot: optionalText(300),
});

module.exports = {
  customerOrder,
  staffOrder,
  orderStatus,
  updateItems,
  cancel,
  discount,
  updateOrder,
  customRequest,
  estimate,
  quote,
  quoteResponse,
  note,
  reason,
  customerPayment,
};

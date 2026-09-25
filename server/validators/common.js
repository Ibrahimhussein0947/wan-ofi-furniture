const { z } = require('zod');

const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid id');
const optionalId = z.union([objectId, z.literal(''), z.null()]).optional().transform((v) => v || null);
const idParam = z.object({ id: objectId });

const money = z.coerce.number({ invalid_type_error: 'Must be a number' }).min(0, 'Must not be negative').max(1e12);
const positiveMoney = z.coerce.number({ invalid_type_error: 'Must be a number' }).positive('Amount must be greater than zero').max(1e12);
const quantity = z.coerce.number().positive('Quantity must be greater than zero').max(1e7);
const intQuantity = z.coerce.number().int('Quantity must be a whole number').min(1).max(10000);
const trimmed = (max = 200) => z.string().trim().max(max);
const optionalText = (max = 2000) => z.string().trim().max(max).optional().or(z.literal('').transform(() => undefined));
const optionalDate = z.union([z.coerce.date(), z.literal('').transform(() => undefined), z.null().transform(() => undefined)]).optional();
const email = z.string().trim().toLowerCase().email('Invalid email address').max(160);
const phone = z
  .string()
  .trim()
  .regex(/^[+\d][\d\s-]{6,20}$/, 'Invalid phone number')
  .optional()
  .or(z.literal('').transform(() => undefined));
const password = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(128)
  .regex(/[A-Za-z]/, 'Password must contain a letter')
  .regex(/\d/, 'Password must contain a number');

const address = z
  .object({
    street: optionalText(200),
    city: optionalText(100),
    region: optionalText(100),
    country: optionalText(100),
    postalCode: optionalText(20),
  })
  .partial()
  .optional();

const dimensions = z
  .object({
    width: money.optional(),
    height: money.optional(),
    length: money.optional(),
    depth: money.optional(),
    unit: z.enum(['cm', 'm', 'in', 'ft', 'mm']).optional(),
  })
  .partial()
  .optional();

// List endpoints accept arbitrary filter keys; each controller whitelists what it uses.
const listQuery = z
  .object({
    page: z.coerce.number().int().min(1).optional(),
    limit: z.coerce.number().int().min(1).max(100).optional(),
    search: z.string().max(100).optional(),
    sort: z.string().max(40).optional(),
    from: z.string().max(40).optional(),
    to: z.string().max(40).optional(),
  })
  .passthrough();

const stringList = (max = 60, count = 30) => z.array(z.string().trim().min(1).max(max)).max(count);

module.exports = {
  z,
  objectId,
  optionalId,
  idParam,
  money,
  positiveMoney,
  quantity,
  intQuantity,
  trimmed,
  optionalText,
  optionalDate,
  email,
  phone,
  password,
  address,
  dimensions,
  listQuery,
  stringList,
};

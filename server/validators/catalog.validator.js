const { z, objectId, optionalId, money, quantity, trimmed, optionalText, optionalDate, dimensions, stringList } = require('./common');
const { PRODUCT_STATUS } = require('../config/constants');
const { MATERIAL_CATEGORIES } = require('../models/Material');

const category = z.object({
  name: trimmed(80).min(2),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9-]+$/, 'Slug may only contain letters, numbers and dashes')
    .max(80)
    .optional(),
  description: optionalText(1000),
  image: optionalText(500),
  sortOrder: z.coerce.number().int().optional(),
  isActive: z.boolean().optional(),
});

const productBase = z.object({
  name: trimmed(150).min(2),
  sku: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9-]+$/, 'SKU may only contain letters, numbers and dashes')
    .max(40),
  category: objectId,
  description: optionalText(5000),
  images: z.array(z.string().max(500)).max(12).optional(),
  price: money,
  costPrice: money,
  sellingPrice: money,
  minStock: money.optional(),
  materials: stringList().optional(),
  dimensions,
  colors: stringList(40).optional(),
  sizes: stringList(40).optional(),
  productionTimeDays: z.coerce.number().int().min(0).max(365).optional(),
  status: z.enum(Object.values(PRODUCT_STATUS)).optional(),
  isFeatured: z.boolean().optional(),
  madeToOrder: z.boolean().optional(),
});

// Opening stock is allowed on create; afterwards stock only changes through inventory transactions.
const createProduct = productBase.extend({ quantity: money.optional(), allowLoss: z.boolean().optional() }).refine((p) => p.sellingPrice >= p.costPrice || p.allowLoss, {
  message: 'Selling price is below cost price',
  path: ['sellingPrice'],
});
const updateProduct = productBase.partial();

const material = z.object({
  name: trimmed(120).min(2),
  code: z.string().trim().toUpperCase().max(40).optional().or(z.literal('').transform(() => undefined)),
  category: z.enum(MATERIAL_CATEGORIES).optional(),
  unit: trimmed(20).min(1),
  minStock: money.optional(),
  unitCost: money.optional(),
  supplier: optionalId,
  purchaseDate: optionalDate,
  expirationDate: optionalDate,
  location: optionalText(80),
  notes: optionalText(1000),
});
const createMaterial = material.extend({ quantity: money.optional() });

const bom = z.object({
  items: z
    .array(
      z.object({
        material: objectId,
        quantity,
        wastePercent: z.coerce.number().min(0).max(100).optional(),
        notes: optionalText(300),
      })
    )
    .max(100),
  laborHours: money.optional(),
  notes: optionalText(2000),
});

const stockAdjustment = z.object({
  itemType: z.enum(['PRODUCT', 'MATERIAL']),
  itemId: objectId,
  type: z.enum(['STOCK_IN', 'STOCK_OUT', 'DAMAGED', 'RETURN', 'ADJUSTMENT']),
  quantity: z.coerce.number().refine((n) => n !== 0, 'Quantity must not be zero'),
  unitCost: money.optional(),
  note: trimmed(500).min(3, 'Please give a reason for this stock change'),
});

const supplier = z.object({
  name: trimmed(150).min(2),
  contactPerson: optionalText(120),
  phone: z.string().trim().max(30).optional(),
  email: z.string().trim().toLowerCase().email().max(160).optional().or(z.literal('').transform(() => undefined)),
  address: optionalText(300),
  materialsSupplied: stringList().optional(),
  paymentTerms: optionalText(120),
  notes: optionalText(2000),
  isActive: z.boolean().optional(),
});

const purchaseOrder = z.object({
  supplier: objectId,
  items: z.array(z.object({ material: objectId, quantity, unitCost: money })).min(1, 'Add at least one item').max(100),
  expectedDate: optionalDate,
  notes: optionalText(2000),
  status: z.enum(['DRAFT', 'ORDERED']).optional(),
});

const receivePurchase = z.object({
  items: z.array(z.object({ itemId: objectId, quantity })).optional(),
});

module.exports = {
  category,
  updateCategory: category.partial(),
  createProduct,
  updateProduct,
  createMaterial,
  updateMaterial: material.partial(),
  bom,
  stockAdjustment,
  supplier,
  updateSupplier: supplier.partial(),
  purchaseOrder,
  receivePurchase,
};

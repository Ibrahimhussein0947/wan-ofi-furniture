const { Material, Product, InventoryTransaction, BillOfMaterials, Supplier } = require('../models');
const { audit, actorFrom, diff } = require('../services/audit.service');
const { adjustStock, transferStock, sendLowStockAlert, MANUAL_TYPES } = require('../services/inventory.service');
const { asyncHandler, sendSuccess, sendCreated } = require('../utils/http');
const { paginate, searchFilter, pickFilters, dateRangeFilter } = require('../utils/query');
const { round2 } = require('../utils/money');
const ApiError = require('../utils/ApiError');
const { assertFound } = require('./helpers');
const { AUDIT_ACTIONS, INVENTORY_TX_TYPES } = require('../config/constants');

// ---------- Materials ----------
exports.listMaterials = asyncHandler(async (req, res) => {
  const filter = { ...pickFilters(req.query, ['category', 'supplier'], ['supplier']), ...searchFilter(req.query.search, ['name', 'code']) };
  if (req.query.lowStock === 'true') filter.$expr = { $lte: ['$quantity', '$minStock'] };
  const { items, pagination } = await paginate(Material, filter, req.query, {
    populate: { path: 'supplier', select: 'name' },
    allowedSort: ['name', 'quantity', 'unitCost', 'createdAt'],
    sort: { name: 1 },
  });
  sendSuccess(res, {
    data: items.map((m) => ({ ...m, isLowStock: m.quantity <= m.minStock, stockValue: round2(m.quantity * m.unitCost) })),
    pagination,
  });
});

exports.getMaterial = asyncHandler(async (req, res) => {
  const material = assertFound(await Material.findById(req.params.id).populate('supplier', 'name phone').lean(), 'Material not found.');
  const [transactions, usedIn] = await Promise.all([
    InventoryTransaction.find({ material: material._id }).sort({ createdAt: -1 }).limit(50).populate('createdBy', 'name').lean(),
    BillOfMaterials.find({ 'items.material': material._id }).populate('product', 'name sku').lean(),
  ]);
  sendSuccess(res, {
    data: {
      ...material,
      isLowStock: material.quantity <= material.minStock,
      transactions,
      usedIn: usedIn.map((b) => ({ product: b.product, quantity: b.items.find((i) => String(i.material) === String(material._id))?.quantity })),
    },
  });
});

exports.createMaterial = asyncHandler(async (req, res) => {
  const { quantity = 0, branch, ...data } = req.body;
  if (data.supplier && !(await Supplier.exists({ _id: data.supplier }))) throw ApiError.badRequest('Supplier not found.');
  const material = await Material.create({ ...data, quantity: 0 });
  if (quantity > 0) {
    await adjustStock({ itemType: 'MATERIAL', itemId: material._id, delta: quantity, type: INVENTORY_TX_TYPES.STOCK_IN, unitCost: material.unitCost, note: 'Opening stock', userId: req.user._id, branch: branch || req.user.branch });
    material.quantity = quantity;
  }
  await audit(actorFrom(req), { action: AUDIT_ACTIONS.CREATE, entity: 'Material', entityId: material._id, reference: material.name });
  sendCreated(res, material, 'Material created');
});

exports.updateMaterial = asyncHandler(async (req, res) => {
  const material = assertFound(await Material.findById(req.params.id), 'Material not found.');
  const before = material.toObject();
  Object.assign(material, req.body);
  await material.save();
  await audit(actorFrom(req), {
    action: AUDIT_ACTIONS.UPDATE,
    entity: 'Material',
    entityId: material._id,
    reference: material.name,
    changes: diff(before, material.toObject(), ['name', 'unit', 'minStock', 'unitCost', 'supplier', 'category']),
  });
  sendSuccess(res, { data: material, message: 'Material updated' });
});

exports.deleteMaterial = asyncHandler(async (req, res) => {
  const material = assertFound(await Material.findById(req.params.id), 'Material not found.');
  if (await BillOfMaterials.exists({ 'items.material': material._id })) throw ApiError.badRequest('This material is used in a bill of materials.');
  if (material.quantity > 0) throw ApiError.badRequest('Write off the remaining stock before removing this material.');
  await material.softDelete(req.user._id);
  await audit(actorFrom(req), { action: AUDIT_ACTIONS.DELETE, entity: 'Material', entityId: material._id, reference: material.name });
  sendSuccess(res, { message: 'Material removed' });
});

// ---------- Inventory ----------
exports.overview = asyncHandler(async (_req, res) => {
  const [products, materials] = await Promise.all([
    Product.find().select('name sku quantity branchStock minStock soldQuantity damagedQuantity costPrice status madeToOrder images').sort({ name: 1 }).lean(),
    Material.find().select('name code unit quantity branchStock minStock unitCost category').sort({ name: 1 }).lean(),
  ]);
  sendSuccess(res, {
    data: {
      products: products.map((p) => ({ ...p, isLowStock: !p.madeToOrder && p.quantity <= p.minStock, stockValue: round2(p.quantity * p.costPrice) })),
      materials: materials.map((m) => ({ ...m, isLowStock: m.quantity <= m.minStock, stockValue: round2(m.quantity * m.unitCost) })),
      totals: {
        productValue: round2(products.reduce((s, p) => s + p.quantity * p.costPrice, 0)),
        materialValue: round2(materials.reduce((s, m) => s + m.quantity * m.unitCost, 0)),
        lowStockMaterials: materials.filter((m) => m.quantity <= m.minStock).length,
        lowStockProducts: products.filter((p) => !p.madeToOrder && p.quantity <= p.minStock).length,
      },
    },
  });
});

exports.listTransactions = asyncHandler(async (req, res) => {
  const filter = {
    ...pickFilters(req.query, ['itemType', 'type', 'product', 'material', 'branch'], ['product', 'material', 'branch']),
    ...dateRangeFilter('createdAt', req.query.from, req.query.to),
  };
  const { items, pagination } = await paginate(InventoryTransaction, filter, req.query, {
    populate: [
      { path: 'product', select: 'name sku' },
      { path: 'material', select: 'name unit' },
      { path: 'createdBy', select: 'name' },
      { path: 'branch', select: 'name code' },
    ],
  });
  sendSuccess(res, { data: items, pagination });
});

/** Moves stock from one branch to another (both sides ledgered). */
exports.transfer = asyncHandler(async (req, res) => {
  const { itemType, itemId, from, to, quantity, note } = req.body;
  const item = await transferStock({ itemType, itemId, from, to, quantity, note, userId: req.user._id });
  await audit(actorFrom(req), {
    action: AUDIT_ACTIONS.INVENTORY_CHANGE,
    entity: itemType === 'PRODUCT' ? 'Product' : 'Material',
    entityId: itemId,
    reference: item.name,
    description: `Transferred ${quantity} between branches${note ? `: ${note}` : ''}`,
  });
  sendSuccess(res, { data: item, message: 'Stock transferred' });
});

/** Manual stock movements (stock-in, stock-out, damage, returns, corrections). Always ledgered. */
exports.adjust = asyncHandler(async (req, res) => {
  const { itemType, itemId, type, quantity, unitCost, note, branch } = req.body;
  const sign = MANUAL_TYPES[type];
  const delta = sign === 0 ? quantity : sign * Math.abs(quantity);
  const result = await adjustStock({ itemType, itemId, delta, type, unitCost, note, userId: req.user._id, branch: branch || req.user.branch });
  if (result.crossedLowStock) await sendLowStockAlert(itemType, result.item);
  await audit(actorFrom(req), {
    action: AUDIT_ACTIONS.INVENTORY_CHANGE,
    entity: itemType === 'PRODUCT' ? 'Product' : 'Material',
    entityId: itemId,
    reference: result.item.name,
    description: `${type} ${delta > 0 ? '+' : ''}${delta}: ${note}`,
  });
  sendSuccess(res, { data: result.item, message: 'Stock updated' });
});

// ---------- Bill of materials ----------
exports.getBom = asyncHandler(async (req, res) => {
  const bom = await BillOfMaterials.findOne({ product: req.params.productId }).populate('items.material', 'name unit unitCost quantity').lean();
  const product = assertFound(await Product.findById(req.params.productId).select('name sku costPrice').lean(), 'Product not found.');
  const materialCost = round2((bom?.items || []).reduce((s, i) => s + i.quantity * (1 + (i.wastePercent || 0) / 100) * (i.material?.unitCost || 0), 0));
  sendSuccess(res, { data: { product, bom, materialCost } });
});

exports.listBoms = asyncHandler(async (_req, res) => {
  const boms = await BillOfMaterials.find().populate('product', 'name sku').populate('items.material', 'name unit unitCost').lean();
  sendSuccess(res, {
    data: boms.map((b) => ({ ...b, materialCost: round2(b.items.reduce((s, i) => s + i.quantity * (i.material?.unitCost || 0), 0)) })),
  });
});

exports.saveBom = asyncHandler(async (req, res) => {
  const product = assertFound(await Product.findById(req.params.productId).select('name sku').lean(), 'Product not found.');
  const ids = [...new Set(req.body.items.map((i) => i.material))];
  if ((await Material.countDocuments({ _id: { $in: ids } })) !== ids.length) throw ApiError.badRequest('Unknown material in the bill of materials.');
  if (ids.length !== req.body.items.length) throw ApiError.badRequest('Each material may appear only once.');
  const bom = await BillOfMaterials.findOneAndUpdate(
    { product: product._id },
    { $set: { ...req.body, updatedBy: req.user._id } },
    { new: true, upsert: true, runValidators: true }
  ).populate('items.material', 'name unit unitCost');
  await audit(actorFrom(req), { action: AUDIT_ACTIONS.UPDATE, entity: 'BillOfMaterials', entityId: bom._id, reference: product.sku, description: `BOM saved (${bom.items.length} items)` });
  sendSuccess(res, { data: bom, message: 'Bill of materials saved' });
});

/** Material requirement for producing N units, compared to current stock. */
exports.calculate = asyncHandler(async (req, res) => {
  const quantity = Math.max(parseInt(req.query.quantity, 10) || 1, 1);
  const bom = await BillOfMaterials.findOne({ product: req.params.productId }).populate('items.material', 'name unit unitCost quantity').lean();
  if (!bom) throw ApiError.notFound('This product has no bill of materials yet.');
  const lines = bom.items.map((i) => {
    const required = round2(i.quantity * quantity * (1 + (i.wastePercent || 0) / 100));
    return {
      material: i.material?._id,
      name: i.material?.name,
      unit: i.material?.unit,
      required,
      available: i.material?.quantity || 0,
      shortage: round2(Math.max(required - (i.material?.quantity || 0), 0)),
      cost: round2(required * (i.material?.unitCost || 0)),
    };
  });
  sendSuccess(res, { data: { quantity, lines, totalCost: round2(lines.reduce((s, l) => s + l.cost, 0)), canProduce: lines.every((l) => l.shortage === 0) } });
});

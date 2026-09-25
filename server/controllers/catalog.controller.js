const { Category, Product, BillOfMaterials, Order } = require('../models');
const { audit, actorFrom, diff } = require('../services/audit.service');
const { adjustStock } = require('../services/inventory.service');
const { removeFile } = require('../services/storage.service');
const { asyncHandler, sendSuccess, sendCreated } = require('../utils/http');
const { paginate, searchFilter, isObjectId, escapeRegex } = require('../utils/query');
const ApiError = require('../utils/ApiError');
const { assertFound } = require('./helpers');
const { AUDIT_ACTIONS, PRODUCT_STATUS, INVENTORY_TX_TYPES, STAFF_ROLES } = require('../config/constants');

const slugify = (text) =>
  String(text)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);

const isStaff = (req) => Boolean(req.user && STAFF_ROLES.includes(req.user.role));

// Fields customers and visitors must never see.
function toPublicProduct(p) {
  const { costPrice, minStock, damagedQuantity, soldQuantity, deletedAt, deletedBy, ...rest } = p;
  return {
    ...rest,
    quantity: undefined,
    availability: p.quantity > 0 ? 'IN_STOCK' : p.madeToOrder ? 'MADE_TO_ORDER' : 'OUT_OF_STOCK',
    inStock: p.quantity,
    isLowStock: undefined,
  };
}

// ---------- Categories ----------
exports.listCategories = asyncHandler(async (req, res) => {
  const filter = isStaff(req) ? {} : { isActive: true };
  const categories = await Category.find(filter).sort({ sortOrder: 1, name: 1 }).lean();
  const counts = await Product.aggregate([
    { $match: { status: { $in: [PRODUCT_STATUS.ACTIVE, PRODUCT_STATUS.OUT_OF_STOCK] } } },
    { $group: { _id: '$category', count: { $sum: 1 } } },
  ]);
  const byId = new Map(counts.map((c) => [String(c._id), c.count]));
  sendSuccess(res, { data: categories.map((c) => ({ ...c, productCount: byId.get(String(c._id)) || 0 })) });
});

exports.createCategory = asyncHandler(async (req, res) => {
  const category = await Category.create({ ...req.body, slug: req.body.slug || slugify(req.body.name) });
  await audit(actorFrom(req), { action: AUDIT_ACTIONS.CREATE, entity: 'Category', entityId: category._id, reference: category.name });
  sendCreated(res, category, 'Category created');
});

exports.updateCategory = asyncHandler(async (req, res) => {
  const category = assertFound(await Category.findById(req.params.id), 'Category not found.');
  Object.assign(category, req.body);
  await category.save();
  await audit(actorFrom(req), { action: AUDIT_ACTIONS.UPDATE, entity: 'Category', entityId: category._id, reference: category.name });
  sendSuccess(res, { data: category, message: 'Category updated' });
});

exports.deleteCategory = asyncHandler(async (req, res) => {
  const category = assertFound(await Category.findById(req.params.id), 'Category not found.');
  if (await Product.exists({ category: category._id })) throw ApiError.badRequest('Move or remove the products in this category first.');
  await category.softDelete(req.user._id);
  await audit(actorFrom(req), { action: AUDIT_ACTIONS.DELETE, entity: 'Category', entityId: category._id, reference: category.name });
  sendSuccess(res, { message: 'Category removed' });
});

// ---------- Products ----------
exports.listProducts = asyncHandler(async (req, res) => {
  const q = req.query;
  const staff = isStaff(req);
  const filter = { ...searchFilter(q.search, ['name', 'sku', 'description', 'materials']) };

  if (!staff) filter.status = { $in: [PRODUCT_STATUS.ACTIVE, PRODUCT_STATUS.OUT_OF_STOCK] };
  else if (q.status) filter.status = { $in: String(q.status).split(',') };

  if (q.category) {
    if (isObjectId(q.category)) filter.category = q.category;
    else {
      const cat = await Category.findOne({ slug: String(q.category) }).select('_id').lean();
      filter.category = cat?._id || null;
    }
  }
  if (q.featured === 'true') filter.isFeatured = true;
  if (q.color) filter.colors = new RegExp(`^${escapeRegex(q.color)}$`, 'i');
  if (q.material) filter.materials = new RegExp(escapeRegex(q.material), 'i');
  if (q.minPrice || q.maxPrice) {
    filter.sellingPrice = {};
    if (q.minPrice) filter.sellingPrice.$gte = Number(q.minPrice) || 0;
    if (q.maxPrice) filter.sellingPrice.$lte = Number(q.maxPrice) || Number.MAX_SAFE_INTEGER;
  }
  if (q.inStock === 'true') filter.quantity = { $gt: 0 };
  if (staff && q.lowStock === 'true') filter.$expr = { $lte: ['$quantity', '$minStock'] };

  const sortMap = { popular: { soldQuantity: -1 }, price: { sellingPrice: 1 }, '-price': { sellingPrice: -1 }, name: { name: 1 }, newest: { createdAt: -1 } };
  const { items, pagination } = await paginate(Product, filter, { ...q, sort: undefined }, {
    sort: sortMap[q.sort] || { isFeatured: -1, createdAt: -1 },
    populate: { path: 'category', select: 'name slug' },
    lean: true,
  });
  const data = staff ? items.map((p) => ({ ...p, isLowStock: p.quantity <= p.minStock })) : items.map(toPublicProduct);
  sendSuccess(res, { data, pagination });
});

exports.getProduct = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const query = isObjectId(id) ? { _id: id } : { slug: String(id).toLowerCase() };
  const product = assertFound(await Product.findOne(query).populate('category', 'name slug').lean(), 'Product not found.');
  const staff = isStaff(req);
  if (!staff && ![PRODUCT_STATUS.ACTIVE, PRODUCT_STATUS.OUT_OF_STOCK].includes(product.status)) throw ApiError.notFound('Product is unavailable.');

  const related = await Product.find({ category: product.category?._id, _id: { $ne: product._id }, status: PRODUCT_STATUS.ACTIVE })
    .limit(4)
    .select('name slug images sellingPrice price quantity madeToOrder')
    .lean();
  const data = staff ? { ...product, isLowStock: product.quantity <= product.minStock } : toPublicProduct(product);
  if (staff) data.bom = await BillOfMaterials.findOne({ product: product._id }).populate('items.material', 'name unit unitCost quantity').lean();
  data.related = related.map(toPublicProduct);
  sendSuccess(res, { data });
});

async function uniqueSlug(name, excludeId) {
  const base = slugify(name) || 'product';
  let slug = base;
  let n = 1;
  while (await Product.exists({ slug, _id: { $ne: excludeId } })) slug = `${base}-${++n}`;
  return slug;
}

exports.createProduct = asyncHandler(async (req, res) => {
  if (!(await Category.exists({ _id: req.body.category }))) throw ApiError.badRequest('Category not found.');
  const { quantity = 0, allowLoss, ...data } = req.body;
  const product = await Product.create({ ...data, quantity: 0, images: [...(data.images || []), ...(req.uploadedFiles || [])], slug: await uniqueSlug(data.name) });
  if (quantity > 0) {
    await adjustStock({
      itemType: 'PRODUCT',
      itemId: product._id,
      delta: quantity,
      type: INVENTORY_TX_TYPES.STOCK_IN,
      unitCost: product.costPrice,
      note: 'Opening stock',
      userId: req.user._id,
    });
    product.quantity = quantity;
  }
  await audit(actorFrom(req), { action: AUDIT_ACTIONS.CREATE, entity: 'Product', entityId: product._id, reference: product.sku, description: product.name });
  sendCreated(res, product, 'Product created');
});

exports.updateProduct = asyncHandler(async (req, res) => {
  const product = assertFound(await Product.findById(req.params.id), 'Product not found.');
  if (req.body.category && !(await Category.exists({ _id: req.body.category }))) throw ApiError.badRequest('Category not found.');
  const before = product.toObject();
  const { images, ...changes } = req.body;
  Object.assign(product, changes);
  if (images) {
    const removed = before.images.filter((url) => !images.includes(url));
    product.images = images;
    removed.forEach((url) => removeFile(url));
  }
  if (req.uploadedFiles?.length) product.images.push(...req.uploadedFiles);
  if (changes.name && changes.name !== before.name) product.slug = await uniqueSlug(changes.name, product._id);
  await product.save();
  await audit(actorFrom(req), {
    action: AUDIT_ACTIONS.UPDATE,
    entity: 'Product',
    entityId: product._id,
    reference: product.sku,
    changes: diff(before, product.toObject(), ['name', 'price', 'costPrice', 'sellingPrice', 'status', 'minStock', 'category', 'isFeatured']),
  });
  sendSuccess(res, { data: product, message: 'Product updated' });
});

exports.deleteProduct = asyncHandler(async (req, res) => {
  const product = assertFound(await Product.findById(req.params.id), 'Product not found.');
  const openOrders = await Order.exists({ 'items.product': product._id, status: { $nin: ['COMPLETED', 'CANCELLED'] } });
  if (openOrders) throw ApiError.badRequest('This product is on open orders. Mark it discontinued instead.');
  product.status = PRODUCT_STATUS.DISCONTINUED;
  await product.softDelete(req.user._id);
  await audit(actorFrom(req), { action: AUDIT_ACTIONS.DELETE, entity: 'Product', entityId: product._id, reference: product.sku });
  sendSuccess(res, { message: 'Product removed' });
});

exports.slugify = slugify;
exports.toPublicProduct = toPublicProduct;

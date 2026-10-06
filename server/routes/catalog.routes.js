const express = require('express');
const { z } = require('zod');
const { requireAuth, optionalAuth } = require('../middleware/auth');
const { requirePermission } = require('../middleware/rbac');
const validate = require('../middleware/validate');
const { uploadImages, parseMultipartJson } = require('../middleware/upload');
const { PERMISSIONS: P } = require('../config/permissions');
const { idParam, listQuery, objectId } = require('../validators/common');
const v = require('../validators/catalog.validator');
const catalog = require('../controllers/catalog.controller');
const reviews = require('../controllers/review.controller');
const wishlistController = require('../controllers/wishlist.controller');
const { publicFormLimiter } = require('../middleware/rateLimit');

const id = validate({ params: idParam });
const canWriteCategories = [requireAuth, requirePermission(P.CATEGORIES_WRITE)];
const canWriteProducts = [requireAuth, requirePermission(P.PRODUCTS_WRITE)];
const productImages = uploadImages('images', { maxCount: 8, folder: 'products' });

// Reads are public: the storefront uses them. Staff see extra fields (cost, stock levels).
const categories = express.Router();
categories.get('/', optionalAuth, catalog.listCategories);
categories.post('/', ...canWriteCategories, validate({ body: v.category }), catalog.createCategory);
categories.patch('/:id', ...canWriteCategories, id, validate({ body: v.updateCategory }), catalog.updateCategory);
categories.delete('/:id', ...canWriteCategories, id, catalog.deleteCategory);

const products = express.Router();
products.get('/', optionalAuth, validate({ query: listQuery }), catalog.listProducts);
products.get('/:id/reviews', optionalAuth, validate({ params: z.object({ id: z.string().max(160) }), query: v.reviewQuery }), reviews.listForProduct);
products.post('/:id/reviews', requireAuth, publicFormLimiter, validate({ params: z.object({ id: z.string().max(160) }), body: v.review }), reviews.create);
products.get('/:id', optionalAuth, validate({ params: z.object({ id: z.string().max(160) }) }), catalog.getProduct);
products.post('/', ...canWriteProducts, productImages, parseMultipartJson, validate({ body: v.createProduct }), catalog.createProduct);
products.patch('/:id', ...canWriteProducts, id, productImages, parseMultipartJson, validate({ body: v.updateProduct }), catalog.updateProduct);
products.delete('/:id', ...canWriteProducts, id, catalog.deleteProduct);

// Staff moderation of customer reviews.
const reviewAdmin = express.Router();
reviewAdmin.get('/', requirePermission(P.PRODUCTS_WRITE), validate({ query: v.reviewQuery }), reviews.listForModeration);
reviewAdmin.patch('/:id', requirePermission(P.PRODUCTS_WRITE), id, validate({ body: v.reviewStatus }), reviews.setStatus);

// Customer favourites.
const wishlist = express.Router();
const productParam = validate({ params: z.object({ productId: objectId }) });
wishlist.get('/', wishlistController.list);
wishlist.post('/merge', validate({ body: z.object({ productIds: z.array(z.string().max(40)).max(200) }) }), wishlistController.merge);
wishlist.put('/:productId', productParam, wishlistController.add);
wishlist.delete('/:productId', productParam, wishlistController.remove);

module.exports = { categories, products, reviews: reviewAdmin, wishlist };

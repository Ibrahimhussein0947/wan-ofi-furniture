const express = require('express');
const { z } = require('zod');
const { requireAuth, optionalAuth } = require('../middleware/auth');
const { requirePermission } = require('../middleware/rbac');
const validate = require('../middleware/validate');
const { uploadImages, parseMultipartJson } = require('../middleware/upload');
const { PERMISSIONS: P } = require('../config/permissions');
const { idParam, listQuery } = require('../validators/common');
const v = require('../validators/catalog.validator');
const catalog = require('../controllers/catalog.controller');

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
products.get('/:id', optionalAuth, validate({ params: z.object({ id: z.string().max(160) }) }), catalog.getProduct);
products.post('/', ...canWriteProducts, productImages, parseMultipartJson, validate({ body: v.createProduct }), catalog.createProduct);
products.patch('/:id', ...canWriteProducts, id, productImages, parseMultipartJson, validate({ body: v.updateProduct }), catalog.updateProduct);
products.delete('/:id', ...canWriteProducts, id, catalog.deleteProduct);

module.exports = { categories, products };

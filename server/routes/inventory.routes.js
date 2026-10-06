const express = require('express');
const { z } = require('zod');
const { requirePermission } = require('../middleware/rbac');
const validate = require('../middleware/validate');
const { PERMISSIONS: P } = require('../config/permissions');
const { idParam, listQuery, objectId } = require('../validators/common');
const v = require('../validators/catalog.validator');
const inventory = require('../controllers/inventory.controller');
const suppliers = require('../controllers/supplier.controller');

const id = validate({ params: idParam });
const list = validate({ query: listQuery });
const productParam = validate({ params: z.object({ productId: objectId }) });

const materials = express.Router();
materials.get('/', requirePermission(P.MATERIALS_READ), list, inventory.listMaterials);
materials.get('/:id', requirePermission(P.MATERIALS_READ), id, inventory.getMaterial);
materials.post('/', requirePermission(P.MATERIALS_WRITE), validate({ body: v.createMaterial }), inventory.createMaterial);
materials.patch('/:id', requirePermission(P.MATERIALS_WRITE), id, validate({ body: v.updateMaterial }), inventory.updateMaterial);
materials.delete('/:id', requirePermission(P.MATERIALS_WRITE), id, inventory.deleteMaterial);

const stock = express.Router();
stock.get('/', requirePermission(P.INVENTORY_READ), inventory.overview);
stock.get('/transactions', requirePermission(P.INVENTORY_READ), list, inventory.listTransactions);
stock.post('/adjust', requirePermission(P.INVENTORY_WRITE), validate({ body: v.stockAdjustment }), inventory.adjust);
stock.post('/transfer', requirePermission(P.INVENTORY_WRITE), validate({ body: v.stockTransfer }), inventory.transfer);

const bom = express.Router();
bom.get('/', requirePermission(P.BOM_READ), inventory.listBoms);
bom.get('/:productId', requirePermission(P.BOM_READ), productParam, inventory.getBom);
bom.get('/:productId/calculate', requirePermission(P.BOM_READ), productParam, inventory.calculate);
bom.put('/:productId', requirePermission(P.BOM_WRITE), productParam, validate({ body: v.bom }), inventory.saveBom);

const supplierRoutes = express.Router();
supplierRoutes.get('/', requirePermission(P.SUPPLIERS_READ), list, suppliers.list);
supplierRoutes.get('/:id', requirePermission(P.SUPPLIERS_READ), id, suppliers.get);
supplierRoutes.post('/', requirePermission(P.SUPPLIERS_WRITE), validate({ body: v.supplier }), suppliers.create);
supplierRoutes.patch('/:id', requirePermission(P.SUPPLIERS_WRITE), id, validate({ body: v.updateSupplier }), suppliers.update);
supplierRoutes.delete('/:id', requirePermission(P.SUPPLIERS_WRITE), id, suppliers.remove);

const purchases = express.Router();
const cancelBody = validate({ body: z.object({ reason: z.string().trim().max(500).optional() }) });
purchases.get('/', requirePermission(P.PURCHASES_READ), list, suppliers.listPurchases);
purchases.get('/suggestions', requirePermission(P.PURCHASES_READ), suppliers.reorderSuggestions);
purchases.get('/:id', requirePermission(P.PURCHASES_READ), id, suppliers.getPurchase);
purchases.post('/', requirePermission(P.PURCHASES_WRITE), validate({ body: v.purchaseOrder }), suppliers.createPurchase);
purchases.post('/:id/place', requirePermission(P.PURCHASES_WRITE), id, suppliers.markOrdered);
purchases.post('/:id/receive', requirePermission(P.PURCHASES_WRITE, P.INVENTORY_WRITE), id, validate({ body: v.receivePurchase }), suppliers.receivePurchase);
purchases.post('/:id/cancel', requirePermission(P.PURCHASES_WRITE), id, cancelBody, suppliers.cancelPurchase);

module.exports = { materials, inventory: stock, bom, suppliers: supplierRoutes, purchases };

const express = require('express');
const { z } = require('zod');
const { requirePermission } = require('../middleware/rbac');
const validate = require('../middleware/validate');
const { uploadImages, parseMultipartJson } = require('../middleware/upload');
const { PERMISSIONS: P } = require('../config/permissions');
const { idParam, listQuery, objectId } = require('../validators/common');
const v = require('../validators/operations.validator');
const production = require('../controllers/production.controller');
const deliveries = require('../controllers/delivery.controller');

const id = validate({ params: idParam });
const list = validate({ query: listQuery });
const withSub = (key) => validate({ params: z.object({ id: objectId, [key]: objectId }) });
const read = requirePermission(P.PRODUCTION_READ);
const update = requirePermission(P.PRODUCTION_UPDATE);
const manage = requirePermission(P.PRODUCTION_MANAGE);

const jobs = express.Router();
jobs.get('/', read, list, production.list);
jobs.get('/board', read, production.board);
jobs.get('/my-workload', read, production.myWorkload);
jobs.get('/:id', read, id, production.get);
jobs.patch('/:id', manage, id, validate({ body: v.updateJob }), production.update);
jobs.post('/:id/stage', update, id, validate({ body: v.stage }), production.stage);
jobs.post('/:id/assign', manage, id, validate({ body: v.assign }), production.assign);
jobs.post('/:id/issue-materials', requirePermission(P.MATERIALS_ISSUE), id, validate({ body: v.materialLines }), production.issueMaterials);
jobs.post('/:id/return-materials', update, id, validate({ body: v.materialReturn }), production.returnMaterials);
jobs.post('/:id/material-requests', update, id, validate({ body: v.materialRequest }), production.requestMaterials);
jobs.post('/:id/material-requests/:requestId', requirePermission(P.MATERIALS_ISSUE), withSub('requestId'), validate({ body: v.decision }), production.handleMaterialRequest);
jobs.post('/:id/notes', update, id, validate({ body: v.jobNote }), production.addNote);
jobs.post('/:id/images', update, id, uploadImages('images', { maxCount: 6, folder: 'production' }), production.addImages);
jobs.post('/:id/problems', update, id, validate({ body: v.problem }), production.reportProblem);
jobs.post('/:id/problems/:problemId/resolve', manage, withSub('problemId'), validate({ body: v.resolution }), production.resolveProblem);

const tasks = express.Router();
tasks.get('/', read, list, production.listTasks);
tasks.post('/', manage, validate({ body: v.task }), production.createTask);
tasks.patch('/:id', update, id, validate({ body: v.updateTask }), production.updateTask);
tasks.delete('/:id', manage, id, production.deleteTask);

const quality = express.Router();
const qc = requirePermission(P.QUALITY_MANAGE);
quality.get('/', qc, list, production.listQuality);
quality.get('/:id', qc, id, production.getQuality);
quality.post('/:id/inspect', qc, id, uploadImages('images', { maxCount: 6, folder: 'quality' }), parseMultipartJson, validate({ body: v.inspection }), production.inspect);

const deliveryRoutes = express.Router();
const seeDeliveries = requirePermission(P.DELIVERIES_READ, P.ORDERS_READ);
deliveryRoutes.get('/', seeDeliveries, list, deliveries.list);
deliveryRoutes.get('/:id', seeDeliveries, id, deliveries.get);
deliveryRoutes.post('/', requirePermission(P.DELIVERIES_MANAGE), validate({ body: v.delivery }), deliveries.create);
deliveryRoutes.patch('/:id', requirePermission(P.DELIVERIES_UPDATE), id, validate({ body: v.updateDelivery }), deliveries.update);
deliveryRoutes.post('/:id/proof', requirePermission(P.DELIVERIES_UPDATE), id, uploadImages('images', { maxCount: 6, folder: 'deliveries' }), deliveries.proof);

module.exports = { production: jobs, tasks, quality, deliveries: deliveryRoutes };

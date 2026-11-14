const express = require('express');
const { z } = require('zod');
const { requireRole } = require('../middleware/rbac');
const validate = require('../middleware/validate');
const { asyncHandler, sendSuccess } = require('../utils/http');
const { actorFrom } = require('../services/audit.service');
const system = require('../services/system.service');

const router = express.Router();
router.use(requireRole('SUPER_ADMIN'));

const body = z.object({ master: z.boolean().optional(), storefront: z.boolean().optional(), customers: z.boolean().optional(), staff: z.boolean().optional() }).strict();

router.get('/overview', asyncHandler(async (_req, res) => sendSuccess(res, { data: await system.overview() })));
router.patch('/systems', validate({ body }), asyncHandler(async (req, res) => sendSuccess(res, { data: await system.setSystems(req.body, actorFrom(req)), message: 'Systems updated' })));

module.exports = router;

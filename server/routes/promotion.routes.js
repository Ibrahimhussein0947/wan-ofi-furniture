const express = require('express');
const { z } = require('zod');
const { requirePermission } = require('../middleware/rbac');
const validate = require('../middleware/validate');
const { publicFormLimiter } = require('../middleware/rateLimit');
const { PERMISSIONS: P } = require('../config/permissions');
const { idParam, money, trimmed, optionalText, optionalDate } = require('../validators/common');
const promotionService = require('../services/promotion.service');
const { actorFrom, audit } = require('../services/audit.service');
const { asyncHandler, sendSuccess, sendCreated } = require('../utils/http');
const { isCustomer, customerOf } = require('../controllers/helpers');
const { AUDIT_ACTIONS } = require('../config/constants');

const promotionBody = z
  .object({
    code: trimmed(30)
      .min(3)
      .regex(/^[A-Za-z0-9_-]+$/, 'Use letters, numbers, dashes or underscores'),
    description: optionalText(300),
    type: z.enum(['PERCENT', 'FIXED']),
    value: money,
    maxDiscount: money.optional(),
    minSubtotal: money.optional(),
    startsAt: optionalDate,
    endsAt: optionalDate,
    usageLimit: z.coerce.number().int().min(0).optional(),
    perCustomerLimit: z.coerce.number().int().min(0).optional(),
    isActive: z.boolean().optional(),
  })
  .refine((p) => p.type !== 'PERCENT' || (p.value > 0 && p.value <= 100), { message: 'A percentage must be between 1 and 100', path: ['value'] })
  .refine((p) => !p.startsAt || !p.endsAt || p.startsAt <= p.endsAt, { message: 'The end date must be after the start date', path: ['endsAt'] });

const router = express.Router();

// Checkout preview. The final discount is always recalculated when the order is placed.
router.post(
  '/check',
  publicFormLimiter,
  validate({ body: z.object({ code: trimmed(30).min(1), subtotal: money }) }),
  asyncHandler(async (req, res) => {
    const customerId = isCustomer(req) ? (await customerOf(req))._id : undefined;
    const { promotion, code, discount } = await promotionService.evaluate(req.body.code, { subtotal: req.body.subtotal, customerId });
    sendSuccess(res, { data: { code, discount, description: promotion.description, type: promotion.type, value: promotion.value }, message: 'Promo code applied' });
  })
);

const canManage = requirePermission(P.DISCOUNTS_WRITE);

router.get(
  '/',
  canManage,
  asyncHandler(async (_req, res) => sendSuccess(res, { data: await promotionService.list() }))
);

router.post(
  '/',
  canManage,
  validate({ body: promotionBody }),
  asyncHandler(async (req, res) => {
    const promotion = await promotionService.create(req.body, actorFrom(req));
    await audit(actorFrom(req), { action: AUDIT_ACTIONS.CREATE, entity: 'Promotion', entityId: promotion._id, reference: promotion.code, description: 'Promo code created' });
    sendCreated(res, promotion, 'Promo code created');
  })
);

router.patch(
  '/:id',
  canManage,
  validate({ params: idParam, body: promotionBody.innerType().innerType().partial() }),
  asyncHandler(async (req, res) => {
    const promotion = await promotionService.update(req.params.id, req.body);
    await audit(actorFrom(req), { action: AUDIT_ACTIONS.UPDATE, entity: 'Promotion', entityId: promotion._id, reference: promotion.code, description: 'Promo code updated' });
    sendSuccess(res, { data: promotion, message: 'Promo code updated' });
  })
);

module.exports = router;

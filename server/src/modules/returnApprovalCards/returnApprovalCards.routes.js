import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { isAdmin } from '../../middleware/rbac.js';
import { validate } from '../../middleware/validate.js';
import {
  idParams,
  approvalCardCreateBody,
  approvalCardDisableBody,
  approvalCardPrintBody,
} from '../../validation/schemas.js';
import * as controller from './returnApprovalCards.controller.js';
import { z } from 'zod';

const cardUsesQuery = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).optional(),
  page: z.coerce.number().int().min(1).default(1),
});

const router = Router();
router.use(authenticate, isAdmin);
router.get('/', controller.list);
router.post('/', validate({ body: approvalCardCreateBody }), controller.create);
router.get('/:id', validate({ params: idParams }), controller.detail);
router.get('/:id/uses', validate({ params: idParams, query: cardUsesQuery }), controller.uses);
router.post('/:id/rotate', validate({ params: idParams }), controller.rotate);
router.post('/:id/enable', validate({ params: idParams }), controller.enable);
router.post(
  '/:id/disable',
  validate({ params: idParams, body: approvalCardDisableBody }),
  controller.disable
);
router.post(
  '/:id/print-request',
  validate({ params: idParams, body: approvalCardPrintBody }),
  controller.print
);
export default router;

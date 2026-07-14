import { Router } from 'express';
import * as preordersController from './preorders.controller.js';
import { authenticate } from '../../middleware/auth.js';
import { requireRole } from '../../middleware/auth.js';
import { isAdmin } from '../../middleware/rbac.js';
import { validate } from '../../middleware/validate.js';
import {
  idParams,
  preorderCreateBody,
  preorderListQuery,
  preorderPickupBody,
  preorderScanBody,
  preorderSearchQuery,
  preorderStatusBody,
} from '../../validation/schemas.js';

const router = Router();

// Protect endpoints under cashier authentication
router.use(authenticate, requireRole(['Cashier']));

router.post(
  '/',
  validate({ body: preorderCreateBody }),
  preordersController.createPreorderController
);
router.post(
  '/scan',
  validate({ body: preorderScanBody }),
  preordersController.scanPreorderController
);
router.get(
  '/search',
  validate({ query: preorderSearchQuery }),
  preordersController.searchPreordersController
);
router.post(
  '/:id/pickup',
  validate({ params: idParams, body: preorderPickupBody }),
  preordersController.pickupPreorderController
);

// Admin-only preorder tracking routes
const adminRouter = Router();
adminRouter.use(authenticate);
adminRouter.use(isAdmin);

adminRouter.get(
  '/',
  validate({ query: preorderListQuery }),
  preordersController.listPreordersController
);
adminRouter.patch(
  '/:id/status',
  validate({ params: idParams, body: preorderStatusBody }),
  preordersController.updatePreorderStatusController
);

export { adminRouter as preorderAdminRoutes };
export default router;

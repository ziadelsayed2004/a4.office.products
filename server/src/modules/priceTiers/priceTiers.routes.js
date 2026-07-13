import { Router } from 'express';
import * as priceTiersController from './priceTiers.controller.js';
import { authenticate } from '../../middleware/auth.js';
import { isAdmin, isCashierOrAdmin } from '../../middleware/rbac.js';
import { validate } from '../../middleware/validate.js';
import {
  categoryListQuery,
  idParams,
  priceTierCreateBody,
  priceTierUpdateBody,
} from '../../validation/schemas.js';

const router = Router();

// Retrieve all price tiers (accessible by both Cashier and Admin)
router.get(
  '/',
  authenticate,
  isCashierOrAdmin,
  validate({ query: categoryListQuery }),
  priceTiersController.getPriceTiersController
);

// Admin-only write routes
router.post(
  '/',
  authenticate,
  isAdmin,
  validate({ body: priceTierCreateBody }),
  priceTiersController.createPriceTierController
);
router.patch(
  '/:id',
  authenticate,
  isAdmin,
  validate({ params: idParams, body: priceTierUpdateBody }),
  priceTiersController.updatePriceTierController
);
router.delete(
  '/:id',
  authenticate,
  isAdmin,
  validate({ params: idParams }),
  priceTiersController.deletePriceTierController
);

export default router;

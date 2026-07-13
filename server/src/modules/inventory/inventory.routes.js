import { Router } from 'express';
import * as inventoryController from './inventory.controller.js';
import { authenticate } from '../../middleware/auth.js';
import { isAdmin } from '../../middleware/rbac.js';
import { validate } from '../../middleware/validate.js';
import { inventoryAdjustmentBody, inventoryQuery } from '../../validation/schemas.js';

const router = Router();

// Apply Admin protection globally to all inventory endpoints
router.use(authenticate, isAdmin);

router.get(
  '/',
  validate({ query: inventoryQuery }),
  inventoryController.getInventoryLedgerController
);
router.post(
  '/adjust',
  validate({ body: inventoryAdjustmentBody }),
  inventoryController.adjustStockController
);

export default router;

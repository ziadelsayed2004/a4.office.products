import { Router } from 'express';
import * as inventoryController from './inventory.controller.js';
import { authenticate } from '../../middleware/auth.js';
import { isAdmin } from '../../middleware/rbac.js';

const router = Router();

// Apply Admin protection globally to all inventory endpoints
router.use(authenticate, isAdmin);

router.get('/', inventoryController.getInventoryLedgerController);
router.post('/adjust', inventoryController.adjustStockController);

export default router;

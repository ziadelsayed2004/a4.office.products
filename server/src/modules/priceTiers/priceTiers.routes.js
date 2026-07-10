import { Router } from 'express';
import * as priceTiersController from './priceTiers.controller.js';
import { authenticate } from '../../middleware/auth.js';
import { isAdmin, isCashierOrAdmin } from '../../middleware/rbac.js';

const router = Router();

// Retrieve all price tiers (accessible by both Cashier and Admin)
router.get('/', authenticate, isCashierOrAdmin, priceTiersController.getPriceTiersController);

// Admin-only write routes
router.post('/', authenticate, isAdmin, priceTiersController.createPriceTierController);
router.patch('/:id', authenticate, isAdmin, priceTiersController.updatePriceTierController);

export default router;

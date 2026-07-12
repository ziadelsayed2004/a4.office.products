import { Router } from 'express';
import * as posController from './pos.controller.js';
import { authenticate } from '../../middleware/auth.js';

const router = Router();

// Apply auth check globally - both cashiers and admins can access scan/search in POS
router.use(authenticate);

router.post('/scan/resolve', posController.resolveScanController);
router.post('/scan-product', posController.scanProductController);
router.get('/products/search', posController.searchPosProductsController);
router.post('/orders/checkout', posController.checkoutController);
router.post('/orders/:id/return', posController.returnOrderController);

export default router;

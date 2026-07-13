import { Router } from 'express';
import * as posController from './pos.controller.js';
import { authenticate } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import {
  checkoutBody,
  idParams,
  posSearchQuery,
  returnOrderBody,
  scanBody,
  scanProductBody,
} from '../../validation/schemas.js';

const router = Router();

// Apply auth check globally - both cashiers and admins can access scan/search in POS
router.use(authenticate);

router.post('/scan/resolve', validate({ body: scanBody }), posController.resolveScanController);
router.post(
  '/scan-product',
  validate({ body: scanProductBody }),
  posController.scanProductController
);
router.get(
  '/products/search',
  validate({ query: posSearchQuery }),
  posController.searchPosProductsController
);
router.post('/orders/checkout', validate({ body: checkoutBody }), posController.checkoutController);
router.post(
  '/orders/:id/return',
  validate({ params: idParams, body: returnOrderBody }),
  posController.returnOrderController
);

export default router;

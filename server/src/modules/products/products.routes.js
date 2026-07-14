import { Router } from 'express';
import * as productsController from './products.controller.js';
import { authenticate } from '../../middleware/auth.js';
import { isAdmin } from '../../middleware/rbac.js';
import { validate } from '../../middleware/validate.js';
import {
  idParams,
  productCreateBody,
  productQuery,
  productUpdateBody,
  qrLabelsBody,
} from '../../validation/schemas.js';

const genericRouter = Router();
genericRouter.use(authenticate);

// Public listings search and item detail views
genericRouter.get(
  '/',
  validate({ query: productQuery }),
  productsController.searchProductsController
);
genericRouter.get(
  '/:id',
  validate({ params: idParams }),
  productsController.getProductDetailsController
);

const adminRouter = Router();
adminRouter.use(authenticate, isAdmin);

// Admin-only write endpoints
adminRouter.post(
  '/',
  validate({ body: productCreateBody }),
  productsController.createProductController
);
adminRouter.patch(
  '/:id',
  validate({ params: idParams, body: productUpdateBody }),
  productsController.updateProductController
);
adminRouter.delete(
  '/:id',
  validate({ params: idParams }),
  productsController.deleteProductController
);
adminRouter.post(
  '/:id/barcode-labels',
  validate({ params: idParams, body: qrLabelsBody }),
  productsController.generateQrLabelsController
);
// Temporary compatibility alias for clients deployed before barcode naming was standardized.
adminRouter.post(
  '/:id/qr-labels',
  validate({ params: idParams, body: qrLabelsBody }),
  productsController.generateQrLabelsController
);

export { genericRouter as productRoutes, adminRouter as productAdminRoutes };

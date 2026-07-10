import { Router } from 'express';
import * as productsController from './products.controller.js';
import { authenticate } from '../../middleware/auth.js';
import { isAdmin } from '../../middleware/rbac.js';

const genericRouter = Router();
genericRouter.use(authenticate);

// Public listings search and item detail views
genericRouter.get('/', productsController.searchProductsController);
genericRouter.get('/:id', productsController.getProductDetailsController);

const adminRouter = Router();
adminRouter.use(authenticate, isAdmin);

// Admin-only write endpoints
adminRouter.post('/', productsController.createProductController);
adminRouter.patch('/:id', productsController.updateProductController);
adminRouter.post('/:id/qr-labels', productsController.generateQrLabelsController);

export { genericRouter as productRoutes, adminRouter as productAdminRoutes };

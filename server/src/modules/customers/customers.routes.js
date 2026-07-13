import { Router } from 'express';
import * as customersController from './customers.controller.js';
import { authenticate } from '../../middleware/auth.js';
import { isAdmin } from '../../middleware/rbac.js';
import { validate } from '../../middleware/validate.js';
import {
  customerBody,
  customerSearchQuery,
  customerUpdateBody,
  idParams,
} from '../../validation/schemas.js';

const router = Router();

// Apply auth check globally - both cashiers and admins can access customers lookup/register
router.use(authenticate);

router.get(
  '/',
  validate({ query: customerSearchQuery }),
  customersController.searchCustomersController
);
router.post('/', validate({ body: customerBody }), customersController.createCustomerController);

const adminRouter = Router();
adminRouter.use(authenticate, isAdmin);
adminRouter.patch(
  '/:id',
  validate({ params: idParams, body: customerUpdateBody }),
  customersController.updateCustomerController
);
adminRouter.delete(
  '/:id',
  validate({ params: idParams }),
  customersController.deleteCustomerController
);

export { adminRouter as customersAdminRoutes };
export default router;

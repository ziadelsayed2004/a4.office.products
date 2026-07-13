import { Router } from 'express';
import * as paymentsController from './payments.controller.js';
import { authenticate } from '../../middleware/auth.js';
import { isAdmin } from '../../middleware/rbac.js';
import { validate } from '../../middleware/validate.js';
import {
  idParams,
  paymentMethodCreateBody,
  paymentMethodsUpdateBody,
  paymentMethodUpdateBody,
} from '../../validation/schemas.js';

const router = Router();

// Apply auth check globally
router.use(authenticate);

// Cashiers & Admins can read payment methods
router.get('/', paymentsController.getPaymentMethodsController);

// Only Admins can modify active payment methods
router.post(
  '/admin',
  isAdmin,
  validate({ body: paymentMethodsUpdateBody }),
  paymentsController.updatePaymentMethodsController
);
router.post(
  '/admin/methods',
  isAdmin,
  validate({ body: paymentMethodCreateBody }),
  paymentsController.createPaymentMethodController
);
router.patch(
  '/admin/methods/:id',
  isAdmin,
  validate({ params: idParams, body: paymentMethodUpdateBody }),
  paymentsController.updatePaymentMethodController
);
router.delete(
  '/admin/methods/:id',
  isAdmin,
  validate({ params: idParams }),
  paymentsController.deletePaymentMethodController
);

export default router;

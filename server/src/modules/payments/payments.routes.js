import { Router } from 'express';
import * as paymentsController from './payments.controller.js';
import { authenticate } from '../../middleware/auth.js';
import { isAdmin } from '../../middleware/rbac.js';

const router = Router();

// Apply auth check globally
router.use(authenticate);

// Cashiers & Admins can read payment methods
router.get('/', paymentsController.getPaymentMethodsController);

// Only Admins can modify active payment methods
router.post('/admin', isAdmin, paymentsController.updatePaymentMethodsController);

export default router;

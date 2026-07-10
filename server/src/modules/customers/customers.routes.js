import { Router } from 'express';
import * as customersController from './customers.controller.js';
import { authenticate } from '../../middleware/auth.js';

const router = Router();

// Apply auth check globally - both cashiers and admins can access customers lookup/register
router.use(authenticate);

router.get('/', customersController.searchCustomersController);
router.post('/', customersController.createCustomerController);

export default router;

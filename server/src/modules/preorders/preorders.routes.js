import { Router } from 'express';
import * as preordersController from './preorders.controller.js';
import { authenticate } from '../../middleware/auth.js';
import { isAdmin } from '../../middleware/rbac.js';

const router = Router();

// Protect endpoints under cashier authentication
router.use(authenticate);

router.post('/', preordersController.createPreorderController);
router.post('/scan', preordersController.scanPreorderController);
router.post('/:id/pickup', preordersController.pickupPreorderController);

// Admin-only preorder tracking routes
const adminRouter = Router();
adminRouter.use(authenticate);
adminRouter.use(isAdmin);

adminRouter.get('/', preordersController.listPreordersController);
adminRouter.patch('/:id/status', preordersController.updatePreorderStatusController);

export { adminRouter as preorderAdminRoutes };
export default router;

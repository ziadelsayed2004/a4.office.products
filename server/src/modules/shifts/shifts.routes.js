import { Router } from 'express';
import * as shiftsController from './shifts.controller.js';
import { authenticate, requireRole } from '../../middleware/auth.js';

const router = Router();

// Protect all routes under shifts module with authentication
router.use(authenticate);

router.post('/open', shiftsController.openShiftController);
router.get('/current', shiftsController.getCurrentShiftController);
router.get('/current/summary', shiftsController.getCurrentShiftSummaryController);
router.post('/current/close-request', shiftsController.requestCloseShiftController);
router.post('/current/cash-movement', shiftsController.registerCashMovementController);

// Admin-only review endpoints
router.get('/pending-review', requireRole(['Admin']), shiftsController.getPendingReviewShiftsController);
router.get('/all', requireRole(['Admin']), shiftsController.listAllShiftsController);
router.get('/:id', requireRole(['Admin']), shiftsController.getShiftDetailsController);
router.post('/:id/approve', requireRole(['Admin']), shiftsController.approveShiftCloseController);
router.post('/:id/reject', requireRole(['Admin']), shiftsController.rejectShiftCloseController);

export default router;

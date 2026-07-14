import { Router } from 'express';
import * as shiftsController from './shifts.controller.js';
import { authenticate, requireRole } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import {
  approveShiftBody,
  cashMovementBody,
  idParams,
  openShiftBody,
  rejectShiftBody,
  shiftCloseBody,
  shiftsListQuery,
} from '../../validation/schemas.js';

const router = Router();

// Protect all routes under shifts module with authentication
router.use(authenticate);

router.post(
  '/open',
  requireRole(['Cashier']),
  validate({ body: openShiftBody }),
  shiftsController.openShiftController
);
router.get('/current', requireRole(['Cashier']), shiftsController.getCurrentShiftController);
router.get(
  '/current/summary',
  requireRole(['Cashier']),
  shiftsController.getCurrentShiftSummaryController
);
router.post(
  '/current/close-request',
  requireRole(['Cashier']),
  validate({ body: shiftCloseBody }),
  shiftsController.requestCloseShiftController
);
router.post(
  '/current/cash-movement',
  requireRole(['Cashier']),
  validate({ body: cashMovementBody }),
  shiftsController.registerCashMovementController
);

// Admin-only review endpoints
router.get(
  '/pending-review',
  requireRole(['Admin']),
  shiftsController.getPendingReviewShiftsController
);
router.get(
  '/all',
  requireRole(['Admin']),
  validate({ query: shiftsListQuery }),
  shiftsController.listAllShiftsController
);
router.get(
  '/:id',
  requireRole(['Admin']),
  validate({ params: idParams }),
  shiftsController.getShiftDetailsController
);
router.post(
  '/:id/approve',
  requireRole(['Admin']),
  validate({ params: idParams, body: approveShiftBody }),
  shiftsController.approveShiftCloseController
);
router.post(
  '/:id/reject',
  requireRole(['Admin']),
  validate({ params: idParams, body: rejectShiftBody }),
  shiftsController.rejectShiftCloseController
);
router.post(
  '/:id/admin-close',
  requireRole(['Admin']),
  shiftsController.emergencyCloseShiftController
);

export default router;

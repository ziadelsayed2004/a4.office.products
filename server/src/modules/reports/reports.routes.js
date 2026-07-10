import { Router } from 'express';
import * as reportsController from './reports.controller.js';
import { authenticate } from '../../middleware/auth.js';
import { isAdmin } from '../../middleware/rbac.js';

const router = Router();

// Protect all report routes with authentication & Admin-only RBAC
router.get('/kpis', authenticate, isAdmin, reportsController.getAdminKPIsController);
router.get('/reports/sales', authenticate, isAdmin, reportsController.getSalesReportController);
router.get('/reports/preorders', authenticate, isAdmin, reportsController.getPreordersReportController);
router.get('/reports/inventory', authenticate, isAdmin, reportsController.getInventoryReportController);
router.get('/reports/shifts', authenticate, isAdmin, reportsController.getShiftsReportController);
router.get('/reports/export', authenticate, isAdmin, reportsController.exportReportController);

export default router;

import { Router } from 'express';
import * as reportsController from './reports.controller.js';
import { authenticate } from '../../middleware/auth.js';
import { isAdmin } from '../../middleware/rbac.js';
import { validate } from '../../middleware/validate.js';
import { reportExportQuery, reportQuery } from '../../validation/schemas.js';

const router = Router();

// Protect all report routes with authentication & Admin-only RBAC
router.get('/kpis', authenticate, isAdmin, reportsController.getAdminKPIsController);
router.get(
  '/reports/sales',
  authenticate,
  isAdmin,
  validate({ query: reportQuery }),
  reportsController.getSalesReportController
);
router.get(
  '/reports/preorders',
  authenticate,
  isAdmin,
  validate({ query: reportQuery }),
  reportsController.getPreordersReportController
);
router.get(
  '/reports/inventory',
  authenticate,
  isAdmin,
  validate({ query: reportQuery }),
  reportsController.getInventoryReportController
);
router.get(
  '/reports/shifts',
  authenticate,
  isAdmin,
  validate({ query: reportQuery }),
  reportsController.getShiftsReportController
);
router.get(
  '/reports/invoices',
  authenticate,
  isAdmin,
  validate({ query: reportQuery }),
  reportsController.getInvoicesReportController
);
router.get(
  '/reports/payments',
  authenticate,
  isAdmin,
  validate({ query: reportQuery }),
  reportsController.getPaymentsReportController
);
router.get(
  '/reports/cashiers',
  authenticate,
  isAdmin,
  validate({ query: reportQuery }),
  reportsController.getCashiersReportController
);
router.get(
  '/reports/export',
  authenticate,
  isAdmin,
  validate({ query: reportExportQuery }),
  reportsController.exportReportController
);

export default router;

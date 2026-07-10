import { Router } from 'express';
import { getAuditLogsController } from './auditLog.controller.js';
import { authenticate } from '../../middleware/auth.js';
import { isAdmin } from '../../middleware/rbac.js';

const router = Router();

// Retrieve all audit logs (Admin only)
router.get('/', authenticate, isAdmin, getAuditLogsController);

export default router;

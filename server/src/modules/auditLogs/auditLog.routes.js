import { Router } from 'express';
import { getAuditLogsController } from './auditLog.controller.js';
import { authenticate } from '../../middleware/auth.js';
import { isAdmin } from '../../middleware/rbac.js';
import { validate } from '../../middleware/validate.js';
import { auditQuery } from '../../validation/schemas.js';

const router = Router();

// Retrieve all audit logs (Admin only)
router.get('/', authenticate, isAdmin, validate({ query: auditQuery }), getAuditLogsController);

export default router;

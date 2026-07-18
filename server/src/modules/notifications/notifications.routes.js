import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { isAdmin } from '../../middleware/rbac.js';
import { validate } from '../../middleware/validate.js';
import { idParams, notificationsQuery } from '../../validation/schemas.js';
import * as controller from './notifications.controller.js';

const router = Router();
router.use(authenticate, isAdmin);
router.get('/', validate({ query: notificationsQuery }), controller.listNotifications);
router.patch('/:id/read', validate({ params: idParams }), controller.markNotificationRead);
router.post('/read-all', controller.markAllNotificationsRead);

export default router;

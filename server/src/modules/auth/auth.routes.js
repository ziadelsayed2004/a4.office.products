import { Router } from 'express';
import * as authController from './auth.controller.js';
import { authenticate } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { loginBody, logoutBody, refreshBody } from '../../validation/schemas.js';

const router = Router();

// Public routes
router.post('/login', validate({ body: loginBody }), authController.loginController);
router.post('/refresh', validate({ body: refreshBody }), authController.refreshController);
router.post('/logout', validate({ body: logoutBody }), authController.logoutController);

// Protected routes
router.get('/me', authenticate, authController.meController);
router.post('/heartbeat', authenticate, authController.heartbeatController);

export default router;

import { Router } from 'express';
import * as authController from './auth.controller.js';
import { authenticate } from '../../middleware/auth.js';

const router = Router();

// Public routes
router.post('/login', authController.loginController);
router.post('/refresh', authController.refreshController);
router.post('/logout', authController.logoutController);

// Protected routes
router.get('/me', authenticate, authController.meController);

export default router;

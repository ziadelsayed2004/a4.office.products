import { Router } from 'express';
import * as usersController from './users.controller.js';
import { authenticate } from '../../middleware/auth.js';
import { isAdmin } from '../../middleware/rbac.js';

const router = Router();

// Apply Admin restriction globally to all user management routes
router.use(authenticate, isAdmin);

router.get('/', usersController.getUsersListController);
router.post('/', usersController.createUserController);
router.patch('/:id', usersController.updateUserController);
router.patch('/:id/password', usersController.updatePasswordController);
router.patch('/:id/disable', usersController.disableUserController);
router.patch('/:id/enable', usersController.enableUserController);

export default router;

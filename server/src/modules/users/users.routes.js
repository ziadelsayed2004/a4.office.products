import { Router } from 'express';
import * as usersController from './users.controller.js';
import { authenticate } from '../../middleware/auth.js';
import { isAdmin } from '../../middleware/rbac.js';
import { validate } from '../../middleware/validate.js';
import {
  idParams,
  passwordBody,
  userCreateBody,
  userUpdateBody,
} from '../../validation/schemas.js';

const router = Router();

// Apply Admin restriction globally to all user management routes
router.use(authenticate, isAdmin);

router.get('/', usersController.getUsersListController);
router.get(
  '/:id/sessions',
  validate({ params: idParams }),
  usersController.getUserSessionsController
);
router.delete('/:id/sessions/:sessionId', usersController.revokeUserSessionsController);
router.delete(
  '/:id/sessions',
  validate({ params: idParams }),
  usersController.revokeUserSessionsController
);
router.post(
  '/:id/revoke-sessions',
  validate({ params: idParams }),
  usersController.revokeUserSessionsController
);
router.post('/', validate({ body: userCreateBody }), usersController.createUserController);
router.patch(
  '/:id',
  validate({ params: idParams, body: userUpdateBody }),
  usersController.updateUserController
);
router.patch(
  '/:id/password',
  validate({ params: idParams, body: passwordBody }),
  usersController.updatePasswordController
);
router.patch('/:id/disable', validate({ params: idParams }), usersController.disableUserController);
router.patch('/:id/enable', validate({ params: idParams }), usersController.enableUserController);

export default router;

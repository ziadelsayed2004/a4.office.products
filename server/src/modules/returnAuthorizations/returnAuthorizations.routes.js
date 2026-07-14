import { Router } from 'express';
import { authenticate, requireRole } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { idParams, returnAuthorizationListQuery } from '../../validation/schemas.js';
import * as controller from './returnAuthorizations.controller.js';

function removed(_req, res) {
  res.status(410).json({
    status: 'error',
    error: 'Legacy return authorization endpoints have been removed.',
    code: 'LEGACY_RETURN_AUTHORIZATION_REMOVED',
  });
}

const adminRouter = Router();
adminRouter.use(authenticate, requireRole(['Admin']));
adminRouter.get('/', validate({ query: returnAuthorizationListQuery }), controller.listController);
adminRouter.get('/:id', validate({ params: idParams }), controller.historicalDetailController);
adminRouter.use(removed);

const posRouter = Router();
posRouter.use(authenticate, requireRole(['Cashier']));
posRouter.use(removed);

export { adminRouter as adminReturnAuthorizationRoutes, posRouter as posReturnAuthorizationRoutes };

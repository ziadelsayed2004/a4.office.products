import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { isAdmin } from '../../middleware/rbac.js';
import { validate } from '../../middleware/validate.js';
import {
  idParams,
  returnAuthorizationCreateBody,
  returnAuthorizationExecuteBody,
  returnAuthorizationListQuery,
  returnAuthorizationPrintBody,
  returnAuthorizationQuoteBody,
  returnAuthorizationReissueBody,
  returnAuthorizationRevokeBody,
} from '../../validation/schemas.js';
import * as controller from './returnAuthorizations.controller.js';

const adminRouter = Router();
adminRouter.use(authenticate, isAdmin);
adminRouter.post(
  '/quote',
  validate({ body: returnAuthorizationQuoteBody }),
  controller.quoteController
);
adminRouter.post(
  '/',
  validate({ body: returnAuthorizationCreateBody }),
  controller.createController
);
adminRouter.get('/', validate({ query: returnAuthorizationListQuery }), controller.listController);
adminRouter.get('/:id', validate({ params: idParams }), controller.detailController);
adminRouter.post(
  '/:id/revoke',
  validate({ params: idParams, body: returnAuthorizationRevokeBody }),
  controller.revokeController
);
adminRouter.post(
  '/:id/reissue',
  validate({ params: idParams, body: returnAuthorizationReissueBody }),
  controller.reissueController
);
adminRouter.post(
  '/:id/print-request',
  validate({ params: idParams, body: returnAuthorizationPrintBody }),
  controller.printRequestController
);

const posRouter = Router();
posRouter.use(authenticate);
posRouter.post(
  '/execute',
  validate({ body: returnAuthorizationExecuteBody }),
  controller.executeController
);

export { adminRouter as adminReturnAuthorizationRoutes, posRouter as posReturnAuthorizationRoutes };

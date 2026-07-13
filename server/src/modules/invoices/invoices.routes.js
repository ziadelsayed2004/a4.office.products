import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { isAdmin } from '../../middleware/rbac.js';
import * as invoicesController from './invoices.controller.js';
import { validate } from '../../middleware/validate.js';
import {
  idParams,
  invoiceCredentialQuery,
  invoiceListQuery,
  invoiceLookupQuery,
} from '../../validation/schemas.js';

const adminRouter = Router();
adminRouter.use(authenticate, isAdmin);
adminRouter.get(
  '/',
  validate({ query: invoiceListQuery }),
  invoicesController.listAdminInvoicesController
);
adminRouter.get(
  '/:id',
  validate({ params: idParams }),
  invoicesController.getAdminInvoiceController
);

const posRouter = Router();
posRouter.use(authenticate);
posRouter.get(
  '/lookup',
  validate({ query: invoiceLookupQuery }),
  invoicesController.lookupCashierInvoicesController
);
posRouter.get(
  '/:id',
  validate({ params: idParams, query: invoiceCredentialQuery }),
  invoicesController.getCashierInvoiceController
);

export { adminRouter as adminInvoiceRoutes, posRouter as posInvoiceRoutes };

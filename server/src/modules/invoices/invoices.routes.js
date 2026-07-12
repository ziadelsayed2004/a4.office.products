import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { isAdmin } from '../../middleware/rbac.js';
import * as invoicesController from './invoices.controller.js';

const adminRouter = Router();
adminRouter.use(authenticate, isAdmin);
adminRouter.get('/', invoicesController.listAdminInvoicesController);
adminRouter.get('/:id', invoicesController.getAdminInvoiceController);

const posRouter = Router();
posRouter.use(authenticate);
posRouter.get('/lookup', invoicesController.lookupCashierInvoicesController);
posRouter.get('/:id', invoicesController.getCashierInvoiceController);

export { adminRouter as adminInvoiceRoutes, posRouter as posInvoiceRoutes };

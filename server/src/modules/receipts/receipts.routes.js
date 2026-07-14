import { Router } from 'express';
import * as receiptsController from './receipts.controller.js';
import { authenticate } from '../../middleware/auth.js';
import { requireRole } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { receiptIdentifierParams, receiptPrintBody } from '../../validation/schemas.js';

const router = Router();

// Protect all receipt endpoints under token verification
router.use(authenticate, requireRole(['Cashier']));

router.get(
  '/:id',
  validate({ params: receiptIdentifierParams }),
  receiptsController.getReceiptDetailsController
);
router.post(
  '/:id/print-request',
  validate({ params: receiptIdentifierParams, body: receiptPrintBody }),
  receiptsController.requestReceiptPrintController
);
router.post(
  '/:id/reprint',
  validate({ params: receiptIdentifierParams, body: receiptPrintBody }),
  receiptsController.reprintReceiptController
);

export default router;

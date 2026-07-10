import { Router } from 'express';
import * as receiptsController from './receipts.controller.js';
import { authenticate } from '../../middleware/auth.js';

const router = Router();

// Protect all receipt endpoints under token verification
router.use(authenticate);

router.get('/:id', receiptsController.getReceiptDetailsController);
router.post('/:id/reprint', receiptsController.reprintReceiptController);

export default router;

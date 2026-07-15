import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { isCashierOrAdmin } from '../../middleware/rbac.js';
import { validate } from '../../middleware/validate.js';
import { numberPreviewQuery } from '../../validation/schemas.js';
import { getNumberPreview } from './numberPreviews.service.js';

const router = Router();
router.use(authenticate, isCashierOrAdmin);
router.get('/', validate({ query: numberPreviewQuery }), async (req, res, next) => {
  try {
    const data = await getNumberPreview({ ...req.query, role: req.user.role });
    return res.status(200).json({ status: 'success', data });
  } catch (error) {
    return next(error);
  }
});

export default router;

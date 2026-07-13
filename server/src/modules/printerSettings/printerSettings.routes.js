import { Router } from 'express';
import * as printerSettingsService from './printerSettings.service.js';
import { authenticate } from '../../middleware/auth.js';
import { isAdmin } from '../../middleware/rbac.js';
import { validate } from '../../middleware/validate.js';
import { printerSettingsBody } from '../../validation/schemas.js';

async function getSettings(req, res, next) {
  try {
    const data = await printerSettingsService.getSafePrinterSettings();
    return res.status(200).json({ status: 'success', data });
  } catch (error) {
    return next(error);
  }
}

const safeRouter = Router();
safeRouter.use(authenticate);
safeRouter.get('/', getSettings);

const adminRouter = Router();
adminRouter.use(authenticate, isAdmin);
adminRouter.get('/', getSettings);
adminRouter.post('/', validate({ body: printerSettingsBody }), async (req, res, next) => {
  try {
    const data = await printerSettingsService.updatePrinterSettings(req.body, req.user.id);
    return res
      .status(200)
      .json({ status: 'success', message: 'Printer settings updated successfully.', data });
  } catch (error) {
    return next(error);
  }
});

export { safeRouter as safePrinterSettingsRoutes };
export default adminRouter;

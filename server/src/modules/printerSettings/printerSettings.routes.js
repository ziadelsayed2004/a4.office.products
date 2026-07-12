import { Router } from 'express';
import * as printerSettingsService from './printerSettings.service.js';
import { authenticate } from '../../middleware/auth.js';
import { isAdmin } from '../../middleware/rbac.js';

const safeRouter = Router();
safeRouter.use(authenticate);
safeRouter.get('/', async (req, res) => {
  try {
    const settings = await printerSettingsService.getSafePrinterSettings();
    return res.status(200).json({ status: 'success', data: settings });
  } catch (error) {
    return res.status(500).json({
      error: 'Failed to load print settings.',
      code: 'PRINT_SETTINGS_LOAD_FAILED'
    });
  }
});

const adminRouter = Router();
adminRouter.use(authenticate, isAdmin);
adminRouter.get('/', async (req, res) => {
  try {
    const settings = await printerSettingsService.getPrinterSettings();
    return res.status(200).json({ status: 'success', data: settings });
  } catch (error) {
    return res.status(500).json({
      error: 'Failed to load printer settings.',
      code: 'PRINT_SETTINGS_LOAD_FAILED'
    });
  }
});

adminRouter.post('/', async (req, res) => {
  try {
    const updated = await printerSettingsService.updatePrinterSettings(req.body, req.user.id);
    return res.status(200).json({
      status: 'success',
      message: 'Printer settings updated successfully.',
      data: updated
    });
  } catch (error) {
    return res.status(error.status || 400).json({
      error: error.message,
      code: error.code || 'UPDATE_SETTINGS_FAILED'
    });
  }
});

export { safeRouter as safePrinterSettingsRoutes };
export default adminRouter;

import { Router } from 'express';
import * as printerSettingsService from './printerSettings.service.js';
import { authenticate } from '../../middleware/auth.js';
import { isAdmin } from '../../middleware/rbac.js';

const router = Router();

// Apply auth check globally
router.use(authenticate);
// All printer settings routes are admin-only
router.use(isAdmin);

/**
 * Get all printer settings (Admin only).
 */
router.get('/', async (req, res) => {
  try {
    const settings = await printerSettingsService.getPrinterSettings();
    return res.status(200).json({
      status: 'success',
      data: settings
    });
  } catch (error) {
    return res.status(500).json({
      error: 'حدث خطأ أثناء تحميل إعدادات الطباعة.',
      code: 'SERVER_ERROR'
    });
  }
});

/**
 * Save printer settings (Admin only).
 */
router.post('/', async (req, res) => {
  try {
    const settingsMap = req.body;
    const updated = await printerSettingsService.updatePrinterSettings(settingsMap, req.user.id);
    return res.status(200).json({
      status: 'success',
      message: 'تم تحديث إعدادات وقوالب الطباعة بنجاح.',
      data: updated
    });
  } catch (error) {
    return res.status(400).json({
      error: error.message,
      code: 'UPDATE_SETTINGS_FAILED'
    });
  }
});

export default router;

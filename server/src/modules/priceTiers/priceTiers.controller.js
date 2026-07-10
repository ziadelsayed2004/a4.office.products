import * as priceTiersService from './priceTiers.service.js';

export async function getPriceTiersController(req, res, next) {
  try {
    const isCashier = req.user.role === 'Cashier';
    const activeOnly = isCashier || req.query.activeOnly === 'true';

    const tiers = await priceTiersService.getAllPriceTiers(activeOnly);

    return res.status(200).json({
      status: 'success',
      data: tiers
    });
  } catch (error) {
    return res.status(500).json({
      error: 'حدث خطأ أثناء تحميل فئات الأسعار.',
      code: 'SERVER_ERROR'
    });
  }
}

export async function createPriceTierController(req, res, next) {
  try {
    const { name, description } = req.body;
    if (!name) {
      return res.status(400).json({
        error: 'اسم فئة السعر مطلوب.',
        code: 'VALIDATION_ERROR'
      });
    }

    const newTier = await priceTiersService.createPriceTier(
      { name, description },
      req.user.id
    );

    return res.status(201).json({
      status: 'success',
      message: 'تم إنشاء فئة السعر بنجاح.',
      data: newTier
    });
  } catch (error) {
    return res.status(400).json({
      error: error.message,
      code: 'CREATE_PRICE_TIER_FAILED'
    });
  }
}

export async function updatePriceTierController(req, res, next) {
  try {
    const { id } = req.params;
    const { name, description, is_active } = req.body;

    const updated = await priceTiersService.updatePriceTier(
      parseInt(id, 10),
      { name, description, is_active },
      req.user.id
    );

    return res.status(200).json({
      status: 'success',
      message: 'تم تحديث فئة السعر بنجاح.',
      data: updated
    });
  } catch (error) {
    return res.status(400).json({
      error: error.message,
      code: 'UPDATE_PRICE_TIER_FAILED'
    });
  }
}

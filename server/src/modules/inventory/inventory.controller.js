import * as inventoryService from './inventory.service.js';

export async function getInventoryLedgerController(req, res, next) {
  try {
    const { productId, transactionType, startDate, endDate, limit = 50, offset = 0 } = req.query;

    const result = await inventoryService.getInventoryLedger({
      productId: productId ? parseInt(productId, 10) : undefined,
      transactionType,
      startDate,
      endDate,
      limit,
      offset
    });

    return res.status(200).json({
      status: 'success',
      data: result
    });
  } catch (error) {
    return res.status(500).json({
      error: 'حدث خطأ أثناء تحميل سجل الحركات المخزنية.',
      code: 'SERVER_ERROR'
    });
  }
}

export async function adjustStockController(req, res, next) {
  try {
    const { product_id, adjustment_type, quantity, notes } = req.body;

    const result = await inventoryService.adjustStock({
      productId: product_id ? parseInt(product_id, 10) : undefined,
      adjustmentType: adjustment_type,
      quantity: quantity ? parseInt(quantity, 10) : undefined,
      notes
    }, req.user.id);

    return res.status(200).json({
      status: 'success',
      message: 'تمت تسوية المخزون بنجاح.',
      data: result
    });
  } catch (error) {
    return res.status(400).json({
      error: error.message,
      code: 'STOCK_ADJUST_FAILED'
    });
  }
}

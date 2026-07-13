import * as inventoryService from './inventory.service.js';

export async function getInventoryLedgerController(req, res, next) {
  try {
    const result = await inventoryService.getInventoryLedger(req.query);
    return res.status(200).json({ status: 'success', data: result });
  } catch (error) {
    return next(error);
  }
}

export async function adjustStockController(req, res, next) {
  try {
    const result = await inventoryService.adjustStock(
      {
        productId: req.body.product_id,
        adjustmentType: req.body.adjustment_type,
        quantity: req.body.quantity,
        notes: req.body.notes,
      },
      req.user.id,
      null,
      req.get('Idempotency-Key')
    );
    res.setHeader('Idempotency-Replayed', String(result.replayed));
    return res.status(result.statusCode).json({
      status: 'success',
      message: 'Stock adjusted successfully.',
      data: result.data,
    });
  } catch (error) {
    return next(error);
  }
}

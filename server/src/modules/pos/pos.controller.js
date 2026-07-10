import * as posService from './pos.service.js';

export async function scanProductController(req, res, next) {
  try {
    const { code } = req.body;
    const product = await posService.scanProduct(code);
    return res.status(200).json({
      status: 'success',
      data: product
    });
  } catch (error) {
    return res.status(400).json({
      error: error.message,
      code: 'POS_SCAN_FAILED'
    });
  }
}

export async function searchPosProductsController(req, res, next) {
  try {
    const { q } = req.query;
    const list = await posService.searchPosProducts(q);
    return res.status(200).json({
      status: 'success',
      data: list
    });
  } catch (error) {
    return res.status(500).json({
      error: 'حدث خطأ أثناء البحث عن المنتجات في الكاشير.',
      code: 'SERVER_ERROR'
    });
  }
}

export async function checkoutController(req, res, next) {
  try {
    const cashierId = req.user.id;
    const { customerId, items, discount, payments } = req.body;

    const result = await posService.checkoutOrder({
      cashierId,
      customerId,
      items,
      discount,
      payments
    });

    return res.status(201).json({
      status: 'success',
      data: result
    });
  } catch (error) {
    return res.status(400).json({
      error: error.message,
      code: 'POS_CHECKOUT_FAILED'
    });
  }
}

export async function returnOrderController(req, res, next) {
  try {
    const cashierId = req.user.id;
    const { id } = req.params;
    const { items, notes, refundMethod } = req.body;

    const result = await posService.returnOrderItems(
      cashierId,
      parseInt(id),
      items,
      notes,
      refundMethod
    );

    return res.status(200).json({
      status: 'success',
      data: result
    });
  } catch (error) {
    return res.status(400).json({
      error: error.message,
      code: 'POS_RETURN_FAILED'
    });
  }
}

import * as posService from './pos.service.js';
import { resolveScan } from './scanResolver.service.js';

function sendError(res, error, fallbackCode, fallbackStatus = 400) {
  return res.status(error.status || fallbackStatus).json({
    error: error.message,
    code: error.code || fallbackCode
  });
}

export async function resolveScanController(req, res) {
  try {
    const result = await resolveScan(req.body?.code || req.body?.token, req.user);
    return res.status(200).json({ status: 'success', data: result });
  } catch (error) {
    return sendError(res, error, 'SCAN_RESOLVE_FAILED');
  }
}

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
      payments,
      idempotencyKey: req.get('Idempotency-Key')
    });

    res.setHeader('Idempotency-Replayed', String(Boolean(result.replayed)));
    return res.status(result.statusCode).json({
      status: 'success',
      data: result.data
    });
  } catch (error) {
    return sendError(res, error, 'POS_CHECKOUT_FAILED');
  }
}

export async function returnOrderController(req, res, next) {
  try {
    const cashierId = req.user.id;
    const { id } = req.params;
    const { items, notes, payments } = req.body;

    const result = await posService.returnOrderItems({
      cashierId,
      orderId: parseInt(id, 10),
      items,
      notes,
      payments,
      idempotencyKey: req.get('Idempotency-Key')
    });

    res.setHeader('Idempotency-Replayed', String(Boolean(result.replayed)));
    return res.status(result.statusCode).json({
      status: 'success',
      data: result.data
    });
  } catch (error) {
    return sendError(res, error, 'POS_RETURN_FAILED');
  }
}

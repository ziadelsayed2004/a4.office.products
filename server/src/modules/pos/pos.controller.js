import * as posService from './pos.service.js';
import { resolveScan } from './scanResolver.service.js';

export async function resolveScanController(req, res, next) {
  try {
    const data = await resolveScan(req.body?.code || req.body?.token, req.user);
    return res.status(200).json({ status: 'success', data });
  } catch (error) {
    return next(error);
  }
}

export async function scanProductController(req, res, next) {
  try {
    const data = await posService.scanProduct(req.body.code);
    return res.status(200).json({ status: 'success', data });
  } catch (error) {
    return next(error);
  }
}

export async function searchPosProductsController(req, res, next) {
  try {
    const data = await posService.searchPosProducts(req.query.q);
    return res.status(200).json({ status: 'success', data });
  } catch (error) {
    return next(error);
  }
}

export async function checkoutController(req, res, next) {
  try {
    const result = await posService.checkoutOrder({
      cashierId: req.user.id,
      customerId: req.body.customerId,
      items: req.body.items,
      discount: req.body.discount,
      payments: req.body.payments,
      idempotencyKey: req.get('Idempotency-Key'),
    });
    res.setHeader('Idempotency-Replayed', String(Boolean(result.replayed)));
    return res.status(result.statusCode).json({ status: 'success', data: result.data });
  } catch (error) {
    return next(error);
  }
}

export async function returnOrderController(req, res, next) {
  try {
    const result = await posService.returnOrderItems({
      cashierId: req.user.id,
      orderId: req.params.id,
      authorizationToken: req.body.authorizationToken,
      refundReferences: req.body.refundReferences,
      cashierNote: req.body.cashierNote,
      idempotencyKey: req.get('Idempotency-Key'),
    });
    res.setHeader('Idempotency-Replayed', String(Boolean(result.replayed)));
    return res.status(result.statusCode).json({ status: 'success', data: result.data });
  } catch (error) {
    return next(error);
  }
}

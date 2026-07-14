import * as preordersService from './preorders.service.js';
import { publishLiveEvent } from '../liveAdmin/liveEvents.js';

export async function createPreorderController(req, res, next) {
  try {
    const result = await preordersService.createPreorder(
      req.body,
      req.user.id,
      req.get('Idempotency-Key')
    );
    if (!result.replayed) {
      publishLiveEvent('preorder.created', {
        preorderId: result.data.id,
        cashierId: req.user.id,
      });
    }
    res.set('Idempotency-Replayed', String(result.replayed));
    return res.status(result.statusCode).json({ status: 'success', data: result.data });
  } catch (error) {
    return next(error);
  }
}

export async function listPreordersController(req, res, next) {
  try {
    const data = await preordersService.listPreordersForAdmin(req.query);
    return res.status(200).json({ status: 'success', data });
  } catch (error) {
    return next(error);
  }
}

export async function updatePreorderStatusController(req, res, next) {
  try {
    const data = await preordersService.updatePreorderStatus(
      req.params.id,
      req.body.status,
      req.user.id
    );
    publishLiveEvent('preorder.updated', {
      preorderId: Number(req.params.id),
      status: req.body.status,
      adminId: req.user.id,
    });
    return res.status(200).json({ status: 'success', data });
  } catch (error) {
    return next(error);
  }
}

export async function getPreordersReportController(req, res, next) {
  try {
    const data = await preordersService.getPreordersReport();
    return res.status(200).json({ status: 'success', data });
  } catch (error) {
    return next(error);
  }
}

export async function scanPreorderController(req, res, next) {
  try {
    const data = await preordersService.scanPreorderToken(req.body.token, req.user.id);
    return res.status(200).json({ status: 'success', data });
  } catch (error) {
    return next(error);
  }
}

export async function pickupPreorderController(req, res, next) {
  try {
    const result = await preordersService.pickupPreorder(
      req.params.id,
      req.body,
      req.user.id,
      req.get('Idempotency-Key')
    );
    if (!result.replayed) {
      publishLiveEvent('sale.created', {
        orderId: result.data.order_id,
        preorderId: result.data.preorder_id,
        cashierId: req.user.id,
      });
    }
    res.set('Idempotency-Replayed', String(result.replayed));
    return res.status(result.statusCode).json({ status: 'success', data: result.data });
  } catch (error) {
    return next(error);
  }
}

export async function searchPreordersController(req, res, next) {
  try {
    const data = await preordersService.searchPreordersForCashier(req.query.q, req.user.id);
    return res.status(200).json({ status: 'success', data });
  } catch (error) {
    return next(error);
  }
}

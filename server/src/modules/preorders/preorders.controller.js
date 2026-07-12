import * as preordersService from './preorders.service.js';

export async function createPreorderController(req, res, next) {
  try {
    const preorderData = req.body;
    const cashierId = req.user.id;

    const result = await preordersService.createPreorder(preorderData, cashierId, req.get('Idempotency-Key'));
    res.set('Idempotency-Replayed', String(result.replayed));
    return res.status(result.statusCode).json({
      status: 'success',
      data: result.data
    });
  } catch (error) {
    return res.status(error.status || 400).json({
      error: error.message,
      code: error.code || 'PREORDER_CREATE_FAILED'
    });
  }
}

export async function listPreordersController(req, res, next) {
  try {
    const { status, q } = req.query;
    const result = await preordersService.listPreordersForAdmin({ status, q });
    return res.status(200).json({
      status: 'success',
      data: result
    });
  } catch (error) {
    return res.status(error.status || 400).json({
      error: error.message,
      code: error.code || 'PREORDER_LIST_FAILED'
    });
  }
}

export async function updatePreorderStatusController(req, res, next) {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const adminUserId = req.user.id;

    const result = await preordersService.updatePreorderStatus(parseInt(id, 10), status, adminUserId);
    return res.status(200).json({
      status: 'success',
      data: result
    });
  } catch (error) {
    return res.status(error.status || 400).json({
      error: error.message,
      code: error.code || 'PREORDER_STATUS_UPDATE_FAILED'
    });
  }
}

export async function getPreordersReportController(req, res, next) {
  try {
    const result = await preordersService.getPreordersReport();
    return res.status(200).json({
      status: 'success',
      data: result
    });
  } catch (error) {
    return res.status(error.status || 400).json({
      error: error.message,
      code: error.code || 'PREORDER_REPORT_FAILED'
    });
  }
}

export async function scanPreorderController(req, res, next) {
  try {
    const { token } = req.body;
    const cashierId = req.user.id;

    if (!token || !token.trim()) {
      return res.status(400).json({
        error: 'رمز الاستلام مطلوب.',
        code: 'SCAN_PREORDER_FAILED'
      });
    }

    const result = await preordersService.scanPreorderToken(token.trim(), cashierId);
    return res.status(200).json({
      status: 'success',
      data: result
    });
  } catch (error) {
    return res.status(error.status || 400).json({
      error: error.message,
      code: error.code || 'SCAN_PREORDER_FAILED'
    });
  }
}

export async function pickupPreorderController(req, res, next) {
  try {
    const { id } = req.params;
    const pickupData = req.body;
    const cashierId = req.user.id;

    const result = await preordersService.pickupPreorder(parseInt(id, 10), pickupData, cashierId, req.get('Idempotency-Key'));
    res.set('Idempotency-Replayed', String(result.replayed));
    return res.status(result.statusCode).json({
      status: 'success',
      data: result.data
    });
  } catch (error) {
    return res.status(error.status || 400).json({
      error: error.message,
      code: error.code || 'PICKUP_PREORDER_FAILED'
    });
  }
}

export async function searchPreordersController(req, res) {
  try {
    const rows = await preordersService.searchPreordersForCashier(req.query.q, req.user.id);
    return res.status(200).json({ status: 'success', data: rows });
  } catch (error) {
    return res.status(error.status || 400).json({ error: error.message, code: error.code || 'PREORDER_SEARCH_FAILED' });
  }
}

import * as service from './returnAuthorizations.service.js';

export async function quoteController(req, res, next) {
  try {
    const data = await service.quoteReturnAuthorization(req.body);
    return res.status(200).json({ status: 'success', data });
  } catch (error) {
    return next(error);
  }
}

export async function createController(req, res, next) {
  try {
    const result = await service.createReturnAuthorization({
      adminId: req.user.id,
      input: req.body,
      idempotencyKey: req.get('Idempotency-Key'),
    });
    res.setHeader('Idempotency-Replayed', String(Boolean(result.replayed)));
    return res.status(result.statusCode).json({ status: 'success', data: result.data });
  } catch (error) {
    return next(error);
  }
}

export async function listController(req, res, next) {
  try {
    const data = await service.listReturnAuthorizations(req.query);
    return res.status(200).json({ status: 'success', data });
  } catch (error) {
    return next(error);
  }
}

export async function detailController(req, res, next) {
  try {
    const data = await service.getReturnAuthorization(req.params.id);
    return res.status(200).json({ status: 'success', data });
  } catch (error) {
    return next(error);
  }
}

export async function revokeController(req, res, next) {
  try {
    const data = await service.revokeReturnAuthorization(req.params.id, {
      adminId: req.user.id,
      reason: req.body.reason,
    });
    return res.status(200).json({ status: 'success', data });
  } catch (error) {
    return next(error);
  }
}

export async function reissueController(req, res, next) {
  try {
    const data = await service.reissueReturnAuthorization(req.params.id, {
      adminId: req.user.id,
      expiresAt: req.body.expiresAt,
    });
    return res.status(200).json({ status: 'success', data });
  } catch (error) {
    return next(error);
  }
}

export async function printRequestController(req, res, next) {
  try {
    const result = await service.requestReturnAuthorizationPrint(req.params.id, req.body, req.user);
    res.setHeader('Idempotency-Replayed', String(Boolean(result.replayed)));
    return res.status(200).json({
      status: 'success',
      data: {
        requestId: result.requestId,
        copies: result.copies,
        card: result.card,
      },
    });
  } catch (error) {
    return next(error);
  }
}

export async function executeController(req, res, next) {
  try {
    const result = await service.executeReturnAuthorization({
      cashierId: req.user.id,
      token: req.body.token,
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

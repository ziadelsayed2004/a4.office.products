import * as receiptsService from './receipts.service.js';

export async function getReceiptDetailsController(req, res, next) {
  try {
    const data = await receiptsService.getReceiptDetails(req.params.id, req.user);
    return res.status(200).json({ status: 'success', data });
  } catch (error) {
    return next(error);
  }
}

function printInput(req, isReprintOverride = null) {
  return {
    requestKey: req.body?.requestKey || req.body?.request_key || req.get('Idempotency-Key'),
    copies: req.body?.copies,
    reason: req.body?.reason,
    isReprint: isReprintOverride ?? req.body?.isReprint ?? false,
  };
}

async function sendPrintRequest(req, res, next, isReprint) {
  try {
    const result = await receiptsService.requestReceiptPrint(
      req.params.id,
      printInput(req, isReprint),
      req.user
    );
    res.setHeader('Idempotency-Replayed', String(result.replayed));
    return res.status(200).json({
      status: 'success',
      data: {
        request_id: result.request_id,
        print_count: result.print_count,
        copies: result.copies,
      },
    });
  } catch (error) {
    return next(error);
  }
}

export function requestReceiptPrintController(req, res, next) {
  return sendPrintRequest(req, res, next, null);
}

export function reprintReceiptController(req, res, next) {
  return sendPrintRequest(req, res, next, true);
}

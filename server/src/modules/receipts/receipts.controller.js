import * as receiptsService from './receipts.service.js';

function sendError(res, error, fallbackCode) {
  return res.status(error.status || 500).json({
    error: error.message,
    code: error.code || fallbackCode
  });
}

export async function getReceiptDetailsController(req, res) {
  try {
    const details = await receiptsService.getReceiptDetails(req.params.id, req.user);
    return res.status(200).json({ status: 'success', data: details });
  } catch (error) {
    return sendError(res, error, 'RECEIPT_LOOKUP_FAILED');
  }
}

function printInput(req, isReprintOverride = null) {
  return {
    requestKey: req.body?.requestKey || req.body?.request_key || req.get('Idempotency-Key'),
    copies: req.body?.copies,
    reason: req.body?.reason,
    isReprint: isReprintOverride ?? req.body?.isReprint ?? false
  };
}

export async function requestReceiptPrintController(req, res) {
  try {
    const result = await receiptsService.requestReceiptPrint(req.params.id, printInput(req), req.user);
    res.setHeader('Idempotency-Replayed', String(result.replayed));
    const { replayed, ...data } = result;
    return res.status(200).json({ status: 'success', data });
  } catch (error) {
    return sendError(res, error, 'RECEIPT_PRINT_REQUEST_FAILED');
  }
}

// Compatibility adapter: old clients may keep the /reprint path, but it now
// records an idempotent browser print request instead of claiming output.
export async function reprintReceiptController(req, res) {
  try {
    const result = await receiptsService.requestReceiptPrint(req.params.id, printInput(req, true), req.user);
    res.setHeader('Idempotency-Replayed', String(result.replayed));
    const { replayed, ...data } = result;
    return res.status(200).json({ status: 'success', data });
  } catch (error) {
    return sendError(res, error, 'RECEIPT_REPRINT_FAILED');
  }
}

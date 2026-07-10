import * as receiptsService from './receipts.service.js';

export async function getReceiptDetailsController(req, res, next) {
  try {
    const { id } = req.params;
    const details = await receiptsService.getReceiptDetails(id);
    return res.status(200).json({
      status: 'success',
      data: details
    });
  } catch (error) {
    return res.status(404).json({
      error: error.message,
      code: 'RECEIPT_NOT_FOUND'
    });
  }
}

export async function reprintReceiptController(req, res, next) {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const userId = req.user.id;

    const result = await receiptsService.reprintReceipt(id, userId, reason);
    return res.status(200).json({
      status: 'success',
      data: result
    });
  } catch (error) {
    return res.status(400).json({
      error: error.message,
      code: 'RECEIPT_REPRINT_FAILED'
    });
  }
}

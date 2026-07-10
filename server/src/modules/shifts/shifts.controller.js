import * as shiftsService from './shifts.service.js';

export async function openShiftController(req, res, next) {
  try {
    const userId = req.user.id;
    const { openingCash } = req.body;

    if (openingCash === undefined || openingCash === null) {
      return res.status(400).json({
        error: 'مبلغ عهدة البداية مطلوب لفتح الوردية.',
        code: 'SHIFT_OPEN_FAILED'
      });
    }

    const result = await shiftsService.openShift(userId, openingCash);
    return res.status(200).json({
      status: 'success',
      data: result
    });
  } catch (error) {
    return res.status(400).json({
      error: error.message,
      code: 'SHIFT_OPEN_FAILED'
    });
  }
}

export async function getCurrentShiftController(req, res, next) {
  try {
    const userId = req.user.id;
    const shift = await shiftsService.getCurrentShift(userId);
    return res.status(200).json({
      status: 'success',
      data: shift
    });
  } catch (error) {
    return res.status(400).json({
      error: error.message,
      code: 'GET_SHIFT_FAILED'
    });
  }
}

export async function getCurrentShiftSummaryController(req, res, next) {
  try {
    const userId = req.user.id;
    const summary = await shiftsService.getCurrentShiftSummary(userId);
    return res.status(200).json({
      status: 'success',
      data: summary
    });
  } catch (error) {
    return res.status(400).json({
      error: error.message,
      code: 'GET_SHIFT_SUMMARY_FAILED'
    });
  }
}

export async function requestCloseShiftController(req, res, next) {
  try {
    const userId = req.user.id;
    const { actualClosingCash } = req.body;

    if (actualClosingCash === undefined || actualClosingCash === null) {
      return res.status(400).json({
        error: 'مبلغ العهدة الفعلية مطلوب لتقديم طلب إغلاق الوردية.',
        code: 'SHIFT_CLOSE_REQUEST_FAILED'
      });
    }

    const shift = await shiftsService.requestCloseShift(userId, actualClosingCash);
    return res.status(200).json({
      status: 'success',
      data: shift
    });
  } catch (error) {
    return res.status(400).json({
      error: error.message,
      code: 'SHIFT_CLOSE_REQUEST_FAILED'
    });
  }
}

export async function getPendingReviewShiftsController(req, res, next) {
  try {
    const shifts = await shiftsService.getPendingReviewShifts();
    return res.status(200).json({
      status: 'success',
      data: shifts
    });
  } catch (error) {
    return res.status(400).json({
      error: error.message,
      code: 'GET_PENDING_SHIFTS_FAILED'
    });
  }
}

export async function approveShiftCloseController(req, res, next) {
  try {
    const adminId = req.user.id;
    const { id } = req.params;
    const { adminNotes } = req.body;

    const shift = await shiftsService.approveShiftClose(adminId, parseInt(id), adminNotes);
    return res.status(200).json({
      status: 'success',
      data: shift
    });
  } catch (error) {
    return res.status(400).json({
      error: error.message,
      code: 'SHIFT_APPROVE_FAILED'
    });
  }
}

export async function rejectShiftCloseController(req, res, next) {
  try {
    const adminId = req.user.id;
    const { id } = req.params;
    const { adminNotes } = req.body;

    const shift = await shiftsService.rejectShiftClose(adminId, parseInt(id), adminNotes);
    return res.status(200).json({
      status: 'success',
      data: shift
    });
  } catch (error) {
    return res.status(400).json({
      error: error.message,
      code: 'SHIFT_REJECT_FAILED'
    });
  }
}

export async function registerCashMovementController(req, res, next) {
  try {
    const userId = req.user.id;
    const { type, amount, notes } = req.body;

    if (!type || amount === undefined || amount === null) {
      return res.status(400).json({
        error: 'نوع الحركة والمبلغ مطلوبان لتسجيل الحركة النقدية.',
        code: 'CASH_MOVEMENT_FAILED'
      });
    }

    const result = await shiftsService.registerCashMovement(userId, { type, amountEgp: amount, notes });
    return res.status(200).json({
      status: 'success',
      data: result
    });
  } catch (error) {
    return res.status(400).json({
      error: error.message,
      code: 'CASH_MOVEMENT_FAILED'
    });
  }
}

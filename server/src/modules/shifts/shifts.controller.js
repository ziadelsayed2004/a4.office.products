import * as shiftsService from './shifts.service.js';
import { publishLiveEvent } from '../liveAdmin/liveEvents.js';

export async function openShiftController(req, res, next) {
  try {
    const data = await shiftsService.openShift(req.user.id, req.body.openingCash);
    publishLiveEvent('shift.opened', {
      shiftId: data.shift.id,
      cashierId: req.user.id,
      resumed: data.resumed,
    });
    return res.status(200).json({
      status: 'success',
      data,
    });
  } catch (error) {
    return next(error);
  }
}

export async function getCurrentShiftController(req, res, next) {
  try {
    return res
      .status(200)
      .json({ status: 'success', data: await shiftsService.getCurrentShift(req.user.id) });
  } catch (error) {
    return next(error);
  }
}

export async function getCurrentShiftSummaryController(req, res, next) {
  try {
    return res
      .status(200)
      .json({ status: 'success', data: await shiftsService.getCurrentShiftSummary(req.user.id) });
  } catch (error) {
    return next(error);
  }
}

export async function requestCloseShiftController(req, res, next) {
  try {
    const data = await shiftsService.requestCloseShift(req.user.id, req.body);
    publishLiveEvent('shift.close-requested', {
      shiftId: data.shift.id,
      cashierId: req.user.id,
    });
    return res.status(200).json({
      status: 'success',
      data,
    });
  } catch (error) {
    return next(error);
  }
}

export async function getPendingReviewShiftsController(req, res, next) {
  try {
    return res
      .status(200)
      .json({ status: 'success', data: await shiftsService.getPendingReviewShifts() });
  } catch (error) {
    return next(error);
  }
}

export async function approveShiftCloseController(req, res, next) {
  try {
    const data = await shiftsService.approveShiftClose(
      req.user.id,
      req.params.id,
      req.body.adminNotes || req.body.notes
    );
    publishLiveEvent('shift.closed', { shiftId: data.shift.id, adminId: req.user.id });
    return res.status(200).json({ status: 'success', data });
  } catch (error) {
    return next(error);
  }
}

export async function rejectShiftCloseController(req, res, next) {
  try {
    const reason = req.body.adminNotes || req.body.reason;
    const data = await shiftsService.rejectShiftClose(req.user.id, req.params.id, reason);
    publishLiveEvent('shift.reopened', { shiftId: data.shift.id, adminId: req.user.id });
    return res.status(200).json({ status: 'success', data });
  } catch (error) {
    return next(error);
  }
}

export async function registerCashMovementController(req, res, next) {
  try {
    const result = await shiftsService.registerCashMovement(
      req.user.id,
      req.body,
      req.get('Idempotency-Key')
    );
    if (!result.replayed) {
      publishLiveEvent('shift.cash-movement', {
        shiftId: result.data.shiftId,
        cashierId: req.user.id,
        movementId: result.data.id,
      });
    }
    res.setHeader('Idempotency-Replayed', String(result.replayed));
    return res.status(result.statusCode).json({ status: 'success', data: result.data });
  } catch (error) {
    return next(error);
  }
}

export async function emergencyCloseShiftController(req, res, next) {
  try {
    const data = await shiftsService.emergencyCloseShift(req.user.id, req.params.id, req.body);
    publishLiveEvent('shift.emergency-closed', {
      shiftId: data.shift.id,
      adminId: req.user.id,
    });
    return res.status(200).json({ status: 'success', data });
  } catch (error) {
    return next(error);
  }
}

export async function listAllShiftsController(req, res, next) {
  try {
    return res
      .status(200)
      .json({ status: 'success', data: await shiftsService.listAllShifts(req.query) });
  } catch (error) {
    return next(error);
  }
}

export async function getShiftDetailsController(req, res, next) {
  try {
    return res
      .status(200)
      .json({ status: 'success', data: await shiftsService.getShiftDetails(req.params.id) });
  } catch (error) {
    return next(error);
  }
}

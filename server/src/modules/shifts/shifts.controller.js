import * as shiftsService from './shifts.service.js';

function failure(res, error, fallback) {
  return res.status(error.status || 400).json({ error: error.message, code: error.code || fallback });
}

export async function openShiftController(req, res) {
  try {
    return res.status(200).json({ status: 'success', data: await shiftsService.openShift(req.user.id, req.body.openingCash) });
  } catch (error) { return failure(res, error, 'SHIFT_OPEN_FAILED'); }
}

export async function getCurrentShiftController(req, res) {
  try { return res.status(200).json({ status: 'success', data: await shiftsService.getCurrentShift(req.user.id) }); }
  catch (error) { return failure(res, error, 'GET_SHIFT_FAILED'); }
}

export async function getCurrentShiftSummaryController(req, res) {
  try { return res.status(200).json({ status: 'success', data: await shiftsService.getCurrentShiftSummary(req.user.id) }); }
  catch (error) { return failure(res, error, 'GET_SHIFT_SUMMARY_FAILED'); }
}

export async function requestCloseShiftController(req, res) {
  try { return res.status(200).json({ status: 'success', data: await shiftsService.requestCloseShift(req.user.id, req.body) }); }
  catch (error) { return failure(res, error, 'SHIFT_CLOSE_REQUEST_FAILED'); }
}

export async function getPendingReviewShiftsController(req, res) {
  try { return res.status(200).json({ status: 'success', data: await shiftsService.getPendingReviewShifts() }); }
  catch (error) { return failure(res, error, 'GET_PENDING_SHIFTS_FAILED'); }
}

export async function approveShiftCloseController(req, res) {
  try { return res.status(200).json({ status: 'success', data: await shiftsService.approveShiftClose(req.user.id, req.params.id, req.body.adminNotes) }); }
  catch (error) { return failure(res, error, 'SHIFT_APPROVE_FAILED'); }
}

export async function rejectShiftCloseController(req, res) {
  try { return res.status(200).json({ status: 'success', data: await shiftsService.rejectShiftClose(req.user.id, req.params.id, req.body.adminNotes || req.body.reason) }); }
  catch (error) { return failure(res, error, 'SHIFT_REJECT_FAILED'); }
}

export async function registerCashMovementController(req, res) {
  try { return res.status(200).json({ status: 'success', data: await shiftsService.registerCashMovement(req.user.id, req.body) }); }
  catch (error) { return failure(res, error, 'CASH_MOVEMENT_FAILED'); }
}

export async function listAllShiftsController(req, res) {
  try { return res.status(200).json({ status: 'success', data: await shiftsService.listAllShifts(req.query) }); }
  catch (error) { return failure(res, error, 'SHIFT_LIST_FAILED'); }
}

export async function getShiftDetailsController(req, res) {
  try { return res.status(200).json({ status: 'success', data: await shiftsService.getShiftDetails(req.params.id) }); }
  catch (error) { return failure(res, error, 'SHIFT_DETAILS_FAILED'); }
}

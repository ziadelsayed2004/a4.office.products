import * as paymentsService from './payments.service.js';

export async function getPaymentMethodsController(req, res, next) {
  try {
    return res
      .status(200)
      .json({ status: 'success', data: await paymentsService.getPaymentMethods() });
  } catch (error) {
    return next(error);
  }
}

export async function updatePaymentMethodsController(req, res, next) {
  try {
    const data = await paymentsService.updatePaymentMethods(req.body.active_ids, req.user.id);
    return res.status(200).json({ status: 'success', message: 'Payment methods updated.', data });
  } catch (error) {
    return next(error);
  }
}

export async function createPaymentMethodController(req, res, next) {
  try {
    const data = await paymentsService.createPaymentMethod(req.body, req.user.id);
    return res.status(201).json({ status: 'success', data });
  } catch (error) {
    return next(error);
  }
}

export async function updatePaymentMethodController(req, res, next) {
  try {
    const data = await paymentsService.updatePaymentMethod(req.params.id, req.body, req.user.id);
    return res.status(200).json({ status: 'success', data });
  } catch (error) {
    return next(error);
  }
}

export async function deletePaymentMethodController(req, res, next) {
  try {
    const data = await paymentsService.deletePaymentMethod(req.params.id, req.user.id);
    return res.status(200).json({
      status: 'success',
      message: 'Payment method deleted successfully.',
      data,
    });
  } catch (error) {
    return next(error);
  }
}

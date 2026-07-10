import * as paymentsService from './payments.service.js';

export async function getPaymentMethodsController(req, res, next) {
  try {
    const list = await paymentsService.getPaymentMethods();
    return res.status(200).json({
      status: 'success',
      data: list
    });
  } catch (error) {
    return res.status(500).json({
      error: 'حدث خطأ أثناء تحميل طرق الدفع.',
      code: 'SERVER_ERROR'
    });
  }
}

export async function updatePaymentMethodsController(req, res, next) {
  try {
    const { active_ids } = req.body;
    const updated = await paymentsService.updatePaymentMethods(active_ids, req.user.id);
    return res.status(200).json({
      status: 'success',
      message: 'تم تحديث طرق الدفع بنجاح.',
      data: updated
    });
  } catch (error) {
    return res.status(400).json({
      error: error.message,
      code: 'UPDATE_PAYMENT_METHODS_FAILED'
    });
  }
}

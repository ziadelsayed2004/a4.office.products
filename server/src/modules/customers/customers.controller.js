import * as customersService from './customers.service.js';

export async function searchCustomersController(req, res, next) {
  try {
    const { q } = req.query;
    const list = await customersService.searchCustomers(q);
    return res.status(200).json({
      status: 'success',
      data: list
    });
  } catch (error) {
    return res.status(500).json({
      error: 'حدث خطأ أثناء البحث عن العملاء.',
      code: 'SERVER_ERROR'
    });
  }
}

export async function createCustomerController(req, res, next) {
  try {
    const { name, phone } = req.body;
    const customer = await customersService.createCustomer({ name, phone }, req.user.id);
    return res.status(201).json({
      status: 'success',
      message: 'تم تسجيل العميل بنجاح.',
      data: customer
    });
  } catch (error) {
    return res.status(400).json({
      error: error.message,
      code: 'CUSTOMER_REGISTRATION_FAILED'
    });
  }
}

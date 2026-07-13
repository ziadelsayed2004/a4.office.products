import * as customersService from './customers.service.js';

export async function searchCustomersController(req, res, next) {
  try {
    return res.status(200).json({
      status: 'success',
      data: await customersService.searchCustomers(req.query.q),
    });
  } catch (error) {
    return next(error);
  }
}

export async function createCustomerController(req, res, next) {
  try {
    const customer = await customersService.createCustomer(req.body, req.user.id);
    return res.status(201).json({
      status: 'success',
      message: 'Customer registered successfully.',
      data: customer,
    });
  } catch (error) {
    return next(error);
  }
}

export async function updateCustomerController(req, res, next) {
  try {
    const data = await customersService.updateCustomer(req.params.id, req.body, req.user.id);
    return res.status(200).json({
      status: 'success',
      message: 'Customer updated successfully.',
      data,
    });
  } catch (error) {
    return next(error);
  }
}

export async function deleteCustomerController(req, res, next) {
  try {
    const data = await customersService.deleteCustomer(req.params.id, req.user.id);
    return res.status(200).json({
      status: 'success',
      message: 'Customer deleted successfully.',
      data,
    });
  } catch (error) {
    return next(error);
  }
}

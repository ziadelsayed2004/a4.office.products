import * as priceTiersService from './priceTiers.service.js';

export async function getPriceTiersController(req, res, next) {
  try {
    const activeOnly = req.user.role === 'Cashier' || req.query.activeOnly === 'true';
    return res.status(200).json({
      status: 'success',
      data: await priceTiersService.getAllPriceTiers(activeOnly),
    });
  } catch (error) {
    return next(error);
  }
}

export async function createPriceTierController(req, res, next) {
  try {
    const tier = await priceTiersService.createPriceTier(req.body, req.user.id);
    return res.status(201).json({
      status: 'success',
      message: 'Price tier created successfully.',
      data: tier,
    });
  } catch (error) {
    return next(error);
  }
}

export async function updatePriceTierController(req, res, next) {
  try {
    const tier = await priceTiersService.updatePriceTier(req.params.id, req.body, req.user.id);
    return res.status(200).json({
      status: 'success',
      message: 'Price tier updated successfully.',
      data: tier,
    });
  } catch (error) {
    return next(error);
  }
}

export async function deletePriceTierController(req, res, next) {
  try {
    const data = await priceTiersService.deletePriceTier(req.params.id, req.user.id);
    return res.status(200).json({
      status: 'success',
      message: 'Price tier deleted successfully.',
      data,
    });
  } catch (error) {
    return next(error);
  }
}

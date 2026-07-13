import * as productsService from './products.service.js';
import { AppError } from '../../utils/errors.js';

export async function searchProductsController(req, res, next) {
  try {
    const data = await productsService.searchProducts({
      q: req.query.q,
      categoryId: req.query.categoryId || null,
      activeOnly: req.user.role === 'Cashier' || req.query.activeOnly === 'true',
      availabilityPolicy: req.query.availabilityPolicy,
    });
    return res.status(200).json({ status: 'success', data });
  } catch (error) {
    return next(error);
  }
}

export async function getProductDetailsController(req, res, next) {
  try {
    const product = await productsService.getProductDetails(req.params.id);
    if (!product) throw new AppError('Product not found.', 404, 'PRODUCT_NOT_FOUND');
    if (req.user.role === 'Cashier' && product.is_active !== 1) {
      throw new AppError('Inactive product access is forbidden.', 403, 'FORBIDDEN');
    }
    return res.status(200).json({ status: 'success', data: product });
  } catch (error) {
    return next(error);
  }
}

export async function createProductController(req, res, next) {
  try {
    const data = await productsService.createProduct(req.body, req.user.id);
    return res
      .status(201)
      .json({ status: 'success', message: 'Product created successfully.', data });
  } catch (error) {
    return next(error);
  }
}

export async function updateProductController(req, res, next) {
  try {
    const data = await productsService.updateProduct(req.params.id, req.body, req.user.id);
    return res
      .status(200)
      .json({ status: 'success', message: 'Product updated successfully.', data });
  } catch (error) {
    return next(error);
  }
}

export async function deleteProductController(req, res, next) {
  try {
    const data = await productsService.deleteProduct(req.params.id, req.user.id);
    return res.status(200).json({
      status: 'success',
      message: 'Product deleted successfully.',
      data,
    });
  } catch (error) {
    return next(error);
  }
}

export async function generateQrLabelsController(req, res, next) {
  try {
    const data = await productsService.getOrCreateProductQrToken(
      req.params.id,
      req.body,
      req.user.id
    );
    return res
      .status(200)
      .json({ status: 'success', message: 'QR labels prepared successfully.', data });
  } catch (error) {
    return next(error);
  }
}

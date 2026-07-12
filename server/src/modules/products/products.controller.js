import * as productsService from './products.service.js';

export async function searchProductsController(req, res, next) {
  try {
    const { q, categoryId, availabilityPolicy } = req.query;
    
    // Cashiers see only active products. Admins see all by default.
    const isCashier = req.user.role === 'Cashier';
    const activeOnly = isCashier || req.query.activeOnly === 'true';

    const products = await productsService.searchProducts({
      q,
      categoryId: categoryId ? parseInt(categoryId, 10) : null,
      activeOnly,
      availabilityPolicy
    });

    return res.status(200).json({
      status: 'success',
      data: products
    });
  } catch (error) {
    return res.status(error.status || 500).json({
      error: error.status ? error.message : 'حدث خطأ أثناء البحث عن المنتجات.',
      code: error.code || 'SERVER_ERROR'
    });
  }
}

export async function getProductDetailsController(req, res, next) {
  try {
    const { id } = req.params;
    
    const product = await productsService.getProductDetails(parseInt(id, 10));
    
    if (!product) {
      return res.status(404).json({
        error: 'المنتج غير موجود.',
        code: 'PRODUCT_NOT_FOUND'
      });
    }

    // Cashiers cannot read inactive products
    const isCashier = req.user.role === 'Cashier';
    if (isCashier && product.is_active !== 1) {
      return res.status(403).json({
        error: 'صلاحيات غير كافية للوصول إلى هذا المنتج المعطل.',
        code: 'FORBIDDEN'
      });
    }

    return res.status(200).json({
      status: 'success',
      data: product
    });
  } catch (error) {
    return res.status(error.status || 500).json({
      error: error.status ? error.message : 'حدث خطأ أثناء تحميل تفاصيل المنتج.',
      code: error.code || 'SERVER_ERROR'
    });
  }
}

export async function createProductController(req, res, next) {
  try {
    const newProduct = await productsService.createProduct(req.body, req.user.id);
    return res.status(201).json({
      status: 'success',
      message: 'تم إنشاء المنتج بنجاح.',
      data: newProduct
    });
  } catch (error) {
    return res.status(error.status || 400).json({
      error: error.message,
      code: error.code || 'CREATE_PRODUCT_FAILED'
    });
  }
}

export async function updateProductController(req, res, next) {
  try {
    const { id } = req.params;
    const updated = await productsService.updateProduct(parseInt(id, 10), req.body, req.user.id);
    return res.status(200).json({
      status: 'success',
      message: 'تم تحديث المنتج بنجاح.',
      data: updated
    });
  } catch (error) {
    return res.status(error.status || 400).json({
      error: error.message,
      code: error.code || 'UPDATE_PRODUCT_FAILED'
    });
  }
}

export async function generateQrLabelsController(req, res, next) {
  try {
    const { id } = req.params;
    const { quantity, label_size } = req.body;

    const result = await productsService.getOrCreateProductQrToken(
      parseInt(id, 10),
      { quantity, label_size },
      req.user.id
    );

    return res.status(200).json({
      status: 'success',
      message: 'تم تجهيز ملصقات رمز QR بنجاح.',
      data: result
    });
  } catch (error) {
    return res.status(error.status || 400).json({
      error: error.message,
      code: error.code || 'QR_GEN_FAILED'
    });
  }
}

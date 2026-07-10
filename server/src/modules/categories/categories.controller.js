import * as categoriesService from './categories.service.js';

export async function getCategoriesController(req, res, next) {
  try {
    // Cashiers see only active categories. Admins see all unless specified.
    const isCashier = req.user.role === 'Cashier';
    const activeOnly = isCashier || req.query.activeOnly === 'true';

    const categories = await categoriesService.getAllCategories(activeOnly);

    return res.status(200).json({
      status: 'success',
      data: categories
    });
  } catch (error) {
    return res.status(500).json({
      error: 'حدث خطأ أثناء تحميل التصنيفات.',
      code: 'SERVER_ERROR'
    });
  }
}

export async function createCategoryController(req, res, next) {
  try {
    const { name } = req.body;
    if (!name) {
      return res.status(400).json({
        error: 'اسم التصنيف مطلوب.',
        code: 'VALIDATION_ERROR'
      });
    }

    const newCategory = await categoriesService.createCategory(name, req.user.id);

    return res.status(201).json({
      status: 'success',
      message: 'تم إنشاء التصنيف بنجاح.',
      data: newCategory
    });
  } catch (error) {
    return res.status(400).json({
      error: error.message,
      code: 'CREATE_CATEGORY_FAILED'
    });
  }
}

export async function updateCategoryController(req, res, next) {
  try {
    const { id } = req.params;
    const { name, is_active } = req.body;

    const updated = await categoriesService.updateCategory(
      parseInt(id, 10),
      { name, is_active },
      req.user.id
    );

    return res.status(200).json({
      status: 'success',
      message: 'تم تحديث التصنيف بنجاح.',
      data: updated
    });
  } catch (error) {
    return res.status(400).json({
      error: error.message,
      code: 'UPDATE_CATEGORY_FAILED'
    });
  }
}

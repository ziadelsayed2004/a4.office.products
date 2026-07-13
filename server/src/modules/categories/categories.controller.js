import * as categoriesService from './categories.service.js';

export async function getCategoriesController(req, res, next) {
  try {
    const activeOnly = req.user.role === 'Cashier' || req.query.activeOnly === 'true';
    return res.status(200).json({
      status: 'success',
      data: await categoriesService.getAllCategories(activeOnly),
    });
  } catch (error) {
    return next(error);
  }
}

export async function createCategoryController(req, res, next) {
  try {
    const category = await categoriesService.createCategory(req.body.name, req.user.id);
    return res.status(201).json({
      status: 'success',
      message: 'Category created successfully.',
      data: category,
    });
  } catch (error) {
    return next(error);
  }
}

export async function updateCategoryController(req, res, next) {
  try {
    const category = await categoriesService.updateCategory(req.params.id, req.body, req.user.id);
    return res.status(200).json({
      status: 'success',
      message: 'Category updated successfully.',
      data: category,
    });
  } catch (error) {
    return next(error);
  }
}

export async function deleteCategoryController(req, res, next) {
  try {
    const data = await categoriesService.deleteCategory(req.params.id, req.user.id);
    return res.status(200).json({
      status: 'success',
      message: 'Category deleted successfully.',
      data,
    });
  } catch (error) {
    return next(error);
  }
}

import { Router } from 'express';
import * as categoriesController from './categories.controller.js';
import { authenticate } from '../../middleware/auth.js';
import { isAdmin } from '../../middleware/rbac.js';

const router = Router();

// Retrieve all categories (accessible to Cashiers and Admins)
router.get('/categories', authenticate, categoriesController.getCategoriesController);

// Admin-only write routes
router.post('/admin/categories', authenticate, isAdmin, categoriesController.createCategoryController);
router.patch('/admin/categories/:id', authenticate, isAdmin, categoriesController.updateCategoryController);

export default router;

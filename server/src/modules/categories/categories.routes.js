import { Router } from 'express';
import * as categoriesController from './categories.controller.js';
import { authenticate } from '../../middleware/auth.js';
import { isAdmin } from '../../middleware/rbac.js';
import { validate } from '../../middleware/validate.js';
import {
  categoryCreateBody,
  categoryListQuery,
  categoryUpdateBody,
  idParams,
} from '../../validation/schemas.js';

const router = Router();

// Retrieve all categories (accessible to Cashiers and Admins)
router.get(
  '/categories',
  authenticate,
  validate({ query: categoryListQuery }),
  categoriesController.getCategoriesController
);

// Admin-only write routes
router.post(
  '/admin/categories',
  authenticate,
  isAdmin,
  validate({ body: categoryCreateBody }),
  categoriesController.createCategoryController
);
router.patch(
  '/admin/categories/:id',
  authenticate,
  isAdmin,
  validate({ params: idParams, body: categoryUpdateBody }),
  categoriesController.updateCategoryController
);
router.delete(
  '/admin/categories/:id',
  authenticate,
  isAdmin,
  validate({ params: idParams }),
  categoriesController.deleteCategoryController
);

export default router;

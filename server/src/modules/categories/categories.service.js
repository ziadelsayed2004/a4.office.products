import db, { withTransaction } from '../../db/index.js';
import { writeAuditLog } from '../../utils/auditLogger.js';
import { AppError } from '../../utils/errors.js';

function categoryName(value) {
  const name = String(value || '').trim();
  if (!name) throw new AppError('Category name is required.', 400, 'CATEGORY_NAME_REQUIRED');
  if (name.length > 150)
    throw new AppError('Category name is too long.', 400, 'CATEGORY_NAME_INVALID');
  return name;
}

export async function getAllCategories(activeOnly = false, connection = db) {
  let query = `SELECT c.id, c.name, c.is_active, c.created_at, c.updated_at,
    (SELECT COUNT(*) FROM products p WHERE p.category_id = c.id) AS product_count,
    (SELECT COUNT(*) FROM products p WHERE p.category_id = c.id AND p.is_active = 1)
      AS active_product_count,
    (SELECT COUNT(*) FROM products p WHERE p.category_id = c.id AND p.is_active = 0)
      AS inactive_product_count
    FROM categories c`;
  if (activeOnly) query += ' WHERE c.is_active = 1';
  query += ' ORDER BY c.name ASC;';
  return (await connection.all(query)).map(decorateCategoryDependencies);
}

export async function getCategoryById(id, connection = db) {
  const category = await connection.get(
    `SELECT c.id, c.name, c.is_active, c.created_at, c.updated_at,
      (SELECT COUNT(*) FROM products p WHERE p.category_id = c.id) AS product_count,
      (SELECT COUNT(*) FROM products p WHERE p.category_id = c.id AND p.is_active = 1)
        AS active_product_count,
      (SELECT COUNT(*) FROM products p WHERE p.category_id = c.id AND p.is_active = 0)
        AS inactive_product_count
     FROM categories c WHERE c.id = ?;`,
    [id]
  );
  return category ? decorateCategoryDependencies(category) : null;
}

function decorateCategoryDependencies(category) {
  const {
    product_count: productCount = 0,
    active_product_count: activeProductCount = 0,
    inactive_product_count: inactiveProductCount = 0,
    ...data
  } = category;
  const dependencyCounts = {
    products: Number(productCount),
    active_products: Number(activeProductCount),
    inactive_products: Number(inactiveProductCount),
  };
  return {
    ...data,
    can_delete: dependencyCounts.products === 0,
    dependency_counts: dependencyCounts,
  };
}

export async function createCategory(value, adminUserId) {
  const name = categoryName(value);
  return withTransaction(async (connection) => {
    const existing = await connection.get('SELECT id FROM categories WHERE name = ?;', [name]);
    if (existing) throw new AppError('Category name already exists.', 409, 'CATEGORY_CONFLICT');
    let result;
    try {
      result = await connection.run('INSERT INTO categories (name) VALUES (?);', [name]);
    } catch (error) {
      if (error.code === 'SQLITE_CONSTRAINT') {
        throw new AppError('Category name already exists.', 409, 'CATEGORY_CONFLICT');
      }
      throw error;
    }
    await writeAuditLog({
      userId: adminUserId,
      actionType: 'CATEGORY_CREATE',
      entityType: 'categories',
      entityId: result.lastID,
      afterValues: { name },
      notes: `Category created: ${name}`,
      connection,
    });
    return getCategoryById(result.lastID, connection);
  });
}

export async function updateCategory(id, { name, is_active }, adminUserId) {
  return withTransaction(async (connection) => {
    const oldCategory = await getCategoryById(id, connection);
    if (!oldCategory) throw new AppError('Category not found.', 404, 'CATEGORY_NOT_FOUND');

    const updates = {};
    const fields = [];
    const params = [];
    if (name !== undefined) {
      const cleanName = categoryName(name);
      if (cleanName !== oldCategory.name) {
        const existing = await connection.get(
          'SELECT id FROM categories WHERE name = ? AND id != ?;',
          [cleanName, id]
        );
        if (existing) throw new AppError('Category name already exists.', 409, 'CATEGORY_CONFLICT');
      }
      updates.name = cleanName;
      fields.push('name = ?');
      params.push(cleanName);
    }
    if (is_active !== undefined) {
      updates.is_active = is_active ? 1 : 0;
      fields.push('is_active = ?');
      params.push(updates.is_active);
    }
    if (fields.length === 0) return oldCategory;

    fields.push('updated_at = CURRENT_TIMESTAMP');
    params.push(id);
    try {
      await connection.run(`UPDATE categories SET ${fields.join(', ')} WHERE id = ?;`, params);
    } catch (error) {
      if (error.code === 'SQLITE_CONSTRAINT') {
        throw new AppError('Category name already exists.', 409, 'CATEGORY_CONFLICT');
      }
      throw error;
    }
    const updatedCategory = await getCategoryById(id, connection);
    await writeAuditLog({
      userId: adminUserId,
      actionType: 'CATEGORY_UPDATE',
      entityType: 'categories',
      entityId: id,
      beforeValues: oldCategory,
      afterValues: updatedCategory,
      notes: `Category ${id} updated`,
      connection,
    });
    return updatedCategory;
  });
}

export async function deleteCategory(id, adminUserId) {
  return withTransaction(async (connection) => {
    const category = await getCategoryById(id, connection);
    if (!category) throw new AppError('Category not found.', 404, 'CATEGORY_NOT_FOUND');

    if (!category.can_delete) {
      throw new AppError(
        'Category is linked to products and cannot be deleted. Move every linked product first.',
        409,
        'CATEGORY_IN_USE',
        category.dependency_counts
      );
    }

    const result = await connection.run('DELETE FROM categories WHERE id = ?;', [id]);
    if (result.changes !== 1) throw new AppError('Category not found.', 404, 'CATEGORY_NOT_FOUND');

    await writeAuditLog({
      userId: adminUserId,
      actionType: 'CATEGORY_DELETE',
      entityType: 'categories',
      entityId: Number(id),
      beforeValues: category,
      afterValues: { id: Number(id), deleted: true },
      notes: `Category deleted: ${category.name}`,
      connection,
    });
    return { id: Number(id) };
  });
}

import db from '../../db/index.js';
import { writeAuditLog } from '../../utils/auditLogger.js';

/**
 * Retrieve all categories.
 * If activeOnly is true, returns only categories where is_active = 1.
 */
export async function getAllCategories(activeOnly = false) {
  let query = 'SELECT id, name, is_active, created_at, updated_at FROM categories';
  const params = [];

  if (activeOnly) {
    query += ' WHERE is_active = 1';
  }

  query += ' ORDER BY name ASC;';
  return await db.all(query, params);
}

/**
 * Retrieve category by ID.
 */
export async function getCategoryById(id) {
  return await db.get(
    'SELECT id, name, is_active, created_at, updated_at FROM categories WHERE id = ?;',
    [id]
  );
}

/**
 * Create a new category.
 */
export async function createCategory(name, adminUserId) {
  if (!name || name.trim().length === 0) {
    throw new Error('اسم التصنيف مطلوب.');
  }

  const cleanName = name.trim();

  // Check unique category name
  const existing = await db.get('SELECT id FROM categories WHERE name = ?;', [cleanName]);
  if (existing) {
    throw new Error('هذا التصنيف موجود بالفعل.');
  }

  const result = await db.run(
    'INSERT INTO categories (name) VALUES (?);',
    [cleanName]
  );

  const newId = result.lastID;

  // Log audit trail
  await writeAuditLog({
    userId: adminUserId,
    actionType: 'CATEGORY_CREATE',
    entityType: 'categories',
    entityId: newId,
    afterValues: { name: cleanName },
    notes: `تم إنشاء تصنيف جديد: ${cleanName}`
  });

  return await getCategoryById(newId);
}

/**
 * Update category details (name, status active/disabled).
 */
export async function updateCategory(id, { name, is_active }, adminUserId) {
  const oldCategory = await getCategoryById(id);
  if (!oldCategory) {
    throw new Error('التصنيف غير موجود.');
  }

  const updates = {};
  const queryParts = [];
  const params = [];

  if (name !== undefined) {
    const cleanName = name.trim();
    if (cleanName.length === 0) {
      throw new Error('اسم التصنيف لا يمكن أن يكون فارغاً.');
    }
    // Check uniqueness if renaming
    if (cleanName !== oldCategory.name) {
      const existing = await db.get('SELECT id FROM categories WHERE name = ?;', [cleanName]);
      if (existing) {
        throw new Error('هناك تصنيف آخر بهذا الاسم بالفعل.');
      }
    }
    updates.name = cleanName;
    queryParts.push('name = ?');
    params.push(cleanName);
  }

  if (is_active !== undefined) {
    const statusVal = is_active ? 1 : 0;
    updates.is_active = statusVal;
    queryParts.push('is_active = ?');
    params.push(statusVal);
  }

  if (queryParts.length === 0) {
    return oldCategory; // No changes requested
  }

  queryParts.push('updated_at = CURRENT_TIMESTAMP');
  params.push(id); // For WHERE clause

  await db.run(
    `UPDATE categories SET ${queryParts.join(', ')} WHERE id = ?;`,
    params
  );

  const updatedCategory = await getCategoryById(id);

  // Log audit trail
  await writeAuditLog({
    userId: adminUserId,
    actionType: 'CATEGORY_UPDATE',
    entityType: 'categories',
    entityId: id,
    beforeValues: oldCategory,
    afterValues: updates,
    notes: `تم تحديث التصنيف ذو المعرف (${id}) إلى: ${JSON.stringify(updates)}`
  });

  return updatedCategory;
}

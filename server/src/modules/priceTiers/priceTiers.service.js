import db from '../../db/index.js';
import { writeAuditLog } from '../../utils/auditLogger.js';

/**
 * Retrieve all price tiers.
 * If activeOnly is true, returns only active price tiers.
 */
export async function getAllPriceTiers(activeOnly = false) {
  let query = 'SELECT id, name, description, is_active, created_at, updated_at FROM price_tiers';
  const params = [];

  if (activeOnly) {
    query += ' WHERE is_active = 1';
  }

  query += ' ORDER BY name ASC;';
  return await db.all(query, params);
}

/**
 * Retrieve single price tier by ID.
 */
export async function getPriceTierById(id) {
  return await db.get(
    'SELECT id, name, description, is_active, created_at, updated_at FROM price_tiers WHERE id = ?;',
    [id]
  );
}

/**
 * Create a new price tier.
 */
export async function createPriceTier({ name, description }, adminUserId) {
  if (!name || name.trim().length === 0) {
    throw new Error('اسم فئة السعر مطلوب.');
  }

  const cleanName = name.trim();

  // Check unique name
  const existing = await db.get('SELECT id FROM price_tiers WHERE name = ?;', [cleanName]);
  if (existing) {
    throw new Error('هذه فئة السعر موجودة بالفعل.');
  }

  const result = await db.run(
    'INSERT INTO price_tiers (name, description) VALUES (?, ?);',
    [cleanName, description || null]
  );

  const newId = result.lastID;

  // Log audit log
  await writeAuditLog({
    userId: adminUserId,
    actionType: 'PRICE_TIER_CREATE',
    entityType: 'price_tiers',
    entityId: newId,
    afterValues: { name: cleanName, description },
    notes: `تم إنشاء فئة سعر جديدة: ${cleanName}`
  });

  return await getPriceTierById(newId);
}

/**
 * Update price tier fields (name, description, active status).
 */
export async function updatePriceTier(id, { name, description, is_active }, adminUserId) {
  const oldTier = await getPriceTierById(id);
  if (!oldTier) {
    throw new Error('فئة السعر غير موجودة.');
  }

  const updates = {};
  const queryParts = [];
  const params = [];

  if (name !== undefined) {
    const cleanName = name.trim();
    if (cleanName.length === 0) {
      throw new Error('اسم فئة السعر لا يمكن أن يكون فارغاً.');
    }
    // Check uniqueness if renaming
    if (cleanName !== oldTier.name) {
      const existing = await db.get('SELECT id FROM price_tiers WHERE name = ?;', [cleanName]);
      if (existing) {
        throw new Error('هناك فئة سعر أخرى بهذا الاسم بالفعل.');
      }
    }
    updates.name = cleanName;
    queryParts.push('name = ?');
    params.push(cleanName);
  }

  if (description !== undefined) {
    updates.description = description;
    queryParts.push('description = ?');
    params.push(description);
  }

  if (is_active !== undefined) {
    const statusVal = is_active ? 1 : 0;
    updates.is_active = statusVal;
    queryParts.push('is_active = ?');
    params.push(statusVal);
  }

  if (queryParts.length === 0) {
    return oldTier;
  }

  queryParts.push('updated_at = CURRENT_TIMESTAMP');
  params.push(id); // For WHERE clause

  await db.run(
    `UPDATE price_tiers SET ${queryParts.join(', ')} WHERE id = ?;`,
    params
  );

  const updatedTier = await getPriceTierById(id);

  // Log audit log
  await writeAuditLog({
    userId: adminUserId,
    actionType: 'PRICE_TIER_UPDATE',
    entityType: 'price_tiers',
    entityId: id,
    beforeValues: oldTier,
    afterValues: updates,
    notes: `تم تحديث فئة السعر ذو المعرف (${id}) إلى: ${JSON.stringify(updates)}`
  });

  return updatedTier;
}

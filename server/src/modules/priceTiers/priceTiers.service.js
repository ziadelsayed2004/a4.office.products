import db, { withTransaction } from '../../db/index.js';
import { writeAuditLog } from '../../utils/auditLogger.js';
import { AppError } from '../../utils/errors.js';

function normalizeName(value) {
  const name = String(value || '').trim();
  if (!name) throw new AppError('Price tier name is required.', 400, 'PRICE_TIER_NAME_REQUIRED');
  if (name.length > 150)
    throw new AppError('Price tier name is too long.', 400, 'PRICE_TIER_NAME_INVALID');
  return name;
}

function normalizeDescription(value) {
  if (value === undefined) return undefined;
  const description = String(value || '').trim();
  if (description.length > 500)
    throw new AppError(
      'Price tier description is too long.',
      400,
      'PRICE_TIER_DESCRIPTION_INVALID'
    );
  return description || null;
}

export async function getAllPriceTiers(activeOnly = false, connection = db) {
  let query = `SELECT pt.id, pt.name, pt.description, pt.is_active, pt.created_at, pt.updated_at,
    (SELECT COUNT(*) FROM product_prices pp WHERE pp.price_tier_id = pt.id)
      AS product_price_count,
    (SELECT COUNT(*) FROM order_items oi WHERE oi.price_tier_id = pt.id)
      AS order_item_count,
    (SELECT COUNT(*) FROM preorder_items pi WHERE pi.price_tier_id = pt.id)
      AS preorder_item_count
    FROM price_tiers pt`;
  if (activeOnly) query += ' WHERE pt.is_active = 1';
  query += ' ORDER BY pt.name ASC;';
  return (await connection.all(query)).map(decoratePriceTierDependencies);
}

export async function getPriceTierById(id, connection = db) {
  const tier = await connection.get(
    `SELECT pt.id, pt.name, pt.description, pt.is_active, pt.created_at, pt.updated_at,
      (SELECT COUNT(*) FROM product_prices pp WHERE pp.price_tier_id = pt.id)
        AS product_price_count,
      (SELECT COUNT(*) FROM order_items oi WHERE oi.price_tier_id = pt.id)
        AS order_item_count,
      (SELECT COUNT(*) FROM preorder_items pi WHERE pi.price_tier_id = pt.id)
        AS preorder_item_count
     FROM price_tiers pt WHERE pt.id = ?;`,
    [id]
  );
  return tier ? decoratePriceTierDependencies(tier) : null;
}

function decoratePriceTierDependencies(tier) {
  const {
    product_price_count: productPriceCount = 0,
    order_item_count: orderItemCount = 0,
    preorder_item_count: preorderItemCount = 0,
    ...data
  } = tier;
  const dependencyCounts = {
    product_prices: Number(productPriceCount),
    order_items: Number(orderItemCount),
    preorder_items: Number(preorderItemCount),
  };
  return {
    ...data,
    can_delete: Object.values(dependencyCounts).every((count) => count === 0),
    dependency_counts: dependencyCounts,
  };
}

export async function createPriceTier({ name: value, description }, adminUserId) {
  const name = normalizeName(value);
  const cleanDescription = normalizeDescription(description);
  return withTransaction(async (connection) => {
    const existing = await connection.get('SELECT id FROM price_tiers WHERE name = ?;', [name]);
    if (existing) throw new AppError('Price tier name already exists.', 409, 'PRICE_TIER_CONFLICT');
    let result;
    try {
      result = await connection.run('INSERT INTO price_tiers (name, description) VALUES (?, ?);', [
        name,
        cleanDescription,
      ]);
    } catch (error) {
      if (error.code === 'SQLITE_CONSTRAINT') {
        throw new AppError('Price tier name already exists.', 409, 'PRICE_TIER_CONFLICT');
      }
      throw error;
    }
    await writeAuditLog({
      userId: adminUserId,
      actionType: 'PRICE_TIER_CREATE',
      entityType: 'price_tiers',
      entityId: result.lastID,
      afterValues: { name, description: cleanDescription },
      notes: `Price tier created: ${name}`,
      connection,
    });
    return getPriceTierById(result.lastID, connection);
  });
}

export async function updatePriceTier(id, { name, description, is_active }, adminUserId) {
  return withTransaction(async (connection) => {
    const oldTier = await getPriceTierById(id, connection);
    if (!oldTier) throw new AppError('Price tier not found.', 404, 'PRICE_TIER_NOT_FOUND');
    const fields = [];
    const params = [];
    if (name !== undefined) {
      const cleanName = normalizeName(name);
      const existing = await connection.get(
        'SELECT id FROM price_tiers WHERE name = ? AND id != ?;',
        [cleanName, id]
      );
      if (existing)
        throw new AppError('Price tier name already exists.', 409, 'PRICE_TIER_CONFLICT');
      fields.push('name = ?');
      params.push(cleanName);
    }
    if (description !== undefined) {
      fields.push('description = ?');
      params.push(normalizeDescription(description));
    }
    if (is_active !== undefined) {
      fields.push('is_active = ?');
      params.push(is_active ? 1 : 0);
    }
    if (fields.length === 0) return oldTier;
    fields.push('updated_at = CURRENT_TIMESTAMP');
    params.push(id);
    try {
      await connection.run(`UPDATE price_tiers SET ${fields.join(', ')} WHERE id = ?;`, params);
    } catch (error) {
      if (error.code === 'SQLITE_CONSTRAINT') {
        throw new AppError('Price tier name already exists.', 409, 'PRICE_TIER_CONFLICT');
      }
      throw error;
    }
    const updatedTier = await getPriceTierById(id, connection);
    await writeAuditLog({
      userId: adminUserId,
      actionType: 'PRICE_TIER_UPDATE',
      entityType: 'price_tiers',
      entityId: id,
      beforeValues: oldTier,
      afterValues: updatedTier,
      notes: `Price tier ${id} updated`,
      connection,
    });
    return updatedTier;
  });
}

export async function deletePriceTier(id, adminUserId) {
  return withTransaction(async (connection) => {
    const tier = await getPriceTierById(id, connection);
    if (!tier) throw new AppError('Price tier not found.', 404, 'PRICE_TIER_NOT_FOUND');

    if (!tier.can_delete) {
      throw new AppError(
        'Price tier has product prices or historical sales and cannot be deleted. Disable it instead.',
        409,
        'PRICE_TIER_IN_USE',
        tier.dependency_counts
      );
    }

    const result = await connection.run('DELETE FROM price_tiers WHERE id = ?;', [id]);
    if (result.changes !== 1)
      throw new AppError('Price tier not found.', 404, 'PRICE_TIER_NOT_FOUND');

    await writeAuditLog({
      userId: adminUserId,
      actionType: 'PRICE_TIER_DELETE',
      entityType: 'price_tiers',
      entityId: Number(id),
      beforeValues: tier,
      afterValues: { id: Number(id), deleted: true },
      notes: `Price tier deleted: ${tier.name}`,
      connection,
    });
    return { id: Number(id) };
  });
}

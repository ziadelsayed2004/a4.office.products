import db from '../../db/index.js';
import { writeAuditLog } from '../../utils/auditLogger.js';

/**
 * Retrieve the current physical stock for a product.
 * Returns 0 if no transactions are recorded yet.
 */
export async function getProductStock(productId) {
  const row = await db.get(
    "SELECT after_quantity FROM inventory_ledger WHERE product_id = ? ORDER BY id DESC LIMIT 1;",
    [productId]
  );
  return row ? row.after_quantity : 0;
}

/**
 * Fetch list of inventory ledger transactions with product and user details.
 */
export async function getInventoryLedger(filters = {}) {
  let query = `
    SELECT il.*, p.name AS product_name, p.sku AS product_sku, u.name AS user_name
    FROM inventory_ledger il
    JOIN products p ON il.product_id = p.id
    JOIN users u ON il.user_id = u.id
    WHERE 1=1
  `;
  const params = [];

  if (filters.productId) {
    query += ' AND il.product_id = ?';
    params.push(filters.productId);
  }

  if (filters.transactionType) {
    query += ' AND il.transaction_type = ?';
    params.push(filters.transactionType);
  }

  if (filters.startDate) {
    query += ' AND il.created_at >= ?';
    params.push(filters.startDate);
  }

  if (filters.endDate) {
    // Add end of day boundary
    query += ' AND il.created_at <= ?';
    params.push(filters.endDate + ' 23:59:59');
  }

  query += ' ORDER BY il.id DESC';

  // Pagination
  if (filters.limit) {
    const limit = parseInt(filters.limit, 10);
    const offset = parseInt(filters.offset, 10) || 0;
    query += ` LIMIT ${limit} OFFSET ${offset}`;
  }

  const logs = await db.all(query, params);
  
  // Total count query
  let countQuery = `
    SELECT COUNT(*) AS total
    FROM inventory_ledger il
    WHERE 1=1
  `;
  const countParams = [];

  if (filters.productId) {
    countQuery += ' AND il.product_id = ?';
    countParams.push(filters.productId);
  }
  if (filters.transactionType) {
    countQuery += ' AND il.transaction_type = ?';
    countParams.push(filters.transactionType);
  }
  if (filters.startDate) {
    countQuery += ' AND il.created_at >= ?';
    countParams.push(filters.startDate);
  }
  if (filters.endDate) {
    countQuery += ' AND il.created_at <= ?';
    countParams.push(filters.endDate + ' 23:59:59');
  }

  const countRow = await db.get(countQuery, countParams);
  const total = countRow ? countRow.total : 0;

  return {
    ledger: logs,
    total
  };
}

/**
 * Handle manual stock adjustment (ADD, SUB, or STOCK_IN).
 * Prevents stock from falling below 0.
 */
export async function adjustStock({ productId, adjustmentType, quantity, notes }, userId, shiftId = null) {
  if (!productId || !adjustmentType || !quantity || quantity <= 0) {
    throw new Error('يرجى توفير معرف المنتج ونوع التعديل والكمية (أكبر من الصفر).');
  }

  // Fetch product to verify it exists
  const product = await db.get("SELECT name, sku FROM products WHERE id = ?;", [productId]);
  if (!product) {
    throw new Error('المنتج غير موجود.');
  }

  let transactionType;
  let quantityChanged;

  if (adjustmentType === 'STOCK_IN') {
    transactionType = 'STOCK_IN';
    quantityChanged = quantity;
  } else if (adjustmentType === 'ADD' || adjustmentType === 'ADJUSTMENT_ADD') {
    transactionType = 'ADJUSTMENT_ADD';
    quantityChanged = quantity;
  } else if (adjustmentType === 'SUB' || adjustmentType === 'ADJUSTMENT_SUB') {
    transactionType = 'ADJUSTMENT_SUB';
    quantityChanged = -quantity;
  } else {
    throw new Error('نوع التعديل غير صالح. يجب أن يكون STOCK_IN أو ADD أو SUB.');
  }

  await db.run('BEGIN TRANSACTION;');
  try {
    const beforeQty = await getProductStock(productId);
    const afterQty = beforeQty + quantityChanged;

    if (afterQty < 0) {
      throw new Error(`لا يمكن إتمام العملية لأن الكمية المطلوبة غير متوفرة في المخزون (المخزون الحالي: ${beforeQty}).`);
    }

    // Insert ledger transaction
    const result = await db.run(
      `INSERT INTO inventory_ledger (
        product_id, transaction_type, quantity_changed, before_quantity, after_quantity, user_id, shift_id, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?);`,
      [productId, transactionType, quantityChanged, beforeQty, afterQty, userId, shiftId, notes || null]
    );

    const ledgerId = result.lastID;

    // Log to Audit trail
    await writeAuditLog({
      userId,
      shiftId,
      actionType: 'STOCK_ADJUST',
      entityType: 'products',
      entityId: productId,
      beforeValues: { stock: beforeQty },
      afterValues: { stock: afterQty },
      notes: `تم تسوية المخزون للمنتج: ${product.name} (التعديل: ${quantityChanged}، المخزون بعد التعديل: ${afterQty})`
    });

    await db.run('COMMIT;');

    return {
      id: ledgerId,
      product_id: productId,
      product_name: product.name,
      product_sku: product.sku,
      transaction_type: transactionType,
      quantity_changed: quantityChanged,
      before_quantity: beforeQty,
      after_quantity: afterQty,
      notes: notes || null,
      created_at: new Date().toISOString()
    };
  } catch (err) {
    await db.run('ROLLBACK;');
    throw err;
  }
}

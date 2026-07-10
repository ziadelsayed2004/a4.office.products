const db = require('../../db');
const notificationsService = require('../notifications/notificationsService');


/**
 * Get the real-time stock level for a specific product.
 */
async function getRealTimeStock(productId) {
  const sql = `
    SELECT COALESCE(SUM(quantity), 0) as stock
    FROM inventory_transactions
    WHERE product_id = ?
  `;
  const result = await db.get(sql, [productId]);
  return result ? result.stock : 0;
}

/**
 * Get stock summaries for all active products.
 */
async function getStockSummary({ limit = 50, offset = 0, search = '' } = {}) {
  let sql = `
    SELECT p.id, p.title, p.code, p.category, p.status, p.stock_policy as stockPolicy,
           COALESCE(SUM(t.quantity), 0) as stock
    FROM products p
    LEFT JOIN inventory_transactions t ON t.product_id = p.id
    WHERE p.status = 'active'
  `;
  const params = [];

  if (search) {
    sql += ` AND (p.title LIKE ? OR p.code LIKE ?)`;
    const term = `%${search}%`;
    params.push(term, term);
  }

  sql += ` GROUP BY p.id ORDER BY p.title ASC LIMIT ? OFFSET ?`;
  params.push(limit, offset);

  return await db.all(sql, params);
}

/**
 * Create a transaction entry in the inventory ledger.
 */
async function createTransaction({ productId, transactionType, quantity, referenceType, referenceId, userId }) {
  if (!productId || !transactionType || quantity === undefined || !referenceType || referenceId === undefined) {
    throw new Error('Missing transaction details');
  }

  const sql = `
    INSERT INTO inventory_transactions (product_id, transaction_type, quantity, reference_type, reference_id, created_by)
    VALUES (?, ?, ?, ?, ?, ?)
  `;
  const result = await db.run(sql, [productId, transactionType, quantity, referenceType, referenceId, userId]);
  return { id: result.lastID, productId, transactionType, quantity, referenceType, referenceId, userId };
}

/**
 * Create a stock adjustment.
 */
async function createAdjustment({ reason, notes = '', items = [], userId }) {
  if (!reason) {
    throw new Error('Reason is required for stock adjustments');
  }
  if (!items || items.length === 0) {
    throw new Error('At least one item is required for stock adjustments');
  }

  // Verify all products exist
  for (const item of items) {
    const { productId, quantity } = item;
    if (!productId || quantity === undefined || isNaN(parseInt(quantity, 10))) {
      throw new Error('Invalid product or quantity details');
    }
    const product = await db.get('SELECT id FROM products WHERE id = ?', [productId]);
    if (!product) {
      throw new Error(`Product with ID ${productId} does not exist`);
    }
  }

  const adjustmentNumber = `ADJ-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

  // Save adjustment parent
  const parentSql = `
    INSERT INTO inventory_adjustments (adjustment_number, reason, notes, created_by)
    VALUES (?, ?, ?, ?)
  `;
  const parentResult = await db.run(parentSql, [adjustmentNumber, reason.trim(), notes.trim(), userId]);
  const adjustmentId = parentResult.lastID;

  // Save adjustment items and transaction ledger records
  for (const item of items) {
    const { productId, quantity } = item;
    const parsedQty = parseInt(quantity, 10);

    const itemSql = `
      INSERT INTO inventory_adjustment_items (adjustment_id, product_id, quantity)
      VALUES (?, ?, ?)
    `;
    await db.run(itemSql, [adjustmentId, productId, parsedQty]);

    // Insert transaction ledger record
    await createTransaction({
      productId,
      transactionType: 'adjustment',
      quantity: parsedQty,
      referenceType: 'adjustment',
      referenceId: adjustmentId,
      userId
    });
  }

  // Check stock notifications for each item
  for (const item of items) {
    try {
      await notificationsService.checkStockNotifications(item.productId);
    } catch (e) {
      console.error('Error running checkStockNotifications:', e);
    }
  }

  return {
    id: adjustmentId,
    adjustmentNumber,
    reason,
    notes,
    items
  };
}

/**
 * Retrieve all transactions.
 */
async function getTransactions({ limit = 50, offset = 0, productId = null, transactionType = '' } = {}) {
  let sql = `
    SELECT t.*, p.title as product_title, p.code as product_code, u.full_name as user_full_name
    FROM inventory_transactions t
    JOIN products p ON p.id = t.product_id
    LEFT JOIN users u ON u.id = t.created_by
    WHERE 1=1
  `;
  const params = [];

  if (productId) {
    sql += ` AND t.product_id = ?`;
    params.push(productId);
  }
  if (transactionType) {
    sql += ` AND t.transaction_type = ?`;
    params.push(transactionType);
  }

  sql += ` ORDER BY t.created_at DESC LIMIT ? OFFSET ?`;
  params.push(limit, offset);

  return await db.all(sql, params);
}

/**
 * Retrieve all stock adjustments.
 */
async function getAdjustments({ limit = 50, offset = 0 } = {}) {
  const sql = `
    SELECT a.*, u.full_name as user_full_name
    FROM inventory_adjustments a
    LEFT JOIN users u ON u.id = a.created_by
    ORDER BY a.created_at DESC
    LIMIT ? OFFSET ?
  `;
  return await db.all(sql, [limit, offset]);
}

/**
 * Retrieve adjustment details by ID.
 */
async function getAdjustmentDetails(id) {
  const adjustment = await db.get(`
    SELECT a.*, u.full_name as user_full_name
    FROM inventory_adjustments a
    LEFT JOIN users u ON u.id = a.created_by
    WHERE a.id = ?
  `, [id]);

  if (adjustment) {
    const items = await db.all(`
      SELECT ai.*, p.title as product_title, p.code as product_code
      FROM inventory_adjustment_items ai
      JOIN products p ON p.id = ai.product_id
      WHERE ai.adjustment_id = ?
    `, [id]);
    adjustment.items = items;
  }

  return adjustment;
}

/**
 * Create a new inventory receipt.
 */
async function createReceipt({ supplierName = '', receivedDate, notes = '', items = [], userId }) {
  if (!receivedDate) {
    throw new Error('Received date is required');
  }
  if (!items || items.length === 0) {
    throw new Error('At least one item is required for inventory receipts');
  }

  // Validate items
  for (const item of items) {
    const { productId, quantity, unitCost } = item;
    if (!productId || quantity === undefined || unitCost === undefined) {
      throw new Error('Product ID, quantity, and unit cost are required for all receipt items');
    }
    const qty = parseInt(quantity, 10);
    const cost = parseFloat(unitCost);
    if (isNaN(qty) || qty <= 0) {
      throw new Error('Quantity must be a positive integer');
    }
    if (isNaN(cost) || cost < 0) {
      throw new Error('Unit cost must be a positive number');
    }

    const product = await db.get('SELECT id FROM products WHERE id = ?', [productId]);
    if (!product) {
      throw new Error(`Product with ID ${productId} does not exist`);
    }
  }

  const receiptNumber = `REC-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

  // Save parent
  const parentSql = `
    INSERT INTO inventory_receipts (receipt_number, supplier_name, received_date, notes, created_by)
    VALUES (?, ?, ?, ?, ?)
  `;
  const parentResult = await db.run(parentSql, [
    receiptNumber,
    supplierName.trim() ? supplierName.trim() : null,
    receivedDate,
    notes.trim(),
    userId
  ]);
  const receiptId = parentResult.lastID;

  // Save items and transactions
  for (const item of items) {
    const { productId, quantity, unitCost } = item;
    const qty = parseInt(quantity, 10);
    const cost = parseFloat(unitCost);

    const itemSql = `
      INSERT INTO inventory_receipt_items (receipt_id, product_id, quantity, unit_cost)
      VALUES (?, ?, ?, ?)
    `;
    await db.run(itemSql, [receiptId, productId, qty, cost]);

    // Create positive ledger transaction record
    await createTransaction({
      productId,
      transactionType: 'receipt',
      quantity: qty,
      referenceType: 'receipt',
      referenceId: receiptId,
      userId
    });
  }

  // Check stock notifications for each item
  for (const item of items) {
    try {
      await notificationsService.checkStockNotifications(item.productId);
    } catch (e) {
      console.error('Error running checkStockNotifications:', e);
    }
  }

  return {
    id: receiptId,
    receiptNumber,
    supplierName,
    receivedDate,
    notes,
    items
  };
}

/**
 * Retrieve all inventory receipts.
 */
async function getReceipts({ limit = 50, offset = 0 } = {}) {
  const sql = `
    SELECT r.*, u.full_name as user_full_name
    FROM inventory_receipts r
    LEFT JOIN users u ON u.id = r.created_by
    ORDER BY r.received_date DESC, r.created_at DESC
    LIMIT ? OFFSET ?
  `;
  return await db.all(sql, [limit, offset]);
}

/**
 * Retrieve inventory receipt details and its items.
 */
async function getReceiptDetails(id) {
  const receipt = await db.get(`
    SELECT r.*, u.full_name as user_full_name
    FROM inventory_receipts r
    LEFT JOIN users u ON u.id = r.created_by
    WHERE r.id = ?
  `, [id]);

  if (receipt) {
    const items = await db.all(`
      SELECT ri.*, p.title as product_title, p.code as product_code
      FROM inventory_receipt_items ri
      JOIN products p ON p.id = ri.product_id
      WHERE ri.receipt_id = ?
    `, [id]);
    receipt.items = items;
  }

  return receipt;
}

module.exports = {
  getRealTimeStock,
  getStockSummary,
  createTransaction,
  createAdjustment,
  getTransactions,
  getAdjustments,
  getAdjustmentDetails,
  createReceipt,
  getReceipts,
  getReceiptDetails
};


import db from '../../db/index.js';
import { writeAuditLog } from '../../utils/auditLogger.js';
import { AppError } from '../../utils/errors.js';
import { requireInteger, withIdempotency } from '../../utils/financial.js';
import { addCalendarDay, cairoMidnightUtc } from '../invoices/invoices.service.js';

const TRANSACTION_TYPES = new Set([
  'STOCK_IN',
  'SALE',
  'PREORDER_PICKUP',
  'ADJUSTMENT_ADD',
  'ADJUSTMENT_SUB',
]);

export async function getProductStock(productId, connection = db) {
  const row = await connection.get(
    'SELECT after_quantity FROM inventory_ledger WHERE product_id = ? ORDER BY id DESC LIMIT 1;',
    [productId]
  );
  return row ? row.after_quantity : 0;
}

function pagination(filters) {
  const rawLimit = Number(filters.limit ?? 50);
  const rawOffset = Number(filters.offset ?? 0);
  return {
    limit: Number.isSafeInteger(rawLimit) ? Math.min(100, Math.max(1, rawLimit)) : 50,
    offset: Number.isSafeInteger(rawOffset) ? Math.max(0, rawOffset) : 0,
  };
}

function addLedgerFilters(sql, params, filters) {
  if (filters.productId) {
    sql.push('il.product_id = ?');
    params.push(requireInteger(Number(filters.productId), 'productId', { min: 1 }));
  }
  if (filters.transactionType) {
    if (!TRANSACTION_TYPES.has(filters.transactionType)) {
      throw new AppError(
        'Unknown inventory transaction type.',
        400,
        'INVALID_INVENTORY_TRANSACTION_TYPE'
      );
    }
    sql.push('il.transaction_type = ?');
    params.push(filters.transactionType);
  }
  if (filters.startDate) {
    sql.push('il.created_at >= ?');
    params.push(cairoMidnightUtc(filters.startDate));
  }
  if (filters.endDate) {
    sql.push('il.created_at < ?');
    params.push(cairoMidnightUtc(addCalendarDay(filters.endDate)));
  }
}

export async function getInventoryLedger(filters = {}, connection = db) {
  const page = pagination(filters);
  const clauses = ['1 = 1'];
  const params = [];
  addLedgerFilters(clauses, params, filters);
  const where = clauses.join(' AND ');
  const [ledger, count] = await Promise.all([
    connection.all(
      `SELECT il.*, p.name AS product_name, p.sku AS product_sku, u.name AS user_name
         FROM inventory_ledger il
         JOIN products p ON p.id = il.product_id
         JOIN users u ON u.id = il.user_id
        WHERE ${where}
        ORDER BY il.id DESC LIMIT ? OFFSET ?;`,
      [...params, page.limit, page.offset]
    ),
    connection.get(`SELECT COUNT(*) AS total FROM inventory_ledger il WHERE ${where};`, params),
  ]);
  return { ledger, total: count?.total || 0, pagination: page };
}

function normalizeAdjustment({ productId, adjustmentType, quantity, notes } = {}) {
  const id = requireInteger(Number(productId), 'productId', { min: 1 });
  const amount = requireInteger(Number(quantity), 'quantity', { min: 1 });
  const mapping = {
    STOCK_IN: ['STOCK_IN', amount],
    ADD: ['ADJUSTMENT_ADD', amount],
    ADJUSTMENT_ADD: ['ADJUSTMENT_ADD', amount],
    SUB: ['ADJUSTMENT_SUB', -amount],
    ADJUSTMENT_SUB: ['ADJUSTMENT_SUB', -amount],
  };
  const mapped = mapping[adjustmentType];
  if (!mapped) {
    throw new AppError(
      'Adjustment type must be STOCK_IN, ADD, or SUB.',
      400,
      'INVALID_STOCK_ADJUSTMENT'
    );
  }
  const cleanNotes = String(notes || '').trim();
  if (cleanNotes.length > 500)
    throw new AppError('Stock adjustment notes are too long.', 400, 'INVALID_STOCK_NOTES');
  return {
    productId: id,
    transactionType: mapped[0],
    quantityChanged: mapped[1],
    notes: cleanNotes || null,
  };
}

export async function adjustStock(input, userId, shiftId = null, idempotencyKey) {
  const adjustment = normalizeAdjustment(input);
  const payload = { ...adjustment, shiftId };
  return withIdempotency(
    { key: idempotencyKey, userId, operation: 'INVENTORY_ADJUSTMENT', payload },
    async (connection) => {
      const product = await connection.get('SELECT id, name, sku FROM products WHERE id = ?;', [
        adjustment.productId,
      ]);
      if (!product) throw new AppError('Product not found.', 404, 'PRODUCT_NOT_FOUND');
      const beforeQuantity = await getProductStock(adjustment.productId, connection);
      const afterQuantity = beforeQuantity + adjustment.quantityChanged;
      if (afterQuantity < 0) {
        throw new AppError(
          `Insufficient stock. Available quantity is ${beforeQuantity}.`,
          409,
          'INSUFFICIENT_STOCK'
        );
      }
      const result = await connection.run(
        `INSERT INTO inventory_ledger
         (product_id, transaction_type, quantity_changed, before_quantity, after_quantity,
          user_id, shift_id, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?);`,
        [
          adjustment.productId,
          adjustment.transactionType,
          adjustment.quantityChanged,
          beforeQuantity,
          afterQuantity,
          userId,
          shiftId,
          adjustment.notes,
        ]
      );
      await writeAuditLog({
        userId,
        shiftId,
        actionType: 'STOCK_ADJUST',
        entityType: 'products',
        entityId: adjustment.productId,
        beforeValues: { stock: beforeQuantity },
        afterValues: { stock: afterQuantity },
        notes: `Inventory adjusted for ${product.name}: ${adjustment.quantityChanged}`,
        connection,
      });
      const row = await connection.get('SELECT created_at FROM inventory_ledger WHERE id = ?;', [
        result.lastID,
      ]);
      return {
        statusCode: 200,
        data: {
          id: result.lastID,
          product_id: adjustment.productId,
          product_name: product.name,
          product_sku: product.sku,
          transaction_type: adjustment.transactionType,
          quantity_changed: adjustment.quantityChanged,
          before_quantity: beforeQuantity,
          after_quantity: afterQuantity,
          notes: adjustment.notes,
          created_at: row.created_at,
        },
      };
    }
  );
}

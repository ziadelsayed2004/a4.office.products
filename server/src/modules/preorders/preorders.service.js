import db, { withTransaction } from '../../db/index.js';
import { writeAuditLog } from '../../utils/auditLogger.js';
import {
  AppError,
  aggregateItems,
  generateSecureToken,
  nextPreorderNumbers,
  nextSaleNumbers,
  requireInteger,
  requirePiasters,
  saveSecureToken,
  withIdempotency,
} from '../../utils/financial.js';
import { insertPayments, validateSplitPayments } from '../payments/payments.service.js';
import { PRODUCT_POLICIES } from '../products/products.service.js';

const OPEN_STATUSES = ['DEPOSIT_PAID_WAITING_STOCK', 'READY_FOR_PICKUP'];
const TRANSITIONS = {
  DEPOSIT_PAID_WAITING_STOCK: new Set(['READY_FOR_PICKUP', 'CANCELLED', 'EXPIRED']),
  READY_FOR_PICKUP: new Set(['CANCELLED', 'EXPIRED']),
  PICKED_UP: new Set(),
  CANCELLED: new Set(),
  EXPIRED: new Set(),
};

async function requireOwnOpenShift(connection, userId) {
  const shift = await connection.get(
    "SELECT * FROM shifts WHERE user_id = ? AND status = 'OPEN' ORDER BY id DESC LIMIT 1;",
    [userId]
  );
  if (!shift)
    throw new AppError(
      'An open shift belonging to the acting user is required.',
      409,
      'OPEN_SHIFT_REQUIRED'
    );
  return shift;
}

async function findOrCreateCustomer(connection, name, phone, creator) {
  const cleanName = String(name || '').trim();
  const cleanPhone = String(phone || '').trim();
  if (!cleanName) throw new AppError('Customer name is required.', 400, 'CUSTOMER_NAME_REQUIRED');
  if (cleanPhone.length < 5)
    throw new AppError('A valid customer phone is required.', 400, 'CUSTOMER_PHONE_REQUIRED');
  let customer = await connection.get('SELECT * FROM customers WHERE name = ? AND phone = ?;', [
    cleanName,
    cleanPhone,
  ]);
  if (!customer) {
    const result = await connection.run('INSERT INTO customers (name, phone) VALUES (?, ?);', [
      cleanName,
      cleanPhone,
    ]);
    customer = { id: result.lastID, name: cleanName, phone: cleanPhone };
    await writeAuditLog({
      userId: creator.userId,
      shiftId: creator.shiftId,
      actionType: 'CUSTOMER_CREATE',
      entityType: 'customers',
      entityId: customer.id,
      afterValues: { name: customer.name, phone: customer.phone },
      notes: `Customer registered during preorder: ${customer.name}`,
      connection,
    });
  }
  return customer;
}

function preorderReceiptSnapshot({
  receiptId,
  receiptNumber,
  preorder,
  items,
  payments,
  cashierName,
  type,
}) {
  const pickup = type === 'preorder_pickup';
  return {
    version: 2,
    receiptId,
    receiptNumber,
    referenceType: type,
    preorderId: preorder.id,
    preorderNumber: preorder.preorder_number,
    invoiceId: preorder.pickup_order_id || null,
    invoiceNumber: preorder.invoice_number || null,
    status: preorder.status,
    cashierName,
    customerName: preorder.customer_name_snapshot,
    customerPhone: preorder.customer_phone_snapshot,
    subtotal: preorder.subtotal,
    discount: preorder.discount,
    total: preorder.total_amount,
    depositRequired: preorder.deposit_required,
    depositPaid: preorder.deposit_paid,
    remainingAmount: pickup ? 0 : preorder.remaining_amount,
    pickupAmount: pickup ? preorder.pickup_amount : 0,
    pickupMethod: preorder.pickup_method,
    qrToken: pickup ? preorder.invoice_qr_token : preorder.qr_pickup_token,
    items: items.map((item) => ({
      productId: item.product_id,
      productName: item.product_name_snapshot,
      productSku: item.sku_snapshot,
      priceTierName: item.price_tier_name_snapshot,
      availabilityPolicy: item.availability_policy_snapshot,
      depositPct: item.deposit_pct_snapshot,
      quantity: item.quantity,
      unitPrice: item.unit_price,
      totalPrice: item.total_price,
    })),
    payments: payments.map((payment) => ({
      method: payment.method,
      methodName: payment.methodSnapshot,
      stage: pickup ? 'PREORDER_PICKUP' : 'PREORDER_DEPOSIT',
      direction: 'IN',
      amount: payment.amount,
      cashReceived: payment.cashReceived,
      changeAmount: payment.changeAmount,
      referenceNumber: payment.referenceNumber,
      note: payment.note,
    })),
  };
}

export async function createPreorder(preorderData, cashierId, idempotencyKey) {
  const items = aggregateItems(preorderData.items);
  const discount = requirePiasters(preorderData.discount ?? 0, 'discount');
  const depositPaid = requirePiasters(
    preorderData.depositPaid ?? preorderData.deposit_paid ?? 0,
    'depositPaid'
  );
  const payload = {
    customerName: String(preorderData.customerName || '').trim(),
    customerPhone: String(preorderData.customerPhone || '').trim(),
    items,
    discount,
    depositPaid,
    pickupMethod: preorderData.pickupMethod || 'walk_in',
    expectedPickupDate: preorderData.expectedPickupDate || null,
    notes: preorderData.notes || null,
    payments: preorderData.payments,
  };
  return withIdempotency(
    { key: idempotencyKey, userId: cashierId, operation: 'PREORDER_CREATE', payload },
    async (connection) => {
      const shift = await requireOwnOpenShift(connection, cashierId);
      const customer = await findOrCreateCustomer(
        connection,
        payload.customerName,
        payload.customerPhone,
        { userId: cashierId, shiftId: shift.id }
      );
      let subtotal = 0;
      let minimumDeposit = 0;
      const detailedItems = [];
      for (const item of items) {
        const product = await connection.get(
          `SELECT p.*,
                  COALESCE((SELECT after_quantity FROM inventory_ledger il WHERE il.product_id = p.id ORDER BY il.id DESC LIMIT 1), 0) AS stock
             FROM products p WHERE p.id = ?;`,
          [item.product_id]
        );
        if (!product || product.is_active !== 1 || product.can_be_sold !== 1) {
          throw new AppError(
            `Product ${item.product_id} is unavailable.`,
            409,
            'PRODUCT_UNAVAILABLE'
          );
        }
        if (
          product.availability_policy !== PRODUCT_POLICIES.STOCK_WITH_PREORDER_WHEN_OUT_OF_STOCK
        ) {
          throw new AppError(
            `${product.name} is configured as stock-only.`,
            409,
            'PRODUCT_NOT_PREORDER_ENABLED'
          );
        }
        if (product.stock !== 0) {
          throw new AppError(
            `${product.name} can be preordered only when physical stock is exactly zero.`,
            409,
            'PREORDER_REQUIRES_ZERO_STOCK'
          );
        }
        const tier = await connection.get(
          `SELECT pp.price, pt.name FROM product_prices pp JOIN price_tiers pt ON pt.id = pp.price_tier_id
            WHERE pp.product_id = ? AND pp.price_tier_id = ? AND pt.is_active = 1;`,
          [item.product_id, item.price_tier_id]
        );
        if (!tier)
          throw new AppError(
            `Active tier price is missing for ${product.name}.`,
            409,
            'PRICE_NOT_FOUND'
          );
        const totalPrice = tier.price * item.quantity;
        subtotal += totalPrice;
        minimumDeposit += Math.round((totalPrice * product.default_preorder_deposit_pct) / 100);
        detailedItems.push({
          ...item,
          unit_price: tier.price,
          total_price: totalPrice,
          product_name_snapshot: product.name,
          sku_snapshot: product.sku,
          price_tier_name_snapshot: tier.name,
          availability_policy_snapshot: product.availability_policy,
          deposit_pct_snapshot: product.default_preorder_deposit_pct,
          preorder_instructions_snapshot: product.preorder_instructions,
        });
      }
      if (discount > subtotal)
        throw new AppError('Discount cannot exceed subtotal.', 400, 'DISCOUNT_EXCEEDS_SUBTOTAL');
      const total = subtotal - discount;
      if (discount > 0 && subtotal > 0)
        minimumDeposit = Math.round((minimumDeposit * total) / subtotal);
      if (depositPaid < minimumDeposit)
        throw new AppError(
          'Deposit is below the required product-policy minimum.',
          400,
          'DEPOSIT_BELOW_MINIMUM'
        );
      if (depositPaid > total)
        throw new AppError('Deposit cannot exceed preorder total.', 400, 'DEPOSIT_EXCEEDS_TOTAL');
      const normalizedPayments = await validateSplitPayments(
        preorderData.payments,
        depositPaid,
        connection
      );
      const { preorderNumber, receiptNumber } = await nextPreorderNumbers(connection);
      const pickupToken = generateSecureToken('preorder');
      const result = await connection.run(
        `INSERT INTO preorders
         (preorder_number, shift_id, cashier_id, customer_id, status, subtotal, discount,
          total_amount, deposit_required, deposit_paid, remaining_amount, pickup_method,
          expected_pickup_date, notes, qr_pickup_token, customer_name_snapshot,
          customer_phone_snapshot, preorder_instructions_snapshot)
         VALUES (?, ?, ?, ?, 'DEPOSIT_PAID_WAITING_STOCK', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
        [
          preorderNumber,
          shift.id,
          cashierId,
          customer.id,
          subtotal,
          discount,
          total,
          minimumDeposit,
          depositPaid,
          total - depositPaid,
          payload.pickupMethod,
          payload.expectedPickupDate,
          payload.notes,
          pickupToken,
          customer.name,
          customer.phone,
          detailedItems
            .map((item) => item.preorder_instructions_snapshot)
            .filter(Boolean)
            .join('\n') || null,
        ]
      );
      const preorderId = result.lastID;
      await saveSecureToken(connection, 'preorder', preorderId, pickupToken);
      await connection.run(
        "INSERT OR IGNORE INTO qr_tokens (token, type, reference_id) VALUES (?, 'preorder', ?);",
        [pickupToken, preorderId]
      );
      for (const item of detailedItems) {
        await connection.run(
          `INSERT INTO preorder_items
           (preorder_id, product_id, quantity, unit_price, price_tier_id, total_price,
            product_name_snapshot, sku_snapshot, price_tier_name_snapshot,
            availability_policy_snapshot, deposit_pct_snapshot)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
          [
            preorderId,
            item.product_id,
            item.quantity,
            item.unit_price,
            item.price_tier_id,
            item.total_price,
            item.product_name_snapshot,
            item.sku_snapshot,
            item.price_tier_name_snapshot,
            item.availability_policy_snapshot,
            item.deposit_pct_snapshot,
          ]
        );
        await connection.run(
          'UPDATE products SET open_preorder_quantity = open_preorder_quantity + ? WHERE id = ?;',
          [item.quantity, item.product_id]
        );
      }
      await insertPayments(
        connection,
        {
          shiftId: shift.id,
          cashierId,
          referenceType: 'preorder',
          referenceId: preorderId,
          stage: 'PREORDER_DEPOSIT',
        },
        normalizedPayments
      );
      const receipt = await connection.run(
        `INSERT INTO receipts (receipt_number, reference_type, reference_id, printed_by, print_count, qr_token)
         VALUES (?, 'preorder_deposit', ?, ?, 1, ?);`,
        [receiptNumber, preorderId, cashierId, pickupToken]
      );
      const cashier = await connection.get('SELECT name FROM users WHERE id = ?;', [cashierId]);
      const preorder = {
        id: preorderId,
        preorder_number: preorderNumber,
        status: 'DEPOSIT_PAID_WAITING_STOCK',
        customer_name_snapshot: customer.name,
        customer_phone_snapshot: customer.phone,
        subtotal,
        discount,
        total_amount: total,
        deposit_required: minimumDeposit,
        deposit_paid: depositPaid,
        remaining_amount: total - depositPaid,
        pickup_method: payload.pickupMethod,
        qr_pickup_token: pickupToken,
      };
      const snapshot = preorderReceiptSnapshot({
        receiptId: receipt.lastID,
        receiptNumber,
        preorder,
        items: detailedItems,
        payments: normalizedPayments,
        cashierName: cashier.name,
        type: 'preorder_deposit',
      });
      await connection.run('UPDATE receipts SET snapshot_json = ? WHERE id = ?;', [
        JSON.stringify(snapshot),
        receipt.lastID,
      ]);
      await writeAuditLog({
        userId: cashierId,
        shiftId: shift.id,
        actionType: 'PREORDER_CREATE',
        entityType: 'preorders',
        entityId: preorderId,
        afterValues: { preorderNumber, total, depositPaid, physicalStockChanged: false },
        connection,
      });
      return {
        statusCode: 201,
        data: {
          ...preorder,
          receipt_id: receipt.lastID,
          receipt_number: receiptNumber,
          customer_id: customer.id,
          customer_name: customer.name,
          customer_phone: customer.phone,
          qr_pickup_token: pickupToken,
          items: detailedItems,
        },
      };
    }
  );
}

export async function listPreordersForAdmin(filters = {}, connection = db) {
  let sql = `SELECT pr.*, pr.customer_name_snapshot AS customer_name,
                    pr.customer_phone_snapshot AS customer_phone, u.name AS cashier_name
               FROM preorders pr JOIN users u ON u.id = pr.cashier_id WHERE 1 = 1`;
  const params = [];
  if (filters.status) {
    sql += ' AND pr.status = ?';
    params.push(filters.status);
  }
  if (filters.q?.trim()) {
    const value = `%${filters.q.trim()}%`;
    sql +=
      ' AND (pr.preorder_number LIKE ? OR pr.customer_name_snapshot LIKE ? OR pr.customer_phone_snapshot LIKE ?)';
    params.push(value, value, value);
  }
  if (filters.cashierId) {
    sql += ' AND pr.cashier_id = ?';
    params.push(filters.cashierId);
  }
  sql += ' ORDER BY pr.created_at DESC;';
  const rows = await connection.all(sql, params);
  for (const preorder of rows) {
    preorder.items = await connection.all(
      `SELECT pi.*, pi.product_name_snapshot AS product_name, pi.sku_snapshot AS product_sku,
              p.availability_policy, p.open_preorder_quantity,
              COALESCE((SELECT after_quantity FROM inventory_ledger il WHERE il.product_id = p.id ORDER BY il.id DESC LIMIT 1), 0) AS stock_on_hand
         FROM preorder_items pi JOIN products p ON p.id = pi.product_id WHERE pi.preorder_id = ? ORDER BY pi.id;`,
      [preorder.id]
    );
  }
  return rows;
}

export async function searchPreordersForCashier(query, userId, connection = db) {
  const value = String(query || '').trim();
  if (!value) return [];
  return connection.all(
    `SELECT pr.id, pr.preorder_number, pr.status, pr.customer_name_snapshot AS customer_name,
            pr.customer_phone_snapshot AS customer_phone, pr.total_amount, pr.deposit_paid,
            pr.remaining_amount, pr.created_at
       FROM preorders pr
      WHERE pr.preorder_number = ? OR pr.customer_phone_snapshot = ?
      ORDER BY pr.created_at DESC LIMIT 20;`,
    [value, value]
  );
}

export async function updatePreorderStatus(preorderId, status, adminUserId) {
  const id = requireInteger(Number(preorderId), 'preorderId', { min: 1 });
  return withTransaction(async (connection) => {
    const preorder = await connection.get('SELECT * FROM preorders WHERE id = ?;', [id]);
    if (!preorder) throw new AppError('Preorder not found.', 404, 'PREORDER_NOT_FOUND');
    if (status === 'PICKED_UP')
      throw new AppError(
        'PICKED_UP is only allowed through the pickup workflow.',
        409,
        'PICKUP_WORKFLOW_REQUIRED'
      );
    if (!TRANSITIONS[preorder.status]?.has(status)) {
      throw new AppError(
        `Transition ${preorder.status} -> ${status} is not allowed.`,
        409,
        'INVALID_PREORDER_TRANSITION'
      );
    }
    await connection.run(
      'UPDATE preorders SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?;',
      [status, id]
    );
    if (OPEN_STATUSES.includes(preorder.status) && !OPEN_STATUSES.includes(status)) {
      const items = await connection.all(
        'SELECT product_id, quantity FROM preorder_items WHERE preorder_id = ?;',
        [id]
      );
      for (const item of items) {
        const update = await connection.run(
          `UPDATE products SET open_preorder_quantity = open_preorder_quantity - ?
            WHERE id = ? AND open_preorder_quantity >= ?;`,
          [item.quantity, item.product_id, item.quantity]
        );
        if (update.changes !== 1)
          throw new AppError(
            'Open preorder quantity is inconsistent.',
            409,
            'OPEN_PREORDER_QUANTITY_INCONSISTENT'
          );
      }
    }
    await writeAuditLog({
      userId: adminUserId,
      actionType: 'PREORDER_STATUS_UPDATE',
      entityType: 'preorders',
      entityId: id,
      beforeValues: { status: preorder.status },
      afterValues: { status },
      connection,
    });
    return { id, preorder_number: preorder.preorder_number, old_status: preorder.status, status };
  });
}

export async function getPreordersReport() {
  const rows = await listPreordersForAdmin();
  return {
    summary: {
      total_count: rows.length,
      total_amount: rows.reduce((sum, row) => sum + row.total_amount, 0),
      total_deposit_paid: rows.reduce((sum, row) => sum + row.deposit_paid, 0),
      total_remaining_amount: rows.reduce((sum, row) => sum + row.remaining_amount, 0),
    },
    preorders: rows,
  };
}

export async function scanPreorderToken(token, cashierId, connection = db) {
  const clean = String(token || '').trim();
  const mapping = await connection.get(
    "SELECT reference_id FROM secure_tokens WHERE token = ? AND token_type = 'preorder';",
    [clean]
  );
  if (!mapping)
    throw new AppError('Preorder QR token is invalid.', 404, 'PREORDER_TOKEN_NOT_FOUND');
  const preorder = await connection.get(
    `SELECT pr.*, pr.customer_name_snapshot AS customer_name, pr.customer_phone_snapshot AS customer_phone
       FROM preorders pr WHERE pr.id = ?;`,
    [mapping.reference_id]
  );
  if (!preorder) throw new AppError('Preorder not found.', 404, 'PREORDER_NOT_FOUND');
  const items = await connection.all(
    `SELECT pi.*, pi.product_name_snapshot AS product_name, pi.sku_snapshot AS product_sku,
            COALESCE((SELECT after_quantity FROM inventory_ledger il WHERE il.product_id = pi.product_id ORDER BY il.id DESC LIMIT 1), 0) AS stock
       FROM preorder_items pi WHERE pi.preorder_id = ? ORDER BY pi.id;`,
    [preorder.id]
  );
  return { preorder, items };
}

export async function pickupPreorder(preorderId, pickupData, cashierId, idempotencyKey) {
  const id = requireInteger(Number(preorderId), 'preorderId', { min: 1 });
  const payload = { preorderId: id, payments: pickupData.payments };
  return withIdempotency(
    { key: idempotencyKey, userId: cashierId, operation: 'PREORDER_PICKUP', payload },
    async (connection) => {
      const shift = await requireOwnOpenShift(connection, cashierId);
      const preorder = await connection.get('SELECT * FROM preorders WHERE id = ?;', [id]);
      if (!preorder) throw new AppError('Preorder not found.', 404, 'PREORDER_NOT_FOUND');
      if (preorder.status !== 'READY_FOR_PICKUP') {
        throw new AppError(
          'Only a READY_FOR_PICKUP preorder can be picked up.',
          409,
          'PREORDER_NOT_READY'
        );
      }
      const items = await connection.all(
        'SELECT * FROM preorder_items WHERE preorder_id = ? ORDER BY id;',
        [id]
      );
      for (const item of items) {
        const stock = await connection.get(
          'SELECT after_quantity FROM inventory_ledger WHERE product_id = ? ORDER BY id DESC LIMIT 1;',
          [item.product_id]
        );
        item.stock = stock?.after_quantity || 0;
        if (item.stock < item.quantity) {
          throw new AppError(
            `Insufficient stock for ${item.product_name_snapshot}.`,
            409,
            'INSUFFICIENT_PICKUP_STOCK'
          );
        }
      }
      const normalizedPayments = await validateSplitPayments(
        pickupData.payments,
        preorder.remaining_amount,
        connection
      );
      const { invoiceNumber, receiptNumber } = await nextSaleNumbers(connection);
      const orderResult = await connection.run(
        `INSERT INTO orders
         (invoice_number, shift_id, cashier_id, customer_id, subtotal, discount, total,
          origin, status, preorder_id, customer_name_snapshot, customer_phone_snapshot)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'PREORDER_PICKUP', 'COMPLETED', ?, ?, ?);`,
        [
          invoiceNumber,
          shift.id,
          cashierId,
          preorder.customer_id,
          preorder.subtotal,
          preorder.discount,
          preorder.total_amount,
          id,
          preorder.customer_name_snapshot,
          preorder.customer_phone_snapshot,
        ]
      );
      const invoiceToken = await saveSecureToken(connection, 'invoice', orderResult.lastID);
      await connection.run('UPDATE orders SET qr_token = ? WHERE id = ?;', [
        invoiceToken,
        orderResult.lastID,
      ]);
      for (const item of items) {
        await connection.run(
          `INSERT INTO order_items
           (order_id, product_id, quantity, unit_price, price_tier_id, total_price,
            product_name_snapshot, sku_snapshot, price_tier_name_snapshot, availability_policy_snapshot)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
          [
            orderResult.lastID,
            item.product_id,
            item.quantity,
            item.unit_price,
            item.price_tier_id,
            item.total_price,
            item.product_name_snapshot,
            item.sku_snapshot,
            item.price_tier_name_snapshot,
            item.availability_policy_snapshot,
          ]
        );
        await connection.run(
          `INSERT INTO inventory_ledger
           (product_id, transaction_type, quantity_changed, before_quantity, after_quantity,
            reference_type, reference_id, user_id, shift_id, notes)
           VALUES (?, 'PREORDER_PICKUP', ?, ?, ?, 'order', ?, ?, ?, ?);`,
          [
            item.product_id,
            -item.quantity,
            item.stock,
            item.stock - item.quantity,
            orderResult.lastID,
            cashierId,
            shift.id,
            `Pickup ${preorder.preorder_number}`,
          ]
        );
        const decrement = await connection.run(
          `UPDATE products SET open_preorder_quantity = open_preorder_quantity - ?
            WHERE id = ? AND open_preorder_quantity >= ?;`,
          [item.quantity, item.product_id, item.quantity]
        );
        if (decrement.changes !== 1)
          throw new AppError(
            'Open preorder quantity is inconsistent.',
            409,
            'OPEN_PREORDER_QUANTITY_INCONSISTENT'
          );
      }
      await insertPayments(
        connection,
        {
          shiftId: shift.id,
          cashierId,
          referenceType: 'order',
          referenceId: orderResult.lastID,
          stage: 'PREORDER_PICKUP',
        },
        normalizedPayments
      );
      const transition = await connection.run(
        `UPDATE preorders SET status = 'PICKED_UP', remaining_amount = 0, pickup_order_id = ?,
         pickup_shift_id = ?, pickup_cashier_id = ?, pickup_amount = ?, picked_up_at = CURRENT_TIMESTAMP,
         updated_at = CURRENT_TIMESTAMP WHERE id = ? AND status = 'READY_FOR_PICKUP';`,
        [orderResult.lastID, shift.id, cashierId, preorder.remaining_amount, id]
      );
      if (transition.changes !== 1)
        throw new AppError(
          'Preorder was already changed by another request.',
          409,
          'PREORDER_STATE_CONFLICT'
        );
      const receipt = await connection.run(
        `INSERT INTO receipts (receipt_number, reference_type, reference_id, printed_by, print_count, qr_token)
         VALUES (?, 'preorder_pickup', ?, ?, 1, ?);`,
        [receiptNumber, id, cashierId, invoiceToken]
      );
      const cashier = await connection.get('SELECT name FROM users WHERE id = ?;', [cashierId]);
      const snapshotPreorder = {
        ...preorder,
        status: 'PICKED_UP',
        pickup_order_id: orderResult.lastID,
        pickup_amount: preorder.remaining_amount,
        invoice_number: invoiceNumber,
        invoice_qr_token: invoiceToken,
      };
      const snapshot = preorderReceiptSnapshot({
        receiptId: receipt.lastID,
        receiptNumber,
        preorder: snapshotPreorder,
        items,
        payments: normalizedPayments,
        cashierName: cashier.name,
        type: 'preorder_pickup',
      });
      await connection.run('UPDATE receipts SET snapshot_json = ? WHERE id = ?;', [
        JSON.stringify(snapshot),
        receipt.lastID,
      ]);
      await writeAuditLog({
        userId: cashierId,
        shiftId: shift.id,
        actionType: 'PREORDER_PICKUP',
        entityType: 'preorders',
        entityId: id,
        afterValues: {
          orderId: orderResult.lastID,
          invoiceNumber,
          pickupAmount: preorder.remaining_amount,
        },
        connection,
      });
      return {
        statusCode: 200,
        data: {
          preorder_id: id,
          order_id: orderResult.lastID,
          invoice_number: invoiceNumber,
          invoice_qr_token: invoiceToken,
          receipt_id: receipt.lastID,
          receipt_number: receiptNumber,
          pickup_amount: preorder.remaining_amount,
        },
      };
    }
  );
}

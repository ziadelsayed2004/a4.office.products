import db from '../../db/index.js';
import { writeAuditLog } from '../../utils/auditLogger.js';
import crypto from 'crypto';

/**
 * Creates a new preorder reservation with deposit payment.
 */
export async function createPreorder(preorderData, cashierId) {
  const {
    customerName,
    customerPhone,
    items,
    discount,
    depositPaid,
    pickupMethod = 'walk_in',
    payments
  } = preorderData;

  // 1. Mandatory customer details check
  if (!customerName || !customerName.trim()) {
    throw new Error('اسم العميل إلزامي لعمل الحجز المسبق.');
  }
  if (!customerPhone || !customerPhone.trim()) {
    throw new Error('رقم هاتف العميل إلزامي لعمل الحجز المسبق.');
  }

  // 2. Active open shift validation
  const activeShift = await db.get(
    "SELECT id FROM shifts WHERE user_id = ? AND status = 'OPEN';",
    [cashierId]
  );
  if (!activeShift) {
    throw new Error('لا يوجد شيفت مفتوح حالياً لتسجيل هذا الحجز. يرجى فتح شيفت أولاً.');
  }
  const shiftId = activeShift.id;

  if (!items || items.length === 0) {
    throw new Error('يجب إدخال صنف واحد على الأقل في الحجز.');
  }

  const parsedDiscount = parseInt(discount, 10) || 0;
  const parsedDepositPaid = parseInt(depositPaid, 10) || 0;

  if (parsedDepositPaid <= 0) {
    throw new Error('مبلغ العربون المدفوع يجب أن يكون أكبر من صفر.');
  }

  await db.run('BEGIN TRANSACTION;');
  try {
    // 3. Find or register customer directly to avoid nested transactions
    const trimmedName = customerName.trim();
    const trimmedPhone = customerPhone.trim();
    
    let customer = await db.get(
      'SELECT * FROM customers WHERE name = ? AND phone = ?;',
      [trimmedName, trimmedPhone]
    );

    if (!customer) {
      if (trimmedPhone.length < 5) {
        throw new Error('رقم الهاتف غير صالح.');
      }
      const customerResult = await db.run(
        `INSERT INTO customers (name, phone, created_at, updated_at)
         VALUES (?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);`,
        [trimmedName, trimmedPhone]
      );
      customer = {
        id: customerResult.lastID,
        name: trimmedName,
        phone: trimmedPhone
      };

      await writeAuditLog({
        userId: cashierId,
        actionType: 'CUSTOMER_CREATE',
        entityType: 'customers',
        entityId: customer.id,
        notes: `تم تسجيل عميل جديد أثناء الحجز: ${trimmedName} (هاتف: ${trimmedPhone})`
      });
    }

    // 4. Validate items and calculate required deposits
    let subtotal = 0;
    let totalDepositRequired = 0;
    const itemsWithPrices = [];

    for (const item of items) {
      const product = await db.get(
        `SELECT p.*,
                COALESCE((SELECT price FROM product_prices WHERE product_id = p.id AND price_tier_id = ?), 0) AS tier_price
         FROM products p
         WHERE p.id = ?;`,
        [item.price_tier_id, item.product_id]
      );

      if (!product) {
        throw new Error(`المنتج ذو المعرف (${item.product_id}) غير موجود.`);
      }
      if (product.is_active !== 1 || product.can_be_preordered !== 1) {
        throw new Error(`المنتج (${product.name}) غير متاح للحجز المسبق.`);
      }

      const unitPrice = product.tier_price;
      const totalPrice = unitPrice * item.quantity;
      subtotal += totalPrice;

      const depositPct = product.default_preorder_deposit_pct || 50;
      const itemDepositRequired = Math.round(totalPrice * (depositPct / 100));
      totalDepositRequired += itemDepositRequired;

      itemsWithPrices.push({
        product_id: item.product_id,
        quantity: item.quantity,
        price_tier_id: item.price_tier_id,
        unit_price: unitPrice,
        total_price: totalPrice
      });
    }

    const totalAmount = Math.max(0, subtotal - parsedDiscount);

    // Scale minimum deposit required by discount proportion if applicable
    if (subtotal > 0 && parsedDiscount > 0) {
      totalDepositRequired = Math.round(totalDepositRequired * (totalAmount / subtotal));
    }

    // Enforce minimum deposit paid limit
    if (parsedDepositPaid < totalDepositRequired) {
      throw new Error(
        `مبلغ العربون المدفوع (${(parsedDepositPaid / 100).toFixed(2)} ج.م) أقل من الحد الأدنى المطلوب وهو (${(totalDepositRequired / 100).toFixed(2)} ج.م).`
      );
    }

    // 5. Generate preorder number: PR-YYYYMMDD-Sequence
    const date = new Date();
    const cairoDateStr = date.toLocaleDateString('en-US', { timeZone: 'Africa/Cairo' });
    const [month, day, year] = cairoDateStr.split('/');
    const formattedDate = `${year}${month.padStart(2, '0')}${day.padStart(2, '0')}`;

    const countRow = await db.get(
      "SELECT COUNT(*) as count FROM preorders WHERE created_at >= date('now', 'start of day');"
    );
    const sequence = (countRow.count + 1).toString().padStart(4, '0');
    const preorderNumber = `PR-${formattedDate}-${sequence}`;

    // 6. Generate secure pickup token
    const qrPickupToken = `pre_${crypto.randomBytes(16).toString('hex')}`;

    // 7. Insert preorder record
    const preorderResult = await db.run(
      `INSERT INTO preorders (
        preorder_number, shift_id, cashier_id, customer_id, status, subtotal, discount, total_amount,
        deposit_required, deposit_paid, remaining_amount, pickup_method, qr_pickup_token, created_at, updated_at
      ) VALUES (?, ?, ?, ?, 'DEPOSIT_PAID_WAITING_STOCK', ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);`,
      [
        preorderNumber,
        shiftId,
        cashierId,
        customer.id,
        subtotal,
        parsedDiscount,
        totalAmount,
        totalDepositRequired,
        parsedDepositPaid,
        totalAmount - parsedDepositPaid,
        pickupMethod,
        qrPickupToken
      ]
    );
    const preorderId = preorderResult.lastID;

    // 8. Register secure QR token mapping
    await db.run(
      `INSERT INTO qr_tokens (token, type, reference_id, created_at)
       VALUES (?, 'preorder', ?, CURRENT_TIMESTAMP);`,
      [qrPickupToken, preorderId]
    );

    // 9. Insert preorder items (does not decrement stock!)
    for (const d of itemsWithPrices) {
      await db.run(
        `INSERT INTO preorder_items (preorder_id, product_id, quantity, unit_price, price_tier_id, total_price, created_at)
         VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP);`,
        [preorderId, d.product_id, d.quantity, d.unit_price, d.price_tier_id, d.total_price]
      );
    }

    // 10. Insert split payments
    for (const p of payments) {
      await db.run(
        `INSERT INTO payments (shift_id, cashier_id, reference_type, reference_id, payment_method, amount, created_at)
         VALUES (?, ?, 'preorder', ?, ?, ?, CURRENT_TIMESTAMP);`,
        [shiftId, cashierId, preorderId, p.method, p.amount]
      );
    }

    // 11. Create corresponding receipt record directly to avoid nested transactions
    const recCountRow = await db.get(
      "SELECT COUNT(*) as count FROM receipts WHERE created_at >= date('now', 'start of day');"
    );
    const recSequence = (recCountRow.count + 1).toString().padStart(4, '0');
    const receiptNumber = `REC-${formattedDate}-${recSequence}`;

    const receiptResult = await db.run(
      `INSERT INTO receipts (receipt_number, reference_type, reference_id, printed_by, print_count, last_printed_at, created_at)
       VALUES (?, 'preorder_deposit', ?, ?, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);`,
      [receiptNumber, preorderId, cashierId]
    );
    const receiptId = receiptResult.lastID;

    // 12. Write Audit Log
    await writeAuditLog({
      userId: cashierId,
      actionType: 'PREORDER_CREATE',
      entityType: 'preorders',
      entityId: preorderId,
      notes: `تسجيل حجز مسبق جديد رقم ${preorderNumber} بقيمة ${(totalAmount / 100).toFixed(2)} ج.م (عربون: ${(parsedDepositPaid / 100).toFixed(2)} ج.م) للعميل ${customer.name}`
    });

    await db.run('COMMIT;');

    return {
      id: preorderId,
      preorder_number: preorderNumber,
      receipt_id: receiptId,
      receipt_number: receiptNumber,
      customer_id: customer.id,
      customer_name: customer.name,
      customer_phone: customer.phone,
      subtotal,
      discount: parsedDiscount,
      total_amount: totalAmount,
      deposit_required: totalDepositRequired,
      deposit_paid: parsedDepositPaid,
      remaining_amount: totalAmount - parsedDepositPaid,
      qr_pickup_token: qrPickupToken,
      items: itemsWithPrices
    };

  } catch (err) {
    await db.run('ROLLBACK;');
    throw err;
  }
}

/**
 * Lists preorders for admin tracking with optional filters.
 */
export async function listPreordersForAdmin(filters = {}) {
  let query = `
    SELECT pr.*, c.name AS customer_name, c.phone AS customer_phone, u.name AS cashier_name
    FROM preorders pr
    JOIN customers c ON pr.customer_id = c.id
    JOIN users u ON pr.cashier_id = u.id
    WHERE 1=1
  `;
  const params = [];

  if (filters.status) {
    query += ' AND pr.status = ?';
    params.push(filters.status);
  }

  if (filters.q && filters.q.trim().length > 0) {
    const searchVal = `%${filters.q.trim()}%`;
    query += ' AND (pr.preorder_number LIKE ? OR c.name LIKE ? OR c.phone LIKE ?)';
    params.push(searchVal, searchVal, searchVal);
  }

  query += ' ORDER BY pr.created_at DESC;';

  const preorders = await db.all(query, params);

  // Load items list for each preorder
  for (const preorder of preorders) {
    const items = await db.all(
      `SELECT pi.*, p.name AS product_name, p.sku AS product_sku
       FROM preorder_items pi
       JOIN products p ON pi.product_id = p.id
       WHERE pi.preorder_id = ?;`,
      [preorder.id]
    );
    preorder.items = items;
  }

  return preorders;
}

/**
 * Manually updates preorder status.
 */
export async function updatePreorderStatus(preorderId, status, adminUserId) {
  const allowedStatuses = ['DEPOSIT_PAID_WAITING_STOCK', 'READY_FOR_PICKUP', 'PICKED_UP', 'CANCELLED', 'EXPIRED'];
  if (!allowedStatuses.includes(status)) {
    throw new Error('حالة الحجز غير صالحة.');
  }

  const preorder = await db.get(
    'SELECT preorder_number, status FROM preorders WHERE id = ?;',
    [preorderId]
  );
  if (!preorder) {
    throw new Error('طلب الحجز المطلوب غير موجود.');
  }

  const oldStatus = preorder.status;

  await db.run('BEGIN TRANSACTION;');
  try {
    await db.run(
      'UPDATE preorders SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?;',
      [status, preorderId]
    );

    await writeAuditLog({
      userId: adminUserId,
      actionType: 'PREORDER_STATUS_UPDATE',
      entityType: 'preorders',
      entityId: preorderId,
      notes: `تم تعديل حالة الحجز رقم ${preorder.preorder_number} من ${oldStatus} إلى ${status}`
    });

    await db.run('COMMIT;');

    return {
      id: preorderId,
      preorder_number: preorder.preorder_number,
      old_status: oldStatus,
      status
    };
  } catch (err) {
    await db.run('ROLLBACK;');
    throw err;
  }
}

/**
 * Returns summary reporting metrics of preorder transactions.
 */
export async function getPreordersReport() {
  const summary = await db.get(`
    SELECT
      COUNT(*) AS total_count,
      COALESCE(SUM(total_amount), 0) AS total_amount,
      COALESCE(SUM(deposit_paid), 0) AS total_deposit_paid,
      COALESCE(SUM(remaining_amount), 0) AS total_remaining_amount
    FROM preorders;
  `);

  const breakdownRows = await db.all(`
    SELECT status, COUNT(*) AS count, COALESCE(SUM(total_amount), 0) AS total_amount
    FROM preorders
    GROUP BY status;
  `);

  const preordersList = await listPreordersForAdmin();

  return {
    summary: {
      total_count: summary.total_count,
      total_amount: summary.total_amount,
      total_deposit_paid: summary.total_deposit_paid,
      total_remaining_amount: summary.total_remaining_amount
    },
    breakdown: breakdownRows,
    preorders: preordersList
  };
}

/**
 * Scans a preorder QR token and returns the preorder and its items details.
 */
export async function scanPreorderToken(token, cashierId) {
  // 1. Validate open shift
  const activeShift = await db.get(
    "SELECT id FROM shifts WHERE user_id = ? AND status = 'OPEN';",
    [cashierId]
  );
  if (!activeShift) {
    throw new Error('لا يوجد شيفت مفتوح حالياً لتسجيل عمليات الاستلام. يرجى فتح شيفت أولاً.');
  }

  // 2. Lookup qr token
  const qrRow = await db.get(
    "SELECT * FROM qr_tokens WHERE token = ? AND type = 'preorder';",
    [token]
  );
  if (!qrRow) {
    throw new Error('رمز الاستلام الممسوح غير صحيح أو غير مسجل بالنظام.');
  }

  const preorderId = qrRow.reference_id;

  // 3. Fetch preorder and customer details
  const preorder = await db.get(
    `SELECT p.*, c.name AS customer_name, c.phone AS customer_phone
     FROM preorders p
     JOIN customers c ON p.customer_id = c.id
     WHERE p.id = ?;`,
    [preorderId]
  );

  if (!preorder) {
    throw new Error('لم يتم العثور على الحجز المرتبط بالرمز.');
  }

  // 4. Fetch preorder items
  const items = await db.all(
    `SELECT pi.*, p.name AS product_name, p.sku AS product_sku
     FROM preorder_items pi
     JOIN products p ON pi.product_id = p.id
     WHERE pi.preorder_id = ?;`,
    [preorderId]
  );

  return {
    preorder,
    items
  };
}

/**
 * Finalizes a preorder pickup checkout:
 * - Collects the remaining payment.
 * - Decrements product inventory stock.
 * - Converts the preorder to a completed sale invoice (orders record).
 * - Generates final receipt.
 */
export async function pickupPreorder(preorderId, pickupData, cashierId) {
  const { payments } = pickupData;

  // 1. Validate active open shift
  const activeShift = await db.get(
    "SELECT id FROM shifts WHERE user_id = ? AND status = 'OPEN' ORDER BY id DESC LIMIT 1;",
    [cashierId]
  );
  if (!activeShift) {
    throw new Error('لا يوجد شيفت مفتوح حالياً لتسجيل عمليات الاستلام. يرجى فتح شيفت أولاً.');
  }
  const shiftId = activeShift.id;

  // 2. Preorder Lookup and validation
  const preorder = await db.get(
    "SELECT * FROM preorders WHERE id = ?;",
    [preorderId]
  );
  if (!preorder) {
    throw new Error('طلب الحجز المطلوب غير موجود.');
  }
  if (preorder.status === 'PICKED_UP') {
    throw new Error('تم استلام هذا الحجز مسبقاً.');
  }
  if (preorder.status === 'CANCELLED') {
    throw new Error('هذا الحجز ملغي ولا يمكن تسليمه.');
  }

  // 3. Verify stock availability
  const items = await db.all(
    `SELECT pi.*, p.name AS product_name,
            COALESCE((SELECT after_quantity FROM inventory_ledger WHERE product_id = p.id ORDER BY id DESC LIMIT 1), 0) AS stock
     FROM preorder_items pi
     JOIN products p ON pi.product_id = p.id
     WHERE pi.preorder_id = ?;`,
    [preorderId]
  );

  for (const item of items) {
    if (item.stock < item.quantity) {
      throw new Error(
        `المخزون غير كافٍ لتسليم المنتج (${item.product_name}). المتاح حالياً: ${item.stock}، المطلوب: ${item.quantity}.`
      );
    }
  }

  // 4. Validate remaining payment total
  const remaining = preorder.remaining_amount;
  let paymentsSum = 0;
  if (payments && payments.length > 0) {
    paymentsSum = payments.reduce((acc, curr) => acc + (parseInt(curr.amount, 10) || 0), 0);
  }

  if (paymentsSum !== remaining) {
    throw new Error(
      `إجمالي مبالغ الدفع (${(paymentsSum / 100).toFixed(2)} ج.م) يجب أن يساوي تماماً المبلغ المتبقي وهو (${(remaining / 100).toFixed(2)} ج.م).`
    );
  }

  await db.run('BEGIN TRANSACTION;');
  try {
    // 5. Create final sales order (invoice)
    const date = new Date();
    const cairoDateStr = date.toLocaleDateString('en-US', { timeZone: 'Africa/Cairo' });
    const [month, day, year] = cairoDateStr.split('/');
    const formattedDate = `${year}${month.padStart(2, '0')}${day.padStart(2, '0')}`;

    const countRow = await db.get(
      "SELECT COUNT(*) as count FROM orders WHERE created_at >= date('now', 'start of day');"
    );
    const sequence = (countRow.count + 1).toString().padStart(4, '0');
    const invoiceNumber = `INV-${formattedDate}-${sequence}`;

    const orderResult = await db.run(
      `INSERT INTO orders (invoice_number, shift_id, cashier_id, customer_id, subtotal, discount, total, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP);`,
      [invoiceNumber, shiftId, cashierId, preorder.customer_id, preorder.subtotal, preorder.discount, preorder.total_amount]
    );
    const orderId = orderResult.lastID;

    // 6. Insert order items and decrement stock
    for (const item of items) {
      await db.run(
        `INSERT INTO order_items (order_id, product_id, quantity, unit_price, price_tier_id, total_price, created_at)
         VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP);`,
        [orderId, item.product_id, item.quantity, item.unit_price, item.price_tier_id, item.total_price]
      );

      const beforeQty = item.stock;
      const afterQty = beforeQty - item.quantity;

      await db.run(
        `INSERT INTO inventory_ledger (product_id, transaction_type, quantity_changed, before_quantity, after_quantity, user_id, shift_id, reference_type, reference_id, notes, created_at)
         VALUES (?, 'SALE', ?, ?, ?, ?, ?, 'order', ?, ?, CURRENT_TIMESTAMP);`,
        [
          item.product_id,
          -item.quantity,
          beforeQty,
          afterQty,
          cashierId,
          shiftId,
          orderId,
          `استلام حجز مسبق رقم ${preorder.preorder_number}`
        ]
      );
    }

    // 7. Insert the final pickup payment
    if (payments && payments.length > 0) {
      for (const p of payments) {
        await db.run(
          `INSERT INTO payments (shift_id, cashier_id, reference_type, reference_id, payment_method, amount, created_at)
           VALUES (?, ?, 'order', ?, ?, ?, CURRENT_TIMESTAMP);`,
          [shiftId, cashierId, orderId, p.method, p.amount]
        );
      }
    }

    // 8. Copy original preorder deposit payments to the order
    const depositPayments = await db.all(
      "SELECT * FROM payments WHERE reference_type = 'preorder' AND reference_id = ?;",
      [preorderId]
    );
    for (const dp of depositPayments) {
      await db.run(
        `INSERT INTO payments (shift_id, cashier_id, reference_type, reference_id, payment_method, amount, created_at)
         VALUES (?, ?, 'order', ?, ?, ?, ?);`,
        [dp.shift_id, dp.cashier_id, orderId, dp.payment_method, dp.amount, dp.created_at]
      );
    }

    // 9. Update preorder status
    await db.run(
      `UPDATE preorders
       SET status = 'PICKED_UP',
           deposit_paid = deposit_paid + ?,
           remaining_amount = 0,
           pickup_order_id = ?,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ?;`,
      [remaining, orderId, preorderId]
    );

    // 10. Generate final pickup receipt
    const recCountRow = await db.get(
      "SELECT COUNT(*) as count FROM receipts WHERE created_at >= date('now', 'start of day');"
    );
    const recSequence = (recCountRow.count + 1).toString().padStart(4, '0');
    const receiptNumber = `REC-${formattedDate}-${recSequence}`;

    const receiptResult = await db.run(
      `INSERT INTO receipts (receipt_number, reference_type, reference_id, printed_by, print_count, last_printed_at, created_at)
       VALUES (?, 'preorder_pickup', ?, ?, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);`,
      [receiptNumber, preorderId, cashierId]
    );
    const receiptId = receiptResult.lastID;

    // 11. Write Audit Log
    await writeAuditLog({
      userId: cashierId,
      actionType: 'PREORDER_PICKUP',
      entityType: 'preorders',
      entityId: preorderId,
      notes: `تم تسليم الحجز المسبق رقم ${preorder.preorder_number} بنجاح. الفاتورة المرتبطة: ${invoiceNumber}`
    });

    await db.run('COMMIT;');

    return {
      preorder_id: preorderId,
      order_id: orderId,
      invoice_number: invoiceNumber,
      receipt_id: receiptId,
      receipt_number: receiptNumber
    };

  } catch (err) {
    await db.run('ROLLBACK;');
    throw err;
  }
}

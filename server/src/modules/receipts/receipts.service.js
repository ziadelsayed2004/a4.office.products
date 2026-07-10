import db from '../../db/index.js';
import { writeAuditLog } from '../../utils/auditLogger.js';

/**
 * Creates a receipt record for a given transaction.
 */
export async function createReceipt({ referenceType, referenceId, printedBy }) {
  const date = new Date();
  const cairoDateStr = date.toLocaleDateString('en-US', { timeZone: 'Africa/Cairo' });
  const [month, day, year] = cairoDateStr.split('/');
  const formattedDate = `${year}${month.padStart(2, '0')}${day.padStart(2, '0')}`;

  await db.run('BEGIN TRANSACTION;');
  try {
    const countRow = await db.get(
      "SELECT COUNT(*) as count FROM receipts WHERE created_at >= date('now', 'start of day');"
    );
    const sequence = (countRow.count + 1).toString().padStart(4, '0');
    const receiptNumber = `REC-${formattedDate}-${sequence}`;

    const result = await db.run(
      `INSERT INTO receipts (receipt_number, reference_type, reference_id, printed_by, print_count, last_printed_at, created_at)
       VALUES (?, ?, ?, ?, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);`,
      [receiptNumber, referenceType, referenceId, printedBy]
    );

    await db.run('COMMIT;');
    return {
      id: result.lastID,
      receipt_number: receiptNumber
    };
  } catch (err) {
    await db.run('ROLLBACK;');
    throw err;
  }
}

/**
 * Gets full printable details of a receipt (for thermal template display).
 */
export async function getReceiptDetails(receiptIdOrNumber) {
  const queryParam = receiptIdOrNumber.toString();
  
  // Look up receipt
  const receipt = await db.get(
    `SELECT r.*, u.name AS printed_by_name, u.username AS printed_by_username
     FROM receipts r
     JOIN users u ON r.printed_by = u.id
     WHERE r.id = ? OR r.receipt_number = ?;`,
    [queryParam, queryParam]
  );

  if (!receipt) {
    throw new Error('إيصال الطباعة المطلوب غير موجود في النظام.');
  }

  const details = {
    id: receipt.id,
    receipt_number: receipt.receipt_number,
    reference_type: receipt.reference_type,
    reference_id: receipt.reference_id,
    print_count: receipt.print_count,
    last_printed_at: receipt.last_printed_at,
    created_at: receipt.created_at,
    printed_by_name: receipt.printed_by_name,
    printed_by_username: receipt.printed_by_username,
    items: [],
    payments: []
  };

  if (receipt.reference_type === 'order_sale') {
    // Fetch Order details
    const order = await db.get(
      `SELECT o.*, c.name AS customer_name, c.phone AS customer_phone
       FROM orders o
       LEFT JOIN customers c ON o.customer_id = c.id
       WHERE o.id = ?;`,
      [receipt.reference_id]
    );

    if (!order) {
      throw new Error('بيانات الفاتورة المرتبطة بالإيصال غير موجودة.');
    }

    details.subtotal = order.subtotal;
    details.discount = order.discount;
    details.total = order.total;
    details.invoice_number = order.invoice_number;
    details.customer_name = order.customer_name;
    details.customer_phone = order.customer_phone;
    details.qr_token = order.invoice_number; // Invoice reference as QR

    // Fetch items
    const items = await db.all(
      `SELECT oi.*, p.name AS product_name, p.sku AS product_sku,
              CASE WHEN pbd.product_id IS NOT NULL THEN 1 ELSE 0 END AS is_book,
              pbd.school_grade, pbd.subject, pbd.term
       FROM order_items oi
       JOIN products p ON oi.product_id = p.id
       LEFT JOIN product_book_details pbd ON p.id = pbd.product_id
       WHERE oi.order_id = ?;`,
      [receipt.reference_id]
    );

    // Fetch already returned stats for this order
    const returnStats = await db.all(
      `SELECT ri.product_id, SUM(ri.quantity) as returned_qty, SUM(ri.refund_amount) as refunded_amount
       FROM return_items ri
       JOIN returns r ON ri.return_id = r.id
       WHERE r.order_id = ?
       GROUP BY ri.product_id;`,
      [receipt.reference_id]
    );

    details.items = items.map(item => {
      const returned = returnStats.find(r => r.product_id === item.product_id);
      return {
        ...item,
        returned_qty: returned ? returned.returned_qty : 0,
        refunded_amount: returned ? returned.refunded_amount : 0
      };
    });

    // Fetch payments
    const payments = await db.all(
      `SELECT payment_method, amount
       FROM payments
       WHERE reference_type = 'order' AND reference_id = ?;`,
      [receipt.reference_id]
    );
    details.payments = payments;

  } else if (receipt.reference_type === 'preorder_deposit' || receipt.reference_type === 'preorder_pickup') {
    // Fetch Preorder details
    const preorder = await db.get(
      `SELECT p.*, c.name AS customer_name, c.phone AS customer_phone
       FROM preorders p
       JOIN customers c ON p.customer_id = c.id
       WHERE p.id = ?;`,
      [receipt.reference_id]
    );

    if (!preorder) {
      throw new Error('بيانات طلب الحجز المرتبطة بالإيصال غير موجودة.');
    }

    details.subtotal = preorder.subtotal;
    details.discount = preorder.discount;
    details.total = preorder.total_amount;
    details.deposit_required = preorder.deposit_required;
    details.deposit_paid = preorder.deposit_paid;
    details.remaining_amount = preorder.remaining_amount;
    details.preorder_number = preorder.preorder_number;
    details.customer_name = preorder.customer_name;
    details.customer_phone = preorder.customer_phone;
    details.qr_token = preorder.qr_pickup_token; // Preorder QR pickup token
    details.pickup_method = preorder.pickup_method;
    details.status = preorder.status;

    // Fetch items
    const items = await db.all(
      `SELECT pi.*, p.name AS product_name, p.sku AS product_sku,
              CASE WHEN pbd.product_id IS NOT NULL THEN 1 ELSE 0 END AS is_book,
              pbd.school_grade, pbd.subject, pbd.term
       FROM preorder_items pi
       JOIN products p ON pi.product_id = p.id
       LEFT JOIN product_book_details pbd ON p.id = pbd.product_id
       WHERE pi.preorder_id = ?;`,
      [receipt.reference_id]
    );
    details.items = items;

    // Fetch payments
    const payments = await db.all(
      `SELECT payment_method, amount
       FROM payments
       WHERE reference_type = 'preorder' AND reference_id = ?;`,
      [receipt.reference_id]
    );
    details.payments = payments;
  }

  return details;
}

/**
 * Increments the print counter of a receipt and registers an audit log about the reprint action.
 */
export async function reprintReceipt(receiptId, userId, reason = '') {
  const receipt = await db.get(
    "SELECT id, receipt_number, reference_type, reference_id, print_count FROM receipts WHERE id = ?;",
    [receiptId]
  );
  if (!receipt) {
    throw new Error('الإيصال المراد إعادة طباعته غير موجود.');
  }

  const nextCount = receipt.print_count + 1;

  await db.run('BEGIN TRANSACTION;');
  try {
    await db.run(
      `UPDATE receipts
       SET print_count = ?, last_printed_at = CURRENT_TIMESTAMP
       WHERE id = ?;`,
      [nextCount, receiptId]
    );

    // Write Audit Log
    await writeAuditLog({
      userId,
      actionType: 'RECEIPT_REPRINT',
      entityType: 'receipt',
      entityId: receiptId,
      notes: `إعادة طباعة إيصال رقم ${receipt.receipt_number} (النسخة رقم ${nextCount}) ${reason ? `- السبب: ${reason}` : ''}`
    });

    await db.run('COMMIT;');

    return {
      receipt_id: receiptId,
      receipt_number: receipt.receipt_number,
      print_count: nextCount
    };
  } catch (err) {
    await db.run('ROLLBACK;');
    throw err;
  }
}

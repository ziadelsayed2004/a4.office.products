import db from '../../db/index.js';
import { validateSplitPayments } from '../payments/payments.service.js';
import { writeAuditLog } from '../../utils/auditLogger.js';

/**
 * Resolves a product by scanning a secure QR token, SKU, or barcode.
 * Returns product details, physical stock, and price tiers list.
 */
export async function scanProduct(code) {
  if (!code || code.trim().length === 0) {
    throw new Error('يرجى توفير رمز المنتج للمسح.');
  }

  const cleanCode = code.trim();
  let productId = null;

  // 1. Check if the code is a secure QR token prefixed with 'prod_'
  if (cleanCode.startsWith('prod_')) {
    const qrRow = await db.get(
      "SELECT reference_id FROM qr_tokens WHERE token = ? AND type = 'product';",
      [cleanCode]
    );
    if (qrRow) {
      productId = qrRow.reference_id;
    } else {
      throw new Error('رمز QR للمنتج غير صالح أو غير مسجل.');
    }
  } else {
    // 2. Lookup by SKU or Barcode in products table
    const prodRow = await db.get(
      "SELECT id FROM products WHERE (sku = ? OR barcode = ?);",
      [cleanCode, cleanCode]
    );
    if (prodRow) {
      productId = prodRow.id;
    }
  }

  if (!productId) {
    throw new Error('لم يتم العثور على أي منتج يطابق الرمز الممسوح.');
  }

  // 3. Retrieve product details, physical stock, and prices list
  const product = await db.get(
    `SELECT p.*, c.name AS category_name,
            COALESCE((SELECT after_quantity FROM inventory_ledger WHERE product_id = p.id ORDER BY id DESC LIMIT 1), 0) AS stock,
            COALESCE((SELECT SUM(pi.quantity) FROM preorder_items pi JOIN preorders pr ON pi.preorder_id = pr.id WHERE pi.product_id = p.id AND pr.status IN ('DEPOSIT_PAID_WAITING_STOCK', 'READY_FOR_PICKUP')), 0) AS open_preorders
     FROM products p
     LEFT JOIN categories c ON p.category_id = c.id
     WHERE p.id = ?;`,
    [productId]
  );

  if (!product) {
    throw new Error('المنتج المختار غير موجود.');
  }

  if (product.is_active !== 1) {
    throw new Error('المنتج معطل حالياً في النظام.');
  }

  if (product.can_be_sold !== 1) {
    throw new Error('المنتج غير مخصص للبيع.');
  }

  // Fetch prices list across all active price tiers
  const prices = await db.all(
    `SELECT pp.price_tier_id, pp.price, pt.name AS tier_name
     FROM product_prices pp
     JOIN price_tiers pt ON pp.price_tier_id = pt.id
     WHERE pp.product_id = ? AND pt.is_active = 1;`,
    [productId]
  );

  product.prices = prices;
  return product;
}

/**
 * Fuzzy search active and sellable products specifically for POS cashiers.
 */
export async function searchPosProducts(queryStr = '') {
  let query = `
    SELECT p.*, c.name AS category_name,
           COALESCE((SELECT after_quantity FROM inventory_ledger WHERE product_id = p.id ORDER BY id DESC LIMIT 1), 0) AS stock,
           COALESCE((SELECT SUM(pi.quantity) FROM preorder_items pi JOIN preorders pr ON pi.preorder_id = pr.id WHERE pi.product_id = p.id AND pr.status IN ('DEPOSIT_PAID_WAITING_STOCK', 'READY_FOR_PICKUP')), 0) AS open_preorders
    FROM products p
    LEFT JOIN categories c ON p.category_id = c.id
    WHERE p.is_active = 1 AND p.can_be_sold = 1
  `;
  const params = [];

  if (queryStr && queryStr.trim().length > 0) {
    const searchVal = `%${queryStr.trim()}%`;
    query += ' AND (p.name LIKE ? OR p.sku LIKE ? OR p.barcode LIKE ?)';
    params.push(searchVal, searchVal, searchVal);
  }

  query += ' ORDER BY p.name ASC LIMIT 30;';

  const products = await db.all(query, params);

  // Load prices list for each matched product
  for (const product of products) {
    const prices = await db.all(
      `SELECT pp.price_tier_id, pp.price, pt.name AS tier_name
       FROM product_prices pp
       JOIN price_tiers pt ON pp.price_tier_id = pt.id
       WHERE pp.product_id = ? AND pt.is_active = 1;`,
      [product.id]
    );
    product.prices = prices;
  }

  return products;
}

/**
 * Executes checkout for a normal sale:
 * - Checks active open shift.
 * - Double checks stock levels.
 * - Validates prices and discount.
 * - Runs split payment validations.
 * - Writes invoice order, order items, inventory ledger decrement, and payments in a single transaction.
 * - Writes AuditLog.
 */
export async function checkoutOrder({ cashierId, customerId, items, discount, payments }) {
  // Validate active open shift
  const activeShift = await db.get(
    "SELECT id FROM shifts WHERE user_id = ? AND status = 'OPEN' ORDER BY id DESC LIMIT 1;",
    [cashierId]
  );
  if (!activeShift) {
    throw new Error('لا يمكن إتمام عملية البيع بدون وردية نشطة مفتوحة للكاشير.');
  }
  const shiftId = activeShift.id;

  if (!Array.isArray(items) || items.length === 0) {
    throw new Error('يرجى إضافة منتج واحد على الأقل لإتمام البيع.');
  }

  await db.run('BEGIN TRANSACTION;');
  try {
    let subtotal = 0;
    const itemsWithDetails = [];

    for (const item of items) {
      const product = await db.get(
        `SELECT p.*,
                COALESCE((SELECT after_quantity FROM inventory_ledger WHERE product_id = p.id ORDER BY id DESC LIMIT 1), 0) AS stock
         FROM products p
         WHERE p.id = ?;`,
        [item.product_id]
      );

      if (!product) {
        throw new Error(`المنتج المختار غير موجود (المعرف: ${item.product_id}).`);
      }
      if (product.is_active !== 1 || product.can_be_sold !== 1) {
        throw new Error(`المنتج "${product.name}" غير متاح للبيع حالياً.`);
      }

      // Check stock limit
      if (product.stock < item.quantity) {
        throw new Error(`المخزون غير كافٍ للمنتج "${product.name}". المتاح: ${product.stock}، المطلوب: ${item.quantity}.`);
      }

      // Retrieve price for selected price tier
      const priceRow = await db.get(
        "SELECT price FROM product_prices WHERE product_id = ? AND price_tier_id = ?;",
        [item.product_id, item.price_tier_id]
      );
      if (!priceRow) {
        throw new Error(`السعر غير محدد للفئة المطلوبة للمنتج "${product.name}".`);
      }

      const unitPrice = priceRow.price;
      const itemTotal = unitPrice * item.quantity;
      subtotal += itemTotal;

      itemsWithDetails.push({
        product_id: item.product_id,
        name: product.name,
        sku: product.sku,
        quantity: item.quantity,
        unit_price: unitPrice,
        price_tier_id: item.price_tier_id,
        total_price: itemTotal,
        before_stock: product.stock
      });
    }

    const parsedDiscount = parseInt(discount, 10) || 0;
    if (parsedDiscount < 0) {
      throw new Error('قيمة الخصم يجب أن تكون صفر أو أكبر.');
    }
    const totalAmount = Math.max(0, subtotal - parsedDiscount);

    // Validate payments list matching net total exactly
    await validateSplitPayments(payments, totalAmount);

    // Generate unique invoice number: INV-YYYYMMDD-Sequence
    const date = new Date();
    // African/Cairo adjustment offset: Cairo is GMT+2 (or GMT+3 DST). We format Cairo time YYYYMMDD
    const cairoDateStr = date.toLocaleDateString('en-US', { timeZone: 'Africa/Cairo' });
    const [month, day, year] = cairoDateStr.split('/');
    const formattedDate = `${year}${month.padStart(2, '0')}${day.padStart(2, '0')}`;

    const countRow = await db.get(
      "SELECT COUNT(*) as count FROM orders WHERE created_at >= date('now', 'start of day');"
    );
    const sequence = (countRow.count + 1).toString().padStart(4, '0');
    const invoiceNumber = `INV-${formattedDate}-${sequence}`;

    // Insert order
    const orderResult = await db.run(
      `INSERT INTO orders (invoice_number, shift_id, cashier_id, customer_id, subtotal, discount, total, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP);`,
      [invoiceNumber, shiftId, cashierId, customerId || null, subtotal, parsedDiscount, totalAmount]
    );
    const orderId = orderResult.lastID;

    // Insert order items & update inventory ledger
    for (const d of itemsWithDetails) {
      await db.run(
        `INSERT INTO order_items (order_id, product_id, quantity, unit_price, price_tier_id, total_price, created_at)
         VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP);`,
        [orderId, d.product_id, d.quantity, d.unit_price, d.price_tier_id, d.total_price]
      );

      // Decrement stock in ledger
      const afterStock = d.before_stock - d.quantity;
      await db.run(
        `INSERT INTO inventory_ledger (product_id, transaction_type, quantity_changed, before_quantity, after_quantity, user_id, shift_id, reference_type, reference_id, notes, created_at)
         VALUES (?, 'SALE', ?, ?, ?, ?, ?, 'order', ?, ?, CURRENT_TIMESTAMP);`,
        [d.product_id, -d.quantity, d.before_stock, afterStock, cashierId, shiftId, orderId, `بيع فاتورة رقم ${invoiceNumber}`]
      );
    }

    // Insert payments
    for (const p of payments) {
      await db.run(
        `INSERT INTO payments (shift_id, cashier_id, reference_type, reference_id, payment_method, amount, created_at)
         VALUES (?, ?, 'order', ?, ?, ?, CURRENT_TIMESTAMP);`,
        [shiftId, cashierId, orderId, p.method, p.amount]
      );
    }

    // Generate unique receipt number: REC-YYYYMMDD-Sequence
    const recCountRow = await db.get(
      "SELECT COUNT(*) as count FROM receipts WHERE created_at >= date('now', 'start of day');"
    );
    const recSequence = (recCountRow.count + 1).toString().padStart(4, '0');
    const receiptNumber = `REC-${formattedDate}-${recSequence}`;

    // Insert receipt
    const receiptResult = await db.run(
      `INSERT INTO receipts (receipt_number, reference_type, reference_id, printed_by, print_count, last_printed_at, created_at)
       VALUES (?, 'order_sale', ?, ?, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);`,
      [receiptNumber, orderId, cashierId]
    );
    const receiptId = receiptResult.lastID;

    // Write Audit Log
    await writeAuditLog({
      userId: cashierId,
      actionType: 'SALE_CREATE',
      entityType: 'order',
      entityId: orderId,
      notes: `إتمام عملية بيع جديدة فاتورة رقم ${invoiceNumber} بقيمة ${(totalAmount / 100).toFixed(2)} ج.م (إيصال رقم ${receiptNumber})`
    });

    await db.run('COMMIT;');

    return {
      id: orderId,
      invoice_number: invoiceNumber,
      receipt_id: receiptId,
      receipt_number: receiptNumber,
      subtotal,
      discount: parsedDiscount,
      total: totalAmount,
      items: itemsWithDetails
    };
  } catch (err) {
    await db.run('ROLLBACK;');
    throw err;
  }
}

/**
 * Processes return/refund of specific items from a sale invoice.
 */
export async function returnOrderItems(cashierId, orderId, itemsToReturn, notes, refundMethod = 'Cash') {
  if (!itemsToReturn || itemsToReturn.length === 0) {
    throw new Error('يرجى تحديد المنتجات المراد إرجاعها.');
  }

  // 1. Ensure cashier has an active shift
  const activeShift = await db.get(
    "SELECT * FROM shifts WHERE user_id = ? AND status = 'OPEN' ORDER BY id DESC LIMIT 1;",
    [cashierId]
  );
  if (!activeShift) {
    throw new Error('لا يمكن إجراء مرتجع بدون وردية نشطة مفتوحة حالياً للكاشير.');
  }
  const shiftId = activeShift.id;

  // 2. Fetch the order
  const order = await db.get("SELECT * FROM orders WHERE id = ?;", [orderId]);
  if (!order) {
    throw new Error('الفاتورة المطلوبة غير موجودة.');
  }

  // 3. Fetch original order items
  const orderItems = await db.all("SELECT * FROM order_items WHERE order_id = ?;", [orderId]);

  await db.run('BEGIN TRANSACTION;');
  try {
    let totalRefunded = 0;
    const processedItems = [];

    // Calculate discount ratio: total / subtotal
    const discountRatio = order.subtotal > 0 ? (order.total / order.subtotal) : 1;

    for (const returnReq of itemsToReturn) {
      const productId = parseInt(returnReq.productId);
      const returnQty = parseInt(returnReq.quantity);

      if (isNaN(productId) || isNaN(returnQty) || returnQty <= 0) {
        throw new Error('بيانات المنتج أو الكمية المرتجعة غير صالحة.');
      }

      // Find original order item
      const originalItem = orderItems.find(item => item.product_id === productId);
      if (!originalItem) {
        throw new Error(`المنتج ذو الرقم التعريفى ${productId} غير موجود في هذه الفاتورة.`);
      }

      // Calculate already returned quantity
      const returnedQtyRow = await db.get(
        `SELECT COALESCE(SUM(ri.quantity), 0) as qty
         FROM return_items ri
         JOIN returns r ON ri.return_id = r.id
         WHERE r.order_id = ? AND ri.product_id = ?;`,
        [orderId, productId]
      );
      const alreadyReturned = returnedQtyRow.qty;

      if (returnQty + alreadyReturned > originalItem.quantity) {
        throw new Error(`الكمية المرتجعة المطلوبة (${returnQty}) تتجاوز الكمية المتبقية القابلة للإرجاع (${originalItem.quantity - alreadyReturned}).`);
      }

      // Proportional refund amount
      const itemRefund = Math.round(originalItem.unit_price * returnQty * discountRatio);
      totalRefunded += itemRefund;

      processedItems.push({
        productId,
        quantity: returnQty,
        refundAmount: itemRefund
      });
    }

    // Insert into returns table
    const returnResult = await db.run(
      `INSERT INTO returns (order_id, shift_id, cashier_id, total_refunded, notes, created_at)
       VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP);`,
      [orderId, shiftId, cashierId, totalRefunded, notes || null]
    );
    const returnId = returnResult.lastID;

    // Process each return item: insert details & adjust inventory stock
    for (const item of processedItems) {
      await db.run(
        `INSERT INTO return_items (return_id, product_id, quantity, refund_amount, created_at)
         VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP);`,
        [returnId, item.productId, item.quantity, item.refundAmount]
      );

      // Get latest inventory stock for this product
      const ledgerRow = await db.get(
        "SELECT after_quantity FROM inventory_ledger WHERE product_id = ? ORDER BY id DESC LIMIT 1;",
        [item.productId]
      );
      const currentStock = ledgerRow ? ledgerRow.after_quantity : 0;
      const newStock = currentStock + item.quantity;

      // Insert STOCK entry in inventory ledger
      await db.run(
        `INSERT INTO inventory_ledger (
           product_id, transaction_type, quantity_changed, before_quantity, after_quantity,
           reference_type, reference_id, user_id, shift_id, notes, created_at
         ) VALUES (?, 'ADJUSTMENT_ADD', ?, ?, ?, 'returns', ?, ?, ?, ?, CURRENT_TIMESTAMP);`,
        [
          item.productId,
          item.quantity,
          currentStock,
          newStock,
          returnId,
          cashierId,
          shiftId,
          `مرتجع فاتورة مبيعات رقم ${order.invoice_number}`
        ]
      );
    }

    // If refund method is Cash, log as PAY_OUT cash movement from the active shift
    if (refundMethod === 'Cash') {
      await db.run(
        `INSERT INTO cash_movements (shift_id, user_id, type, amount, notes, created_at)
         VALUES (?, ?, 'PAY_OUT', ?, ?, CURRENT_TIMESTAMP);`,
        [shiftId, cashierId, totalRefunded, `مرتجع نقدي للفاتورة رقم ${order.invoice_number}`]
      );
    }

    // Write Audit Log
    await writeAuditLog({
      userId: cashierId,
      actionType: 'ORDER_RETURN',
      entityType: 'order',
      entityId: orderId,
      notes: `تسجيل مرتجع للفاتورة رقم ${order.invoice_number} بقيمة إجمالية مستردة ${(totalRefunded / 100).toFixed(2)} ج.م طريقة الاسترداد: ${refundMethod}`
    });

    await db.run('COMMIT;');

    return {
      returnId,
      orderId,
      totalRefunded,
      items: processedItems
    };

  } catch (err) {
    await db.run('ROLLBACK;');
    throw err;
  }
}


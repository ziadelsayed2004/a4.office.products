import db from '../../db/index.js';
import { writeAuditLog } from '../../utils/auditLogger.js';
import {
  AppError,
  aggregateItems,
  nextSaleNumbers,
  requireInteger,
  requirePiasters,
  saveSecureToken,
  withIdempotency,
} from '../../utils/financial.js';
import { insertPayments, validateSplitPayments } from '../payments/payments.service.js';
import { PRODUCT_POLICIES } from '../products/products.service.js';
import { executeReturnAuthorization } from '../returnAuthorizations/returnAuthorizations.service.js';

function decorateProduct(product) {
  const stock = Number(product.stock || 0);
  const openQuantity = Number(product.open_preorder_quantity || 0);
  const active = Number(product.is_active) === 1;
  return {
    ...product,
    stock,
    open_preorders: openQuantity,
    stockOnHand: stock,
    openPreorderQuantity: openQuantity,
    availabilityPolicy: product.availability_policy,
    defaultPreorderDepositPct: Number(product.default_preorder_deposit_pct || 0),
    canSellNow: active && stock > 0,
    canPreorderNow:
      active &&
      product.availability_policy === PRODUCT_POLICIES.STOCK_WITH_PREORDER_WHEN_OUT_OF_STOCK &&
      stock === 0,
  };
}

async function loadPosProduct(connection, productId) {
  const product = await connection.get(
    `SELECT p.*, c.name AS category_name,
            COALESCE((SELECT after_quantity FROM inventory_ledger il WHERE il.product_id = p.id ORDER BY il.id DESC LIMIT 1), 0) AS stock
       FROM products p LEFT JOIN categories c ON c.id = p.category_id WHERE p.id = ?;`,
    [productId]
  );
  if (!product) return null;
  product.prices = await connection.all(
    `SELECT pp.price_tier_id, pp.price, pt.name AS tier_name
       FROM product_prices pp JOIN price_tiers pt ON pt.id = pp.price_tier_id
      WHERE pp.product_id = ? AND pt.is_active = 1 ORDER BY pt.id;`,
    [productId]
  );
  return decorateProduct(product);
}

export async function scanProduct(code, connection = db) {
  const clean = String(code || '').trim();
  if (!clean) throw new AppError('A product code is required.', 400, 'SCAN_CODE_REQUIRED');
  let productId;
  if (clean.startsWith('prod_')) {
    const token = await connection.get(
      "SELECT reference_id FROM secure_tokens WHERE token = ? AND token_type = 'product';",
      [clean]
    );
    if (!token) throw new AppError('Product QR token is invalid.', 404, 'PRODUCT_TOKEN_NOT_FOUND');
    productId = token.reference_id;
  } else {
    const product = await connection.get('SELECT id FROM products WHERE sku = ? OR barcode = ?;', [
      clean,
      clean,
    ]);
    productId = product?.id;
  }
  if (!productId)
    throw new AppError('No product matches the scanned code.', 404, 'PRODUCT_NOT_FOUND');
  const product = await loadPosProduct(connection, productId);
  if (!product || product.is_active !== 1 || product.can_be_sold !== 1) {
    throw new AppError('Product is inactive or unavailable.', 409, 'PRODUCT_UNAVAILABLE');
  }
  return product;
}

export async function searchPosProducts(queryStr = '', connection = db) {
  const params = [];
  let sql = `SELECT p.id FROM products p WHERE p.is_active = 1 AND p.can_be_sold = 1`;
  if (String(queryStr).trim()) {
    const value = `%${String(queryStr).trim()}%`;
    sql += ' AND (p.name LIKE ? OR p.sku LIKE ? OR p.barcode LIKE ?)';
    params.push(value, value, value);
  }
  sql += ' ORDER BY p.name COLLATE NOCASE LIMIT 50;';
  const rows = await connection.all(sql, params);
  return Promise.all(rows.map((row) => loadPosProduct(connection, row.id)));
}

async function requireOwnOpenShift(connection, userId) {
  const shift = await connection.get(
    "SELECT s.* FROM shifts s JOIN users u ON u.id=s.user_id WHERE s.user_id = ? AND u.role='Cashier' AND u.is_active=1 AND s.status = 'OPEN' ORDER BY s.id DESC LIMIT 1;",
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

function saleReceiptSnapshot({
  receiptId,
  receiptNumber,
  invoiceToken,
  order,
  cashierName,
  items,
  payments,
}) {
  return {
    version: 2,
    receiptId,
    receiptNumber,
    referenceType: 'order_sale',
    invoiceId: order.id,
    invoiceNumber: order.invoice_number,
    origin: 'SALE',
    status: 'COMPLETED',
    cashierName,
    customerName: order.customer_name_snapshot,
    customerPhone: order.customer_phone_snapshot,
    subtotal: order.subtotal,
    discount: order.discount,
    total: order.total,
    qrToken: invoiceToken,
    items: items.map((item) => ({
      productId: item.product_id,
      productName: item.product_name_snapshot,
      productSku: item.sku_snapshot,
      priceTierName: item.price_tier_name_snapshot,
      availabilityPolicy: item.availability_policy_snapshot,
      quantity: item.quantity,
      unitPrice: item.unit_price,
      totalPrice: item.total_price,
    })),
    payments: payments.map((payment) => ({
      method: payment.method,
      methodName: payment.methodSnapshot,
      stage: 'SALE',
      direction: 'IN',
      amount: payment.amount,
      cashReceived: payment.cashReceived,
      changeAmount: payment.changeAmount,
      referenceNumber: payment.referenceNumber,
      note: payment.note,
    })),
  };
}

export async function checkoutOrder({
  cashierId,
  customerId,
  items,
  discount,
  payments,
  idempotencyKey,
}) {
  const requestItems = aggregateItems(items);
  const parsedDiscount = requirePiasters(discount ?? 0, 'discount');
  const payload = {
    customerId: customerId || null,
    items: requestItems,
    discount: parsedDiscount,
    payments,
  };
  return withIdempotency(
    { key: idempotencyKey, userId: cashierId, operation: 'SALE', payload },
    async (connection) => {
      const shift = await requireOwnOpenShift(connection, cashierId);
      let customer = null;
      if (customerId !== undefined && customerId !== null && customerId !== '') {
        customer = await connection.get('SELECT id, name, phone FROM customers WHERE id = ?;', [
          requireInteger(Number(customerId), 'customerId', { min: 1 }),
        ]);
        if (!customer) throw new AppError('Customer not found.', 404, 'CUSTOMER_NOT_FOUND');
      }

      const detailedItems = [];
      let subtotal = 0;
      for (const item of requestItems) {
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
        if (product.stock < item.quantity) {
          throw new AppError(
            `Insufficient stock for ${product.name}. Available ${product.stock}, requested ${item.quantity}.`,
            409,
            'INSUFFICIENT_STOCK'
          );
        }
        const tier =
          item.price_tier_id === null
            ? { price: product.base_sale_price, name: 'السعر الأساسي' }
            : await connection.get(
                `SELECT pp.price, pt.name FROM product_prices pp JOIN price_tiers pt ON pt.id = pp.price_tier_id
                  WHERE pp.product_id = ? AND pp.price_tier_id = ? AND pt.is_active = 1;`,
                [item.product_id, item.price_tier_id]
              );
        if (!tier)
          throw new AppError(
            `Active custom price is missing for ${product.name}.`,
            409,
            'PRICE_NOT_FOUND'
          );
        const totalPrice = tier.price * item.quantity;
        subtotal += totalPrice;
        detailedItems.push({
          ...item,
          unit_price: tier.price,
          total_price: totalPrice,
          before_stock: product.stock,
          product_name_snapshot: product.name,
          sku_snapshot: product.sku,
          price_tier_name_snapshot: tier.name,
          availability_policy_snapshot: product.availability_policy,
        });
      }
      if (parsedDiscount > subtotal)
        throw new AppError('Discount cannot exceed subtotal.', 400, 'DISCOUNT_EXCEEDS_SUBTOTAL');
      const total = subtotal - parsedDiscount;
      const normalizedPayments = await validateSplitPayments(payments, total, connection);
      const { invoiceNumber, receiptNumber } = await nextSaleNumbers(connection);
      const orderResult = await connection.run(
        `INSERT INTO orders
         (invoice_number, shift_id, cashier_id, customer_id, subtotal, discount, total,
          origin, status, customer_name_snapshot, customer_phone_snapshot)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'SALE', 'COMPLETED', ?, ?);`,
        [
          invoiceNumber,
          shift.id,
          cashierId,
          customer?.id || null,
          subtotal,
          parsedDiscount,
          total,
          customer?.name || null,
          customer?.phone || null,
        ]
      );
      const orderId = orderResult.lastID;
      const invoiceToken = await saveSecureToken(connection, 'invoice', orderId);
      await connection.run('UPDATE orders SET qr_token = ? WHERE id = ?;', [invoiceToken, orderId]);

      for (const item of detailedItems) {
        await connection.run(
          `INSERT INTO order_items
           (order_id, product_id, quantity, unit_price, price_tier_id, total_price,
            product_name_snapshot, sku_snapshot, price_tier_name_snapshot, availability_policy_snapshot)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
          [
            orderId,
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
           VALUES (?, 'SALE', ?, ?, ?, 'order', ?, ?, ?, ?);`,
          [
            item.product_id,
            -item.quantity,
            item.before_stock,
            item.before_stock - item.quantity,
            orderId,
            cashierId,
            shift.id,
            `Sale ${invoiceNumber}`,
          ]
        );
      }
      await insertPayments(
        connection,
        {
          shiftId: shift.id,
          cashierId,
          referenceType: 'order',
          referenceId: orderId,
          stage: 'SALE',
        },
        normalizedPayments
      );

      const receiptResult = await connection.run(
        `INSERT INTO receipts
         (receipt_number, reference_type, reference_id, printed_by, print_count, qr_token)
         VALUES (?, 'order_sale', ?, ?, 1, ?);`,
        [receiptNumber, orderId, cashierId, invoiceToken]
      );
      const order = {
        id: orderId,
        invoice_number: invoiceNumber,
        subtotal,
        discount: parsedDiscount,
        total,
        customer_name_snapshot: customer?.name || null,
        customer_phone_snapshot: customer?.phone || null,
      };
      const cashier = await connection.get('SELECT name FROM users WHERE id = ?;', [cashierId]);
      const snapshot = saleReceiptSnapshot({
        receiptId: receiptResult.lastID,
        receiptNumber,
        invoiceToken,
        order,
        cashierName: cashier.name,
        items: detailedItems,
        payments: normalizedPayments,
      });
      await connection.run('UPDATE receipts SET snapshot_json = ? WHERE id = ?;', [
        JSON.stringify(snapshot),
        receiptResult.lastID,
      ]);
      await writeAuditLog({
        userId: cashierId,
        shiftId: shift.id,
        actionType: 'SALE_CREATE',
        entityType: 'orders',
        entityId: orderId,
        afterValues: { invoiceNumber, receiptNumber, total },
        connection,
      });
      return {
        statusCode: 201,
        data: {
          id: orderId,
          shift_id: shift.id,
          invoice_number: invoiceNumber,
          invoice_qr_token: invoiceToken,
          receipt_id: receiptResult.lastID,
          receipt_number: receiptNumber,
          subtotal,
          discount: parsedDiscount,
          total,
          items: detailedItems,
        },
      };
    }
  );
}

export async function returnOrderItems({
  cashierId,
  orderId,
  authorizationToken,
  refundReferences = [],
  cashierNote = null,
  idempotencyKey,
}) {
  if (!authorizationToken) {
    throw new AppError(
      'An Admin-issued return authorization is required.',
      409,
      'RETURN_AUTHORIZATION_REQUIRED'
    );
  }
  const result = await executeReturnAuthorization({
    cashierId,
    token: authorizationToken,
    refundReferences,
    cashierNote,
    expectedOrderId: requireInteger(Number(orderId), 'orderId', { min: 1 }),
    idempotencyKey,
  });
  return result;
}

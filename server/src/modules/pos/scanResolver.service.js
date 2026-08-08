import db from '../../db/index.js';
import { AppError } from '../../utils/financial.js';
import { getInvoiceByExactCredential } from '../invoices/invoices.service.js';
import { resolveReturnAuthorizationToken } from '../returnAuthorizations/returnAuthorizations.service.js';
import { resolveCardToken } from '../returnApprovalCards/returnApprovalCards.service.js';
import { normalizeCustomerPhone } from '../../utils/customerPhone.js';

async function resolveProduct(productId, connection) {
  const product = await connection.get(
    `SELECT p.id, p.name, p.sku, p.barcode, p.category_id, c.name AS category_name,
            p.is_active, p.can_be_sold, p.availability_policy,
            p.default_preorder_deposit_pct, p.default_pickup_method,
            p.preorder_instructions, p.base_sale_price,
            COALESCE((
              SELECT il.after_quantity FROM inventory_ledger il
               WHERE il.product_id = p.id ORDER BY il.id DESC LIMIT 1
            ), 0) AS stock_on_hand,
            COALESCE(p.open_preorder_quantity, 0) AS open_preorder_quantity
       FROM products p LEFT JOIN categories c ON c.id = p.category_id
      WHERE p.id = ?;`,
    [productId]
  );
  if (!product) throw new AppError('Product not found.', 404, 'PRODUCT_NOT_FOUND');

  const prices = await connection.all(
    `SELECT pp.price_tier_id, pt.name AS price_tier_name, pp.price
       FROM product_prices pp JOIN price_tiers pt ON pt.id = pp.price_tier_id
      WHERE pp.product_id = ? AND pt.is_active = 1
      ORDER BY pt.id;`,
    [product.id]
  );
  const policy = product.availability_policy || 'STOCK_ONLY';
  const active = product.is_active === 1;
  const canSellNow = active && product.can_be_sold === 1 && product.stock_on_hand > 0;
  const canPreorderNow =
    active &&
    product.can_be_sold === 1 &&
    policy === 'STOCK_WITH_PREORDER_WHEN_OUT_OF_STOCK' &&
    product.stock_on_hand === 0;

  return {
    type: 'product',
    action: canSellNow ? 'SALE' : canPreorderNow ? 'PREORDER' : 'BLOCKED',
    data: {
      id: product.id,
      productId: product.id,
      name: product.name,
      sku: product.sku,
      barcode: product.barcode,
      categoryId: product.category_id,
      categoryName: product.category_name,
      isActive: active,
      stockOnHand: product.stock_on_hand,
      openPreorderQuantity: product.open_preorder_quantity,
      availabilityPolicy: policy,
      canSellNow,
      canPreorderNow,
      defaultPreorderDepositPct: product.default_preorder_deposit_pct,
      defaultPickupMethod: product.default_pickup_method,
      preorderInstructions: product.preorder_instructions,
      baseSalePrice: product.base_sale_price,
      base_sale_price: product.base_sale_price,
      prices,
    },
  };
}

async function resolvePreorder(preorderId, connection) {
  const preorder = await connection.get(
    `SELECT p.id, p.preorder_number, p.status, p.shift_id, p.cashier_id,
            p.customer_name_snapshot, p.customer_phone_snapshot,
            COALESCE(NULLIF(p.customer_name_snapshot, ''), c.name) AS customer_name,
            COALESCE(NULLIF(p.customer_phone_snapshot, ''), c.phone) AS customer_phone,
            p.subtotal, p.discount, p.total_amount, p.deposit_required,
            p.deposit_paid, p.remaining_amount, p.pickup_method,
            p.expected_pickup_date, p.notes, p.qr_pickup_token,
            p.pickup_order_id, p.picked_up_at, p.created_at, p.updated_at,
            o.invoice_number,
            u.name AS cashier_name
       FROM preorders p
       JOIN users u ON u.id = p.cashier_id
       LEFT JOIN customers c ON c.id = p.customer_id
       LEFT JOIN orders o ON o.id = p.pickup_order_id
      WHERE p.id = ?;`,
    [preorderId]
  );
  if (!preorder) throw new AppError('Preorder not found.', 404, 'PREORDER_NOT_FOUND');
  const items = await connection.all(
    `SELECT pi.id, pi.product_id, pi.quantity, pi.unit_price, pi.total_price,
            pi.product_name_snapshot AS product_name,
            pi.sku_snapshot AS product_sku,
            pi.price_tier_name_snapshot AS price_tier_name,
            pi.availability_policy_snapshot AS availability_policy,
            pi.deposit_pct_snapshot AS deposit_pct,
            c.name AS category_name,
            pbd.book_type, pbd.school_grade, pbd.subject,
            pbd.teacher AS author, pbd.publisher, pbd.release_year, pbd.term,
            COALESCE((
              SELECT il.after_quantity FROM inventory_ledger il
               WHERE il.product_id = pi.product_id ORDER BY il.id DESC LIMIT 1
            ), 0) AS stock_on_hand
       FROM preorder_items pi
       JOIN products p ON p.id = pi.product_id
       LEFT JOIN categories c ON c.id = p.category_id
       LEFT JOIN product_book_details pbd ON pbd.product_id = p.id
      WHERE pi.preorder_id = ? ORDER BY pi.id;`,
    [preorder.id]
  );
  const sufficientStock = items.every((item) => item.stock_on_hand >= item.quantity);
  const canPickup =
    ['DEPOSIT_PAID_WAITING_STOCK', 'READY_FOR_PICKUP'].includes(preorder.status) && sufficientStock;
  const normalizedItems = items.map((item) => ({
    ...item,
    stock: Number(item.stock_on_hand || 0),
  }));
  return {
    type: 'preorder',
    action: canPickup ? 'PICKUP_REVIEW' : 'READ_ONLY',
    data: {
      preorder: { ...preorder, canPickup },
      canPickup,
      items: normalizedItems,
    },
  };
}

export async function resolveScan(code, actor, connection = db, context = null) {
  const normalized = typeof code === 'string' ? code.trim() : '';
  if (!normalized) throw new AppError('Scan code is required.', 400, 'SCAN_CODE_REQUIRED');

  if (normalized.startsWith('ret_')) {
    return resolveReturnAuthorizationToken(normalized, actor, connection);
  }
  if (normalized.startsWith('rac_')) return resolveCardToken(normalized, connection);

  const token = await connection.get(
    'SELECT token_type, reference_id FROM secure_tokens WHERE token = ?;',
    [normalized]
  );
  if (token?.token_type === 'product') return resolveProduct(token.reference_id, connection);
  if (token?.token_type === 'preorder') return resolvePreorder(token.reference_id, connection);
  if (token?.token_type === 'invoice') {
    const detail = await getInvoiceByExactCredential({ token: normalized }, actor, connection);
    return { type: 'invoice', action: 'READ_ONLY', data: detail };
  }

  const preorderNumber = await connection.get(
    'SELECT id FROM preorders WHERE preorder_number = ? COLLATE NOCASE LIMIT 1;',
    [normalized]
  );
  if (preorderNumber) return resolvePreorder(preorderNumber.id, connection);

  if (/^(prod_|pre_|inv_|ret_|rac_)/.test(normalized)) {
    throw new AppError('Secure QR token is invalid.', 404, 'INVALID_SECURE_TOKEN');
  }

  const product = await connection.get(
    'SELECT id FROM products WHERE sku = ? OR barcode = ? LIMIT 1;',
    [normalized, normalized]
  );
  if (product) return resolveProduct(product.id, connection);

  if (context === 'pickup') {
    const phone = normalizeCustomerPhone(normalized);
    if (/^\d+$/.test(phone) && phone.length >= 6) {
      const rows = await connection.all(
        `SELECT p.id, p.preorder_number, p.status,
                p.customer_name_snapshot AS customer_name,
                COALESCE(NULLIF(p.customer_phone_snapshot, ''), c.phone) AS customer_phone,
                p.total_amount, p.deposit_paid, p.remaining_amount,
                p.expected_pickup_date, p.created_at
           FROM preorders p
           LEFT JOIN customers c ON c.id = p.customer_id
          WHERE p.status IN ('DEPOSIT_PAID_WAITING_STOCK', 'READY_FOR_PICKUP')
            AND (c.phone LIKE ? OR p.customer_phone_snapshot LIKE ?)
          ORDER BY CASE WHEN p.status = 'READY_FOR_PICKUP' THEN 0 ELSE 1 END,
                   p.created_at DESC, p.id DESC LIMIT 25;`,
        [`${phone}%`, `%${phone}%`]
      );
      if (!rows.length)
        throw new AppError(
          'No active preorder matches this phone.',
          404,
          'ACTIVE_PREORDER_NOT_FOUND'
        );
      return { type: 'preorder_list', action: 'PICKUP_SELECT', data: { rows } };
    }
  }
  throw new AppError(
    'No supported product, preorder, invoice, or return card matches this scan.',
    404,
    'SCAN_NOT_FOUND'
  );
}

import db, { withTransaction } from '../../db/index.js';
import { writeAuditLog } from '../../utils/auditLogger.js';
import {
  AppError,
  requireInteger,
  requirePiasters,
  nextProductIdentity,
  saveSecureToken,
} from '../../utils/financial.js';

export const PRODUCT_POLICIES = Object.freeze({
  STOCK_ONLY: 'STOCK_ONLY',
  STOCK_WITH_PREORDER_WHEN_OUT_OF_STOCK: 'STOCK_WITH_PREORDER_WHEN_OUT_OF_STOCK',
});

const POLICY_VALUES = Object.values(PRODUCT_POLICIES);
const CODE128_VALUE = /^[\x20-\x7e]{1,80}$/;

function requireCode128Barcode(value) {
  if (!CODE128_VALUE.test(String(value || ''))) {
    throw new AppError(
      'Barcode must be 1-80 printable CODE128 characters. Use English letters, digits, or symbols.',
      400,
      'INVALID_CODE128_BARCODE'
    );
  }
  return value;
}

function field(data, camel, snake = camel) {
  if (data[camel] !== undefined) return data[camel];
  return data[snake];
}

function cleanOptional(value) {
  const cleaned = typeof value === 'string' ? value.trim() : value;
  return cleaned === '' || cleaned === undefined ? null : cleaned;
}

function availabilityPolicyFrom(data, fallback = null) {
  const policy = field(data, 'availabilityPolicy', 'availability_policy') ?? fallback;
  if (!POLICY_VALUES.includes(policy)) {
    throw new AppError(
      'availabilityPolicy must be STOCK_ONLY or STOCK_WITH_PREORDER_WHEN_OUT_OF_STOCK.',
      400,
      'INVALID_AVAILABILITY_POLICY'
    );
  }
  if (
    field(data, 'canBeSold', 'can_be_sold') === 0 ||
    field(data, 'canBeSold', 'can_be_sold') === false
  ) {
    throw new AppError(
      'Preorder-only and non-sellable combinations are not supported.',
      400,
      'UNSUPPORTED_PRODUCT_POLICY'
    );
  }
  return policy;
}

function decorateAvailability(product) {
  const {
    order_item_count: orderItemCount = 0,
    preorder_item_count: preorderItemCount = 0,
    inventory_entry_count: inventoryEntryCount = 0,
    return_item_count: returnItemCount = 0,
    return_authorization_item_count: returnAuthorizationItemCount = 0,
    product_price_count: productPriceCount = 0,
    book_detail_count: bookDetailCount = 0,
    secure_token_count: secureTokenCount = 0,
    qr_token_count: qrTokenCount = 0,
    ...data
  } = product;
  const stock = Number(data.stock ?? data.stockOnHand ?? 0);
  const openQuantity = Number(data.open_preorder_quantity ?? data.open_preorders ?? 0);
  const policy = data.availability_policy;
  const active = Number(data.is_active) === 1;
  const dependencyCounts = {
    order_items: Number(orderItemCount),
    preorder_items: Number(preorderItemCount),
    inventory_entries: Number(inventoryEntryCount),
    return_items: Number(returnItemCount),
    return_authorization_items: Number(returnAuthorizationItemCount),
    open_preorder_quantity: openQuantity,
  };
  const cleanupCounts = {
    product_prices: Number(productPriceCount),
    book_details: Number(bookDetailCount),
    secure_tokens: Number(secureTokenCount),
    qr_tokens: Number(qrTokenCount),
  };
  return {
    ...data,
    stock,
    open_preorders: openQuantity,
    stockOnHand: stock,
    openPreorderQuantity: openQuantity,
    availabilityPolicy: policy,
    defaultPreorderDepositPct: Number(product.default_preorder_deposit_pct || 0),
    defaultPickupMethod: product.default_pickup_method,
    preorderInstructions: product.preorder_instructions,
    canSellNow: active && stock > 0,
    canPreorderNow:
      active && policy === PRODUCT_POLICIES.STOCK_WITH_PREORDER_WHEN_OUT_OF_STOCK && stock === 0,
    can_delete: Object.values(dependencyCounts).every((count) => count === 0),
    dependency_counts: dependencyCounts,
    cleanup_counts: cleanupCounts,
  };
}

function baseProductSelect() {
  return `SELECT p.*, c.name AS category_name,
          COALESCE((SELECT after_quantity FROM inventory_ledger il WHERE il.product_id = p.id ORDER BY il.id DESC LIMIT 1), 0) AS stock,
          p.open_preorder_quantity AS open_preorders,
          CASE WHEN EXISTS (SELECT 1 FROM product_book_details pbd WHERE pbd.product_id = p.id) THEN 1 ELSE 0 END AS is_book,
          (SELECT COUNT(*) FROM order_items oi WHERE oi.product_id = p.id) AS order_item_count,
          (SELECT COUNT(*) FROM preorder_items pi WHERE pi.product_id = p.id) AS preorder_item_count,
          (SELECT COUNT(*) FROM inventory_ledger il WHERE il.product_id = p.id) AS inventory_entry_count,
          (SELECT COUNT(*) FROM return_items ri WHERE ri.product_id = p.id) AS return_item_count,
          (SELECT COUNT(*) FROM return_authorization_items rai WHERE rai.product_id = p.id) AS return_authorization_item_count,
          (SELECT COUNT(*) FROM product_prices pp WHERE pp.product_id = p.id) AS product_price_count,
          (SELECT COUNT(*) FROM product_book_details pbd WHERE pbd.product_id = p.id) AS book_detail_count,
          (SELECT COUNT(*) FROM secure_tokens st WHERE st.token_type = 'product' AND st.reference_id = p.id) AS secure_token_count,
          (SELECT COUNT(*) FROM qr_tokens qt WHERE qt.type = 'product' AND qt.reference_id = p.id) AS qr_token_count
          FROM products p LEFT JOIN categories c ON c.id = p.category_id`;
}

export async function searchProducts(filters = {}, connection = db) {
  let query = `${baseProductSelect()} WHERE 1 = 1`;
  const params = [];
  if (filters.q?.trim()) {
    const value = `%${filters.q.trim()}%`;
    query += ' AND (p.name LIKE ? OR p.sku LIKE ? OR p.barcode LIKE ?)';
    params.push(value, value, value);
  }
  if (filters.categoryId) {
    query += ' AND p.category_id = ?';
    params.push(filters.categoryId);
  }
  if (String(filters.activeOnly) === 'true') query += ' AND p.is_active = 1';
  if (filters.availabilityPolicy) {
    query += ' AND p.availability_policy = ?';
    params.push(filters.availabilityPolicy);
  }
  query += ' ORDER BY p.name COLLATE NOCASE;';
  return (await connection.all(query, params)).map(decorateAvailability);
}

export async function getProductDetails(id, connection = db) {
  const product = await connection.get(`${baseProductSelect()} WHERE p.id = ?;`, [id]);
  if (!product) return null;
  const [bookDetails, prices] = await Promise.all([
    connection.get('SELECT * FROM product_book_details WHERE product_id = ?;', [id]),
    connection.all(
      `SELECT pt.id AS price_tier_id, pt.name AS price_tier_name, pt.is_active, pp.price
       FROM price_tiers pt LEFT JOIN product_prices pp
         ON pp.price_tier_id = pt.id AND pp.product_id = ?
       ORDER BY pt.id;`,
      [id]
    ),
  ]);
  return decorateAvailability({
    ...product,
    book_details: bookDetails || null,
    prices: prices.map((price) => ({ ...price, price: price.price ?? null })),
  });
}

async function validateCategory(connection, categoryId) {
  const id = requireInteger(Number(categoryId), 'categoryId', { min: 1 });
  if (!(await connection.get('SELECT id FROM categories WHERE id = ?;', [id]))) {
    throw new AppError('The selected category does not exist.', 400, 'CATEGORY_NOT_FOUND');
  }
  return id;
}

async function normalizePrices(connection, rawPrices, { required }) {
  if (!Array.isArray(rawPrices)) {
    if (required)
      throw new AppError(
        'Prices are required for every active price tier.',
        400,
        'PRICES_REQUIRED'
      );
    return null;
  }
  const activeTiers = await connection.all(
    'SELECT id, name FROM price_tiers WHERE is_active = 1 ORDER BY id;'
  );
  const byTier = new Map();
  for (const row of rawPrices) {
    const tierId = requireInteger(
      Number(field(row, 'priceTierId', 'price_tier_id')),
      'priceTierId',
      { min: 1 }
    );
    if (byTier.has(tierId))
      throw new AppError('A price tier cannot appear more than once.', 400, 'DUPLICATE_PRICE_TIER');
    byTier.set(tierId, requirePiasters(field(row, 'price', 'price'), 'price'));
  }
  const missing = activeTiers.filter((tier) => !byTier.has(tier.id));
  if (missing.length) {
    throw new AppError(
      `Missing prices for active tiers: ${missing.map((tier) => tier.name).join(', ')}`,
      400,
      'ACTIVE_TIER_PRICE_REQUIRED'
    );
  }
  const knownIds = new Set(
    (await connection.all('SELECT id FROM price_tiers;')).map((tier) => tier.id)
  );
  for (const id of byTier.keys()) {
    if (!knownIds.has(id))
      throw new AppError(`Price tier ${id} does not exist.`, 400, 'PRICE_TIER_NOT_FOUND');
  }
  return [...byTier].map(([priceTierId, price]) => ({ priceTierId, price }));
}

function normalizeBookDetails(data) {
  const isBook = Boolean(field(data, 'isBook', 'is_book'));
  const details = field(data, 'bookDetails', 'book_details');
  if (!isBook) return { isBook: false, details: null };
  const value = details || {};
  if (value.term && !['first', 'second'].includes(value.term)) {
    throw new AppError('Book term must be first or second.', 400, 'INVALID_BOOK_TERM');
  }
  if (
    value.educational_classification &&
    !['external_book', 'school_book', 'booklet', 'notes'].includes(value.educational_classification)
  ) {
    throw new AppError('Invalid educational classification.', 400, 'INVALID_BOOK_CLASSIFICATION');
  }
  return { isBook: true, details: value };
}

async function upsertBookDetails(connection, productId, normalized, explicit = true) {
  if (!explicit) return;
  if (!normalized.isBook) {
    await connection.run('DELETE FROM product_book_details WHERE product_id = ?;', [productId]);
    return;
  }
  const value = normalized.details;
  await connection.run(
    `INSERT INTO product_book_details
     (product_id, book_type, school_grade, subject, teacher, publisher, release_year, term, educational_classification)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(product_id) DO UPDATE SET
       book_type = excluded.book_type, school_grade = excluded.school_grade,
       subject = excluded.subject, teacher = excluded.teacher, publisher = excluded.publisher,
       release_year = excluded.release_year, term = excluded.term,
       educational_classification = excluded.educational_classification;`,
    [
      productId,
      cleanOptional(value.book_type),
      cleanOptional(value.school_grade),
      cleanOptional(value.subject),
      cleanOptional(value.teacher),
      cleanOptional(value.publisher),
      value.release_year
        ? requireInteger(Number(value.release_year), 'releaseYear', { min: 1 })
        : null,
      cleanOptional(value.term),
      cleanOptional(value.educational_classification),
    ]
  );
}

async function persistPrices(connection, productId, prices) {
  if (!prices) return;
  for (const row of prices) {
    await connection.run(
      `INSERT INTO product_prices (product_id, price_tier_id, price)
       VALUES (?, ?, ?)
       ON CONFLICT(product_id, price_tier_id) DO UPDATE
       SET price = excluded.price, updated_at = CURRENT_TIMESTAMP;`,
      [productId, row.priceTierId, row.price]
    );
  }
}

async function unlinkInactivePrices(connection, productId, rawTierIds) {
  if (rawTierIds === undefined) return [];
  const tierIds = rawTierIds.map((value) =>
    requireInteger(Number(value), 'priceTierId', { min: 1 })
  );
  if (new Set(tierIds).size !== tierIds.length) {
    throw new AppError(
      'A price tier cannot be unlinked more than once.',
      400,
      'DUPLICATE_PRICE_TIER'
    );
  }
  if (tierIds.length === 0) return [];

  const placeholders = tierIds.map(() => '?').join(', ');
  const tiers = await connection.all(
    `SELECT id, name, is_active FROM price_tiers WHERE id IN (${placeholders});`,
    tierIds
  );
  if (tiers.length !== tierIds.length) {
    const known = new Set(tiers.map((tier) => tier.id));
    throw new AppError('Price tier does not exist.', 400, 'PRICE_TIER_NOT_FOUND', {
      missing_ids: tierIds.filter((id) => !known.has(id)),
    });
  }
  const active = tiers.filter((tier) => Number(tier.is_active) === 1);
  if (active.length > 0) {
    throw new AppError(
      'Active price tiers must keep a product price. Disable the tier before unlinking it.',
      409,
      'ACTIVE_PRICE_TIER_UNLINK_FORBIDDEN',
      { active_tiers: active.map(({ id, name }) => ({ id, name })) }
    );
  }

  await connection.run(
    `DELETE FROM product_prices WHERE product_id = ? AND price_tier_id IN (${placeholders});`,
    [productId, ...tierIds]
  );
  return tierIds;
}

export async function createProduct(productData, adminUserId) {
  const name = String(field(productData, 'name') || '').trim();
  if (!name) throw new AppError('Product name is required.', 400, 'PRODUCT_NAME_REQUIRED');
  const policy = availabilityPolicyFrom(productData);
  const isActiveRaw = field(productData, 'isActive', 'is_active');
  if (typeof isActiveRaw !== 'boolean' && ![0, 1].includes(isActiveRaw)) {
    throw new AppError('Active status is required.', 400, 'ACTIVE_STATUS_REQUIRED');
  }
  const lowStock = requireInteger(
    Number(field(productData, 'lowStockThreshold', 'low_stock_threshold')),
    'lowStockThreshold',
    { min: 0 }
  );
  const purchaseCost = requirePiasters(
    field(productData, 'purchaseCost', 'purchase_cost') ?? 0,
    'purchaseCost'
  );
  const depositPct =
    policy === PRODUCT_POLICIES.STOCK_ONLY
      ? 0
      : requireInteger(
          Number(
            field(productData, 'defaultPreorderDepositPct', 'default_preorder_deposit_pct') ?? 50
          ),
          'defaultPreorderDepositPct',
          { min: 0, max: 100 }
        );
  const pickupMethod =
    policy === PRODUCT_POLICIES.STOCK_ONLY
      ? 'walk_in'
      : String(field(productData, 'defaultPickupMethod', 'default_pickup_method') || 'walk_in');
  const instructions =
    policy === PRODUCT_POLICIES.STOCK_ONLY
      ? null
      : cleanOptional(field(productData, 'preorderInstructions', 'preorder_instructions'));
  const book = normalizeBookDetails(productData);

  return withTransaction(async (connection) => {
    const categoryId = await validateCategory(
      connection,
      field(productData, 'categoryId', 'category_id')
    );
    const category = await connection.get('SELECT id, code FROM categories WHERE id = ?;', [
      categoryId,
    ]);
    const { sku, barcode } = await nextProductIdentity(connection, category);
    requireCode128Barcode(barcode);
    const prices = await normalizePrices(connection, field(productData, 'prices'), {
      required: true,
    });
    const result = await connection.run(
      `INSERT INTO products
       (name, sku, barcode, category_id, description, is_active, can_be_sold, can_be_preordered,
        availability_policy, default_preorder_deposit_pct, default_pickup_method,
        preorder_instructions, low_stock_threshold, purchase_cost, notes)
       VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?, ?, ?, ?);`,
      [
        name,
        sku,
        barcode,
        categoryId,
        cleanOptional(field(productData, 'description')),
        isActiveRaw ? 1 : 0,
        policy === PRODUCT_POLICIES.STOCK_WITH_PREORDER_WHEN_OUT_OF_STOCK ? 1 : 0,
        policy,
        depositPct,
        pickupMethod,
        instructions,
        lowStock,
        purchaseCost,
        cleanOptional(field(productData, 'notes')),
      ]
    );
    const productId = result.lastID;
    await persistPrices(connection, productId, prices);
    await upsertBookDetails(connection, productId, book);
    const token = await saveSecureToken(connection, 'product', productId);
    await connection.run(
      "INSERT OR IGNORE INTO qr_tokens (token, type, reference_id) VALUES (?, 'product', ?);",
      [token, productId]
    );
    await writeAuditLog({
      userId: adminUserId,
      actionType: 'PRODUCT_CREATE',
      entityType: 'products',
      entityId: productId,
      afterValues: { name, sku, availabilityPolicy: policy },
      connection,
    });
    return getProductDetails(productId, connection);
  });
}

export async function updateProduct(id, productData, adminUserId) {
  return withTransaction(async (connection) => {
    const old = await getProductDetails(id, connection);
    if (!old) throw new AppError('Product not found.', 404, 'PRODUCT_NOT_FOUND');
    const policy = availabilityPolicyFrom(productData, old.availability_policy);
    if (
      policy === PRODUCT_POLICIES.STOCK_ONLY &&
      old.availability_policy !== PRODUCT_POLICIES.STOCK_ONLY &&
      Number(old.open_preorder_quantity) > 0
    ) {
      throw new AppError(
        'Cannot switch to stock-only while open preorders exist.',
        409,
        'OPEN_PREORDERS_BLOCK_POLICY_CHANGE'
      );
    }

    const name =
      field(productData, 'name') === undefined
        ? old.name
        : String(field(productData, 'name')).trim();
    if (!name) throw new AppError('Product name is required.', 400, 'PRODUCT_NAME_REQUIRED');
    const requestedSku = field(productData, 'sku');
    const requestedBarcode = field(productData, 'barcode');
    if (requestedSku !== undefined && String(requestedSku).trim() !== old.sku) {
      throw new AppError('SKU is generated and cannot be changed.', 409, 'PRODUCT_SKU_IMMUTABLE');
    }
    if (requestedBarcode !== undefined && String(requestedBarcode || '').trim() !== old.barcode) {
      throw new AppError(
        'Barcode is generated and cannot be changed.',
        409,
        'PRODUCT_BARCODE_IMMUTABLE'
      );
    }

    const categoryId =
      field(productData, 'categoryId', 'category_id') === undefined
        ? old.category_id
        : await validateCategory(connection, field(productData, 'categoryId', 'category_id'));
    if (Number(categoryId) !== Number(old.category_id)) {
      throw new AppError(
        'A product cannot be moved to another category after its identity is generated.',
        409,
        'PRODUCT_CATEGORY_IMMUTABLE'
      );
    }
    const lowStock =
      field(productData, 'lowStockThreshold', 'low_stock_threshold') === undefined
        ? old.low_stock_threshold
        : requireInteger(
            Number(field(productData, 'lowStockThreshold', 'low_stock_threshold')),
            'lowStockThreshold',
            { min: 0 }
          );
    const purchaseCost =
      field(productData, 'purchaseCost', 'purchase_cost') === undefined
        ? old.purchase_cost
        : requirePiasters(field(productData, 'purchaseCost', 'purchase_cost'), 'purchaseCost');
    const depositPct =
      policy === PRODUCT_POLICIES.STOCK_ONLY
        ? 0
        : requireInteger(
            Number(
              field(productData, 'defaultPreorderDepositPct', 'default_preorder_deposit_pct') ??
                old.default_preorder_deposit_pct
            ),
            'defaultPreorderDepositPct',
            { min: 0, max: 100 }
          );
    const pickupMethod =
      policy === PRODUCT_POLICIES.STOCK_ONLY
        ? 'walk_in'
        : String(
            field(productData, 'defaultPickupMethod', 'default_pickup_method') ??
              old.default_pickup_method
          );
    const instructions =
      policy === PRODUCT_POLICIES.STOCK_ONLY
        ? null
        : cleanOptional(
            field(productData, 'preorderInstructions', 'preorder_instructions') ??
              old.preorder_instructions
          );
    const activeRaw = field(productData, 'isActive', 'is_active');
    const isActive = activeRaw === undefined ? old.is_active : activeRaw ? 1 : 0;
    const prices = await normalizePrices(connection, field(productData, 'prices'), {
      required: false,
    });
    const sku = old.sku;
    const barcode = old.barcode;

    await connection.run(
      `UPDATE products SET name = ?, sku = ?, barcode = ?, category_id = ?, description = ?,
       is_active = ?, can_be_sold = 1, can_be_preordered = ?, availability_policy = ?,
       default_preorder_deposit_pct = ?, default_pickup_method = ?, preorder_instructions = ?,
       low_stock_threshold = ?, purchase_cost = ?, notes = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?;`,
      [
        name,
        sku,
        barcode,
        categoryId,
        field(productData, 'description') === undefined
          ? old.description
          : cleanOptional(field(productData, 'description')),
        isActive,
        policy === PRODUCT_POLICIES.STOCK_WITH_PREORDER_WHEN_OUT_OF_STOCK ? 1 : 0,
        policy,
        depositPct,
        pickupMethod,
        instructions,
        lowStock,
        purchaseCost,
        field(productData, 'notes') === undefined
          ? old.notes
          : cleanOptional(field(productData, 'notes')),
        id,
      ]
    );
    await persistPrices(connection, id, prices);
    const unlinkedPriceTierIds = await unlinkInactivePrices(
      connection,
      id,
      field(productData, 'unlinkPriceTierIds', 'unlink_price_tier_ids')
    );
    const bookExplicit =
      field(productData, 'isBook', 'is_book') !== undefined ||
      field(productData, 'bookDetails', 'book_details') !== undefined;
    if (bookExplicit) await upsertBookDetails(connection, id, normalizeBookDetails(productData));
    await writeAuditLog({
      userId: adminUserId,
      actionType: 'PRODUCT_UPDATE',
      entityType: 'products',
      entityId: Number(id),
      beforeValues: { name: old.name, sku: old.sku, availabilityPolicy: old.availability_policy },
      afterValues: { name, sku, availabilityPolicy: policy, unlinkedPriceTierIds },
      connection,
    });
    return getProductDetails(id, connection);
  });
}

export async function deleteProduct(id, adminUserId) {
  return withTransaction(async (connection) => {
    const product = await getProductDetails(id, connection);
    if (!product) throw new AppError('Product not found.', 404, 'PRODUCT_NOT_FOUND');

    if (!product.can_delete) {
      throw new AppError(
        'Product has operational or financial history and cannot be deleted. Disable it instead.',
        409,
        'PRODUCT_IN_USE',
        product.dependency_counts
      );
    }

    await connection.run(
      "DELETE FROM secure_tokens WHERE token_type = 'product' AND reference_id = ?;",
      [id]
    );
    await connection.run("DELETE FROM qr_tokens WHERE type = 'product' AND reference_id = ?;", [
      id,
    ]);
    await connection.run('DELETE FROM product_book_details WHERE product_id = ?;', [id]);
    await connection.run('DELETE FROM product_prices WHERE product_id = ?;', [id]);
    const result = await connection.run('DELETE FROM products WHERE id = ?;', [id]);
    if (result.changes !== 1) throw new AppError('Product not found.', 404, 'PRODUCT_NOT_FOUND');

    await writeAuditLog({
      userId: adminUserId,
      actionType: 'PRODUCT_DELETE',
      entityType: 'products',
      entityId: Number(id),
      beforeValues: {
        id: product.id,
        name: product.name,
        sku: product.sku,
        category_id: product.category_id,
        dependency_counts: product.dependency_counts,
      },
      afterValues: { id: Number(id), deleted: true },
      notes: `Unused product deleted: ${product.name}`,
      connection,
    });
    return { id: Number(id) };
  });
}

export async function getOrCreateProductQrToken(productId, { quantity, label_size }, adminUserId) {
  return withTransaction(async (connection) => {
    const product = await getProductDetails(productId, connection);
    if (!product) throw new AppError('Product not found.', 404, 'PRODUCT_NOT_FOUND');
    requireCode128Barcode(product.barcode || product.sku);
    const qty = requireInteger(Number(quantity || 1), 'quantity', { min: 1, max: 500 });
    const labelSizes = {
      small: 'small',
      medium: 'medium',
      large: 'large',
      '38x25': 'small',
      '50x25': 'medium',
      '80x50': 'large',
    };
    const labelSize = labelSizes[label_size] || 'medium';
    await writeAuditLog({
      userId: adminUserId,
      actionType: 'PRODUCT_LABEL_PREPARE',
      entityType: 'products',
      entityId: Number(productId),
      afterValues: { quantity: qty, labelSize },
      connection,
    });
    return {
      product: { id: product.id, name: product.name, sku: product.sku, barcode: product.barcode },
      barcode: product.barcode || product.sku,
      token: product.barcode || product.sku,
      quantity: qty,
      label_size: labelSize,
    };
  });
}

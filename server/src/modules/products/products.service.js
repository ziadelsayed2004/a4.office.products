import db, { withTransaction } from '../../db/index.js';
import { writeAuditLog } from '../../utils/auditLogger.js';
import {
  AppError, generateSecureToken, requireInteger, requirePiasters, saveSecureToken
} from '../../utils/financial.js';

export const PRODUCT_POLICIES = Object.freeze({
  STOCK_ONLY: 'STOCK_ONLY',
  STOCK_WITH_PREORDER_WHEN_OUT_OF_STOCK: 'STOCK_WITH_PREORDER_WHEN_OUT_OF_STOCK'
});

const POLICY_VALUES = Object.values(PRODUCT_POLICIES);

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
    throw new AppError('availabilityPolicy must be STOCK_ONLY or STOCK_WITH_PREORDER_WHEN_OUT_OF_STOCK.', 400, 'INVALID_AVAILABILITY_POLICY');
  }
  if (field(data, 'canBeSold', 'can_be_sold') === 0 || field(data, 'canBeSold', 'can_be_sold') === false) {
    throw new AppError('Preorder-only and non-sellable combinations are not supported.', 400, 'UNSUPPORTED_PRODUCT_POLICY');
  }
  return policy;
}

function decorateAvailability(product) {
  const stock = Number(product.stock ?? product.stockOnHand ?? 0);
  const openQuantity = Number(product.open_preorder_quantity ?? product.open_preorders ?? 0);
  const policy = product.availability_policy;
  const active = Number(product.is_active) === 1;
  return {
    ...product,
    stock,
    open_preorders: openQuantity,
    stockOnHand: stock,
    openPreorderQuantity: openQuantity,
    availabilityPolicy: policy,
    defaultPreorderDepositPct: Number(product.default_preorder_deposit_pct || 0),
    defaultPickupMethod: product.default_pickup_method,
    preorderInstructions: product.preorder_instructions,
    canSellNow: active && stock > 0,
    canPreorderNow: active
      && policy === PRODUCT_POLICIES.STOCK_WITH_PREORDER_WHEN_OUT_OF_STOCK
      && stock === 0
  };
}

function baseProductSelect() {
  return `SELECT p.*, c.name AS category_name,
          COALESCE((SELECT after_quantity FROM inventory_ledger il WHERE il.product_id = p.id ORDER BY il.id DESC LIMIT 1), 0) AS stock,
          p.open_preorder_quantity AS open_preorders,
          CASE WHEN EXISTS (SELECT 1 FROM product_book_details pbd WHERE pbd.product_id = p.id) THEN 1 ELSE 0 END AS is_book
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
    )
  ]);
  return decorateAvailability({
    ...product,
    book_details: bookDetails || null,
    prices: prices.map((price) => ({ ...price, price: price.price ?? null }))
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
    if (required) throw new AppError('Prices are required for every active price tier.', 400, 'PRICES_REQUIRED');
    return null;
  }
  const activeTiers = await connection.all('SELECT id, name FROM price_tiers WHERE is_active = 1 ORDER BY id;');
  const byTier = new Map();
  for (const row of rawPrices) {
    const tierId = requireInteger(Number(field(row, 'priceTierId', 'price_tier_id')), 'priceTierId', { min: 1 });
    if (byTier.has(tierId)) throw new AppError('A price tier cannot appear more than once.', 400, 'DUPLICATE_PRICE_TIER');
    byTier.set(tierId, requirePiasters(field(row, 'price', 'price'), 'price'));
  }
  const missing = activeTiers.filter((tier) => !byTier.has(tier.id));
  if (missing.length) {
    throw new AppError(`Missing prices for active tiers: ${missing.map((tier) => tier.name).join(', ')}`, 400, 'ACTIVE_TIER_PRICE_REQUIRED');
  }
  const knownIds = new Set((await connection.all('SELECT id FROM price_tiers;')).map((tier) => tier.id));
  for (const id of byTier.keys()) {
    if (!knownIds.has(id)) throw new AppError(`Price tier ${id} does not exist.`, 400, 'PRICE_TIER_NOT_FOUND');
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
  if (value.educational_classification && !['external_book', 'school_book', 'booklet', 'notes'].includes(value.educational_classification)) {
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
      productId, cleanOptional(value.book_type), cleanOptional(value.school_grade), cleanOptional(value.subject),
      cleanOptional(value.teacher), cleanOptional(value.publisher),
      value.release_year ? requireInteger(Number(value.release_year), 'releaseYear', { min: 1 }) : null,
      cleanOptional(value.term), cleanOptional(value.educational_classification)
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

export async function createProduct(productData, adminUserId) {
  const name = String(field(productData, 'name') || '').trim();
  const sku = String(field(productData, 'sku') || '').trim();
  if (!name) throw new AppError('Product name is required.', 400, 'PRODUCT_NAME_REQUIRED');
  if (!sku) throw new AppError('SKU is required.', 400, 'PRODUCT_SKU_REQUIRED');
  const policy = availabilityPolicyFrom(productData);
  const isActiveRaw = field(productData, 'isActive', 'is_active');
  if (typeof isActiveRaw !== 'boolean' && ![0, 1].includes(isActiveRaw)) {
    throw new AppError('Active status is required.', 400, 'ACTIVE_STATUS_REQUIRED');
  }
  const lowStock = requireInteger(Number(field(productData, 'lowStockThreshold', 'low_stock_threshold')), 'lowStockThreshold', { min: 0 });
  const initialStockRaw = field(productData, 'initialStock', 'initial_stock');
  const initialStock = requireInteger(Number(initialStockRaw ?? 0), 'initialStock', { min: 0 });
  const purchaseCost = requirePiasters(field(productData, 'purchaseCost', 'purchase_cost') ?? 0, 'purchaseCost');
  const depositPct = policy === PRODUCT_POLICIES.STOCK_ONLY
    ? 0
    : requireInteger(Number(field(productData, 'defaultPreorderDepositPct', 'default_preorder_deposit_pct') ?? 50), 'defaultPreorderDepositPct', { min: 0, max: 100 });
  const pickupMethod = policy === PRODUCT_POLICIES.STOCK_ONLY
    ? 'walk_in'
    : String(field(productData, 'defaultPickupMethod', 'default_pickup_method') || 'walk_in');
  const instructions = policy === PRODUCT_POLICIES.STOCK_ONLY
    ? null
    : cleanOptional(field(productData, 'preorderInstructions', 'preorder_instructions'));
  const book = normalizeBookDetails(productData);

  return withTransaction(async (connection) => {
    const categoryId = await validateCategory(connection, field(productData, 'categoryId', 'category_id'));
    const prices = await normalizePrices(connection, field(productData, 'prices'), { required: true });
    if (await connection.get('SELECT id FROM products WHERE sku = ?;', [sku])) {
      throw new AppError('SKU is already used by another product.', 409, 'SKU_CONFLICT');
    }
    const result = await connection.run(
      `INSERT INTO products
       (name, sku, barcode, category_id, description, is_active, can_be_sold, can_be_preordered,
        availability_policy, default_preorder_deposit_pct, default_pickup_method,
        preorder_instructions, low_stock_threshold, purchase_cost, notes)
       VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?, ?, ?, ?);`,
      [
        name, sku, cleanOptional(field(productData, 'barcode')), categoryId,
        cleanOptional(field(productData, 'description')), isActiveRaw ? 1 : 0,
        policy === PRODUCT_POLICIES.STOCK_WITH_PREORDER_WHEN_OUT_OF_STOCK ? 1 : 0,
        policy, depositPct, pickupMethod, instructions, lowStock, purchaseCost,
        cleanOptional(field(productData, 'notes'))
      ]
    );
    const productId = result.lastID;
    await persistPrices(connection, productId, prices);
    await upsertBookDetails(connection, productId, book);
    if (initialStock > 0) {
      await connection.run(
        `INSERT INTO inventory_ledger
         (product_id, transaction_type, quantity_changed, before_quantity, after_quantity, user_id, notes)
         VALUES (?, 'STOCK_IN', ?, 0, ?, ?, ?);`,
        [productId, initialStock, initialStock, adminUserId, 'Initial stock entered during product creation']
      );
    }
    const token = await saveSecureToken(connection, 'product', productId);
    await connection.run("INSERT OR IGNORE INTO qr_tokens (token, type, reference_id) VALUES (?, 'product', ?);", [token, productId]);
    await writeAuditLog({
      userId: adminUserId, actionType: 'PRODUCT_CREATE', entityType: 'products', entityId: productId,
      afterValues: { name, sku, availabilityPolicy: policy, initialStock }, connection
    });
    return getProductDetails(productId, connection);
  });
}

export async function updateProduct(id, productData, adminUserId) {
  return withTransaction(async (connection) => {
    const old = await getProductDetails(id, connection);
    if (!old) throw new AppError('Product not found.', 404, 'PRODUCT_NOT_FOUND');
    const policy = availabilityPolicyFrom(productData, old.availability_policy);
    if (policy === PRODUCT_POLICIES.STOCK_ONLY
        && old.availability_policy !== PRODUCT_POLICIES.STOCK_ONLY
        && Number(old.open_preorder_quantity) > 0) {
      throw new AppError('Cannot switch to stock-only while open preorders exist.', 409, 'OPEN_PREORDERS_BLOCK_POLICY_CHANGE');
    }

    const name = field(productData, 'name') === undefined ? old.name : String(field(productData, 'name')).trim();
    const sku = field(productData, 'sku') === undefined ? old.sku : String(field(productData, 'sku')).trim();
    if (!name || !sku) throw new AppError('Product name and SKU are required.', 400, 'PRODUCT_FIELDS_REQUIRED');
    const conflict = await connection.get('SELECT id FROM products WHERE sku = ? AND id != ?;', [sku, id]);
    if (conflict) throw new AppError('SKU is already used by another product.', 409, 'SKU_CONFLICT');

    const categoryId = field(productData, 'categoryId', 'category_id') === undefined
      ? old.category_id
      : await validateCategory(connection, field(productData, 'categoryId', 'category_id'));
    const lowStock = field(productData, 'lowStockThreshold', 'low_stock_threshold') === undefined
      ? old.low_stock_threshold
      : requireInteger(Number(field(productData, 'lowStockThreshold', 'low_stock_threshold')), 'lowStockThreshold', { min: 0 });
    const purchaseCost = field(productData, 'purchaseCost', 'purchase_cost') === undefined
      ? old.purchase_cost
      : requirePiasters(field(productData, 'purchaseCost', 'purchase_cost'), 'purchaseCost');
    const depositPct = policy === PRODUCT_POLICIES.STOCK_ONLY ? 0 : requireInteger(
      Number(field(productData, 'defaultPreorderDepositPct', 'default_preorder_deposit_pct') ?? old.default_preorder_deposit_pct),
      'defaultPreorderDepositPct', { min: 0, max: 100 }
    );
    const pickupMethod = policy === PRODUCT_POLICIES.STOCK_ONLY ? 'walk_in'
      : String(field(productData, 'defaultPickupMethod', 'default_pickup_method') ?? old.default_pickup_method);
    const instructions = policy === PRODUCT_POLICIES.STOCK_ONLY ? null
      : cleanOptional(field(productData, 'preorderInstructions', 'preorder_instructions') ?? old.preorder_instructions);
    const activeRaw = field(productData, 'isActive', 'is_active');
    const isActive = activeRaw === undefined ? old.is_active : (activeRaw ? 1 : 0);
    const prices = await normalizePrices(connection, field(productData, 'prices'), { required: false });

    await connection.run(
      `UPDATE products SET name = ?, sku = ?, barcode = ?, category_id = ?, description = ?,
       is_active = ?, can_be_sold = 1, can_be_preordered = ?, availability_policy = ?,
       default_preorder_deposit_pct = ?, default_pickup_method = ?, preorder_instructions = ?,
       low_stock_threshold = ?, purchase_cost = ?, notes = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?;`,
      [
        name, sku,
        field(productData, 'barcode') === undefined ? old.barcode : cleanOptional(field(productData, 'barcode')),
        categoryId,
        field(productData, 'description') === undefined ? old.description : cleanOptional(field(productData, 'description')),
        isActive, policy === PRODUCT_POLICIES.STOCK_WITH_PREORDER_WHEN_OUT_OF_STOCK ? 1 : 0,
        policy, depositPct, pickupMethod, instructions, lowStock, purchaseCost,
        field(productData, 'notes') === undefined ? old.notes : cleanOptional(field(productData, 'notes')), id
      ]
    );
    await persistPrices(connection, id, prices);
    const bookExplicit = field(productData, 'isBook', 'is_book') !== undefined || field(productData, 'bookDetails', 'book_details') !== undefined;
    if (bookExplicit) await upsertBookDetails(connection, id, normalizeBookDetails(productData));
    await writeAuditLog({
      userId: adminUserId, actionType: 'PRODUCT_UPDATE', entityType: 'products', entityId: Number(id),
      beforeValues: { name: old.name, sku: old.sku, availabilityPolicy: old.availability_policy },
      afterValues: { name, sku, availabilityPolicy: policy }, connection
    });
    return getProductDetails(id, connection);
  });
}

export async function getOrCreateProductQrToken(productId, { quantity, label_size }, adminUserId) {
  return withTransaction(async (connection) => {
    const product = await getProductDetails(productId, connection);
    if (!product) throw new AppError('Product not found.', 404, 'PRODUCT_NOT_FOUND');
    const existing = await connection.get(
      "SELECT token FROM secure_tokens WHERE token_type = 'product' AND reference_id = ?;", [productId]
    );
    const token = existing?.token || generateSecureToken('product');
    if (!existing) {
      await connection.run("INSERT INTO secure_tokens (token, token_type, reference_id) VALUES (?, 'product', ?);", [token, productId]);
      await connection.run("INSERT OR IGNORE INTO qr_tokens (token, type, reference_id) VALUES (?, 'product', ?);", [token, productId]);
    }
    const qty = requireInteger(Number(quantity || 1), 'quantity', { min: 1, max: 500 });
    const labelSize = ['small', 'medium', 'large'].includes(label_size) ? label_size : 'medium';
    await writeAuditLog({
      userId: adminUserId, actionType: 'PRODUCT_LABEL_PREPARE', entityType: 'products', entityId: Number(productId),
      afterValues: { quantity: qty, labelSize }, connection
    });
    return { product: { id: product.id, name: product.name, sku: product.sku, barcode: product.barcode }, token, quantity: qty, label_size: labelSize };
  });
}

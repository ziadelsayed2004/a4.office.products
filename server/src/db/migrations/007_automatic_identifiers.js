import crypto from 'node:crypto';

export const version = '007';
export const name = 'automatic_identifiers';
export const checksum = crypto
  .createHash('sha256')
  .update(`${version}:${name}:2026-07-15-v1`)
  .digest('hex');

const pad = (value, width) => String(value).padStart(width, '0');

async function addColumn(db, table, definition) {
  const name = definition.trim().split(/\s+/)[0];
  const columns = await db.all(`PRAGMA table_info(${table});`);
  if (!columns.some((column) => column.name === name)) {
    await db.run(`ALTER TABLE ${table} ADD COLUMN ${definition};`);
  }
}

function replaceSnapshot(value, replacements) {
  if (typeof value === 'string') return replacements.get(value) || value;
  if (Array.isArray(value)) return value.map((item) => replaceSnapshot(item, replacements));
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, replaceSnapshot(item, replacements)])
    );
  }
  return value;
}

async function recordMapping(db, entityType, entityId, oldValue, newValue) {
  if (!oldValue || oldValue === newValue) return;
  await db.run(
    `INSERT INTO identifier_migration_map
      (migration_version, entity_type, entity_id, old_value, new_value)
     VALUES (?, ?, ?, ?, ?);`,
    [version, entityType, entityId, oldValue, newValue]
  );
}

export async function up(db) {
  await addColumn(db, 'categories', 'code TEXT');
  await db.exec(`
    CREATE TABLE IF NOT EXISTS number_sequences (
      sequence_type TEXT NOT NULL,
      scope_key TEXT NOT NULL DEFAULT 'GLOBAL',
      last_value INTEGER NOT NULL CHECK(last_value >= 0),
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY(sequence_type, scope_key)
    );
    CREATE TABLE IF NOT EXISTS identifier_migration_map (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      migration_version TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id INTEGER NOT NULL,
      old_value TEXT NOT NULL,
      new_value TEXT NOT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(migration_version, entity_type, entity_id, old_value)
    );
    DROP TRIGGER IF EXISTS trg_receipt_snapshot_immutable;
    DROP TRIGGER IF EXISTS trg_order_item_snapshot_immutable;
  `);

  const replacements = new Map();
  const categories = await db.all('SELECT id, code FROM categories ORDER BY created_at, id;');
  for (let index = 0; index < categories.length; index += 1) {
    const category = categories[index];
    const code = `CAT${pad(index + 1, 3)}`;
    await recordMapping(db, 'category_code', category.id, category.code, code);
    await db.run('UPDATE categories SET code = ? WHERE id = ?;', [code, category.id]);
  }

  const products = await db.all(
    `SELECT p.id, p.category_id, p.sku, p.barcode, c.code AS category_code
       FROM products p JOIN categories c ON c.id = p.category_id
      ORDER BY p.category_id, p.created_at, p.id;`
  );
  for (const product of products) {
    await db.run('UPDATE products SET sku = ?, barcode = ? WHERE id = ?;', [
      `TMP-SKU-${product.id}`,
      `TMP-BAR-${product.id}`,
      product.id,
    ]);
  }
  const productCounters = new Map();
  for (const product of products) {
    const next = (productCounters.get(product.category_id) || 0) + 1;
    productCounters.set(product.category_id, next);
    const sku = `${product.category_code}-${pad(next, 6)}`;
    replacements.set(product.sku, sku);
    if (product.barcode) replacements.set(product.barcode, sku);
    await recordMapping(db, 'product_sku', product.id, product.sku, sku);
    await recordMapping(db, 'product_barcode', product.id, product.barcode, sku);
    await db.run('UPDATE products SET sku = ?, barcode = ? WHERE id = ?;', [sku, sku, product.id]);
  }
  await db.exec(`
    UPDATE order_items SET sku_snapshot = (SELECT sku FROM products WHERE id = order_items.product_id);
    UPDATE preorder_items SET sku_snapshot = (SELECT sku FROM products WHERE id = preorder_items.product_id);
  `);

  const orders = await db.all('SELECT id, invoice_number FROM orders ORDER BY created_at, id;');
  await db.exec("UPDATE orders SET invoice_number = 'TMP-INV-' || id;");
  const saleNumbers = new Map();
  for (let index = 0; index < orders.length; index += 1) {
    const order = orders[index];
    const sequence = index + 1;
    const invoiceNumber = `INV-${pad(sequence, 8)}`;
    saleNumbers.set(order.id, sequence);
    replacements.set(order.invoice_number, invoiceNumber);
    await recordMapping(db, 'invoice_number', order.id, order.invoice_number, invoiceNumber);
    await db.run('UPDATE orders SET invoice_number = ? WHERE id = ?;', [invoiceNumber, order.id]);
  }

  const preorders = await db.all(
    'SELECT id, preorder_number FROM preorders ORDER BY created_at, id;'
  );
  await db.exec("UPDATE preorders SET preorder_number = 'TMP-PR-' || id;");
  const preorderNumbers = new Map();
  for (let index = 0; index < preorders.length; index += 1) {
    const preorder = preorders[index];
    const sequence = index + 1;
    const number = `PR-${pad(sequence, 8)}`;
    preorderNumbers.set(preorder.id, sequence);
    replacements.set(preorder.preorder_number, number);
    await recordMapping(db, 'preorder_number', preorder.id, preorder.preorder_number, number);
    await db.run('UPDATE preorders SET preorder_number = ? WHERE id = ?;', [number, preorder.id]);
  }

  const returns = await db.all('SELECT id, return_number FROM returns ORDER BY created_at, id;');
  await db.exec(
    "UPDATE returns SET return_number = 'TMP-RTN-' || id WHERE return_number IS NOT NULL;"
  );
  const returnNumbers = new Map();
  for (let index = 0; index < returns.length; index += 1) {
    const item = returns[index];
    const sequence = index + 1;
    const number = `RTN-${pad(sequence, 8)}`;
    returnNumbers.set(item.id, sequence);
    if (item.return_number) replacements.set(item.return_number, number);
    await recordMapping(db, 'return_number', item.id, item.return_number, number);
    await db.run('UPDATE returns SET return_number = ? WHERE id = ?;', [number, item.id]);
  }

  const receipts = await db.all(
    'SELECT id, receipt_number, reference_type, reference_id, snapshot_json FROM receipts ORDER BY created_at, id;'
  );
  await db.exec("UPDATE receipts SET receipt_number = 'TMP-REC-' || id;");
  let orphanReceipt = 0;
  for (const receipt of receipts) {
    let number;
    if (receipt.reference_type === 'order_sale') {
      number = `REC-${pad(saleNumbers.get(receipt.reference_id), 8)}`;
    } else if (receipt.reference_type === 'preorder_deposit') {
      number = `REC-PR-${pad(preorderNumbers.get(receipt.reference_id), 8)}`;
    } else if (receipt.reference_type === 'preorder_pickup') {
      const preorder = await db.get('SELECT pickup_order_id FROM preorders WHERE id = ?;', [
        receipt.reference_id,
      ]);
      number = `REC-${pad(saleNumbers.get(preorder?.pickup_order_id), 8)}`;
    } else if (receipt.reference_type === 'order_return') {
      number = `REC-RTN-${pad(returnNumbers.get(receipt.reference_id), 8)}`;
    }
    if (!number || number.includes('undefined')) {
      orphanReceipt += 1;
      number = `REC-LEGACY-${pad(orphanReceipt, 8)}`;
    }
    replacements.set(receipt.receipt_number, number);
    await recordMapping(db, 'receipt_number', receipt.id, receipt.receipt_number, number);
    await db.run('UPDATE receipts SET receipt_number = ? WHERE id = ?;', [number, receipt.id]);
  }

  for (const receipt of receipts) {
    if (!receipt.snapshot_json) continue;
    try {
      const updated = replaceSnapshot(JSON.parse(receipt.snapshot_json), replacements);
      const current = await db.get('SELECT receipt_number FROM receipts WHERE id = ?;', [
        receipt.id,
      ]);
      updated.receiptNumber = current.receipt_number;
      await db.run('UPDATE receipts SET snapshot_json = ? WHERE id = ?;', [
        JSON.stringify(updated),
        receipt.id,
      ]);
    } catch {
      await db.run(
        `INSERT INTO migration_review_issues
          (migration_version, issue_type, entity_type, entity_id, details_json)
         VALUES (?, 'INVALID_RECEIPT_SNAPSHOT', 'receipts', ?, ?);`,
        [version, receipt.id, JSON.stringify({ receiptNumber: receipt.receipt_number })]
      );
    }
  }

  const categoryIntegrity = await db.get(`
    SELECT
      SUM(CASE WHEN code IS NULL OR code NOT GLOB 'CAT[0-9][0-9][0-9]*' THEN 1 ELSE 0 END) AS invalid,
      COUNT(*) - COUNT(DISTINCT code) AS duplicates
    FROM categories;
  `);
  const productIntegrity = await db.get(`
    SELECT
      SUM(CASE WHEN sku IS NULL OR barcode IS NULL OR sku != barcode THEN 1 ELSE 0 END) AS invalid,
      COUNT(*) - COUNT(DISTINCT sku) AS duplicate_skus,
      COUNT(*) - COUNT(DISTINCT barcode) AS duplicate_barcodes
    FROM products;
  `);
  const documentIntegrity = await db.get(`
    SELECT
      (SELECT COUNT(*) - COUNT(DISTINCT invoice_number) FROM orders) AS duplicate_invoices,
      (SELECT COUNT(*) - COUNT(DISTINCT preorder_number) FROM preorders) AS duplicate_preorders,
      (SELECT COUNT(*) - COUNT(DISTINCT return_number) FROM returns) AS duplicate_returns,
      (SELECT COUNT(*) - COUNT(DISTINCT receipt_number) FROM receipts) AS duplicate_receipts;
  `);
  const integrityValues = [
    ...Object.values(categoryIntegrity || {}),
    ...Object.values(productIntegrity || {}),
    ...Object.values(documentIntegrity || {}),
  ].map((value) => Number(value || 0));
  if (integrityValues.some((value) => value !== 0)) {
    throw new Error('AUTOMATIC_IDENTIFIER_INTEGRITY_CHECK_FAILED');
  }

  await db.run(
    `INSERT OR REPLACE INTO number_sequences (sequence_type, scope_key, last_value)
     VALUES ('category', 'GLOBAL', ?), ('sale', 'GLOBAL', ?),
            ('preorder', 'GLOBAL', ?), ('return', 'GLOBAL', ?);`,
    [categories.length, orders.length, preorders.length, returns.length]
  );
  for (const [categoryId, count] of productCounters) {
    await db.run(
      `INSERT OR REPLACE INTO number_sequences (sequence_type, scope_key, last_value)
       VALUES ('product', ?, ?);`,
      [String(categoryId), count]
    );
  }

  await db.exec(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_categories_code_unique ON categories(code);
    CREATE TRIGGER IF NOT EXISTS trg_category_code_required_insert
      BEFORE INSERT ON categories WHEN NEW.code IS NULL OR trim(NEW.code) = ''
      BEGIN SELECT RAISE(ABORT, 'CATEGORY_CODE_REQUIRED'); END;
    CREATE TRIGGER IF NOT EXISTS trg_category_code_immutable
      BEFORE UPDATE OF code ON categories WHEN NEW.code != OLD.code
      BEGIN SELECT RAISE(ABORT, 'CATEGORY_CODE_IMMUTABLE'); END;
    CREATE TRIGGER IF NOT EXISTS trg_product_identity_immutable
      BEFORE UPDATE OF sku, barcode, category_id ON products
      WHEN NEW.sku != OLD.sku OR NEW.barcode != OLD.barcode OR NEW.category_id != OLD.category_id
      BEGIN SELECT RAISE(ABORT, 'PRODUCT_IDENTITY_IMMUTABLE'); END;
    CREATE TRIGGER IF NOT EXISTS trg_order_item_snapshot_immutable
      BEFORE UPDATE ON order_items
      BEGIN SELECT RAISE(ABORT, 'INVOICE_ITEM_SNAPSHOT_IMMUTABLE'); END;
    CREATE TRIGGER IF NOT EXISTS trg_receipt_snapshot_immutable
      BEFORE UPDATE OF snapshot_json, reference_type, reference_id, receipt_number ON receipts
      WHEN OLD.snapshot_json IS NOT NULL
      BEGIN SELECT RAISE(ABORT, 'RECEIPT_SNAPSHOT_IMMUTABLE'); END;
  `);
}

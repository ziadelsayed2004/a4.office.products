import crypto from 'node:crypto';

export const version = '003';
export const name = 'approval_cards_barcodes';
export const checksum = crypto
  .createHash('sha256')
  .update(`${version}:${name}:2026-07-14-v1`)
  .digest('hex');

async function addColumn(db, table, definition) {
  const column = definition.trim().split(/\s+/)[0];
  const columns = await db.all(`PRAGMA table_info(${table});`);
  if (!columns.some((candidate) => candidate.name === column)) {
    await db.run(`ALTER TABLE ${table} ADD COLUMN ${definition};`);
  }
}

export async function up(db) {
  await db.exec(`
    CREATE TABLE IF NOT EXISTS return_approval_cards (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      card_number TEXT UNIQUE NOT NULL,
      label TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK(status IN ('ACTIVE', 'DISABLED')),
      owner_admin_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
      token_nonce TEXT NOT NULL,
      token_version INTEGER NOT NULL DEFAULT 1 CHECK(token_version > 0),
      print_count INTEGER NOT NULL DEFAULT 0 CHECK(print_count >= 0),
      last_printed_at DATETIME,
      last_used_at DATETIME,
      disabled_at DATETIME,
      disabled_by INTEGER REFERENCES users(id) ON DELETE RESTRICT,
      disabled_reason TEXT,
      rotated_at DATETIME,
      rotated_by INTEGER REFERENCES users(id) ON DELETE RESTRICT,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_return_approval_cards_status
      ON return_approval_cards(status, created_at DESC);
    CREATE TABLE IF NOT EXISTS return_approval_card_print_requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      card_id INTEGER NOT NULL REFERENCES return_approval_cards(id) ON DELETE RESTRICT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
      request_key TEXT NOT NULL,
      copies INTEGER NOT NULL DEFAULT 1 CHECK(copies BETWEEN 1 AND 20),
      reason TEXT,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, request_key)
    );
    UPDATE return_authorizations
       SET status = 'REVOKED', revoked_reason = 'Legacy workflow retired',
           revoked_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
     WHERE status = 'ACTIVE';
    UPDATE products SET barcode = sku WHERE barcode IS NULL OR trim(barcode) = '';
    UPDATE products SET barcode = sku
     WHERE id NOT IN (SELECT MIN(id) FROM products GROUP BY barcode)
       AND barcode IN (SELECT barcode FROM products GROUP BY barcode HAVING COUNT(*) > 1);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_products_barcode_unique ON products(barcode);
  `);
  await addColumn(
    db,
    'returns',
    'approval_card_id INTEGER REFERENCES return_approval_cards(id) ON DELETE RESTRICT'
  );
  await addColumn(db, 'returns', 'approval_card_version INTEGER');
  await addColumn(db, 'returns', 'approval_snapshot_json TEXT');
}

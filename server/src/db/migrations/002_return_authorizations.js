import crypto from 'node:crypto';

export const version = '002';
export const name = 'return_authorizations';
export const checksum = crypto
  .createHash('sha256')
  .update(`${version}:${name}:2026-07-13-v2`)
  .digest('hex');

async function hasColumn(db, table, column) {
  const rows = await db.all(`PRAGMA table_info(${table});`);
  return rows.some((row) => row.name === column);
}

async function addColumn(db, table, definition) {
  const column = definition.trim().split(/\s+/)[0];
  if (!(await hasColumn(db, table, column))) {
    await db.run(`ALTER TABLE ${table} ADD COLUMN ${definition};`);
  }
}

async function rebuildProductPrices(db) {
  await db.exec(`
    DROP TABLE IF EXISTS product_prices_v002;
    CREATE TABLE product_prices_v002 (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      price_tier_id INTEGER NOT NULL REFERENCES price_tiers(id) ON DELETE RESTRICT,
      price INTEGER NOT NULL CHECK(price >= 0),
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(product_id, price_tier_id)
    );
    INSERT INTO product_prices_v002
      (id, product_id, price_tier_id, price, created_at, updated_at)
    SELECT id, product_id, price_tier_id, price, created_at, updated_at FROM product_prices;
    DROP TABLE product_prices;
    ALTER TABLE product_prices_v002 RENAME TO product_prices;
  `);
}

async function rebuildReturnItems(db) {
  await db.exec(`
    DROP TABLE IF EXISTS return_items_v002;
    CREATE TABLE return_items_v002 (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      return_id INTEGER NOT NULL REFERENCES returns(id) ON DELETE CASCADE,
      product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
      quantity INTEGER NOT NULL CHECK(quantity > 0),
      refund_amount INTEGER NOT NULL CHECK(refund_amount >= 0),
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      order_item_id INTEGER REFERENCES order_items(id) ON DELETE RESTRICT,
      disposition TEXT NOT NULL DEFAULT 'RESTOCK'
        CHECK(disposition IN ('RESTOCK', 'NO_RESTOCK')),
      restocked INTEGER NOT NULL DEFAULT 1 CHECK(restocked IN (0, 1)),
      CHECK((disposition = 'RESTOCK' AND restocked = 1)
         OR (disposition = 'NO_RESTOCK' AND restocked = 0))
    );
    INSERT INTO return_items_v002
      (id, return_id, product_id, quantity, refund_amount, created_at,
       order_item_id, disposition, restocked)
    SELECT id, return_id, product_id, quantity, refund_amount, created_at,
           order_item_id, disposition, restocked FROM return_items;
    DROP TABLE return_items;
    ALTER TABLE return_items_v002 RENAME TO return_items;
    CREATE INDEX IF NOT EXISTS idx_return_items_return ON return_items(return_id, id);
    CREATE INDEX IF NOT EXISTS idx_return_items_order_item ON return_items(order_item_id);
  `);
}

async function rebuildPayments(db) {
  await db.exec(`
    DROP TRIGGER IF EXISTS trg_payment_open_shift;
    DROP TABLE IF EXISTS payments_v002;
    CREATE TABLE payments_v002 (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      shift_id INTEGER NOT NULL REFERENCES shifts(id) ON DELETE RESTRICT,
      cashier_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
      reference_type TEXT NOT NULL CHECK(reference_type IN ('order', 'preorder')),
      reference_id INTEGER NOT NULL,
      payment_method TEXT NOT NULL,
      amount INTEGER NOT NULL CHECK(amount > 0),
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      method_id INTEGER REFERENCES payment_methods(id) ON DELETE RESTRICT,
      stage TEXT NOT NULL DEFAULT 'SALE'
        CHECK(stage IN ('SALE', 'PREORDER_DEPOSIT', 'PREORDER_PICKUP', 'REFUND')),
      direction TEXT NOT NULL DEFAULT 'IN' CHECK(direction IN ('IN', 'OUT')),
      applied_amount INTEGER,
      reference_number TEXT,
      note TEXT,
      cash_received INTEGER,
      change_amount INTEGER NOT NULL DEFAULT 0,
      method_snapshot TEXT,
      is_excluded INTEGER NOT NULL DEFAULT 0 CHECK(is_excluded IN (0, 1)),
      exclusion_reason TEXT,
      return_id INTEGER REFERENCES returns(id) ON DELETE RESTRICT
    );
    INSERT INTO payments_v002
      (id, shift_id, cashier_id, reference_type, reference_id, payment_method, amount,
       created_at, method_id, stage, direction, applied_amount, reference_number, note,
       cash_received, change_amount, method_snapshot, is_excluded, exclusion_reason, return_id)
    SELECT id, shift_id, cashier_id, reference_type, reference_id, payment_method, amount,
       created_at, method_id, stage, direction, applied_amount, reference_number, note,
       cash_received, change_amount, method_snapshot, is_excluded, exclusion_reason, return_id
      FROM payments;
    DROP TABLE payments;
    ALTER TABLE payments_v002 RENAME TO payments;

    CREATE INDEX IF NOT EXISTS idx_payments_reference ON payments(reference_type, reference_id);
    CREATE INDEX IF NOT EXISTS idx_payments_stage_method
      ON payments(stage, payment_method, created_at);
    CREATE INDEX IF NOT EXISTS idx_payments_return ON payments(return_id);

    CREATE TRIGGER trg_payment_open_shift BEFORE INSERT ON payments
    WHEN NOT EXISTS (
      SELECT 1 FROM shifts s
       WHERE s.id = NEW.shift_id AND s.user_id = NEW.cashier_id AND s.status = 'OPEN'
    )
    BEGIN SELECT RAISE(ABORT, 'OPEN_OWN_SHIFT_REQUIRED'); END;
  `);
}

async function rebuildReceipts(db) {
  await db.exec(`
    DROP TRIGGER IF EXISTS trg_receipt_snapshot_immutable;
    DROP TABLE IF EXISTS print_requests_v002;
    CREATE TABLE print_requests_v002 AS SELECT * FROM print_requests;
    DROP TABLE print_requests;
    DROP TABLE IF EXISTS receipts_v002;
    CREATE TABLE receipts_v002 (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      receipt_number TEXT UNIQUE NOT NULL,
      reference_type TEXT NOT NULL
        CHECK(reference_type IN ('order_sale', 'preorder_deposit', 'preorder_pickup', 'order_return')),
      reference_id INTEGER NOT NULL,
      printed_by INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
      print_count INTEGER NOT NULL DEFAULT 1 CHECK(print_count >= 1),
      last_printed_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      snapshot_json TEXT,
      qr_token TEXT
    );
    INSERT INTO receipts_v002
      (id, receipt_number, reference_type, reference_id, printed_by, print_count,
       last_printed_at, created_at, snapshot_json, qr_token)
    SELECT id, receipt_number, reference_type, reference_id, printed_by, print_count,
       last_printed_at, created_at, snapshot_json, qr_token FROM receipts;
    DROP TABLE receipts;
    ALTER TABLE receipts_v002 RENAME TO receipts;

    CREATE TABLE print_requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      receipt_id INTEGER NOT NULL REFERENCES receipts(id) ON DELETE RESTRICT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
      shift_id INTEGER NOT NULL REFERENCES shifts(id) ON DELETE RESTRICT,
      request_key TEXT NOT NULL,
      is_reprint INTEGER NOT NULL DEFAULT 0 CHECK(is_reprint IN (0, 1)),
      reason TEXT,
      copies INTEGER NOT NULL DEFAULT 1 CHECK(copies BETWEEN 1 AND 20),
      requested_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, request_key)
    );
    INSERT INTO print_requests
      (id, receipt_id, user_id, shift_id, request_key, is_reprint, reason, copies, requested_at)
    SELECT id, receipt_id, user_id, shift_id, request_key, is_reprint, reason, copies, requested_at
      FROM print_requests_v002;
    DROP TABLE print_requests_v002;

    CREATE INDEX IF NOT EXISTS idx_receipts_reference ON receipts(reference_type, reference_id);
    CREATE INDEX IF NOT EXISTS idx_receipts_number ON receipts(receipt_number);
    CREATE INDEX IF NOT EXISTS idx_print_requests_receipt
      ON print_requests(receipt_id, requested_at);
    CREATE TRIGGER trg_receipt_snapshot_immutable
    BEFORE UPDATE OF snapshot_json, reference_type, reference_id, receipt_number ON receipts
    WHEN OLD.snapshot_json IS NOT NULL
    BEGIN SELECT RAISE(ABORT, 'RECEIPT_SNAPSHOT_IMMUTABLE'); END;
  `);
}

async function rebuildInventoryLedger(db) {
  await db.exec(`
    DROP TRIGGER IF EXISTS trg_inventory_ledger_continuity;
    DROP TABLE IF EXISTS inventory_ledger_v002;
    CREATE TABLE inventory_ledger_v002 (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
      transaction_type TEXT NOT NULL
        CHECK(transaction_type IN ('STOCK_IN', 'SALE', 'PREORDER_PICKUP', 'RETURN',
                                   'ADJUSTMENT_ADD', 'ADJUSTMENT_SUB')),
      quantity_changed INTEGER NOT NULL CHECK(quantity_changed != 0),
      before_quantity INTEGER NOT NULL CHECK(before_quantity >= 0),
      after_quantity INTEGER NOT NULL CHECK(after_quantity >= 0),
      reference_type TEXT,
      reference_id INTEGER,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
      shift_id INTEGER REFERENCES shifts(id) ON DELETE RESTRICT,
      notes TEXT,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    INSERT INTO inventory_ledger_v002
      (id, product_id, transaction_type, quantity_changed, before_quantity, after_quantity,
       reference_type, reference_id, user_id, shift_id, notes, created_at)
    SELECT id, product_id, transaction_type, quantity_changed, before_quantity, after_quantity,
       reference_type, reference_id, user_id, shift_id, notes, created_at
      FROM inventory_ledger;
    DROP TABLE inventory_ledger;
    ALTER TABLE inventory_ledger_v002 RENAME TO inventory_ledger;

    CREATE INDEX IF NOT EXISTS idx_inv_ledger_product ON inventory_ledger(product_id);
    CREATE INDEX IF NOT EXISTS idx_inv_ledger_latest ON inventory_ledger(product_id, id DESC);
    CREATE TRIGGER trg_inventory_ledger_continuity
    BEFORE INSERT ON inventory_ledger
    WHEN NEW.before_quantity != COALESCE(
      (SELECT after_quantity FROM inventory_ledger
        WHERE product_id = NEW.product_id ORDER BY id DESC LIMIT 1), 0
    ) OR NEW.after_quantity != NEW.before_quantity + NEW.quantity_changed
    BEGIN SELECT RAISE(ABORT, 'INVENTORY_LEDGER_CONTINUITY_VIOLATION'); END;
  `);
}

async function backfillReturnNumbers(db) {
  const rows = await db.all(
    'SELECT id, created_at FROM returns WHERE return_number IS NULL ORDER BY created_at, id;'
  );
  for (const row of rows) {
    const dateKey = String(row.created_at || new Date().toISOString())
      .slice(0, 10)
      .replaceAll('-', '');
    await db.run(
      `INSERT INTO document_sequences (document_type, cairo_date, last_value)
       VALUES ('return', ?, 1)
       ON CONFLICT(document_type, cairo_date)
       DO UPDATE SET last_value = last_value + 1;`,
      [dateKey]
    );
    const sequence = await db.get(
      `SELECT last_value FROM document_sequences
        WHERE document_type = 'return' AND cairo_date = ?;`,
      [dateKey]
    );
    await db.run('UPDATE returns SET return_number = ? WHERE id = ?;', [
      `RTN-${dateKey}-${String(sequence.last_value).padStart(4, '0')}`,
      row.id,
    ]);
  }
}

export async function up(db) {
  // Rebuilt parent tables retain their canonical names before COMMIT, so all
  // deferred foreign keys resolve against the replacement tables atomically.
  await db.exec('PRAGMA defer_foreign_keys = ON;');

  await db.exec(`
    CREATE TABLE IF NOT EXISTS return_authorizations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      authorization_number TEXT UNIQUE NOT NULL,
      order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE RESTRICT,
      status TEXT NOT NULL DEFAULT 'ACTIVE'
        CHECK(status IN ('ACTIVE', 'CONSUMED', 'REVOKED', 'EXPIRED')),
      reason TEXT NOT NULL,
      total_refund INTEGER NOT NULL CHECK(total_refund >= 0),
      expires_at DATETIME NOT NULL,
      created_by INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
      token_nonce TEXT NOT NULL,
      token_version INTEGER NOT NULL DEFAULT 1 CHECK(token_version > 0),
      consumed_return_id INTEGER UNIQUE REFERENCES returns(id) ON DELETE RESTRICT,
      consumed_by INTEGER REFERENCES users(id) ON DELETE RESTRICT,
      consumed_shift_id INTEGER REFERENCES shifts(id) ON DELETE RESTRICT,
      consumed_at DATETIME,
      revoked_by INTEGER REFERENCES users(id) ON DELETE RESTRICT,
      revoked_reason TEXT,
      revoked_at DATETIME,
      print_count INTEGER NOT NULL DEFAULT 0 CHECK(print_count >= 0),
      last_printed_at DATETIME,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS return_authorization_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      authorization_id INTEGER NOT NULL REFERENCES return_authorizations(id) ON DELETE CASCADE,
      order_item_id INTEGER NOT NULL REFERENCES order_items(id) ON DELETE RESTRICT,
      product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
      product_name_snapshot TEXT NOT NULL,
      sku_snapshot TEXT,
      quantity INTEGER NOT NULL CHECK(quantity > 0),
      unit_price INTEGER NOT NULL CHECK(unit_price >= 0),
      refund_amount INTEGER NOT NULL CHECK(refund_amount >= 0),
      disposition TEXT NOT NULL CHECK(disposition IN ('RESTOCK', 'NO_RESTOCK')),
      no_restock_reason TEXT,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(authorization_id, order_item_id),
      CHECK(disposition = 'RESTOCK' OR length(trim(no_restock_reason)) > 0)
    );

    CREATE TABLE IF NOT EXISTS return_authorization_allocations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      authorization_id INTEGER NOT NULL REFERENCES return_authorizations(id) ON DELETE CASCADE,
      payment_method_id INTEGER NOT NULL REFERENCES payment_methods(id) ON DELETE RESTRICT,
      method_code_snapshot TEXT NOT NULL,
      method_name_snapshot TEXT NOT NULL,
      refund_mode TEXT NOT NULL
        CHECK(refund_mode IN ('CASH_DRAWER', 'EXTERNAL_REFERENCE', 'DISABLED')),
      amount INTEGER NOT NULL CHECK(amount > 0),
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(authorization_id, payment_method_id)
    );

    CREATE TABLE IF NOT EXISTS return_authorization_print_requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      authorization_id INTEGER NOT NULL REFERENCES return_authorizations(id) ON DELETE RESTRICT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
      request_key TEXT NOT NULL,
      copies INTEGER NOT NULL DEFAULT 1 CHECK(copies BETWEEN 1 AND 20),
      reason TEXT,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, request_key)
    );
  `);

  await addColumn(
    db,
    'payment_methods',
    'is_system INTEGER NOT NULL DEFAULT 0 CHECK(is_system IN (0, 1))'
  );
  await addColumn(
    db,
    'payment_methods',
    "refund_mode TEXT NOT NULL DEFAULT 'EXTERNAL_REFERENCE' CHECK(refund_mode IN ('CASH_DRAWER', 'EXTERNAL_REFERENCE', 'DISABLED'))"
  );
  await addColumn(
    db,
    'returns',
    'authorization_id INTEGER REFERENCES return_authorizations(id) ON DELETE RESTRICT'
  );
  await addColumn(db, 'returns', 'return_number TEXT');
  await addColumn(db, 'returns', 'authorized_by INTEGER REFERENCES users(id) ON DELETE RESTRICT');
  await addColumn(db, 'return_items', 'order_item_id INTEGER REFERENCES order_items(id)');
  await addColumn(db, 'return_items', "disposition TEXT NOT NULL DEFAULT 'RESTOCK'");
  await addColumn(db, 'return_items', 'restocked INTEGER NOT NULL DEFAULT 1');

  await db.exec(`
    UPDATE payment_methods
       SET is_system = CASE WHEN code IN ('Cash', 'Card', 'InstaPay', 'Wallet', 'Transfer')
                            THEN 1 ELSE COALESCE(is_system, 0) END,
           refund_mode = CASE WHEN code = 'Cash' THEN 'CASH_DRAWER'
                              WHEN refund_mode IS NULL OR refund_mode NOT IN
                                   ('CASH_DRAWER', 'EXTERNAL_REFERENCE', 'DISABLED')
                              THEN 'EXTERNAL_REFERENCE' ELSE refund_mode END;

    UPDATE return_items
       SET order_item_id = (
         SELECT oi.id
           FROM returns r JOIN order_items oi
             ON oi.order_id = r.order_id AND oi.product_id = return_items.product_id
          WHERE r.id = return_items.return_id
          ORDER BY oi.id LIMIT 1
       )
     WHERE order_item_id IS NULL;
  `);

  await backfillReturnNumbers(db);
  await rebuildReturnItems(db);
  await rebuildProductPrices(db);
  await rebuildPayments(db);
  await rebuildReceipts(db);
  await rebuildInventoryLedger(db);

  await db.exec(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_returns_authorization
      ON returns(authorization_id) WHERE authorization_id IS NOT NULL;
    CREATE UNIQUE INDEX IF NOT EXISTS idx_returns_number
      ON returns(return_number) WHERE return_number IS NOT NULL;
    CREATE UNIQUE INDEX IF NOT EXISTS idx_one_active_return_authorization
      ON return_authorizations(order_id) WHERE status = 'ACTIVE';
    CREATE INDEX IF NOT EXISTS idx_return_authorizations_list
      ON return_authorizations(status, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_return_authorizations_order
      ON return_authorizations(order_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_return_authorization_items_auth
      ON return_authorization_items(authorization_id, id);
    CREATE INDEX IF NOT EXISTS idx_return_authorization_allocations_auth
      ON return_authorization_allocations(authorization_id, id);
  `);

  const violations = await db.all('PRAGMA foreign_key_check;');
  if (violations.length > 0) {
    throw new Error(
      `Return authorization migration produced ${violations.length} foreign-key violation(s).`
    );
  }
}

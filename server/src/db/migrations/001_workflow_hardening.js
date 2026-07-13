import crypto from 'crypto';

export const version = '001';
export const name = 'workflow_hardening';
export const checksum = crypto
  .createHash('sha256')
  .update(`${version}:${name}:2026-07-12-v1`)
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

function secureToken(prefix) {
  return `${prefix}${crypto.randomBytes(24).toString('base64url')}`;
}

async function backfillDocumentSequence(db, type, table, column) {
  const rows = await db.all(`SELECT ${column} AS value FROM ${table} WHERE ${column} IS NOT NULL;`);
  const byDate = new Map();
  for (const row of rows) {
    const match = String(row.value).match(/^[A-Z]+-(\d{8})-(\d+)$/);
    if (!match) continue;
    const [, date, sequence] = match;
    byDate.set(date, Math.max(byDate.get(date) || 0, Number(sequence)));
  }
  for (const [date, lastValue] of byDate) {
    await db.run(
      `INSERT INTO document_sequences (document_type, cairo_date, last_value)
       VALUES (?, ?, ?)
       ON CONFLICT(document_type, cairo_date) DO UPDATE SET last_value = MAX(last_value, excluded.last_value);`,
      [type, date, lastValue]
    );
  }
}

async function backfillReceiptSnapshots(db) {
  const receipts = await db.all('SELECT * FROM receipts WHERE snapshot_json IS NULL ORDER BY id;');
  for (const receipt of receipts) {
    const snapshot = {
      version: 1,
      receiptId: receipt.id,
      receiptNumber: receipt.receipt_number,
      referenceType: receipt.reference_type,
      createdAt: receipt.created_at,
      items: [],
      payments: [],
    };

    if (receipt.reference_type === 'order_sale') {
      const order = await db.get(
        `SELECT o.*, u.name AS cashier_name
         FROM orders o JOIN users u ON u.id = o.cashier_id WHERE o.id = ?;`,
        [receipt.reference_id]
      );
      if (order) {
        Object.assign(snapshot, {
          invoiceId: order.id,
          invoiceNumber: order.invoice_number,
          origin: order.origin || 'SALE',
          status: order.status || 'COMPLETED',
          cashierName: order.cashier_name,
          customerName: order.customer_name_snapshot,
          customerPhone: order.customer_phone_snapshot,
          subtotal: order.subtotal,
          discount: order.discount,
          total: order.total,
          qrToken: order.qr_token,
        });
        snapshot.items = await db.all(
          `SELECT product_id, quantity, unit_price, total_price,
                  product_name_snapshot AS product_name, sku_snapshot AS product_sku,
                  price_tier_name_snapshot AS price_tier_name,
                  availability_policy_snapshot AS availability_policy
           FROM order_items WHERE order_id = ? ORDER BY id;`,
          [order.id]
        );
        snapshot.payments = await db.all(
          `SELECT method_snapshot AS method, stage, direction, applied_amount AS amount,
                  cash_received, change_amount, reference_number, note, created_at
           FROM payments WHERE reference_type = 'order' AND reference_id = ? AND is_excluded = 0 ORDER BY id;`,
          [order.id]
        );
      }
    } else {
      const preorder = await db.get(
        `SELECT p.*, u.name AS cashier_name
         FROM preorders p JOIN users u ON u.id = p.cashier_id WHERE p.id = ?;`,
        [receipt.reference_id]
      );
      if (preorder) {
        Object.assign(snapshot, {
          preorderId: preorder.id,
          preorderNumber: preorder.preorder_number,
          status: preorder.status,
          cashierName: preorder.cashier_name,
          customerName: preorder.customer_name_snapshot,
          customerPhone: preorder.customer_phone_snapshot,
          subtotal: preorder.subtotal,
          discount: preorder.discount,
          total: preorder.total_amount,
          depositRequired: preorder.deposit_required,
          depositPaid: preorder.deposit_paid,
          remainingAmount: preorder.remaining_amount,
          pickupMethod: preorder.pickup_method,
          qrToken: preorder.qr_pickup_token,
        });
        snapshot.items = await db.all(
          `SELECT product_id, quantity, unit_price, total_price,
                  product_name_snapshot AS product_name, sku_snapshot AS product_sku,
                  price_tier_name_snapshot AS price_tier_name,
                  availability_policy_snapshot AS availability_policy,
                  deposit_pct_snapshot AS deposit_pct
           FROM preorder_items WHERE preorder_id = ? ORDER BY id;`,
          [preorder.id]
        );
        const stage =
          receipt.reference_type === 'preorder_deposit' ? 'PREORDER_DEPOSIT' : 'PREORDER_PICKUP';
        snapshot.payments = await db.all(
          `SELECT method_snapshot AS method, stage, direction, applied_amount AS amount,
                  cash_received, change_amount, reference_number, note, created_at
           FROM payments WHERE reference_type = 'preorder' AND reference_id = ? AND stage = ? AND is_excluded = 0 ORDER BY id;`,
          [preorder.id, stage]
        );
      }
    }
    await db.run('UPDATE receipts SET snapshot_json = ? WHERE id = ?;', [
      JSON.stringify(snapshot),
      receipt.id,
    ]);
  }
}

export async function up(db) {
  await db.exec(`
    CREATE TABLE IF NOT EXISTS migration_review_issues (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      migration_version TEXT NOT NULL,
      issue_type TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id INTEGER,
      details_json TEXT NOT NULL,
      resolved_at DATETIME,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS document_sequences (
      document_type TEXT NOT NULL,
      cairo_date TEXT NOT NULL,
      last_value INTEGER NOT NULL CHECK(last_value > 0),
      PRIMARY KEY(document_type, cairo_date)
    );

    CREATE TABLE IF NOT EXISTS idempotency_records (
      idempotency_key TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
      operation TEXT NOT NULL,
      request_hash TEXT NOT NULL,
      status TEXT NOT NULL CHECK(status IN ('PROCESSING', 'COMMITTED')),
      status_code INTEGER,
      response_json TEXT,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      committed_at DATETIME
    );

    CREATE TABLE IF NOT EXISTS payment_methods (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT UNIQUE NOT NULL,
      name_ar TEXT NOT NULL,
      is_active INTEGER NOT NULL DEFAULT 1 CHECK(is_active IN (0, 1)),
      accepts_cash_received INTEGER NOT NULL DEFAULT 0 CHECK(accepts_cash_received IN (0, 1)),
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS secure_tokens (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      token TEXT UNIQUE NOT NULL,
      token_type TEXT NOT NULL CHECK(token_type IN ('product', 'preorder', 'invoice')),
      reference_id INTEGER NOT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(token_type, reference_id)
    );

    CREATE TABLE IF NOT EXISTS print_requests (
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

    CREATE TABLE IF NOT EXISTS shift_close_revisions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      shift_id INTEGER NOT NULL REFERENCES shifts(id) ON DELETE RESTRICT,
      revision_number INTEGER NOT NULL,
      submitted_by INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
      status TEXT NOT NULL CHECK(status IN ('SUBMITTED', 'REJECTED', 'APPROVED')),
      system_totals_json TEXT NOT NULL,
      declared_totals_json TEXT NOT NULL,
      variances_json TEXT NOT NULL,
      cashier_note TEXT,
      admin_id INTEGER REFERENCES users(id) ON DELETE RESTRICT,
      admin_reason TEXT,
      submitted_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      reviewed_at DATETIME,
      UNIQUE(shift_id, revision_number)
    );
  `);

  await addColumn(db, 'products', "availability_policy TEXT NOT NULL DEFAULT 'STOCK_ONLY'");
  await addColumn(db, 'products', 'preorder_instructions TEXT');
  await addColumn(db, 'products', 'open_preorder_quantity INTEGER NOT NULL DEFAULT 0');

  await addColumn(db, 'orders', "origin TEXT NOT NULL DEFAULT 'SALE'");
  await addColumn(db, 'orders', "status TEXT NOT NULL DEFAULT 'COMPLETED'");
  await addColumn(db, 'orders', 'preorder_id INTEGER REFERENCES preorders(id)');
  await addColumn(db, 'orders', 'qr_token TEXT');
  await addColumn(db, 'orders', 'customer_name_snapshot TEXT');
  await addColumn(db, 'orders', 'customer_phone_snapshot TEXT');

  for (const definition of [
    'product_name_snapshot TEXT',
    'sku_snapshot TEXT',
    'price_tier_name_snapshot TEXT',
    "availability_policy_snapshot TEXT NOT NULL DEFAULT 'STOCK_ONLY'",
  ])
    await addColumn(db, 'order_items', definition);

  await addColumn(db, 'preorders', 'customer_name_snapshot TEXT');
  await addColumn(db, 'preorders', 'customer_phone_snapshot TEXT');
  await addColumn(db, 'preorders', 'pickup_shift_id INTEGER REFERENCES shifts(id)');
  await addColumn(db, 'preorders', 'pickup_cashier_id INTEGER REFERENCES users(id)');
  await addColumn(db, 'preorders', 'pickup_amount INTEGER NOT NULL DEFAULT 0');
  await addColumn(db, 'preorders', 'picked_up_at DATETIME');
  await addColumn(db, 'preorders', 'preorder_instructions_snapshot TEXT');

  for (const definition of [
    'product_name_snapshot TEXT',
    'sku_snapshot TEXT',
    'price_tier_name_snapshot TEXT',
    "availability_policy_snapshot TEXT NOT NULL DEFAULT 'STOCK_ONLY'",
    'deposit_pct_snapshot INTEGER NOT NULL DEFAULT 0',
  ])
    await addColumn(db, 'preorder_items', definition);

  await addColumn(db, 'payments', 'method_id INTEGER REFERENCES payment_methods(id)');
  await addColumn(db, 'payments', "stage TEXT NOT NULL DEFAULT 'SALE'");
  await addColumn(db, 'payments', "direction TEXT NOT NULL DEFAULT 'IN'");
  await addColumn(db, 'payments', 'applied_amount INTEGER');
  await addColumn(db, 'payments', 'reference_number TEXT');
  await addColumn(db, 'payments', 'note TEXT');
  await addColumn(db, 'payments', 'cash_received INTEGER');
  await addColumn(db, 'payments', 'change_amount INTEGER NOT NULL DEFAULT 0');
  await addColumn(db, 'payments', 'method_snapshot TEXT');
  await addColumn(db, 'payments', 'is_excluded INTEGER NOT NULL DEFAULT 0');
  await addColumn(db, 'payments', 'exclusion_reason TEXT');
  await addColumn(db, 'payments', 'return_id INTEGER REFERENCES returns(id)');

  await addColumn(db, 'receipts', 'snapshot_json TEXT');
  await addColumn(db, 'receipts', 'qr_token TEXT');
  await addColumn(db, 'returns', 'payment_method_snapshot TEXT');
  await addColumn(
    db,
    'shifts',
    'approved_close_revision_id INTEGER REFERENCES shift_close_revisions(id)'
  );

  await db.exec(`
    INSERT OR IGNORE INTO payment_methods (code, name_ar, is_active, accepts_cash_received, sort_order) VALUES
      ('Cash', 'نقدي (كاش)', 1, 1, 10),
      ('Card', 'بطاقة', 1, 0, 20),
      ('InstaPay', 'إنستا باي', 1, 0, 30),
      ('Wallet', 'محفظة إلكترونية', 1, 0, 40),
      ('Transfer', 'تحويل بنكي', 1, 0, 50);

    UPDATE products
       SET availability_policy = CASE WHEN can_be_preordered = 1
                                      THEN 'STOCK_WITH_PREORDER_WHEN_OUT_OF_STOCK'
                                      ELSE 'STOCK_ONLY' END;

    INSERT INTO migration_review_issues (migration_version, issue_type, entity_type, entity_id, details_json)
    SELECT '001', 'UNSUPPORTED_LEGACY_PRODUCT_POLICY', 'product', id,
           json_object('sku', sku, 'can_be_sold', can_be_sold, 'can_be_preordered', can_be_preordered)
      FROM products
     WHERE can_be_sold = 0
       AND NOT EXISTS (
         SELECT 1 FROM migration_review_issues i
          WHERE i.migration_version = '001' AND i.issue_type = 'UNSUPPORTED_LEGACY_PRODUCT_POLICY'
            AND i.entity_type = 'product' AND i.entity_id = products.id
       );

    UPDATE products
       SET open_preorder_quantity = COALESCE((
         SELECT SUM(pi.quantity)
           FROM preorder_items pi JOIN preorders pr ON pr.id = pi.preorder_id
          WHERE pi.product_id = products.id
            AND pr.status IN ('DEPOSIT_PAID_WAITING_STOCK', 'READY_FOR_PICKUP')
       ), 0);

    UPDATE orders
       SET origin = CASE WHEN EXISTS (SELECT 1 FROM preorders p WHERE p.pickup_order_id = orders.id)
                         THEN 'PREORDER_PICKUP' ELSE 'SALE' END,
           preorder_id = (SELECT p.id FROM preorders p WHERE p.pickup_order_id = orders.id LIMIT 1),
           customer_name_snapshot = (SELECT c.name FROM customers c WHERE c.id = orders.customer_id),
           customer_phone_snapshot = (SELECT c.phone FROM customers c WHERE c.id = orders.customer_id);

    UPDATE preorders
       SET customer_name_snapshot = (SELECT c.name FROM customers c WHERE c.id = preorders.customer_id),
           customer_phone_snapshot = (SELECT c.phone FROM customers c WHERE c.id = preorders.customer_id);

    UPDATE order_items
       SET product_name_snapshot = (SELECT p.name FROM products p WHERE p.id = order_items.product_id),
           sku_snapshot = (SELECT p.sku FROM products p WHERE p.id = order_items.product_id),
           price_tier_name_snapshot = (SELECT pt.name FROM price_tiers pt WHERE pt.id = order_items.price_tier_id),
           availability_policy_snapshot = COALESCE((SELECT p.availability_policy FROM products p WHERE p.id = order_items.product_id), 'STOCK_ONLY');

    UPDATE preorder_items
       SET product_name_snapshot = (SELECT p.name FROM products p WHERE p.id = preorder_items.product_id),
           sku_snapshot = (SELECT p.sku FROM products p WHERE p.id = preorder_items.product_id),
           price_tier_name_snapshot = (SELECT pt.name FROM price_tiers pt WHERE pt.id = preorder_items.price_tier_id),
           availability_policy_snapshot = COALESCE((SELECT p.availability_policy FROM products p WHERE p.id = preorder_items.product_id), 'STOCK_ONLY'),
           deposit_pct_snapshot = COALESCE((SELECT p.default_preorder_deposit_pct FROM products p WHERE p.id = preorder_items.product_id), 0);

    UPDATE payments
       SET method_id = (SELECT pm.id FROM payment_methods pm WHERE pm.code = payments.payment_method),
           applied_amount = amount,
           method_snapshot = payment_method,
           cash_received = CASE WHEN payment_method = 'Cash' THEN amount ELSE NULL END,
           stage = CASE WHEN reference_type = 'preorder' THEN 'PREORDER_DEPOSIT'
                        WHEN EXISTS (SELECT 1 FROM orders o WHERE o.id = payments.reference_id AND o.origin = 'PREORDER_PICKUP') THEN 'PREORDER_PICKUP'
                        ELSE 'SALE' END;

    UPDATE payments AS copied
       SET is_excluded = 1,
           exclusion_reason = 'LEGACY_COPIED_PREORDER_DEPOSIT'
     WHERE copied.reference_type = 'order'
       AND EXISTS (
         SELECT 1
           FROM preorders pr
           JOIN payments original
             ON original.reference_type = 'preorder'
            AND original.reference_id = pr.id
            AND original.shift_id = copied.shift_id
            AND original.cashier_id = copied.cashier_id
            AND original.payment_method = copied.payment_method
            AND original.amount = copied.amount
            AND original.created_at = copied.created_at
          WHERE pr.pickup_order_id = copied.reference_id
       );

    CREATE UNIQUE INDEX IF NOT EXISTS idx_one_unfinished_shift_per_user
      ON shifts(user_id) WHERE status IN ('OPEN', 'PENDING_ADMIN_REVIEW');
    CREATE INDEX IF NOT EXISTS idx_orders_lookup ON orders(invoice_number, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_orders_cashier_shift ON orders(cashier_id, shift_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_receipts_reference ON receipts(reference_type, reference_id);
    CREATE INDEX IF NOT EXISTS idx_receipts_number ON receipts(receipt_number);
    CREATE INDEX IF NOT EXISTS idx_payments_stage_method ON payments(stage, payment_method, created_at);
    CREATE INDEX IF NOT EXISTS idx_secure_tokens_lookup ON secure_tokens(token_type, reference_id);
    CREATE INDEX IF NOT EXISTS idx_print_requests_receipt ON print_requests(receipt_id, requested_at);
    CREATE INDEX IF NOT EXISTS idx_shift_close_revisions_shift ON shift_close_revisions(shift_id, revision_number DESC);
    CREATE INDEX IF NOT EXISTS idx_order_items_snapshot_lookup ON order_items(product_name_snapshot, sku_snapshot);

    DROP TRIGGER IF EXISTS trg_inventory_ledger_continuity;
    CREATE TRIGGER trg_inventory_ledger_continuity
    BEFORE INSERT ON inventory_ledger
    WHEN NEW.before_quantity != COALESCE(
      (SELECT after_quantity FROM inventory_ledger WHERE product_id = NEW.product_id ORDER BY id DESC LIMIT 1), 0
    ) OR NEW.after_quantity != NEW.before_quantity + NEW.quantity_changed
    BEGIN
      SELECT RAISE(ABORT, 'INVENTORY_LEDGER_CONTINUITY_VIOLATION');
    END;

    DROP TRIGGER IF EXISTS trg_order_open_shift;
    CREATE TRIGGER trg_order_open_shift BEFORE INSERT ON orders
    WHEN NOT EXISTS (SELECT 1 FROM shifts s WHERE s.id = NEW.shift_id AND s.user_id = NEW.cashier_id AND s.status = 'OPEN')
    BEGIN SELECT RAISE(ABORT, 'OPEN_OWN_SHIFT_REQUIRED'); END;

    DROP TRIGGER IF EXISTS trg_payment_open_shift;
    CREATE TRIGGER trg_payment_open_shift BEFORE INSERT ON payments
    WHEN NOT EXISTS (SELECT 1 FROM shifts s WHERE s.id = NEW.shift_id AND s.user_id = NEW.cashier_id AND s.status = 'OPEN')
    BEGIN SELECT RAISE(ABORT, 'OPEN_OWN_SHIFT_REQUIRED'); END;

    DROP TRIGGER IF EXISTS trg_preorder_pickup_guard;
    CREATE TRIGGER trg_preorder_pickup_guard BEFORE UPDATE OF status ON preorders
    WHEN NEW.status = 'PICKED_UP' AND (
      OLD.status != 'READY_FOR_PICKUP' OR NEW.pickup_order_id IS NULL OR NEW.pickup_shift_id IS NULL
      OR NEW.pickup_cashier_id IS NULL OR NEW.picked_up_at IS NULL
    )
    BEGIN SELECT RAISE(ABORT, 'PICKUP_TRANSITION_REQUIRES_PICKUP_WORKFLOW'); END;

    DROP TRIGGER IF EXISTS trg_receipt_snapshot_immutable;
    CREATE TRIGGER trg_receipt_snapshot_immutable BEFORE UPDATE OF snapshot_json, reference_type, reference_id, receipt_number ON receipts
    WHEN OLD.snapshot_json IS NOT NULL
    BEGIN SELECT RAISE(ABORT, 'RECEIPT_SNAPSHOT_IMMUTABLE'); END;

    DROP TRIGGER IF EXISTS trg_order_item_snapshot_immutable;
    CREATE TRIGGER trg_order_item_snapshot_immutable BEFORE UPDATE ON order_items
    BEGIN SELECT RAISE(ABORT, 'INVOICE_ITEM_SNAPSHOT_IMMUTABLE'); END;
  `);

  // Preserve all usable legacy tokens while introducing the canonical registry.
  const legacyTokens = await db.all('SELECT token, type, reference_id FROM qr_tokens;');
  for (const token of legacyTokens) {
    await db.run(
      'INSERT OR IGNORE INTO secure_tokens (token, token_type, reference_id) VALUES (?, ?, ?);',
      [token.token, token.type, token.reference_id]
    );
  }

  const orders = await db.all('SELECT id, qr_token FROM orders ORDER BY id;');
  for (const order of orders) {
    const existing = await db.get(
      "SELECT token FROM secure_tokens WHERE token_type = 'invoice' AND reference_id = ?;",
      [order.id]
    );
    const token = existing?.token || secureToken('inv_');
    if (!existing)
      await db.run(
        "INSERT INTO secure_tokens (token, token_type, reference_id) VALUES (?, 'invoice', ?);",
        [token, order.id]
      );
    await db.run('UPDATE orders SET qr_token = ? WHERE id = ?;', [token, order.id]);
  }

  await backfillDocumentSequence(db, 'invoice', 'orders', 'invoice_number');
  await backfillDocumentSequence(db, 'receipt', 'receipts', 'receipt_number');
  await backfillDocumentSequence(db, 'preorder', 'preorders', 'preorder_number');
  await backfillReceiptSnapshots(db);
}

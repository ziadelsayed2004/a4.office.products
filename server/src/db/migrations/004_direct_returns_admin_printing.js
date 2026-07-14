import crypto from 'node:crypto';

export const version = '004';
export const name = 'direct_returns_admin_printing';
export const checksum = crypto
  .createHash('sha256')
  .update(`${version}:${name}:2026-07-15-v2`)
  .digest('hex');

async function hasColumn(db, table, column) {
  const columns = await db.all(`PRAGMA table_info(${table});`);
  return columns.some((candidate) => candidate.name === column);
}

async function addColumn(db, table, definition) {
  const column = definition.trim().split(/\s+/)[0];
  if (!(await hasColumn(db, table, column))) {
    await db.run(`ALTER TABLE ${table} ADD COLUMN ${definition};`);
  }
}

async function rebuildPrintRequests(db) {
  const columns = await db.all('PRAGMA table_info(print_requests);');
  const shift = columns.find((column) => column.name === 'shift_id');
  const alreadyCurrent =
    shift?.notnull === 0 &&
    columns.some((column) => column.name === 'actor_role_snapshot') &&
    columns.some((column) => column.name === 'admin_override');
  if (alreadyCurrent) return;

  await db.exec(`
    DROP TABLE IF EXISTS print_requests_v004;
    CREATE TABLE print_requests_v004 (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      receipt_id INTEGER NOT NULL REFERENCES receipts(id) ON DELETE RESTRICT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
      shift_id INTEGER REFERENCES shifts(id) ON DELETE RESTRICT,
      request_key TEXT NOT NULL,
      is_reprint INTEGER NOT NULL DEFAULT 0 CHECK(is_reprint IN (0, 1)),
      reason TEXT,
      copies INTEGER NOT NULL DEFAULT 1 CHECK(copies BETWEEN 1 AND 20),
      requested_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      actor_role_snapshot TEXT NOT NULL CHECK(actor_role_snapshot IN ('Admin', 'Cashier')),
      admin_override INTEGER NOT NULL DEFAULT 0 CHECK(admin_override IN (0, 1)),
      UNIQUE(user_id, request_key),
      CHECK((admin_override = 1 AND actor_role_snapshot = 'Admin' AND shift_id IS NULL)
         OR (admin_override = 0 AND shift_id IS NOT NULL))
    );
    INSERT INTO print_requests_v004
      (id, receipt_id, user_id, shift_id, request_key, is_reprint, reason, copies,
       requested_at, actor_role_snapshot, admin_override)
    SELECT pr.id, pr.receipt_id, pr.user_id, pr.shift_id, pr.request_key, pr.is_reprint,
           pr.reason, pr.copies, pr.requested_at, 'Cashier', 0
      FROM print_requests pr;
    DROP TABLE print_requests;
    ALTER TABLE print_requests_v004 RENAME TO print_requests;
    CREATE INDEX idx_print_requests_receipt
      ON print_requests(receipt_id, requested_at);
    CREATE INDEX idx_print_requests_actor
      ON print_requests(user_id, requested_at DESC);
  `);
}

export async function up(db) {
  await rebuildPrintRequests(db);
  await addColumn(db, 'returns', 'return_reason TEXT');
  await addColumn(db, 'return_items', 'no_restock_reason TEXT');

  await db.exec(`
    CREATE INDEX IF NOT EXISTS idx_returns_created
      ON returns(created_at DESC, id DESC);
    CREATE INDEX IF NOT EXISTS idx_returns_order_created
      ON returns(order_id, created_at DESC, id DESC);
    CREATE INDEX IF NOT EXISTS idx_returns_shift_created
      ON returns(shift_id, created_at DESC, id DESC);
    CREATE INDEX IF NOT EXISTS idx_returns_cashier_created
      ON returns(cashier_id, created_at DESC, id DESC);
    CREATE INDEX IF NOT EXISTS idx_returns_approval_card_created
      ON returns(approval_card_id, created_at DESC, id DESC);
    CREATE INDEX IF NOT EXISTS idx_return_items_product_return
      ON return_items(product_id, return_id);
    CREATE INDEX IF NOT EXISTS idx_receipts_qr_token
      ON receipts(qr_token);

    DROP TRIGGER IF EXISTS trg_return_open_shift;
    CREATE TRIGGER trg_return_open_shift BEFORE INSERT ON returns
    WHEN NOT EXISTS (
      SELECT 1 FROM shifts s
       WHERE s.id = NEW.shift_id AND s.user_id = NEW.cashier_id AND s.status = 'OPEN'
    )
    BEGIN SELECT RAISE(ABORT, 'OPEN_OWN_SHIFT_REQUIRED'); END;

    DROP TRIGGER IF EXISTS trg_return_shift_immutable;
    CREATE TRIGGER trg_return_shift_immutable BEFORE UPDATE OF shift_id, cashier_id ON returns
    WHEN NEW.shift_id != OLD.shift_id OR NEW.cashier_id != OLD.cashier_id
    BEGIN SELECT RAISE(ABORT, 'RETURN_SHIFT_IMMUTABLE'); END;
  `);
}

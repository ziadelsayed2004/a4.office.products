import assert from 'node:assert/strict';
import { createTestEnvironment, disposeTestEnvironment } from './test-environment.js';

const environment = createTestEnvironment('schema');
let db;

try {
  const dbModule = await import('../db/index.js');
  const migrationModule = await import('../db/migrate.js');
  const printMigration = await import('../db/migrations/004_direct_returns_admin_printing.js');
  db = dbModule.default;

  assert.equal(
    dbModule.dbPath,
    environment.databasePath,
    'schema test must use its isolated database'
  );
  await migrationModule.runMigrations();

  await db.run('INSERT INTO customers (name, phone) VALUES (?, ?);', [
    'Schema persistence sentinel',
    'schema-test-sentinel',
  ]);
  await migrationModule.runMigrations();
  assert.ok(
    await db.get('SELECT id FROM customers WHERE phone = ?;', ['schema-test-sentinel']),
    'rerunning setup/migrations must preserve existing records'
  );

  const integrity = await db.get('PRAGMA integrity_check;');
  assert.equal(integrity.integrity_check, 'ok');
  assert.deepEqual(await db.all('PRAGMA foreign_key_check;'), []);

  const tables = await db.all("SELECT name FROM sqlite_master WHERE type = 'table';");
  const tableNames = new Set(tables.map(({ name }) => name));
  for (const requiredTable of ['users', 'products', 'orders', 'payments', 'schema_migrations']) {
    assert.ok(tableNames.has(requiredTable), `missing required table: ${requiredTable}`);
  }
  const migrationVersions = await db.get(
    'SELECT COUNT(*) AS total, COUNT(DISTINCT version) AS distinct_versions FROM schema_migrations;'
  );
  assert.equal(
    migrationVersions.total,
    migrationVersions.distinct_versions,
    'migration versions must be unique'
  );

  for (const table of tableNames) {
    if (table.startsWith('sqlite_')) continue;
    const foreignKeys = await db.all(`PRAGMA foreign_key_list("${table.replaceAll('"', '""')}");`);
    for (const foreignKey of foreignKeys) {
      assert.ok(
        tableNames.has(foreignKey.table),
        `${table}.${foreignKey.from} references missing table ${foreignKey.table}`
      );
    }
  }

  // Legacy print rows all came from the shift-bound Cashier workflow. The
  // migration must preserve that historical meaning even if the same account
  // currently has the Admin role.
  const admin = await db.get("SELECT id FROM users WHERE role = 'Admin' ORDER BY id LIMIT 1;");
  const shift = await db.run(
    `INSERT INTO shifts (user_id, status, closed_at, opening_cash)
     VALUES (?, 'CLOSED', CURRENT_TIMESTAMP, 0);`,
    [admin.id]
  );
  const receipt = await db.run(
    `INSERT INTO receipts
     (receipt_number, reference_type, reference_id, printed_by, print_count)
     VALUES ('RCT-MIGRATION-004', 'order_sale', 987654, ?, 1);`,
    [admin.id]
  );
  await db.exec(`
    DROP TABLE print_requests;
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
  `);
  await db.run(
    `INSERT INTO print_requests
     (receipt_id, user_id, shift_id, request_key, copies)
     VALUES (?, ?, ?, 'legacy-admin-account-print', 1);`,
    [receipt.lastID, admin.id, shift.lastID]
  );
  await printMigration.up(db);
  const migratedPrint = await db.get(
    "SELECT * FROM print_requests WHERE request_key = 'legacy-admin-account-print';"
  );
  assert.equal(migratedPrint.actor_role_snapshot, 'Cashier');
  assert.equal(migratedPrint.admin_override, 0);
  assert.equal(migratedPrint.shift_id, shift.lastID);

  console.log(`Schema validation passed using isolated database: ${environment.databasePath}`);
} finally {
  await disposeTestEnvironment(environment, db);
}

import assert from 'node:assert/strict';
import { createTestEnvironment, disposeTestEnvironment } from './test-environment.js';

const environment = createTestEnvironment('schema');
let db;

try {
  const dbModule = await import('../db/index.js');
  const migrationModule = await import('../db/migrate.js');
  db = dbModule.default;

  assert.equal(dbModule.dbPath, environment.databasePath, 'schema test must use its isolated database');
  await migrationModule.runMigrations();

  await db.run(
    'INSERT INTO customers (name, phone) VALUES (?, ?);',
    ['Schema persistence sentinel', 'schema-test-sentinel']
  );
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
  assert.equal(migrationVersions.total, migrationVersions.distinct_versions, 'migration versions must be unique');

  for (const table of tableNames) {
    if (table.startsWith('sqlite_')) continue;
    const foreignKeys = await db.all(`PRAGMA foreign_key_list(\"${table.replaceAll('"', '""')}\");`);
    for (const foreignKey of foreignKeys) {
      assert.ok(
        tableNames.has(foreignKey.table),
        `${table}.${foreignKey.from} references missing table ${foreignKey.table}`
      );
    }
  }

  console.log(`Schema validation passed using isolated database: ${environment.databasePath}`);
} finally {
  await disposeTestEnvironment(environment, db);
}

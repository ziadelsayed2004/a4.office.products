import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import bcrypt from 'bcryptjs';
import db, { withTransaction } from './index.js';
import config from '../config/index.js';
import { backupDatabase } from '../utils/backup.js';
import * as workflowHardening from './migrations/001_workflow_hardening.js';
import * as returnAuthorizations from './migrations/002_return_authorizations.js';
import * as approvalCardsBarcodes from './migrations/003_approval_cards_barcodes.js';
import * as directReturnsAdminPrinting from './migrations/004_direct_returns_admin_printing.js';
import * as liveAdminActivity from './migrations/005_live_admin_activity.js';
import * as retireBankTransfer from './migrations/006_retire_bank_transfer.js';
import * as automaticIdentifiers from './migrations/007_automatic_identifiers.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const migrations = [
  workflowHardening,
  returnAuthorizations,
  approvalCardsBarcodes,
  directReturnsAdminPrinting,
  liveAdminActivity,
  retireBankTransfer,
  automaticIdentifiers,
];

async function tableExists(name) {
  return Boolean(
    await db.get("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?;", [name])
  );
}

async function assertDatabaseHealth({ initialized }) {
  const integrity = await db.get('PRAGMA integrity_check;');
  if (!integrity || integrity.integrity_check !== 'ok') {
    throw new Error(
      `SQLite integrity preflight failed: ${integrity?.integrity_check || 'unknown result'}`
    );
  }
  const foreignKeys = await db.all('PRAGMA foreign_key_check;');
  if (foreignKeys.length > 0) {
    throw new Error(`SQLite foreign-key preflight failed (${foreignKeys.length} violation(s)).`);
  }
  if (!initialized) return;

  const duplicateShift = await db.get(
    `SELECT user_id, COUNT(*) AS count FROM shifts
     WHERE status IN ('OPEN', 'PENDING_ADMIN_REVIEW')
     GROUP BY user_id HAVING COUNT(*) > 1 LIMIT 1;`
  );
  if (duplicateShift) {
    throw new Error(
      `Migration blocked: user ${duplicateShift.user_id} has ${duplicateShift.count} unfinished shifts.`
    );
  }

  const continuity = await db.get(`
    WITH ledger AS (
      SELECT id, product_id, before_quantity, after_quantity,
             LAG(after_quantity) OVER (PARTITION BY product_id ORDER BY id) AS previous_after
      FROM inventory_ledger
    )
    SELECT id, product_id FROM ledger
    WHERE (previous_after IS NULL AND before_quantity != 0)
       OR (previous_after IS NOT NULL AND before_quantity != previous_after)
    LIMIT 1;
  `);
  if (continuity) {
    throw new Error(`Migration blocked: inventory ledger discontinuity at entry ${continuity.id}.`);
  }

  const ambiguousDeposit = await db.get(`
    SELECT copied.id, COUNT(original.id) AS matches
      FROM preorders pr
      JOIN payments copied ON copied.reference_type = 'order' AND copied.reference_id = pr.pickup_order_id
      JOIN payments original ON original.reference_type = 'preorder' AND original.reference_id = pr.id
       AND original.shift_id = copied.shift_id AND original.cashier_id = copied.cashier_id
       AND original.payment_method = copied.payment_method AND original.amount = copied.amount
       AND original.created_at = copied.created_at
     WHERE pr.pickup_order_id IS NOT NULL
     GROUP BY copied.id HAVING COUNT(original.id) > 1 LIMIT 1;
  `);
  if (ambiguousDeposit) {
    throw new Error(
      `Migration blocked: ambiguous legacy copied deposit payment ${ambiguousDeposit.id}.`
    );
  }
}

async function validateTargetSchema() {
  await assertDatabaseHealth({ initialized: true });
  const requiredTables = [
    'schema_migrations',
    'document_sequences',
    'idempotency_records',
    'payment_methods',
    'secure_tokens',
    'print_requests',
    'shift_close_revisions',
    'return_authorizations',
    'return_authorization_items',
    'return_authorization_allocations',
    'return_authorization_print_requests',
    'return_approval_cards',
    'return_approval_card_print_requests',
    'number_sequences',
    'identifier_migration_map',
  ];
  for (const table of requiredTables) {
    if (!(await tableExists(table)))
      throw new Error(`Post-migration validation failed: missing table ${table}.`);
  }
  const productColumns = await db.all('PRAGMA table_info(products);');
  if (!productColumns.some((column) => column.name === 'availability_policy')) {
    throw new Error('Post-migration validation failed: canonical product policy is missing.');
  }
  const categoryColumns = await db.all('PRAGMA table_info(categories);');
  if (!categoryColumns.some((column) => column.name === 'code')) {
    throw new Error('Post-migration validation failed: categories.code is missing.');
  }
  const sessionColumns = await db.all('PRAGMA table_info(sessions);');
  if (!sessionColumns.some((column) => column.name === 'last_seen_at')) {
    throw new Error('Post-migration validation failed: sessions.last_seen_at is missing.');
  }
  const paymentMethodColumns = await db.all('PRAGMA table_info(payment_methods);');
  for (const column of ['is_system', 'refund_mode']) {
    if (!paymentMethodColumns.some((candidate) => candidate.name === column)) {
      throw new Error(`Post-migration validation failed: payment_methods.${column} is missing.`);
    }
  }
  const priceTierForeignKey = (await db.all('PRAGMA foreign_key_list(product_prices);')).find(
    (foreignKey) => foreignKey.table === 'price_tiers' && foreignKey.from === 'price_tier_id'
  );
  if (priceTierForeignKey?.on_delete !== 'RESTRICT') {
    throw new Error(
      'Post-migration validation failed: product price tiers must use ON DELETE RESTRICT.'
    );
  }
  for (const [table, requiredFragment] of [
    ['receipts', 'order_return'],
    ['inventory_ledger', "'RETURN'"],
  ]) {
    const definition = await db.get(
      "SELECT sql FROM sqlite_master WHERE type = 'table' AND name = ?;",
      [table]
    );
    if (!definition?.sql?.includes(requiredFragment)) {
      throw new Error(
        `Post-migration validation failed: ${table} does not support ${requiredFragment}.`
      );
    }
  }
}

async function seedDefaults({ freshDatabase }) {
  const usersCount = await db.get('SELECT COUNT(*) AS count FROM users;');
  if (usersCount.count === 0 && config.demoUsers.enabled) {
    const adminHash = await bcrypt.hash('admin123', 10);
    const cashierHash = await bcrypt.hash('cashier123', 10);
    await withTransaction(async (connection) => {
      await connection.run(
        'INSERT INTO users (username, password_hash, role, name, phone) VALUES (?, ?, ?, ?, ?);',
        ['admin', adminHash, 'Admin', 'مدير النظام', '01000000001']
      );
      await connection.run(
        'INSERT INTO users (username, password_hash, role, name, phone) VALUES (?, ?, ?, ?, ?);',
        ['cashier', cashierHash, 'Cashier', 'كاشير المحل', '01000000002']
      );
    });
  } else if (usersCount.count === 0) {
    console.warn(
      'Demo user seeding is disabled. Run npm run admin:bootstrap to create the first Admin account.'
    );
  }

  await withTransaction(async (connection) => {
    if (freshDatabase) {
      await connection.exec(`
      INSERT OR IGNORE INTO categories (name, code, is_active) VALUES
        ('كتب خارجية', 'CAT001', 1), ('أدوات مكتبية', 'CAT002', 1),
        ('أجهزة وآلات حاسبة', 'CAT003', 1);
      INSERT INTO number_sequences (sequence_type, scope_key, last_value)
        VALUES ('category', 'GLOBAL', 3)
        ON CONFLICT(sequence_type, scope_key)
        DO UPDATE SET last_value = MAX(last_value, excluded.last_value);
      INSERT OR IGNORE INTO price_tiers (name, description, is_active) VALUES
        ('سعر التجزئة الافتراضي', 'السعر الافتراضي لبيع التجزئة للجمهور', 1),
        ('سعر الجملة للشركات', 'سعر خاص للشركات والمؤسسات', 1),
        ('خصم الطلاب والمعلمين', 'خصم مخصص للطلاب وهيئة التدريس', 1);
      `);
    }
    await connection.exec(`
      INSERT OR IGNORE INTO business_settings (key, value) VALUES
        ('active_payment_methods', '["Cash","Card","InstaPay","Wallet"]');
      INSERT OR IGNORE INTO printer_settings (key, value) VALUES
        ('print_mode', 'browser'),
        ('receipt_printer_width', '80mm'),
        ('receipt_copies', '1'),
        ('receipt_printer_header', 'A4 Office Products'),
        ('receipt_printer_footer', 'شكراً لتعاملكم معنا'),
        ('auto_print_sale', 'true'),
        ('auto_print_preorder_deposit', 'true'),
        ('auto_print_preorder_pickup', 'true');
    `);
  });

  // Products created by an older seed or restored database retain their exact
  // IDs while receiving the canonical policy mapping.
  await db.exec(`
    UPDATE products
       SET availability_policy = CASE WHEN can_be_preordered = 1
                                      THEN 'STOCK_WITH_PREORDER_WHEN_OUT_OF_STOCK'
                                      ELSE 'STOCK_ONLY' END;
  `);
  const legacyTokens = await db.all('SELECT token, type, reference_id FROM qr_tokens;');
  for (const token of legacyTokens) {
    await db.run(
      'INSERT OR IGNORE INTO secure_tokens (token, token_type, reference_id) VALUES (?, ?, ?);',
      [token.token, token.type, token.reference_id]
    );
  }
}

export async function runMigrations() {
  console.log('----------------------------------------');
  console.log('Checking versioned database migrations...');
  const initialized = await tableExists('users');
  if (!initialized) {
    const schemaPath = path.resolve(__dirname, 'schema.sql');
    await db.exec(fs.readFileSync(schemaPath, 'utf8'));
  }

  await db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      checksum TEXT NOT NULL,
      applied_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await assertDatabaseHealth({ initialized });
  const appliedRows = await db.all(
    'SELECT version, checksum FROM schema_migrations ORDER BY version;'
  );
  const applied = new Map(appliedRows.map((row) => [row.version, row.checksum]));
  for (const migration of migrations) {
    if (applied.has(migration.version) && applied.get(migration.version) !== migration.checksum) {
      throw new Error(
        `Migration ${migration.version} checksum does not match the applied version.`
      );
    }
  }

  const pending = migrations.filter((migration) => !applied.has(migration.version));
  if (pending.length > 0 && initialized) {
    await backupDatabase({ reason: `before_migration_${pending[0].version}` });
  }

  for (const migration of pending) {
    await withTransaction(async (connection) => {
      await migration.up(connection);
      await connection.run(
        'INSERT INTO schema_migrations (version, name, checksum) VALUES (?, ?, ?);',
        [migration.version, migration.name, migration.checksum]
      );
    });
    console.log(`Applied migration ${migration.version}: ${migration.name}`);
  }

  await seedDefaults({ freshDatabase: !initialized });
  await validateTargetSchema();
  console.log('Database schema and migrations validated successfully.');
  console.log('----------------------------------------');
}

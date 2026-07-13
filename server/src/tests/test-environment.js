import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

function safeSuiteName(value) {
  return String(value || 'suite')
    .replace(/[^a-z0-9_-]+/gi, '-')
    .toLowerCase();
}

function removeOwnedTestDirectory(directory) {
  if (!fs.existsSync(directory)) return;
  const canonicalTempRoot = fs.realpathSync.native(os.tmpdir());
  const canonicalDirectory = fs.realpathSync.native(directory);
  const relative = path.relative(canonicalTempRoot, canonicalDirectory);
  const isInsideTemp = relative && !relative.startsWith('..') && !path.isAbsolute(relative);
  const hasOwnedPrefix = path.basename(canonicalDirectory).startsWith('a4-pos-');
  if (!isInsideTemp || !hasOwnedPrefix) {
    throw new Error(`Refusing to remove unowned test directory: ${canonicalDirectory}`);
  }
  fs.rmSync(canonicalDirectory, { recursive: true, force: true });
}

export function createTestEnvironment(suiteName) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), `a4-pos-${safeSuiteName(suiteName)}-`));
  const databasePath = path.join(directory, 'test.sqlite');
  const backupDirectory = path.join(directory, 'backups');

  // These values must be set before app/config/db modules are imported.
  process.env.NODE_ENV = 'test';
  process.env.SQLITE_DB_PATH = databasePath;
  process.env.JWT_SECRET ||= 'a4-pos-isolated-test-secret';
  process.env.RETURN_QR_SECRET ||= 'a4-pos-isolated-return-qr-secret-for-tests';
  process.env.SEED_DEMO_USERS = 'true';
  process.env.ALLOW_DATABASE_RESET = 'false';
  process.env.BACKUP_DIR = backupDirectory;

  return { directory, databasePath, backupDirectory };
}

export async function seedCatalogFixture(db) {
  const category = await db.get('SELECT id FROM categories ORDER BY id LIMIT 1;');
  const priceTier = await db.get('SELECT id FROM price_tiers ORDER BY id LIMIT 1;');
  if (!category || !priceTier)
    throw new Error('Migrations did not create the catalog seed prerequisites.');

  const product = await db.run(
    `INSERT INTO products
     (name, sku, barcode, category_id, description, is_active, can_be_sold, can_be_preordered,
      availability_policy, default_preorder_deposit_pct, default_pickup_method,
      low_stock_threshold, purchase_cost)
     VALUES (?, ?, ?, ?, ?, 1, 1, 1, 'STOCK_WITH_PREORDER_WHEN_OUT_OF_STOCK', 50, 'walk_in', 5, 2500);`,
    [
      'Test A4 notebook',
      'NOTE-A4-TEST',
      '6220000000001',
      category.id,
      'Isolated smoke-test fixture',
    ]
  );
  await db.run('INSERT INTO product_prices (product_id, price_tier_id, price) VALUES (?, ?, ?);', [
    product.lastID,
    priceTier.id,
    4000,
  ]);

  return product.lastID;
}

export async function closeTestServer(server) {
  if (!server?.listening) return;

  await new Promise((resolve, reject) => {
    server.close((error) => {
      if (error) reject(error);
      else resolve();
    });
  });
}

export async function disposeTestEnvironment(environment, db) {
  let closeError;
  try {
    if (db) await db.close();
  } catch (error) {
    // Closing an already-closed SQLite handle is harmless during test teardown.
    if (error?.code !== 'SQLITE_MISUSE') closeError = error;
  } finally {
    removeOwnedTestDirectory(environment.directory);
  }

  if (closeError) throw closeError;
}

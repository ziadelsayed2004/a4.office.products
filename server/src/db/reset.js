import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { assertSafeResetTarget } from './reset-safety.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const serverRoot = path.resolve(__dirname, '../..');
const configuredPath = path.resolve(
  serverRoot,
  process.env.SQLITE_DB_PATH || './src/db/a4_pos.db'
);

let db;

try {
  const databasePath = assertSafeResetTarget({
    targetPath: configuredPath,
    serverRoot
  });

  // The guard above runs before the database module is imported or any file is removed.
  for (const suffix of ['', '-journal', '-wal', '-shm']) {
    fs.rmSync(`${databasePath}${suffix}`, { force: true });
  }

  process.env.SQLITE_DB_PATH = databasePath;
  const dbModule = await import('./index.js');
  const migrationModule = await import('./migrate.js');
  db = dbModule.default;

  console.log(`Resetting isolated development/test database: ${databasePath}`);
  await migrationModule.runMigrations();
  console.log('Database reset and setup completed successfully.');
} catch (error) {
  console.error(`Database reset refused or failed: ${error.message}`);
  process.exitCode = 1;
} finally {
  if (db) await db.close();
}

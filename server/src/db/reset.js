import db from './index.js';
import { runMigrations } from './migrate.js';

async function resetDatabase() {
  console.log('========================================');
  console.log(' Resetting A4 POS database...');
  console.log('========================================');
  try {
    await db.run('PRAGMA foreign_keys = OFF;');
    const tables = [
      'preorder_items', 'preorders', 'return_items', 'returns',
      'payments', 'order_items', 'orders', 'qr_tokens',
      'inventory_ledger', 'product_prices', 'product_book_details',
      'products', 'categories', 'price_tiers', 'users', 'customers',
      'printer_settings', 'shifts', 'cash_movements', 'audit_logs', 'sessions', 'sqlite_sequence'
    ];
    for (const table of tables) {
      try {
        await db.run(`DELETE FROM ${table}`);
      } catch (err) {
        // Ignore if tables do not exist yet
      }
    }
    console.log('✔ Purged all database tables.');

    // Run migrations to recreate tables & seed defaults
    await runMigrations();
    
    await db.run('PRAGMA foreign_keys = ON;');
    console.log('✔ Database successfully reset and seeded.');
    process.exit(0);
  } catch (error) {
    console.error('❌ FATAL: Database reset failed:', error.message);
    process.exit(1);
  }
}

resetDatabase();

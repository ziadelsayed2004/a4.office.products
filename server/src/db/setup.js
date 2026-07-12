import db from './index.js';
import { runMigrations } from './migrate.js';

try {
  console.log('Applying non-destructive database setup and migrations...');
  await runMigrations();
  console.log('Database setup completed successfully.');
} catch (error) {
  console.error('Database setup failed:', error.message);
  process.exitCode = 1;
} finally {
  await db.close();
}

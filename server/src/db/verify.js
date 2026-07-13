import config from '../config/index.js';
import { verifyDatabaseFile } from './database-health.js';

try {
  const result = await verifyDatabaseFile(config.database.path);
  console.log(`Database verification passed: ${result.path}`);
  console.log('integrity_check=ok foreign_key_violations=0 mode=read-only');
} catch (error) {
  console.error(`Database verification failed: ${error.message}`);
  process.exitCode = 1;
}

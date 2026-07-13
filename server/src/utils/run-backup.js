import { backupDatabase } from './backup.js';
import db from '../db/index.js';

async function run() {
  console.log('Initiating database backup process...');
  try {
    const filename = await backupDatabase();
    if (filename) {
      console.log(`Backup completed successfully: ${filename}`);
    } else {
      console.log('Backup skipped or not completed.');
    }
  } catch (error) {
    console.error('Backup script failed:', error.message);
    process.exitCode = 1;
  } finally {
    await db.close();
  }
}

await run();

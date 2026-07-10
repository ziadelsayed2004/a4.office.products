import { backupDatabase } from './backup.js';

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
    process.exit(1);
  }
}

run();

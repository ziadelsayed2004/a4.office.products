import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import config from '../config/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Define backups directory
const BACKUP_DIR = path.resolve(__dirname, '../../../backups');
const MAX_BACKUPS = 5;

/**
 * Creates a database backup file with a Cairo timestamp suffix,
 * and maintains a maximum limit of historical backups.
 */
export async function backupDatabase() {
  try {
    // 1. Ensure backups directory exists
    if (!fs.existsSync(BACKUP_DIR)) {
      fs.mkdirSync(BACKUP_DIR, { recursive: true });
    }

    const dbPath = config.database.path;
    if (!fs.existsSync(dbPath)) {
      console.warn(`WARNING: SQLite database file not found at ${dbPath}. Skipping backup.`);
      return null;
    }

    // 2. Format Cairo timestamp suffix: YYYYMMDD_HHMMSS
    const now = new Date();
    const cairoString = now.toLocaleString('en-US', { timeZone: 'Africa/Cairo' });
    // Parse format "MM/DD/YYYY, hh:mm:ss AM/PM"
    const [datePart, timePart] = cairoString.split(', ');
    const [month, day, year] = datePart.split('/');
    const [time, period] = timePart.split(' ');
    let [hours, minutes, seconds] = time.split(':');
    
    let hoursInt = parseInt(hours, 10);
    if (period === 'PM' && hoursInt < 12) hoursInt += 12;
    if (period === 'AM' && hoursInt === 12) hoursInt = 0;
    const formattedHours = hoursInt.toString().padStart(2, '0');

    const timestamp = `${year}${month.padStart(2, '0')}${day.padStart(2, '0')}_${formattedHours}${minutes.padStart(2, '0')}${seconds.padStart(2, '0')}`;
    const backupFileName = `a4_pos_backup_${timestamp}.db`;
    const backupFilePath = path.join(BACKUP_DIR, backupFileName);

    // 3. Copy the database file
    fs.copyFileSync(dbPath, backupFilePath);
    console.log(`[BACKUP SUCCESS] Database backup created at: ${backupFilePath}`);

    // 4. Prune older backups keeping only the MAX_BACKUPS limit
    pruneOldBackups();

    return backupFileName;
  } catch (error) {
    console.error('Failed to create database backup:', error.message);
    throw error;
  }
}

/**
 * Retains only the most recent MAX_BACKUPS files in the backup directory.
 */
function pruneOldBackups() {
  try {
    const files = fs.readdirSync(BACKUP_DIR);
    const backupFiles = files
      .filter(f => f.startsWith('a4_pos_backup_') && f.endsWith('.db'))
      .map(f => ({
        name: f,
        path: path.join(BACKUP_DIR, f),
        mtime: fs.statSync(path.join(BACKUP_DIR, f)).mtimeMs
      }))
      .sort((a, b) => b.mtime - a.mtime); // Sort descending (newest first)

    if (backupFiles.length > MAX_BACKUPS) {
      const filesToDelete = backupFiles.slice(MAX_BACKUPS);
      for (const file of filesToDelete) {
        fs.unlinkSync(file.path);
        console.log(`[BACKUP PRUNE] Deleted old backup: ${file.name}`);
      }
    }
  } catch (error) {
    console.error('Failed to prune old database backups:', error.message);
  }
}

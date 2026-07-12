import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import config from '../config/index.js';
import { dbConn, globalReady } from '../db/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const BACKUP_DIR = path.resolve(__dirname, '../../../backups');
const MAX_BACKUPS = 10;

function cairoTimestamp() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Cairo', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23'
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}${values.month}${values.day}_${values.hour}${values.minute}${values.second}`;
}

function sqliteBackup(connection, destination) {
  return new Promise((resolve, reject) => {
    const backup = connection.backup(destination, (initializeError) => {
      if (initializeError) {
        reject(initializeError);
        return;
      }
      backup.step(-1, (stepError) => {
        if (stepError) reject(stepError);
        else if (!backup.completed) reject(new Error('SQLite online backup did not complete.'));
        else resolve();
      });
    });
  });
}

function pruneOldBackups() {
  const files = fs.readdirSync(BACKUP_DIR)
    .filter((name) => name.startsWith('a4_pos_') && name.endsWith('.db'))
    .map((name) => ({ name, fullPath: path.join(BACKUP_DIR, name), mtime: fs.statSync(path.join(BACKUP_DIR, name)).mtimeMs }))
    .sort((a, b) => b.mtime - a.mtime);
  for (const file of files.slice(MAX_BACKUPS)) fs.unlinkSync(file.fullPath);
}

/**
 * Produces a consistent SQLite online backup, including committed WAL pages.
 */
export async function backupDatabase({ reason = 'manual', connection = dbConn } = {}) {
  await globalReady;
  if (!fs.existsSync(config.database.path)) return null;
  fs.mkdirSync(BACKUP_DIR, { recursive: true });

  const safeReason = String(reason).replace(/[^a-z0-9_-]/gi, '_').slice(0, 40) || 'manual';
  const fileName = `a4_pos_${safeReason}_${cairoTimestamp()}.db`;
  const destination = path.join(BACKUP_DIR, fileName);

  await sqliteBackup(connection, destination);
  const stats = fs.statSync(destination);
  if (stats.size === 0) {
    fs.unlinkSync(destination);
    throw new Error('SQLite backup verification failed: empty output file.');
  }
  pruneOldBackups();
  console.log(`[BACKUP SUCCESS] ${destination}`);
  return destination;
}

export { BACKUP_DIR };

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import config from '../config/index.js';
import { dbConn, globalReady } from '../db/index.js';
import { verifyDatabaseFile } from '../db/database-health.js';

const BACKUP_DIR = config.backup.directory;
const MAX_BACKUPS = config.backup.retention;
const PRUNE_LOCK_PATH = path.join(BACKUP_DIR, '.backup-prune.lock');
const PRUNE_LOCK_TIMEOUT_MS = 30_000;
const STALE_PRUNE_LOCK_MS = 5 * 60_000;

function cairoTimestamp() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Cairo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
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

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function acquirePruneLock() {
  const deadline = Date.now() + PRUNE_LOCK_TIMEOUT_MS;
  while (Date.now() < deadline) {
    try {
      const descriptor = fs.openSync(PRUNE_LOCK_PATH, 'wx');
      try {
        fs.writeFileSync(descriptor, `${process.pid}\n${new Date().toISOString()}\n`);
      } catch (error) {
        fs.closeSync(descriptor);
        fs.rmSync(PRUNE_LOCK_PATH, { force: true });
        throw error;
      }
      return descriptor;
    } catch (error) {
      if (error.code !== 'EEXIST') throw error;
      try {
        const age = Date.now() - fs.statSync(PRUNE_LOCK_PATH).mtimeMs;
        if (age > STALE_PRUNE_LOCK_MS) {
          fs.rmSync(PRUNE_LOCK_PATH, { force: true });
          continue;
        }
      } catch (statError) {
        if (statError.code !== 'ENOENT') throw statError;
        continue;
      }
      await delay(25);
    }
  }
  throw new Error('Timed out waiting for the backup retention lock.');
}

async function pruneOldBackups() {
  const lockDescriptor = await acquirePruneLock();
  let pruneError;
  try {
    await pruneOldBackupsWhileLocked();
  } catch (error) {
    pruneError = error;
  }

  let releaseError;
  try {
    await releasePruneLock(lockDescriptor);
  } catch (error) {
    releaseError = error;
  }

  if (pruneError && releaseError) {
    throw new AggregateError(
      [pruneError, releaseError],
      'Backup pruning and lock cleanup both failed.'
    );
  }
  if (pruneError) throw pruneError;
  if (releaseError) throw releaseError;
}

async function releasePruneLock(lockDescriptor) {
  let closeError;
  try {
    fs.closeSync(lockDescriptor);
  } catch (error) {
    closeError = error;
  }
  let removalError;
  try {
    await removeFileWithRetry(PRUNE_LOCK_PATH);
  } catch (error) {
    removalError = error;
  }
  if (closeError && removalError) {
    throw new AggregateError(
      [closeError, removalError],
      'Closing and removing the prune lock failed.'
    );
  }
  if (closeError) throw closeError;
  if (removalError) throw removalError;
}

async function pruneOldBackupsWhileLocked() {
  const files = [];
  for (const name of fs.readdirSync(BACKUP_DIR)) {
    if (!name.startsWith('a4_pos_') || !name.endsWith('.db')) continue;
    const fullPath = path.join(BACKUP_DIR, name);
    try {
      files.push({ name, fullPath, mtime: fs.statSync(fullPath).mtimeMs });
    } catch (error) {
      // Another backup process may have pruned the same file after readdir.
      if (error.code !== 'ENOENT') throw error;
    }
  }
  files.sort((a, b) => b.mtime - a.mtime || b.name.localeCompare(a.name));

  const validBackups = [];
  for (const file of files) {
    try {
      await verifyStandaloneBackup(file.fullPath);
      await removeBackupSidecars(file.fullPath);
      validBackups.push(file);
    } catch (error) {
      await removeBackupArtifacts(file.fullPath);
      console.warn(`[BACKUP REMOVED] Invalid backup ${file.name}: ${error.message}`);
    }
  }
  for (const file of validBackups.slice(MAX_BACKUPS)) {
    await removeBackupArtifacts(file.fullPath);
  }
}

async function verifyStandaloneBackup(filename) {
  const verificationCopy = path.join(
    BACKUP_DIR,
    `.${path.basename(filename)}.${crypto.randomUUID()}.verify.partial`
  );
  try {
    fs.copyFileSync(filename, verificationCopy, fs.constants.COPYFILE_EXCL);
    await verifyDatabaseFile(verificationCopy);
  } finally {
    await removeBackupArtifacts(verificationCopy);
  }
}

function createBackupPaths(safeReason) {
  const uniqueId = crypto.randomUUID();
  const fileName = `a4_pos_${safeReason}_${cairoTimestamp()}_${uniqueId}.db`;
  const destination = path.join(BACKUP_DIR, fileName);
  const partial = path.join(BACKUP_DIR, `.${fileName}.${crypto.randomUUID()}.partial`);
  return { destination, partial };
}

const SQLITE_SIDECAR_SUFFIXES = ['-wal', '-shm', '-journal'];

const RETRYABLE_REMOVE_ERRORS = new Set(['EBUSY', 'EPERM', 'EACCES']);
const REMOVE_RETRY_ATTEMPTS = 20;

async function removeFileWithRetry(filename) {
  for (let attempt = 0; attempt <= REMOVE_RETRY_ATTEMPTS; attempt += 1) {
    try {
      await fs.promises.rm(filename, { force: true });
      return;
    } catch (error) {
      if (!RETRYABLE_REMOVE_ERRORS.has(error.code) || attempt === REMOVE_RETRY_ATTEMPTS) {
        throw error;
      }
      await delay(Math.min(25 * (attempt + 1), 100));
    }
  }
}

async function removeFiles(filenames) {
  let firstError;
  for (const filename of filenames.filter(Boolean)) {
    try {
      await removeFileWithRetry(filename);
    } catch (error) {
      firstError ||= error;
    }
  }
  if (firstError) throw firstError;
}

async function removeBackupArtifacts(...filenames) {
  await removeFiles(
    filenames
      .filter(Boolean)
      .flatMap((filename) => [
        filename,
        ...SQLITE_SIDECAR_SUFFIXES.map((suffix) => `${filename}${suffix}`),
      ])
  );
}

async function removeBackupSidecars(filename) {
  await removeFiles(SQLITE_SIDECAR_SUFFIXES.map((suffix) => `${filename}${suffix}`));
}

/**
 * Produces a consistent SQLite online backup, including committed WAL pages.
 */
export async function backupDatabase({ reason = 'manual', connection = dbConn } = {}) {
  await globalReady;
  if (!fs.existsSync(config.database.path)) return null;
  fs.mkdirSync(BACKUP_DIR, { recursive: true });

  const safeReason =
    String(reason)
      .replace(/[^a-z0-9_-]/gi, '_')
      .slice(0, 40) || 'manual';
  const { destination, partial } = createBackupPaths(safeReason);

  try {
    await sqliteBackup(connection, partial);
    if (fs.statSync(partial).size === 0) {
      throw new Error('SQLite backup verification failed: empty output file.');
    }
    await verifyDatabaseFile(partial);
    await removeBackupSidecars(partial);

    // The verified file is published by a same-directory atomic rename. The
    // UUID in both names prevents concurrent calls in the same second from
    // sharing either the work file or the final destination.
    fs.renameSync(partial, destination);
    await pruneOldBackups();
  } catch (error) {
    const backupError = error.message.startsWith('SQLite backup verification failed:')
      ? error
      : new Error(`SQLite backup verification failed: ${error.message}`, { cause: error });
    try {
      await removeBackupArtifacts(partial, destination);
    } catch (cleanupError) {
      throw new Error(
        `${backupError.message} Backup artifact cleanup also failed: ${cleanupError.message}`,
        { cause: new AggregateError([backupError, cleanupError]) }
      );
    }
    throw backupError;
  }

  console.log(`[BACKUP SUCCESS] ${destination}`);
  return destination;
}

export { BACKUP_DIR };

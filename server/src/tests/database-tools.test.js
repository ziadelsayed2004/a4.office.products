import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import sqlite3 from 'sqlite3';
import { verifyDatabaseFile } from '../db/database-health.js';

const serverRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const projectRoot = path.resolve(serverRoot, '..');
const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const resetScript = path.join(serverRoot, 'src', 'db', 'reset.js');
const verifyScript = path.join(serverRoot, 'src', 'db', 'verify.js');
const bootstrapAdminScript = path.join(serverRoot, 'src', 'db', 'bootstrap-admin.js');
const backupScript = path.join(serverRoot, 'src', 'utils', 'run-backup.js');
const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'a4-pos-database-tools-'));
const ownedUnsafeDirectory = path.join(serverRoot, '.tmp');
const ownedUnsafeDirectoryExisted = fs.existsSync(ownedUnsafeDirectory);
let ownedUnsafeTarget;

function sqliteConnection(filename, mode = sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE) {
  return new Promise((resolve, reject) => {
    const connection = new sqlite3.Database(filename, mode, (error) => {
      if (error) reject(error);
      else resolve(connection);
    });
  });
}

function exec(connection, sql) {
  return new Promise((resolve, reject) => {
    connection.exec(sql, (error) => {
      if (error) reject(error);
      else resolve();
    });
  });
}

function close(connection) {
  return new Promise((resolve, reject) => {
    connection.close((error) => {
      if (error) reject(error);
      else resolve();
    });
  });
}

function get(connection, sql, params = []) {
  return new Promise((resolve, reject) => {
    connection.get(sql, params, (error, row) => {
      if (error) reject(error);
      else resolve(row);
    });
  });
}

function fileHash(filename) {
  return crypto.createHash('sha256').update(fs.readFileSync(filename)).digest('hex');
}

const sqliteSidecarSuffixes = ['-wal', '-shm', '-journal'];
const retryableFixtureRemoveErrors = new Set(['EBUSY', 'EPERM', 'EACCES']);

function testDelay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function removeFixtureFileWithRetry(filename) {
  for (let attempt = 0; attempt <= 20; attempt += 1) {
    try {
      await fs.promises.rm(filename, { force: true });
      return;
    } catch (error) {
      if (!retryableFixtureRemoveErrors.has(error.code) || attempt === 20) throw error;
      await testDelay(Math.min(25 * (attempt + 1), 100));
    }
  }
}

async function removeFixtureSidecars(filename) {
  for (const suffix of sqliteSidecarSuffixes) {
    await removeFixtureFileWithRetry(`${filename}${suffix}`);
  }
}

function cleanupOwnedUnsafeFixture() {
  if (ownedUnsafeTarget) fs.rmSync(ownedUnsafeTarget, { force: true });
  if (ownedUnsafeDirectoryExisted) return null;
  try {
    fs.rmdirSync(ownedUnsafeDirectory);
    return null;
  } catch (error) {
    return ['ENOENT', 'ENOTEMPTY'].includes(error.code) ? null : error;
  }
}

function resetEnvironment(databasePath, overrides = {}) {
  const environment = {
    ...process.env,
    NODE_ENV: 'test',
    JWT_SECRET: 'a4-pos-isolated-database-tools-test-secret',
    RETURN_QR_SECRET: 'a4-pos-isolated-database-tools-return-qr-secret',
    SQLITE_DB_PATH: databasePath,
    PRODUCTION_SQLITE_DB_PATH: path.join(serverRoot, 'src', 'db', 'a4_pos.db'),
    ALLOW_DATABASE_RESET: 'true',
    SEED_DEMO_USERS: 'true',
    BACKUP_DIR: path.join(temporaryDirectory, 'backups'),
    ...overrides,
  };
  delete environment.A4_ENV_FILE;
  return environment;
}

function spawnNode(argumentsList, environment) {
  return spawnSync(process.execPath, argumentsList, {
    cwd: serverRoot,
    env: environment,
    encoding: 'utf8',
    timeout: 90_000,
  });
}

function spawnNodeAsync(argumentsList, environment) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, argumentsList, {
      cwd: serverRoot,
      env: environment,
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    });
    let stdout = '';
    let stderr = '';
    const timeout = setTimeout(() => {
      child.kill();
      reject(new Error(`Timed out running: node ${argumentsList.join(' ')}`));
    }, 90_000);

    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk) => {
      stdout += chunk;
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk;
    });
    child.once('error', (error) => {
      clearTimeout(timeout);
      reject(error);
    });
    child.once('close', (status) => {
      clearTimeout(timeout);
      resolve({ status, stdout, stderr });
    });
  });
}

try {
  const healthyPath = path.join(temporaryDirectory, 'healthy.sqlite');
  const healthy = await sqliteConnection(healthyPath);
  await exec(
    healthy,
    `
    PRAGMA foreign_keys = ON;
    CREATE TABLE parent (id INTEGER PRIMARY KEY);
    CREATE TABLE child (id INTEGER PRIMARY KEY, parent_id INTEGER REFERENCES parent(id));
    INSERT INTO parent (id) VALUES (1);
    INSERT INTO child (id, parent_id) VALUES (1, 1);
  `
  );
  await close(healthy);

  const hashBeforeVerification = fileHash(healthyPath);
  const verification = await verifyDatabaseFile(healthyPath);
  assert.equal(verification.integrity, 'ok');
  assert.equal(verification.foreignKeyViolations, 0);
  assert.equal(
    fileHash(healthyPath),
    hashBeforeVerification,
    'Read-only verification changed the database file.'
  );

  const verifyCommand = spawnNode(
    [verifyScript],
    resetEnvironment(healthyPath, {
      ALLOW_DATABASE_RESET: 'false',
    })
  );
  assert.equal(verifyCommand.status, 0, `${verifyCommand.stdout}\n${verifyCommand.stderr}`);
  assert.match(verifyCommand.stdout, /mode=read-only/);
  assert.equal(
    fileHash(healthyPath),
    hashBeforeVerification,
    'db:verify changed the database file.'
  );

  const invalidForeignKeyPath = path.join(temporaryDirectory, 'invalid-foreign-key.sqlite');
  const invalidForeignKey = await sqliteConnection(invalidForeignKeyPath);
  await exec(
    invalidForeignKey,
    `
    PRAGMA foreign_keys = OFF;
    CREATE TABLE parent (id INTEGER PRIMARY KEY);
    CREATE TABLE child (id INTEGER PRIMARY KEY, parent_id INTEGER REFERENCES parent(id));
    INSERT INTO child (id, parent_id) VALUES (1, 999);
  `
  );
  await close(invalidForeignKey);
  await assert.rejects(() => verifyDatabaseFile(invalidForeignKeyPath), /foreign_key_check/);
  await assert.rejects(
    () => verifyDatabaseFile(path.join(temporaryDirectory, 'missing.sqlite')),
    /does not exist/
  );

  const verifiedBackupDirectory = path.join(temporaryDirectory, 'verified-backups');
  fs.mkdirSync(verifiedBackupDirectory);
  const zeroBackupPath = path.join(verifiedBackupDirectory, 'a4_pos_zero.db');
  fs.writeFileSync(zeroBackupPath, '');

  // Populate more than the configured retention limit with known-valid files.
  // Their explicit timestamps make the expected pruning order deterministic.
  const retentionFixtures = [];
  const retentionClock = Date.now() - 60_000;
  for (let index = 0; index < 12; index += 1) {
    const fixtureName = `a4_pos_retention_${String(index).padStart(2, '0')}.db`;
    const fixturePath = path.join(verifiedBackupDirectory, fixtureName);
    fs.copyFileSync(healthyPath, fixturePath);
    const fixtureTime = new Date(retentionClock - (11 - index) * 60_000);
    fs.utimesSync(fixturePath, fixtureTime, fixtureTime);
    retentionFixtures.push({ name: fixtureName, path: fixturePath });
  }

  // Keep a connection open with auto-checkpointing disabled so the sentinel is
  // committed in WAL while the independent backup process performs an online
  // SQLite backup. A plain filesystem copy would miss this data.
  const backupSentinel = `online-backup-${crypto.randomUUID()}`;
  const onlineBackupSource = await sqliteConnection(healthyPath, sqlite3.OPEN_READWRITE);
  let backupCommands;
  try {
    await exec(
      onlineBackupSource,
      `
      PRAGMA journal_mode = WAL;
      PRAGMA wal_autocheckpoint = 0;
      CREATE TABLE backup_sentinel (
        token TEXT PRIMARY KEY,
        note TEXT NOT NULL
      );
      INSERT INTO backup_sentinel (token, note)
      VALUES ('${backupSentinel}', 'committed while the WAL connection stayed open');
    `
    );
    const walPath = `${healthyPath}-wal`;
    assert.ok(
      fs.existsSync(walPath) && fs.statSync(walPath).size > 0,
      'The WAL sentinel was not created.'
    );

    const concurrentBackupEnvironment = resetEnvironment(healthyPath, {
      ALLOW_DATABASE_RESET: 'false',
      BACKUP_DIR: verifiedBackupDirectory,
      BACKUP_RETENTION: '10',
    });
    backupCommands = await Promise.all([
      spawnNodeAsync([backupScript], concurrentBackupEnvironment),
      spawnNodeAsync([backupScript], concurrentBackupEnvironment),
    ]);
  } finally {
    await close(onlineBackupSource);
  }
  for (const backupCommand of backupCommands) {
    assert.equal(backupCommand.status, 0, `${backupCommand.stdout}\n${backupCommand.stderr}`);
  }
  assert.equal(
    fs.existsSync(zeroBackupPath),
    false,
    'The invalid zero-byte backup was not removed.'
  );

  const backupDirectoryEntries = fs.readdirSync(verifiedBackupDirectory);
  const backupFiles = backupDirectoryEntries.filter(
    (name) => name.startsWith('a4_pos_') && name.endsWith('.db')
  );
  assert.equal(
    backupFiles.length,
    10,
    'Backup retention must keep exactly the newest 10 valid backups.'
  );
  assert.deepEqual(
    backupDirectoryEntries.filter(
      (name) => name.includes('.partial') || /-(?:wal|shm|journal)$/u.test(name)
    ),
    [],
    'Successful backups and retention checks must not leave work files or SQLite sidecars.'
  );
  assert.equal(
    backupDirectoryEntries.length,
    backupFiles.length,
    'The backup directory contains an unexpected non-backup artifact.'
  );

  const generatedBackups = backupFiles.filter((name) => !name.startsWith('a4_pos_retention_'));
  assert.equal(
    generatedBackups.length,
    2,
    'Expected two independently published concurrent backups.'
  );
  assert.equal(
    new Set(generatedBackups).size,
    2,
    'Concurrent backups reused the same final filename.'
  );
  const generatedBackupPath = path.join(verifiedBackupDirectory, generatedBackups[0]);
  for (const generatedBackup of generatedBackups) {
    const generatedPath = path.join(verifiedBackupDirectory, generatedBackup);
    await verifyDatabaseFile(generatedPath);
    const backedUpDatabase = await sqliteConnection(generatedPath, sqlite3.OPEN_READONLY);
    const backedUpSentinel = await get(
      backedUpDatabase,
      'SELECT token, note FROM backup_sentinel WHERE token = ?;',
      [backupSentinel]
    );
    await close(backedUpDatabase);
    assert.deepEqual(backedUpSentinel, {
      token: backupSentinel,
      note: 'committed while the WAL connection stayed open',
    });
    await removeFixtureSidecars(generatedPath);
  }

  // The two online backups are newest, so the newest eight fixtures survive
  // and the oldest four valid fixtures are pruned.
  for (const fixture of retentionFixtures.slice(0, 4)) {
    assert.equal(fs.existsSync(fixture.path), false, `Old backup was retained: ${fixture.name}`);
  }
  for (const fixture of retentionFixtures.slice(4)) {
    assert.equal(fs.existsSync(fixture.path), true, `Recent backup was pruned: ${fixture.name}`);
    await verifyDatabaseFile(fixture.path);
    await removeFixtureSidecars(fixture.path);
  }

  // Force post-write verification to fail. Neither the unique work file nor a
  // final .db may remain after the backup subprocess reports the failure.
  const failedBackupSourcePath = path.join(temporaryDirectory, 'forced-backup-failure.sqlite');
  const failedBackupSource = await sqliteConnection(failedBackupSourcePath);
  await exec(
    failedBackupSource,
    `
    PRAGMA foreign_keys = OFF;
    CREATE TABLE parent (id INTEGER PRIMARY KEY);
    CREATE TABLE child (id INTEGER PRIMARY KEY, parent_id INTEGER REFERENCES parent(id));
    INSERT INTO child (id, parent_id) VALUES (1, 404);
  `
  );
  await close(failedBackupSource);

  const failedBackupDirectory = path.join(temporaryDirectory, 'failed-backups');
  const forcedBackupFailure = spawnNode(
    [backupScript],
    resetEnvironment(failedBackupSourcePath, {
      ALLOW_DATABASE_RESET: 'false',
      BACKUP_DIR: failedBackupDirectory,
      BACKUP_RETENTION: '10',
    })
  );
  assert.notEqual(forcedBackupFailure.status, 0);
  assert.match(`${forcedBackupFailure.stdout}\n${forcedBackupFailure.stderr}`, /foreign_key_check/);
  assert.deepEqual(
    fs.existsSync(failedBackupDirectory) ? fs.readdirSync(failedBackupDirectory) : [],
    [],
    'A failed backup left a partial or published artifact.'
  );

  // Exercise the documented restore shape without replacing any configured
  // database. First stop/close an existing destination, then rotate its main
  // file and every possible stale SQLite sidecar before installing a verified
  // copy through a same-directory atomic rename.
  const restoredDatabasePath = path.join(temporaryDirectory, 'restored-backup.test.sqlite');
  const existingDestination = await sqliteConnection(restoredDatabasePath);
  await exec(
    existingDestination,
    `
    PRAGMA journal_mode = WAL;
    CREATE TABLE stale_destination (id INTEGER PRIMARY KEY, note TEXT NOT NULL);
    INSERT INTO stale_destination (id, note) VALUES (1, 'must be rotated before restore');
  `
  );
  await close(existingDestination);

  for (const suffix of sqliteSidecarSuffixes) {
    fs.writeFileSync(`${restoredDatabasePath}${suffix}`, `stale SQLite sidecar ${suffix}`);
  }

  await verifyDatabaseFile(generatedBackupPath);
  await removeFixtureSidecars(generatedBackupPath);
  const restorePartialPath = path.join(
    temporaryDirectory,
    `a4_pos.restore-${crypto.randomUUID()}.partial.db`
  );
  fs.copyFileSync(generatedBackupPath, restorePartialPath, fs.constants.COPYFILE_EXCL);
  await verifyDatabaseFile(restorePartialPath);
  await removeFixtureSidecars(restorePartialPath);

  const stagedRestoreVerification = spawnSync(
    npmCommand,
    ['--prefix', 'server', 'run', 'db:verify'],
    {
      cwd: projectRoot,
      env: resetEnvironment(restorePartialPath, {
        NODE_ENV: 'production',
        HOST: '127.0.0.1',
        APP_DOMAIN: 'staging.example.test',
        APP_URL: 'https://staging.example.test',
        SQLITE_DB_PATH: restorePartialPath,
        PRODUCTION_SQLITE_DB_PATH: restorePartialPath,
        ALLOW_DATABASE_RESET: 'false',
        SEED_DEMO_USERS: 'false',
        CORS_ORIGIN: 'https://staging.example.test',
      }),
      encoding: 'utf8',
      timeout: 90_000,
      shell: process.platform === 'win32',
    }
  );
  assert.equal(
    stagedRestoreVerification.status,
    0,
    `Production staged restore verification failed:\n${stagedRestoreVerification.stdout}\n${stagedRestoreVerification.stderr}`
  );
  assert.match(stagedRestoreVerification.stdout, /mode=read-only/);
  await removeFixtureSidecars(restorePartialPath);

  // Rotate the stopped destination only after the independently staged copy
  // has passed the same package command used by the deployment procedure.
  const restoreRotationId = crypto.randomUUID();
  const destinationArtifacts = [
    restoredDatabasePath,
    ...sqliteSidecarSuffixes.map((suffix) => `${restoredDatabasePath}${suffix}`),
  ];
  const rotatedDestinationArtifacts = [];
  for (const artifact of destinationArtifacts) {
    const rotated = `${artifact}.pre-restore-${restoreRotationId}`;
    fs.renameSync(artifact, rotated);
    rotatedDestinationArtifacts.push(rotated);
  }
  for (const artifact of destinationArtifacts) assert.equal(fs.existsSync(artifact), false);
  for (const rotated of rotatedDestinationArtifacts) assert.equal(fs.existsSync(rotated), true);

  fs.renameSync(restorePartialPath, restoredDatabasePath);
  assert.equal(fs.existsSync(restorePartialPath), false);
  for (const suffix of sqliteSidecarSuffixes) {
    assert.equal(fs.existsSync(`${restoredDatabasePath}${suffix}`), false);
  }
  await verifyDatabaseFile(restoredDatabasePath);

  const restoredDatabase = await sqliteConnection(restoredDatabasePath, sqlite3.OPEN_READWRITE);
  const restoreWriteToken = `restore-write-${crypto.randomUUID()}`;
  try {
    await exec(restoredDatabase, 'PRAGMA foreign_keys = ON; BEGIN IMMEDIATE;');
    await exec(
      restoredDatabase,
      `INSERT INTO backup_sentinel (token, note) VALUES ('${restoreWriteToken}', 'temporary restore write');`
    );
    await exec(restoredDatabase, 'COMMIT;');
  } catch (error) {
    try {
      await exec(restoredDatabase, 'ROLLBACK;');
    } catch {
      // Preserve the original write failure when no transaction remains open.
    }
    throw error;
  } finally {
    await close(restoredDatabase);
  }
  await verifyDatabaseFile(restoredDatabasePath);

  const verifiedRestore = await sqliteConnection(restoredDatabasePath, sqlite3.OPEN_READONLY);
  const restoredSentinels = await get(
    verifiedRestore,
    `SELECT
       SUM(token = ?) AS original_sentinel,
       SUM(token = ?) AS restore_write
     FROM backup_sentinel;`,
    [backupSentinel, restoreWriteToken]
  );
  await close(verifiedRestore);
  assert.deepEqual(restoredSentinels, { original_sentinel: 1, restore_write: 1 });

  const directTarget = path.join(temporaryDirectory, 'direct.test.sqlite');
  fs.writeFileSync(directTarget, 'reset must not remove this file');
  const directReset = spawnNode([resetScript], resetEnvironment(directTarget));
  assert.notEqual(directReset.status, 0);
  assert.match(`${directReset.stdout}\n${directReset.stderr}`, /--confirm-reset/);
  assert.equal(fs.readFileSync(directTarget, 'utf8'), 'reset must not remove this file');

  const permissionTarget = path.join(temporaryDirectory, 'permission.test.sqlite');
  fs.writeFileSync(permissionTarget, 'reset without permission must be refused');
  const permissionReset = spawnNode(
    [resetScript, '--confirm-reset'],
    resetEnvironment(permissionTarget, { ALLOW_DATABASE_RESET: 'false' })
  );
  assert.notEqual(permissionReset.status, 0);
  assert.match(`${permissionReset.stdout}\n${permissionReset.stderr}`, /ALLOW_DATABASE_RESET=true/);
  assert.equal(
    fs.readFileSync(permissionTarget, 'utf8'),
    'reset without permission must be refused'
  );

  const productionTarget = path.join(temporaryDirectory, 'production-refusal.test.sqlite');
  fs.writeFileSync(productionTarget, 'production reset must be refused');
  const productionReset = spawnNode(
    [resetScript, '--confirm-reset'],
    resetEnvironment(productionTarget, { NODE_ENV: 'production' })
  );
  assert.notEqual(productionReset.status, 0);
  assert.match(
    `${productionReset.stdout}\n${productionReset.stderr}`,
    /outside NODE_ENV=development or NODE_ENV=test.*production/
  );
  assert.equal(fs.readFileSync(productionTarget, 'utf8'), 'production reset must be refused');

  const configuredProductionTarget = path.join(temporaryDirectory, 'configured-target.test.sqlite');
  fs.writeFileSync(configuredProductionTarget, 'configured production target must be refused');
  const configuredProductionReset = spawnNode(
    [resetScript, '--confirm-reset'],
    resetEnvironment(configuredProductionTarget, {
      PRODUCTION_SQLITE_DB_PATH: configuredProductionTarget,
    })
  );
  assert.notEqual(configuredProductionReset.status, 0);
  assert.match(
    `${configuredProductionReset.stdout}\n${configuredProductionReset.stderr}`,
    /configured production database/
  );
  assert.equal(
    fs.readFileSync(configuredProductionTarget, 'utf8'),
    'configured production target must be refused'
  );

  const liveMarkedTarget = path.join(temporaryDirectory, 'a4-pos.live.test.sqlite');
  fs.writeFileSync(liveMarkedTarget, 'live-marked target must be refused');
  const liveMarkedReset = spawnNode(
    [resetScript, '--confirm-reset'],
    resetEnvironment(liveMarkedTarget)
  );
  assert.notEqual(liveMarkedReset.status, 0);
  assert.match(`${liveMarkedReset.stdout}\n${liveMarkedReset.stderr}`, /production\/live/);
  assert.equal(fs.readFileSync(liveMarkedTarget, 'utf8'), 'live-marked target must be refused');

  fs.mkdirSync(ownedUnsafeDirectory, { recursive: true });
  ownedUnsafeTarget = path.join(ownedUnsafeDirectory, `unsafe-${crypto.randomUUID()}.sqlite`);
  fs.writeFileSync(ownedUnsafeTarget, 'unmarked workspace target must be refused');
  const unmarkedWorkspaceReset = spawnNode(
    [resetScript, '--confirm-reset'],
    resetEnvironment(ownedUnsafeTarget)
  );
  assert.notEqual(unmarkedWorkspaceReset.status, 0);
  assert.match(
    `${unmarkedWorkspaceReset.stdout}\n${unmarkedWorkspaceReset.stderr}`,
    /dev\/local\/test marker/
  );
  assert.equal(
    fs.readFileSync(ownedUnsafeTarget, 'utf8'),
    'unmarked workspace target must be refused'
  );

  const realSymlinkTarget = path.join(temporaryDirectory, 'real-symlink-target');
  const linkedResetTarget = path.join(temporaryDirectory, 'linked-reset-target.test.sqlite');
  const symlinkSentinel = path.join(realSymlinkTarget, 'sentinel.txt');
  fs.mkdirSync(realSymlinkTarget);
  fs.writeFileSync(symlinkSentinel, 'symlink destination must remain unchanged');
  fs.symlinkSync(
    realSymlinkTarget,
    linkedResetTarget,
    process.platform === 'win32' ? 'junction' : 'dir'
  );
  const symlinkReset = spawnNode(
    [resetScript, '--confirm-reset'],
    resetEnvironment(linkedResetTarget)
  );
  assert.notEqual(symlinkReset.status, 0);
  assert.match(`${symlinkReset.stdout}\n${symlinkReset.stderr}`, /symbolic-link/);
  assert.ok(fs.lstatSync(linkedResetTarget).isSymbolicLink());
  assert.equal(
    fs.readFileSync(symlinkSentinel, 'utf8'),
    'symlink destination must remain unchanged'
  );

  for (const invalidEnvironment of ['staging', 'invalid-environment']) {
    const invalidEnvironmentTarget = path.join(
      temporaryDirectory,
      `${invalidEnvironment}-refusal.test.sqlite`
    );
    fs.writeFileSync(invalidEnvironmentTarget, 'non-development reset must be refused');
    const invalidEnvironmentReset = spawnNode(
      [resetScript, '--confirm-reset'],
      resetEnvironment(invalidEnvironmentTarget, { NODE_ENV: invalidEnvironment })
    );
    assert.notEqual(invalidEnvironmentReset.status, 0);
    assert.match(
      `${invalidEnvironmentReset.stdout}\n${invalidEnvironmentReset.stderr}`,
      /outside NODE_ENV=development or NODE_ENV=test/
    );
    assert.equal(
      fs.readFileSync(invalidEnvironmentTarget, 'utf8'),
      'non-development reset must be refused'
    );
  }

  const packageResetTarget = path.join(temporaryDirectory, 'package-reset.test.sqlite');
  const packageReset = spawnSync(npmCommand, ['run', 'db:reset', '--silent'], {
    cwd: serverRoot,
    env: resetEnvironment(packageResetTarget),
    encoding: 'utf8',
    timeout: 90_000,
    shell: process.platform === 'win32',
  });
  assert.equal(
    packageReset.status,
    0,
    `Package reset failed:\n${packageReset.stdout}\n${packageReset.stderr}`
  );
  await verifyDatabaseFile(packageResetTarget);
  assert.ok(fs.statSync(packageResetTarget).size > 0);

  const rootPackageResetTarget = path.join(temporaryDirectory, 'root-package-reset.test.sqlite');
  const rootPackageReset = spawnSync(npmCommand, ['run', 'db:reset', '--silent'], {
    cwd: projectRoot,
    env: resetEnvironment(rootPackageResetTarget),
    encoding: 'utf8',
    timeout: 90_000,
    shell: process.platform === 'win32',
  });
  assert.equal(
    rootPackageReset.status,
    0,
    `Root package reset failed:\n${rootPackageReset.stdout}\n${rootPackageReset.stderr}`
  );
  await verifyDatabaseFile(rootPackageResetTarget);
  assert.ok(fs.statSync(rootPackageResetTarget).size > 0);

  const bootstrapDatabasePath = path.join(temporaryDirectory, 'bootstrap-admin.test.sqlite');
  const bootstrapPassword = 'temporary-safe-password-123';
  const bootstrapEnvironment = resetEnvironment(bootstrapDatabasePath, {
    ALLOW_DATABASE_RESET: 'false',
    SEED_DEMO_USERS: 'false',
    BOOTSTRAP_ADMIN_USERNAME: 'initial-admin',
    BOOTSTRAP_ADMIN_PASSWORD: bootstrapPassword,
    BOOTSTRAP_ADMIN_NAME: 'Initial Administrator',
  });
  const bootstrap = spawnNode([bootstrapAdminScript], bootstrapEnvironment);
  assert.equal(bootstrap.status, 0, `${bootstrap.stdout}\n${bootstrap.stderr}`);
  assert.doesNotMatch(`${bootstrap.stdout}\n${bootstrap.stderr}`, new RegExp(bootstrapPassword));
  const bootstrapDatabase = await sqliteConnection(bootstrapDatabasePath, sqlite3.OPEN_READONLY);
  const bootstrapUsers = await get(
    bootstrapDatabase,
    "SELECT COUNT(*) AS total, SUM(role = 'Admin') AS admins, SUM(role = 'Cashier') AS cashiers FROM users;"
  );
  await close(bootstrapDatabase);
  assert.deepEqual(bootstrapUsers, { total: 1, admins: 1, cashiers: 0 });

  const repeatedBootstrap = spawnNode([bootstrapAdminScript], bootstrapEnvironment);
  assert.notEqual(repeatedBootstrap.status, 0);
  assert.match(
    `${repeatedBootstrap.stdout}\n${repeatedBootstrap.stderr}`,
    /Admin account already exists/
  );

  console.log('Read-only database verification and reset subprocess checks passed.');
} finally {
  const cleanupError = cleanupOwnedUnsafeFixture();
  fs.rmSync(temporaryDirectory, { recursive: true, force: true });
  if (cleanupError) {
    console.error(`Temporary fixture cleanup failed: ${cleanupError.message}`);
    process.exitCode = 1;
  }
}

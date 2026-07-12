import sqlite3 from 'sqlite3';
import fs from 'fs';
import path from 'path';
import config from '../config/index.js';

const dbPath = config.database.path;
const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });

function openNativeConnection(filename = dbPath) {
  return new Promise((resolve, reject) => {
    const connection = new sqlite3.Database(filename, (error) => {
      if (error) reject(error);
      else resolve(connection);
    });
  });
}

function runNative(connection, sql, params = []) {
  return new Promise((resolve, reject) => {
    connection.run(sql, params, function onRun(error) {
      if (error) reject(error);
      else resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
}

function getNative(connection, sql, params = []) {
  return new Promise((resolve, reject) => {
    connection.get(sql, params, (error, row) => {
      if (error) reject(error);
      else resolve(row);
    });
  });
}

function allNative(connection, sql, params = []) {
  return new Promise((resolve, reject) => {
    connection.all(sql, params, (error, rows) => {
      if (error) reject(error);
      else resolve(rows);
    });
  });
}

function execNative(connection, sql) {
  return new Promise((resolve, reject) => {
    connection.exec(sql, (error) => {
      if (error) reject(error);
      else resolve();
    });
  });
}

function closeNative(connection) {
  return new Promise((resolve, reject) => {
    connection.close((error) => {
      if (error) reject(error);
      else resolve();
    });
  });
}

async function configureConnection(connection) {
  // These settings are connection-local except journal_mode, which is persisted.
  await execNative(connection, `
    PRAGMA foreign_keys = ON;
    PRAGMA busy_timeout = 10000;
    PRAGMA journal_mode = WAL;
    PRAGMA synchronous = FULL;
  `);
  return connection;
}

function wrapConnection(connection) {
  return {
    all: (sql, params = []) => allNative(connection, sql, params),
    get: (sql, params = []) => getNative(connection, sql, params),
    run: (sql, params = []) => runNative(connection, sql, params),
    exec: (sql) => execNative(connection, sql),
    close: () => closeNative(connection),
    native: connection
  };
}

const dbConn = new sqlite3.Database(dbPath);
const globalReady = configureConnection(dbConn).then(() => {
  console.log(`Connected to SQLite database at: ${dbPath}`);
  console.log('SQLite WAL, foreign keys, and busy timeout are enabled.');
});

const db = {
  async all(sql, params = []) {
    await globalReady;
    return allNative(dbConn, sql, params);
  },
  async get(sql, params = []) {
    await globalReady;
    return getNative(dbConn, sql, params);
  },
  async run(sql, params = []) {
    await globalReady;
    return runNative(dbConn, sql, params);
  },
  async exec(sql) {
    await globalReady;
    return execNative(dbConn, sql);
  },
  async close() {
    await globalReady;
    return closeNative(dbConn);
  }
};

/**
 * Opens a short-lived configured connection. Callers cannot accidentally share
 * transaction state with another request.
 */
export async function withConnection(work) {
  const native = await openNativeConnection();
  await configureConnection(native);
  const connection = wrapConnection(native);
  try {
    return await work(connection);
  } finally {
    await connection.close();
  }
}

/**
 * Runs a write workflow on its own connection. BEGIN IMMEDIATE takes the write
 * reservation before validation reads, preventing stale stock/shift decisions.
 */
export async function withTransaction(work, { mode = 'IMMEDIATE' } = {}) {
  const transactionMode = String(mode).toUpperCase();
  if (!['DEFERRED', 'IMMEDIATE', 'EXCLUSIVE'].includes(transactionMode)) {
    throw new Error(`Unsupported SQLite transaction mode: ${mode}`);
  }

  return withConnection(async (connection) => {
    await connection.run(`BEGIN ${transactionMode};`);
    try {
      const result = await work(connection);
      await connection.run('COMMIT;');
      return result;
    } catch (error) {
      try {
        await connection.run('ROLLBACK;');
      } catch (rollbackError) {
        error.rollbackError = rollbackError;
      }
      throw error;
    }
  });
}

export { dbConn, dbPath, globalReady };
export default db;

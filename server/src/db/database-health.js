import fs from 'node:fs';
import path from 'node:path';
import sqlite3 from 'sqlite3';

function openReadOnlyDatabase(filename) {
  return new Promise((resolve, reject) => {
    const connection = new sqlite3.Database(filename, sqlite3.OPEN_READONLY, (error) => {
      if (error) reject(error);
      else resolve(connection);
    });
  });
}

function all(connection, sql) {
  return new Promise((resolve, reject) => {
    connection.all(sql, (error, rows) => {
      if (error) reject(error);
      else resolve(rows);
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

/**
 * Verifies an existing SQLite file through an OPEN_READONLY connection. This
 * function never creates, migrates, checkpoints, or otherwise writes the file.
 */
export async function verifyDatabaseFile(filename) {
  const databasePath = path.resolve(filename);
  if (!fs.existsSync(databasePath) || !fs.statSync(databasePath).isFile()) {
    throw new Error(`SQLite database file does not exist: ${databasePath}`);
  }
  if (fs.statSync(databasePath).size === 0) {
    throw new Error(`SQLite database file is empty: ${databasePath}`);
  }

  let connection;
  try {
    connection = await openReadOnlyDatabase(databasePath);
    const integrityRows = await all(connection, 'PRAGMA integrity_check;');
    const integrityMessages = integrityRows.map((row) => row.integrity_check).filter(Boolean);
    if (integrityMessages.length !== 1 || integrityMessages[0] !== 'ok') {
      throw new Error(`SQLite integrity_check failed (${integrityMessages.length || 1} issue(s)).`);
    }

    const foreignKeyViolations = await all(connection, 'PRAGMA foreign_key_check;');
    if (foreignKeyViolations.length > 0) {
      throw new Error(
        `SQLite foreign_key_check failed (${foreignKeyViolations.length} violation(s)).`
      );
    }

    return {
      path: databasePath,
      integrity: 'ok',
      foreignKeyViolations: 0,
    };
  } finally {
    if (connection) await close(connection);
  }
}

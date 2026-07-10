import sqlite3 from 'sqlite3';
import fs from 'fs';
import path from 'path';
import config from '../config/index.js';

// Ensure the directory for the database file exists
const dbPath = config.database.path;
const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

// Instantiate connection
const dbConn = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Failed to open database connection:', err.message);
  } else {
    console.log(`Connected to SQLite database at: ${dbPath}`);
    // Enable Foreign Keys enforcement
    dbConn.run('PRAGMA foreign_keys = ON;', (pragmaErr) => {
      if (pragmaErr) {
        console.error('Failed to enable foreign keys:', pragmaErr.message);
      } else {
        console.log('SQLite foreign key constraint checks enabled.');
      }
    });
  }
});

// Database wrapper utilities returning Promises
const db = {
  /**
   * Run a query that returns all rows (SELECT)
   */
  all(sql, params = []) {
    return new Promise((resolve, reject) => {
      dbConn.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  },

  /**
   * Run a query that returns a single row (SELECT LIMIT 1)
   */
  get(sql, params = []) {
    return new Promise((resolve, reject) => {
      dbConn.get(sql, params, (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  },

  /**
   * Run a query that performs an insert/update/delete (returns changes and lastID)
   */
  run(sql, params = []) {
    return new Promise((resolve, reject) => {
      dbConn.run(sql, params, function (err) {
        if (err) {
          reject(err);
        } else {
          resolve({
            lastID: this.lastID,
            changes: this.changes
          });
        }
      });
    });
  },

  /**
   * Execute multiple SQL statements at once
   */
  exec(sql) {
    return new Promise((resolve, reject) => {
      dbConn.exec(sql, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  },

  /**
   * Close the database connection
   */
  close() {
    return new Promise((resolve, reject) => {
      dbConn.close((err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }
};

export default db;
export { dbConn };

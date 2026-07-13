import assert from 'node:assert/strict';
import path from 'node:path';
import { createConfig } from '../config/index.js';

const roots = {
  projectRoot: path.resolve('C:/a4-project'),
  serverRoot: path.resolve('C:/a4-project/server'),
  warn: null,
};

const productionEnvironment = {
  NODE_ENV: 'production',
  PORT: '5000',
  JWT_SECRET: 'a-production-secret-that-is-longer-than-thirty-two-characters',
  RETURN_QR_SECRET: 'a-distinct-production-return-qr-secret-longer-than-thirty-two',
  JWT_EXPIRES_IN: '8h',
  CORS_ORIGIN: 'https://pos.example.com,https://admin.example.com',
  RATE_LIMIT_WINDOW_MS: '900000',
  RATE_LIMIT_MAX: '1500',
  LOGIN_RATE_LIMIT_WINDOW_MS: '900000',
  LOGIN_RATE_LIMIT_MAX: '10',
  SQLITE_DB_PATH: './data/a4_pos.db',
  PRODUCTION_SQLITE_DB_PATH: './data/a4_pos.db',
  ALLOW_DATABASE_RESET: 'false',
  SEED_DEMO_USERS: 'false',
  TRUST_PROXY: '1',
  BACKUP_DIR: './backups',
  BACKUP_RETENTION: '10',
  SHUTDOWN_TIMEOUT_MS: '10000',
};

const productionConfig = createConfig(productionEnvironment, roots);
assert.equal(productionConfig.env, 'production');
assert.equal(productionConfig.port, 5000);
assert.deepEqual(productionConfig.cors.origin, [
  'https://pos.example.com',
  'https://admin.example.com',
]);
assert.equal(productionConfig.trustProxy, 1);
assert.equal(productionConfig.demoUsers.enabled, false);
assert.equal(productionConfig.backup.retention, 10);
assert.equal(productionConfig.returns.defaultTtlHours, 24);
assert.equal(productionConfig.database.path, path.resolve(roots.serverRoot, './data/a4_pos.db'));
assert.equal(productionConfig.backup.directory, path.resolve(roots.projectRoot, './backups'));

assert.throws(() => createConfig({ ...productionEnvironment, PORT: '70000' }, roots), /PORT/);
assert.throws(
  () => createConfig({ ...productionEnvironment, JWT_SECRET: 'too-short' }, roots),
  /32 characters/
);
assert.throws(
  () => createConfig({ ...productionEnvironment, RETURN_QR_SECRET: 'too-short' }, roots),
  /RETURN_QR_SECRET must contain at least 32 characters/
);
assert.throws(
  () => createConfig({ ...productionEnvironment, CORS_ORIGIN: '*' }, roots),
  /cannot be \*/
);
assert.throws(
  () => createConfig({ ...productionEnvironment, ALLOW_DATABASE_RESET: 'true' }, roots),
  /must be false/
);
assert.throws(
  () => createConfig({ ...productionEnvironment, SEED_DEMO_USERS: 'true' }, roots),
  /must be false/
);
assert.throws(
  () => createConfig({ ...productionEnvironment, TRUST_PROXY: 'not a proxy' }, roots),
  /TRUST_PROXY/
);
assert.throws(
  () => createConfig({ ...productionEnvironment, CORS_ORIGIN: 'https://example.com/path' }, roots),
  /without paths/
);
assert.throws(
  () => createConfig({ ...productionEnvironment, SQLITE_DB_PATH: './data/a4_pos' }, roots),
  /SQLITE_DB_PATH must end/
);
assert.throws(
  () =>
    createConfig(
      {
        ...productionEnvironment,
        PRODUCTION_SQLITE_DB_PATH: './data/different.db',
      },
      roots
    ),
  /must match PRODUCTION_SQLITE_DB_PATH/
);

const developmentConfig = createConfig(
  {
    NODE_ENV: 'development',
    SQLITE_DB_PATH: './src/db/a4_pos.local.db',
  },
  roots
);
assert.equal(developmentConfig.database.allowReset, false);
assert.equal(developmentConfig.demoUsers.enabled, true);
assert.equal(developmentConfig.trustProxy, false);

console.log('Server configuration validation checks passed.');

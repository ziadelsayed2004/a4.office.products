import path from 'node:path';
import { isIP } from 'node:net';
import { z } from 'zod';
import { PROJECT_ROOT, SERVER_ROOT } from './env.js';

const integerString = (name, minimum, maximum, fallback) =>
  z
    .string()
    .regex(/^\d+$/, `${name} must be an integer.`)
    .default(String(fallback))
    .transform(Number)
    .pipe(z.number().int().min(minimum).max(maximum));

const booleanString = (name, fallback) =>
  z
    .string()
    .default(String(fallback))
    .transform((value, context) => {
      const normalized = value.trim().toLowerCase();
      if (normalized === 'true') return true;
      if (normalized === 'false') return false;
      context.addIssue({ code: 'custom', message: `${name} must be true or false.` });
      return z.NEVER;
    });

const optionalBooleanString = (name) =>
  z
    .string()
    .optional()
    .transform((value, context) => {
      if (value === undefined) return undefined;
      const normalized = value.trim().toLowerCase();
      if (normalized === 'true') return true;
      if (normalized === 'false') return false;
      context.addIssue({ code: 'custom', message: `${name} must be true or false.` });
      return z.NEVER;
    });

const environmentSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: integerString('PORT', 1, 65535, 5000),
    JWT_SECRET: z.string().min(1).optional(),
    JWT_EXPIRES_IN: z
      .string()
      .regex(/^\d+[smhd]$/, 'JWT_EXPIRES_IN must use a value such as 15m, 8h, or 7d.')
      .default('7d'),
    RETURN_QR_SECRET: z.string().min(1).optional(),
    RETURN_AUTHORIZATION_TTL_HOURS: integerString('RETURN_AUTHORIZATION_TTL_HOURS', 1, 168, 24),
    CORS_ORIGIN: z.string().min(1).default('http://localhost:5173'),
    RATE_LIMIT_WINDOW_MS: integerString('RATE_LIMIT_WINDOW_MS', 1000, 86_400_000, 900_000),
    RATE_LIMIT_MAX: integerString('RATE_LIMIT_MAX', 1, 1_000_000, 1500),
    LOGIN_RATE_LIMIT_WINDOW_MS: integerString(
      'LOGIN_RATE_LIMIT_WINDOW_MS',
      1000,
      86_400_000,
      900_000
    ),
    LOGIN_RATE_LIMIT_MAX: integerString('LOGIN_RATE_LIMIT_MAX', 1, 10_000, 10),
    SQLITE_DB_PATH: z.string().min(1).default('./src/db/a4_pos.db'),
    PRODUCTION_SQLITE_DB_PATH: z.string().min(1).default('./src/db/a4_pos.db'),
    ALLOW_DATABASE_RESET: booleanString('ALLOW_DATABASE_RESET', false),
    SEED_DEMO_USERS: optionalBooleanString('SEED_DEMO_USERS'),
    TRUST_PROXY: z.string().min(1).default('false'),
    BACKUP_DIR: z.string().min(1).default('./backups'),
    BACKUP_RETENTION: integerString('BACKUP_RETENTION', 1, 365, 10),
    SHUTDOWN_TIMEOUT_MS: integerString('SHUTDOWN_TIMEOUT_MS', 1000, 120_000, 10_000),
  })
  .passthrough();

const trustProxyAliases = new Set(['loopback', 'linklocal', 'uniquelocal']);

function parseTrustProxy(value) {
  const normalized = value.trim().toLowerCase();
  if (normalized === 'false') return false;
  if (normalized === 'true') return true;
  if (/^\d+$/.test(normalized)) {
    const hops = Number(normalized);
    if (hops <= 10) return hops;
    throw new Error('TRUST_PROXY hop count must be between 0 and 10.');
  }

  const entries = value
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
  const validEntry = (entry) => {
    if (trustProxyAliases.has(entry.toLowerCase()) || isIP(entry)) return true;
    const [address, prefix, extra] = entry.split('/');
    if (extra !== undefined || !prefix || !/^\d+$/.test(prefix) || !isIP(address)) return false;
    const maximumPrefix = isIP(address) === 4 ? 32 : 128;
    return Number(prefix) <= maximumPrefix;
  };
  if (entries.length === 0 || !entries.every(validEntry)) {
    throw new Error(
      'TRUST_PROXY must be false, true, a hop count, or a comma-separated IP/CIDR list.'
    );
  }
  return entries;
}

function parseCorsOrigins(value) {
  const origins = value
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  if (origins.length === 0) throw new Error('CORS_ORIGIN must contain at least one origin.');
  if (origins.includes('*') && origins.length > 1) {
    throw new Error('CORS_ORIGIN cannot combine * with explicit origins.');
  }
  for (const origin of origins) {
    if (origin === '*') continue;
    let url;
    try {
      url = new URL(origin);
    } catch {
      throw new Error(`CORS_ORIGIN contains an invalid origin: ${origin}`);
    }
    if (!['http:', 'https:'].includes(url.protocol) || url.origin !== origin) {
      throw new Error(`CORS_ORIGIN must contain HTTP(S) origins without paths: ${origin}`);
    }
  }
  return origins.length === 1 ? origins[0] : origins;
}

function formatValidationError(error) {
  return error.issues
    .map((issue) => `${issue.path.join('.') || 'environment'}: ${issue.message}`)
    .join('; ');
}

/**
 * Creates an immutable, validated runtime configuration. The input can be
 * supplied directly by tests without mutating the real process environment.
 */
export function createConfig(
  environment = process.env,
  { projectRoot = PROJECT_ROOT, serverRoot = SERVER_ROOT, warn = console.warn } = {}
) {
  const parsedResult = environmentSchema.safeParse(environment);
  if (!parsedResult.success) {
    throw new Error(`Invalid server configuration: ${formatValidationError(parsedResult.error)}`);
  }

  const values = parsedResult.data;
  const isProduction = values.NODE_ENV === 'production';
  const seedDemoUsers = values.SEED_DEMO_USERS ?? !isProduction;
  const configurationErrors = [];
  const databasePath = path.resolve(serverRoot, values.SQLITE_DB_PATH);
  const productionDatabasePath = path.resolve(serverRoot, values.PRODUCTION_SQLITE_DB_PATH);
  const backupDirectory = path.resolve(projectRoot, values.BACKUP_DIR);
  const sqliteExtension = (filename) =>
    ['.db', '.sqlite', '.sqlite3'].includes(path.extname(filename).toLowerCase());

  if (!sqliteExtension(databasePath)) {
    configurationErrors.push('SQLITE_DB_PATH must end in .db, .sqlite, or .sqlite3.');
  }
  if (!sqliteExtension(productionDatabasePath)) {
    configurationErrors.push('PRODUCTION_SQLITE_DB_PATH must end in .db, .sqlite, or .sqlite3.');
  }
  if (databasePath === backupDirectory || productionDatabasePath === backupDirectory) {
    configurationErrors.push(
      'BACKUP_DIR must be a directory distinct from the SQLite database file.'
    );
  }

  if (isProduction && (!values.JWT_SECRET || values.JWT_SECRET.length < 32)) {
    configurationErrors.push('JWT_SECRET must contain at least 32 characters in production.');
  }
  if (isProduction && (!values.RETURN_QR_SECRET || values.RETURN_QR_SECRET.length < 32)) {
    configurationErrors.push('RETURN_QR_SECRET must contain at least 32 characters in production.');
  }
  if (
    isProduction &&
    values.CORS_ORIGIN.split(',')
      .map((entry) => entry.trim())
      .includes('*')
  ) {
    configurationErrors.push('CORS_ORIGIN cannot be * in production.');
  }
  if (isProduction && values.ALLOW_DATABASE_RESET) {
    configurationErrors.push('ALLOW_DATABASE_RESET must be false in production.');
  }
  if (isProduction && seedDemoUsers) {
    configurationErrors.push('SEED_DEMO_USERS must be false in production.');
  }
  if (isProduction && databasePath !== productionDatabasePath) {
    configurationErrors.push('SQLITE_DB_PATH must match PRODUCTION_SQLITE_DB_PATH in production.');
  }
  if (configurationErrors.length > 0) {
    throw new Error(`Invalid server configuration: ${configurationErrors.join(' ')}`);
  }

  let trustProxy;
  let corsOrigin;
  try {
    trustProxy = parseTrustProxy(values.TRUST_PROXY);
    corsOrigin = parseCorsOrigins(values.CORS_ORIGIN);
  } catch (error) {
    throw new Error(`Invalid server configuration: ${error.message}`);
  }

  const jwtSecret = values.JWT_SECRET || 'dev_fallback_jwt_secret_key_change_in_prod';
  if (!values.JWT_SECRET && typeof warn === 'function') {
    warn('WARNING: JWT_SECRET is not configured. Using the development-only fallback secret.');
  }
  const returnQrSecret = values.RETURN_QR_SECRET || 'dev_fallback_return_qr_secret_change_in_prod';
  if (!values.RETURN_QR_SECRET && typeof warn === 'function') {
    warn(
      'WARNING: RETURN_QR_SECRET is not configured. Using the development-only fallback secret.'
    );
  }

  const config = {
    env: values.NODE_ENV,
    isProduction,
    port: values.PORT,
    jwt: {
      secret: jwtSecret,
      expiresIn: values.JWT_EXPIRES_IN,
    },
    returns: {
      qrSecret: returnQrSecret,
      defaultTtlHours: values.RETURN_AUTHORIZATION_TTL_HOURS,
      maximumTtlHours: 168,
    },
    database: {
      path: databasePath,
      productionPath: productionDatabasePath,
      allowReset: values.ALLOW_DATABASE_RESET,
    },
    timezone: 'Africa/Cairo',
    cors: {
      origin: corsOrigin,
    },
    rateLimit: {
      windowMs: values.RATE_LIMIT_WINDOW_MS,
      max: values.RATE_LIMIT_MAX,
      loginWindowMs: values.LOGIN_RATE_LIMIT_WINDOW_MS,
      loginMax: values.LOGIN_RATE_LIMIT_MAX,
    },
    trustProxy,
    backup: {
      directory: backupDirectory,
      retention: values.BACKUP_RETENTION,
    },
    demoUsers: {
      enabled: seedDemoUsers,
    },
    shutdownTimeoutMs: values.SHUTDOWN_TIMEOUT_MS,
  };

  return Object.freeze(config);
}

process.env.TZ = 'Africa/Cairo';

const config = createConfig();

export default config;

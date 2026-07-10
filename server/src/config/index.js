import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Search for unified .env file in hierarchy
const cwdEnvPath = path.resolve(process.cwd(), '.env');
const serverEnvPath = path.resolve(__dirname, '../../.env');
const rootEnvPath = path.resolve(__dirname, '../../../.env');

if (fs.existsSync(cwdEnvPath)) {
  dotenv.config({ path: cwdEnvPath });
} else if (fs.existsSync(serverEnvPath)) {
  dotenv.config({ path: serverEnvPath });
} else if (fs.existsSync(rootEnvPath)) {
  dotenv.config({ path: rootEnvPath });
} else {
  dotenv.config();
}

// Lock application timezone permanently to Africa/Cairo
process.env.TZ = 'Africa/Cairo';

const nodeEnv = process.env.NODE_ENV || 'development';
const isProduction = nodeEnv === 'production';

// Basic verification of required keys
const jwtSecret = process.env.JWT_SECRET;
if (!jwtSecret) {
  if (isProduction) {
    throw new Error('FATAL: JWT_SECRET environment variable is required in production mode!');
  }
  console.warn('WARNING: JWT_SECRET is not configured. Falling back to default development secret.');
}

const config = {
  env: nodeEnv,
  port: parseInt(process.env.PORT || '5000', 10),
  jwt: {
    secret: jwtSecret || 'dev_fallback_jwt_secret_key_change_in_prod',
    expiresIn: process.env.JWT_EXPIRES_IN || '7d'
  },
  database: {
    // Resolve absolute path for the SQLite database file
    path: path.resolve(__dirname, '../../', process.env.SQLITE_DB_PATH || './src/db/a4_pos.db')
  },
  timezone: 'Africa/Cairo',
  cors: {
    origin: process.env.CORS_ORIGIN || '*'
  },
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10), // Default 15 minutes (15 * 60 * 1000)
    max: parseInt(process.env.RATE_LIMIT_MAX || '100', 10) // Default 100 requests per window
  }
};

export default config;

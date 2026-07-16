import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const resetScript = path.join(projectRoot, 'server', 'src', 'db', 'reset.js');

const result = spawnSync(process.execPath, [resetScript, '--confirm-reset'], {
  cwd: projectRoot,
  stdio: 'inherit',
  env: {
    ...process.env,
    NODE_ENV: 'development',
    SQLITE_DB_PATH: './src/db/a4_pos.local.db',
    PRODUCTION_SQLITE_DB_PATH: './src/db/a4_pos.db',
    ALLOW_DATABASE_RESET: 'true',
    SEED_DEMO_USERS: 'false',
    JWT_SECRET: process.env.JWT_SECRET || 'local_development_jwt_secret',
    RETURN_QR_SECRET: process.env.RETURN_QR_SECRET || 'local_development_return_qr_secret',
  },
});

if (result.error) {
  console.error(`Unable to run the local database reset: ${result.error.message}`);
  process.exitCode = 1;
} else {
  process.exitCode = result.status ?? 1;
}

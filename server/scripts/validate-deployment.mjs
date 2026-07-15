import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const serverRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const projectRoot = path.resolve(serverRoot, '..');

const deploy = fs.readFileSync(path.join(projectRoot, 'deploy.sh'), 'utf8');
const ecosystem = fs.readFileSync(path.join(projectRoot, 'ecosystem.config.js'), 'utf8');
const rootManifest = JSON.parse(fs.readFileSync(path.join(projectRoot, 'package.json'), 'utf8'));
const jwtSelector = path.join(serverRoot, 'scripts', 'select-deployment-jwt.mjs');
const supportedNodeRange = '^20.19.0 || >=22.12.0';

for (const relativeDirectory of ['', 'client', 'server']) {
  const directory = path.join(projectRoot, relativeDirectory);
  const manifest = JSON.parse(fs.readFileSync(path.join(directory, 'package.json'), 'utf8'));
  const lockfile = JSON.parse(fs.readFileSync(path.join(directory, 'package-lock.json'), 'utf8'));
  assert.equal(manifest.engines?.node, supportedNodeRange);
  assert.equal(lockfile.packages?.['']?.engines?.node, supportedNodeRange);
}

function envKeys(filename) {
  const lines = fs.readFileSync(path.join(projectRoot, filename), 'utf8').split(/\r?\n/);
  return lines
    .filter((line) => /^[A-Z][A-Z0-9_]*=/.test(line))
    .map((line) => line.slice(0, line.indexOf('=')));
}

const developmentKeys = envKeys('.env.example');
const productionKeys = envKeys('.env.production.example');
assert.deepEqual(productionKeys, developmentKeys, 'Development and production env keys differ.');
assert.equal(new Set(developmentKeys).size, developmentKeys.length, 'Duplicate env example key.');
for (const key of productionKeys) {
  assert.ok(deploy.includes(`${key}=`), `deploy.sh does not write production key: ${key}`);
}
assert.match(
  fs.readFileSync(path.join(projectRoot, '.env.production.example'), 'utf8'),
  /^JWT_SECRET=$/m,
  'The production JWT placeholder must fail closed.'
);
assert.match(
  fs.readFileSync(path.join(projectRoot, '.env.production.example'), 'utf8'),
  /^RETURN_QR_SECRET=$/m,
  'The production return QR secret placeholder must fail closed.'
);

for (const forbidden of [
  /chmod\s+(?:-R\s+)?777/,
  /setup_18\.x/,
  /server\/src\/db\/backups/,
  /SEED_DEMO_USERS=true/,
  /ALLOW_DATABASE_RESET=true/,
  /pm2 startup systemd -u root/,
  /usermod[^\n]*www-data/,
]) {
  assert.doesNotMatch(deploy, forbidden, `Unsafe deployment pattern found: ${forbidden}`);
}

for (const required of [
  'set -Eeuo pipefail',
  'setup_20.x',
  'Node.js 20.19 or newer is required.',
  'npm run ci:all',
  'npm run check',
  'npm run db:migrate',
  'NODE_ENV=production',
  'RETURN_QR_SECRET=$EXISTING_RETURN_QR_SECRET',
  'VITE_API_BASE_URL=',
  'HOST=127.0.0.1',
  'APP_DOMAIN=$DOMAIN_NAME',
  'APP_URL=https://$DOMAIN_NAME',
  'CORS_ORIGIN=https://$DOMAIN_NAME',
  'CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium',
  "fail 'Chromium was installed but /usr/bin/chromium is unavailable.'",
  'ALLOW_DATABASE_RESET=false',
  'SEED_DEMO_USERS=false',
  'BACKUP_DIR=./backups',
  'BACKUP_RETENTION=10',
  'BOOTSTRAP_ADMIN_PASSWORD',
  'APP_USER="${APP_USER:-a4pos}"',
  'sudo -u "$APP_USER"',
  'chown -R "root:$APP_GROUP" "$APP_DIR"',
  'EXISTING_NODE_ENV',
  'select-deployment-jwt.mjs',
  'chmod 0755 "$APP_DIR" "$APP_DIR/client" "$APP_DIR/client/dist"',
  'gpasswd -d www-data "$APP_GROUP"',
  'systemctl restart nginx',
  'sudo -u www-data test -r "$APP_DIR/client/dist/index.html"',
  'sudo -u www-data test -r "$APP_DIR/.env"',
  'APP_GROUP_GID=',
  '/proc/$nginx_pid/status',
  'certbot --nginx',
  'certbot.timer',
  'PDF_MAX_CONCURRENCY=2',
  'Pre-deployment SQLite backup failed integrity verification.',
  'Public HTTPS health check failed.',
  '\"available\":true',
]) {
  assert.ok(deploy.includes(required), `Deployment script is missing: ${required}`);
}

for (const script of [
  'production:check',
  'production:start',
  'production:restart',
  'production:logs',
  'db:migrate',
  'db:backup',
]) {
  assert.ok(rootManifest.scripts?.[script], `Root production script is missing: ${script}`);
}

assert.match(ecosystem, /NODE_ENV:\s*'production'/);
assert.match(ecosystem, /PORT:\s*5000/);
assert.match(ecosystem, /HOST:\s*'127\.0\.0\.1'/);
assert.doesNotMatch(ecosystem, /ALLOW_DATABASE_RESET/);

function selectDeploymentJwt(candidate, environment) {
  const result = spawnSync(process.execPath, [jwtSelector], {
    encoding: 'utf8',
    env: {
      ...process.env,
      EXISTING_JWT: candidate,
      EXISTING_NODE_ENV: environment,
    },
  });
  assert.equal(result.status, 0, result.stderr || 'JWT selector failed.');
  return result.stdout;
}

const developmentExample = fs
  .readFileSync(path.join(projectRoot, '.env.example'), 'utf8')
  .match(/^JWT_SECRET=(.*)$/m)?.[1];
assert.ok(developmentExample);
const generatedFromExample = selectDeploymentJwt(developmentExample, 'development');
assert.notEqual(generatedFromExample, developmentExample);
assert.match(generatedFromExample, /^[a-f0-9]{64}$/);
for (const weakCandidate of ['x'.repeat(64), 'production secret with whitespace'.repeat(2)]) {
  assert.notEqual(selectDeploymentJwt(weakCandidate, 'production'), weakCandidate);
}
const strongExistingSecret = 'A4-Strong_Existing-Production.JWT-Secret-2026!';
assert.equal(selectDeploymentJwt(strongExistingSecret, 'production'), strongExistingSecret);

const bashCandidates =
  process.platform === 'win32'
    ? [path.join(process.env.ProgramFiles || 'C:\\Program Files', 'Git', 'bin', 'bash.exe')]
    : ['bash'];
let bashChecked = false;
for (const executable of bashCandidates) {
  const check = spawnSync(executable, ['-n', path.join(projectRoot, 'deploy.sh')], {
    encoding: 'utf8',
  });
  if (check.error?.code === 'ENOENT') continue;
  assert.equal(check.status, 0, check.stderr || 'deploy.sh failed Bash syntax validation.');
  bashChecked = true;
  break;
}

console.log(
  `Deployment configuration validation passed${bashChecked ? ' (including Bash syntax)' : ''}.`
);

#!/usr/bin/env bash

set -Eeuo pipefail

# Production bootstrap for Ubuntu 22.04/24.04.
# Run from the project checkout (for example /root/a4-office):
#   sudo ./deploy.sh

APP_USER="root"
APP_GROUP="root"
APP_HOME="/root"
APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PM2_HOME="$APP_HOME/.pm2"
NGINX_SITE="/etc/nginx/sites-available/a4-pos"

fail() {
  printf 'ERROR: %s\n' "$*" >&2
  exit 1
}

if [[ "${EUID}" -ne 0 ]]; then
  fail 'Run this script as root with sudo.'
fi

DOMAIN_NAME="${DOMAIN_NAME:-a4office.cloud}"
if [[ ! "$DOMAIN_NAME" =~ ^[A-Za-z0-9.-]+$ ]] || [[ "$DOMAIN_NAME" == .* ]] || [[ "$DOMAIN_NAME" == *..* ]]; then
  fail 'The domain is invalid.'
fi

export DEBIAN_FRONTEND=noninteractive
apt-get update
apt-get install -y ca-certificates curl dnsutils build-essential nginx sqlite3 openssl ufw \
  certbot python3-certbot-nginx chromium fonts-noto-core fonts-noto-extra fonts-liberation
if [[ ! -x /usr/bin/chromium && -x /usr/bin/chromium-browser ]]; then
  ln -sfn /usr/bin/chromium-browser /usr/bin/chromium
fi
[[ -x /usr/bin/chromium ]] || fail 'Chromium was installed but /usr/bin/chromium is unavailable.'

NODE_VERSION_OK=false
if command -v node >/dev/null 2>&1; then
  NODE_VERSION_OK="$(node -e 'const [major, minor] = process.versions.node.split(".").map(Number); process.stdout.write(String(major === 20 && minor >= 19))')"
fi
if [[ "$NODE_VERSION_OK" != true ]]; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
fi
NODE_VERSION_OK="$(node -e 'const [major, minor] = process.versions.node.split(".").map(Number); process.stdout.write(String(major === 20 && minor >= 19))')"
if [[ "$NODE_VERSION_OK" != true ]]; then
  fail 'Node.js 20.19 or newer is required.'
fi

if ! command -v pm2 >/dev/null 2>&1; then
  npm install --global pm2
fi

install -d -o "$APP_USER" -g "$APP_GROUP" -m 0750 "$APP_HOME" "$PM2_HOME"
install -d -o "$APP_USER" -g "$APP_GROUP" -m 0750 \
  "$APP_DIR/backups" "$APP_DIR/logs" "$APP_DIR/server/src/db"
chown -R "$APP_USER:$APP_GROUP" "$APP_DIR"
chmod 0750 "$APP_DIR"

RESET_DATABASE="${RESET_DATABASE:-false}"
if [[ "$RESET_DATABASE" != "true" && "$RESET_DATABASE" != "false" ]]; then
  fail 'RESET_DATABASE must be true or false.'
fi

if [[ "$RESET_DATABASE" == "true" ]]; then
  printf 'RESET_DATABASE=true: removing the production SQLite database and sequence state.\n'
  rm -f -- \
    "$APP_DIR/server/src/db/a4_pos.db" \
    "$APP_DIR/server/src/db/a4_pos.db-wal" \
    "$APP_DIR/server/src/db/a4_pos.db-shm" \
    "$APP_DIR/server/src/db/a4_pos.db-journal"
elif [[ -s "$APP_DIR/server/src/db/a4_pos.db" ]]; then
  PRE_DEPLOY_BACKUP="$APP_DIR/backups/a4_pos.pre_deploy.$(date -u +%Y%m%dT%H%M%SZ).db"
  sudo -u "$APP_USER" sqlite3 "$APP_DIR/server/src/db/a4_pos.db" ".backup '$PRE_DEPLOY_BACKUP'"
  sudo -u "$APP_USER" sqlite3 "$PRE_DEPLOY_BACKUP" 'PRAGMA integrity_check;' | grep -Fxq ok \
    || fail 'Pre-deployment SQLite backup failed integrity verification.'
fi

EXISTING_JWT=''
EXISTING_RETURN_QR_SECRET=''
EXISTING_NODE_ENV=''
if [[ -f "$APP_DIR/.env" ]]; then
  EXISTING_JWT="$(sed -n 's/^JWT_SECRET=//p' "$APP_DIR/.env" | tail -n 1)"
  EXISTING_RETURN_QR_SECRET="$(sed -n 's/^RETURN_QR_SECRET=//p' "$APP_DIR/.env" | tail -n 1)"
  EXISTING_NODE_ENV="$(sed -n 's/^NODE_ENV=//p' "$APP_DIR/.env" | tail -n 1)"
fi
EXISTING_JWT="$(EXISTING_JWT="$EXISTING_JWT" EXISTING_NODE_ENV="$EXISTING_NODE_ENV" \
  node "$APP_DIR/server/scripts/select-deployment-jwt.mjs")"
EXISTING_RETURN_QR_SECRET="$(EXISTING_JWT="$EXISTING_RETURN_QR_SECRET" \
  EXISTING_NODE_ENV="$EXISTING_NODE_ENV" node "$APP_DIR/server/scripts/select-deployment-jwt.mjs")"
unset EXISTING_NODE_ENV

ENV_TEMP="$(mktemp "$APP_DIR/.env.production.XXXXXX")"
cleanup() {
  rm -f "$ENV_TEMP"
}
trap cleanup EXIT

cat >"$ENV_TEMP" <<EOF
NODE_ENV=production
PORT=5000
HOST=127.0.0.1
APP_DOMAIN=$DOMAIN_NAME
APP_URL=https://$DOMAIN_NAME
JWT_SECRET=$EXISTING_JWT
JWT_EXPIRES_IN=7d
RETURN_QR_SECRET=$EXISTING_RETURN_QR_SECRET
CORS_ORIGIN=https://$DOMAIN_NAME
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX=1500
LOGIN_RATE_LIMIT_WINDOW_MS=900000
LOGIN_RATE_LIMIT_MAX=10
TRUST_PROXY=loopback
SQLITE_DB_PATH=./src/db/a4_pos.db
PRODUCTION_SQLITE_DB_PATH=./src/db/a4_pos.db
ALLOW_DATABASE_RESET=false
SEED_DEMO_USERS=false
BACKUP_DIR=./backups
BACKUP_RETENTION=10
SHUTDOWN_TIMEOUT_MS=10000
CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium
PDF_TIMEOUT_MS=30000
PDF_MAX_CONCURRENCY=2
PDF_MAX_RECORDS=100
VITE_API_BASE_URL=
EOF
chown "$APP_USER:$APP_GROUP" "$ENV_TEMP"
chmod 0600 "$ENV_TEMP"
mv -f "$ENV_TEMP" "$APP_DIR/.env"
trap - EXIT

sudo -u "$APP_USER" -H bash -lc "cd '$APP_DIR' && npm run ci:all"
sudo -u "$APP_USER" -H bash -lc "cd '$APP_DIR' && npm run check"
sudo -u "$APP_USER" -H bash -lc "cd '$APP_DIR' && npm run build"
sudo -u "$APP_USER" -H bash -lc "cd '$APP_DIR' && npm run db:migrate"

ADMIN_COUNT="$(sqlite3 "$APP_DIR/server/src/db/a4_pos.db" \
  "SELECT COUNT(*) FROM users WHERE role = 'Admin';")"
if [[ "$ADMIN_COUNT" == "0" ]]; then
  printf '\nNo Admin account exists. Create the initial production Admin.\n'
  read -r -p 'Admin username [admin]: ' BOOTSTRAP_USERNAME
  BOOTSTRAP_USERNAME="${BOOTSTRAP_USERNAME:-admin}"
  read -r -p 'Admin display name [System Administrator]: ' BOOTSTRAP_NAME
  BOOTSTRAP_NAME="${BOOTSTRAP_NAME:-System Administrator}"
  read -r -s -p 'Temporary Admin password (minimum 8 characters): ' BOOTSTRAP_PASSWORD
  printf '\n'
  if (( ${#BOOTSTRAP_PASSWORD} < 8 )); then
    fail 'The temporary Admin password must contain at least 8 characters.'
  fi
  sudo -u "$APP_USER" -H env \
    BOOTSTRAP_ADMIN_USERNAME="$BOOTSTRAP_USERNAME" \
    BOOTSTRAP_ADMIN_NAME="$BOOTSTRAP_NAME" \
    BOOTSTRAP_ADMIN_PASSWORD="$BOOTSTRAP_PASSWORD" \
    npm --prefix "$APP_DIR/server" run admin:bootstrap
  unset BOOTSTRAP_PASSWORD
fi

# Keep the checkout owned by root, matching the simple PM2 deployment model.
chown -R root:root "$APP_DIR"
find "$APP_DIR" -type d -exec chmod 0750 {} +
find "$APP_DIR" -type f -exec chmod 0640 {} +
chmod 0750 "$APP_DIR/deploy.sh"
chown "$APP_USER:$APP_GROUP" "$APP_DIR/.env" "$APP_DIR/server/src/db"
find "$APP_DIR/server/src/db" -maxdepth 1 -type f \
  \( -name '*.db' -o -name '*.db-wal' -o -name '*.db-shm' -o -name '*.db-journal' \) \
  -exec chown "$APP_USER:$APP_GROUP" {} +
chown -R "$APP_USER:$APP_GROUP" "$APP_DIR/backups" "$APP_DIR/logs"
chmod 0750 "$APP_DIR/server/src/db" "$APP_DIR/backups" "$APP_DIR/logs"
find "$APP_DIR/client/dist" -type d -exec chmod 0755 {} +
find "$APP_DIR/client/dist" -type f -exec chmod 0644 {} +
chmod 0600 "$APP_DIR/.env"

cat >"$NGINX_SITE" <<EOF
server {
    listen 80;
    listen [::]:80;
    server_name $DOMAIN_NAME;
    client_max_body_size 10M;

    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml;

    location / {
        proxy_pass http://127.0.0.1:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_read_timeout 60s;
        proxy_buffering off;
    }
}
EOF

ln -sfn "$NGINX_SITE" /etc/nginx/sites-enabled/a4-pos
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl restart nginx

if ! getent ahostsv4 "$DOMAIN_NAME" >/dev/null 2>&1; then
  fail "DNS for $DOMAIN_NAME does not resolve; TLS was not requested."
fi
certbot --nginx -d "$DOMAIN_NAME" --non-interactive --agree-tos \
  --register-unsafely-without-email --redirect --keep-until-expiring
nginx -t
systemctl reload nginx
systemctl enable --now certbot.timer

sudo -u "$APP_USER" -H env PM2_HOME="$PM2_HOME" \
  pm2 delete a4-pos-server >/dev/null 2>&1 || true
sudo -u "$APP_USER" -H env PM2_HOME="$PM2_HOME" \
  pm2 start "$APP_DIR/ecosystem.config.js" --env production
sudo -u "$APP_USER" -H env PM2_HOME="$PM2_HOME" pm2 save
pm2 startup systemd -u "$APP_USER" --hp "$APP_HOME"

for attempt in {1..30}; do
  HEALTH_JSON="$(curl --fail --silent --show-error "http://127.0.0.1:5000/api/health" || true)"
  if grep -Fq '"status":"ok"' <<<"$HEALTH_JSON" \
    && grep -Fq '"available":true' <<<"$HEALTH_JSON"; then
    break
  fi
  if [[ "$attempt" -eq 30 ]]; then fail 'Application health check failed after PM2 startup.'; fi
  sleep 1
done
curl --fail --silent --show-error "https://$DOMAIN_NAME/api/health" >/dev/null \
  || fail 'Public HTTPS health check failed.'

CRON_FILE="/etc/cron.d/a4-pos-backup"
cat >"$CRON_FILE" <<EOF
SHELL=/bin/bash
PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
0 2 * * * $APP_USER cd $APP_DIR && npm run db:backup >> $APP_DIR/logs/backup.log 2>&1
EOF
chmod 0644 "$CRON_FILE"

ufw allow OpenSSH
ufw allow 'Nginx Full'
ufw --force enable

printf '\nDeployment completed.\n'
printf 'Application: https://%s\n' "$DOMAIN_NAME"
printf 'API health: https://%s/api/health\n' "$DOMAIN_NAME"
printf 'Backups: %s/backups (last 10 valid copies)\n' "$APP_DIR"
printf 'PM2: sudo -u %s -H env PM2_HOME=%s pm2 status\n' "$APP_USER" "$PM2_HOME"
printf 'Logs: %s/logs\n' "$APP_DIR"
printf 'TLS renewal test: certbot renew --dry-run\n'

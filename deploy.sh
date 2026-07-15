#!/usr/bin/env bash

set -Eeuo pipefail

# Production bootstrap for Ubuntu 22.04/24.04.
# Run from a checkout located outside /root (for example /opt/a4-office):
#   sudo ./deploy.sh

APP_USER="${APP_USER:-a4pos}"
APP_GROUP="${APP_GROUP:-a4pos}"
APP_HOME="${APP_HOME:-/var/lib/a4pos}"
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

if [[ "$APP_DIR" == /root || "$APP_DIR" == /root/* ]]; then
  fail 'Move the checkout to /opt/a4-office or /var/www/a4-office before deployment.'
fi
if [[ "$APP_USER" == www-data || "$APP_GROUP" == www-data ]]; then
  fail 'The application user and group must be isolated from the Nginx www-data account.'
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

if ! getent group "$APP_GROUP" >/dev/null; then
  groupadd --system "$APP_GROUP"
fi
if ! id "$APP_USER" >/dev/null 2>&1; then
  useradd --system --gid "$APP_GROUP" --home-dir "$APP_HOME" --create-home --shell /usr/sbin/nologin "$APP_USER"
fi
# Older releases added Nginx to the runtime group. Remove that inherited
# membership before applying permissions; a full Nginx restart below also
# clears supplementary groups retained by existing worker processes.
if id -nG www-data | tr ' ' '\n' | grep -Fxq "$APP_GROUP"; then
  gpasswd -d www-data "$APP_GROUP"
fi
if id -nG www-data | tr ' ' '\n' | grep -Fxq "$APP_GROUP"; then
  fail 'Unable to remove www-data from the application runtime group.'
fi

install -d -o "$APP_USER" -g "$APP_GROUP" -m 0750 "$APP_HOME" "$PM2_HOME"
install -d -o "$APP_USER" -g "$APP_GROUP" -m 0750 \
  "$APP_DIR/backups" "$APP_DIR/logs" "$APP_DIR/server/src/db"
chown -R "$APP_USER:$APP_GROUP" "$APP_DIR"
chmod 0750 "$APP_DIR"

if [[ -s "$APP_DIR/server/src/db/a4_pos.db" ]]; then
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

read -r -p 'Create the first production Admin now? [y/N]: ' CREATE_ADMIN
if [[ "$CREATE_ADMIN" =~ ^[Yy]$ ]]; then
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

# Lock application source after dependency installation/build. The service can
# write only runtime state; source remains readable through the a4pos group.
chown -R "root:$APP_GROUP" "$APP_DIR"
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
# Nginx can traverse only the public build path. It is deliberately not a
# member of the application group, so source, SQLite files, and backups stay
# unreadable to the web-server account.
chmod 0755 "$APP_DIR" "$APP_DIR/client" "$APP_DIR/client/dist"
chmod 0600 "$APP_DIR/.env"

cat >"$NGINX_SITE" <<EOF
server {
    listen 80;
    listen [::]:80;
    server_name $DOMAIN_NAME;
    client_max_body_size 10M;

    root $APP_DIR/client/dist;
    index index.html;

    location /api/ {
        proxy_pass http://127.0.0.1:5000;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_read_timeout 60s;
        proxy_buffering off;
        add_header Cache-Control "private, no-store" always;
    }

    location ^~ /assets/ {
        expires 1y;
        add_header Cache-Control "public, max-age=31536000, immutable";
        try_files \$uri =404;
    }

    location = /index.html {
        add_header Cache-Control "no-cache, no-store, must-revalidate";
    }

    location ~ (^|/)\. { deny all; }
    location ~* \.(?:env|db|sqlite|sqlite3|bak|log|map)$ { deny all; }

    location / {
        try_files \$uri \$uri/ /index.html;
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

if ! sudo -u www-data test -r "$APP_DIR/client/dist/index.html"; then
  fail 'Nginx cannot read the public client build.'
fi
if sudo -u www-data test -r "$APP_DIR/.env"; then
  fail 'Nginx can read the private environment file.'
fi
while IFS= read -r -d '' sensitive_file; do
  if sudo -u www-data test -r "$sensitive_file"; then
    fail "Nginx can read private runtime data: $sensitive_file"
  fi
done < <(
  find "$APP_DIR/server/src/db" "$APP_DIR/backups" -maxdepth 1 -type f \
    \( -name '*.db' -o -name '*.db-wal' -o -name '*.db-shm' -o -name '*.db-journal' \) \
    -print0
)

APP_GROUP_GID="$(getent group "$APP_GROUP" | cut -d: -f3)"
while IFS= read -r nginx_pid; do
  if awk -v gid="$APP_GROUP_GID" '$1 == "Groups:" { for (index = 2; index <= NF; index += 1) if ($index == gid) found = 1 } END { exit found ? 0 : 1 }' "/proc/$nginx_pid/status"; then
    fail "Nginx worker $nginx_pid retained the application group after restart."
  fi
done < <(pgrep -u www-data nginx || true)

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

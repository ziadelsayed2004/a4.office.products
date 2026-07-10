#!/bin/bash

# ==============================================================================
# 🚀 A4 Office Products POS — Unified Management System Ubuntu Deploy Script
# ==============================================================================
# This script automates the installation and deployment of the application on a
# clean Hostinger VPS running Ubuntu Linux.
#
# Requirements: Ubuntu 20.04 LTS or newer
# Run as: root (sudo)
# ==============================================================================

# Ensure script is run as root
if [ "$EUID" -ne 0 ]; then
  echo "❌ Error: Please run this script with root privileges (sudo):"
  echo "sudo ./deploy.sh"
  exit 1
fi

# Set working directory to project root
APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$APP_DIR"

echo "------------------------------------------------------------"
echo "🌟 A4 Office Products POS — Production Deployment Starting"
echo "Project Path: $APP_DIR"
echo "------------------------------------------------------------"

# 1. Update system packages
echo "⏳ Updating system packages..."
apt update && apt install -y curl git build-essential sqlite3 nginx ufw libnss3 libnspr4 libatk1.0-0 libatk-bridge2.0-0 libcups2 libdrm2 libxkbcommon0 libxcomposite1 libxdamage1 libxrandr2 libgbm1 libasound2t64 libx11-6 libx11-xcb1 libxcb1 libxfixes3 libxrender1 libxext6 libxss1 libxtst6 libxcursor1 libxi6 libpango-1.0-0 libpangocairo-1.0-0 libcairo2 libglib2.0-0 libgtk-3-0 libdbus-1-3 fonts-liberation
echo "✅ System packages updated."

# 2. Install Node.js v20 if not installed or older
echo "⏳ Verifying Node.js environment..."
INSTALL_NODE=true
if command -v node >/dev/null 2>&1; then
  NODE_VER=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
  if [ "$NODE_VER" -ge 20 ]; then
    echo "✅ Node.js $(node -v) is already installed."
    INSTALL_NODE=false
  fi
fi

if [ "$INSTALL_NODE" = true ]; then
  echo "⏳ Installing Node.js v20..."
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt install -y nodejs
  echo "✅ Node.js installed: $(node -v)"
fi

# 3. Install PM2 Process Manager globally
echo "⏳ Verifying PM2 installer..."
if ! command -v pm2 >/dev/null 2>&1; then
  echo "⏳ Installing PM2..."
  npm install -g pm2
fi
echo "✅ PM2 installed: $(pm2 -v)"

# 4. Prompt for Server Domain
echo "------------------------------------------------------------"
echo "🌐 Domain Configuration"
echo "------------------------------------------------------------"
read -p "Enter your domain [default: a4posplatform.cloud]: " DOMAIN_NAME
if [ -z "$DOMAIN_NAME" ]; then
  DOMAIN_NAME="a4posplatform.cloud"
fi
echo "ℹ️ Configuring server block with domain: $DOMAIN_NAME"

# 5. Configure Production Environment variables (.env) inside server/
echo "⏳ Configuring Environment File (server/.env)..."
mkdir -p server
if [ ! -f "server/.env" ]; then
  if [ -f "server/.env.example" ]; then
    cp server/.env.example server/.env
    echo "✓ Created server/.env file from template."
  elif [ -f ".env.example" ]; then
    cp .env.example server/.env
    echo "✓ Created server/.env file from root template."
  else
    # Fallback default .env creation
    cat <<EOF > server/.env
PORT=5000
NODE_ENV=production
JWT_SECRET=default_placeholder_secret
JWT_EXPIRES_IN=7d
SQLITE_DB_PATH=./src/db/a4_pos.db
EOF
    echo "✓ Created default server/.env file."
  fi
fi

# Generate secure random secret for JWT and replace placeholders
SECURE_SECRET=$(openssl rand -hex 32)
sed -i "s|^JWT_SECRET=.*|JWT_SECRET=${SECURE_SECRET}|" server/.env
sed -i "s|^NODE_ENV=.*|NODE_ENV=production|" server/.env
sed -i "s|^PORT=.*|PORT=5000|" server/.env

echo "✅ Environment configured (.env file updated)."

# 6. Install Project Dependencies & Compile React Frontend
echo "⏳ Installing all project dependencies (Root, Client, Server)..."
npm run install:all

echo "⏳ Compiling React static production files (Vite build)..."
npm run build
echo "✅ Application dependencies and client compilation finished."

# 7. Setup Directory Access Permissions
echo "⏳ Setting file permissions for security and system write operations..."
# Web root files readable by Nginx
chmod -R 755 "$APP_DIR/client/dist"
# SQLite database folders read/writable by Express app running in PM2
mkdir -p server/src/db/backups
chmod -R 777 "$APP_DIR/server/src/db"
echo "✅ Permissions updated."

# 8. Configure PM2 process daemonization
echo "⏳ Starting Node.js backend daemon with PM2..."
# Stop existing application thread if it was running
pm2 stop a4-pos-server >/dev/null 2>&1 || true
pm2 delete a4-pos-server >/dev/null 2>&1 || true

# Start clean process in production mode
pm2 start ecosystem.config.js --env production
pm2 save

# Automatically configure PM2 startup daemon to launch after reboot
pm2 startup systemd -u root --hp /root >/dev/null 2>&1 || true
echo "✅ Daemonized successfully. PM2 processes saved."

# 9. Configure Nginx Reverse Proxy
echo "⏳ Setting up Nginx Virtual Host configuration..."
NGINX_CONF="/etc/nginx/sites-available/a4-pos"

cat <<EOF > "$NGINX_CONF"
server {
    listen 80;
    server_name $DOMAIN_NAME;

    # Maximum client payload size (important for document attachments)
    client_max_body_size 10M;

    # Gzip Compression
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml;

    # Serve static assets directly
    location / {
        root $APP_DIR/client/dist;
        index index.html;
        try_files \$uri \$uri/ /index.html;
    }

    # Proxy API requests to backend
    location /api {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}
EOF

# Activate site configuration and disable default site
rm -f /etc/nginx/sites-enabled/default
rm -f /etc/nginx/sites-enabled/a4-pos
ln -s "$NGINX_CONF" /etc/nginx/sites-enabled/

echo "⏳ Testing Nginx server configuration..."
nginx -t
if [ $? -eq 0 ]; then
  systemctl restart nginx
  echo "✅ Nginx server successfully configured and restarted."
else
  echo "❌ Error: Nginx configuration test failed." >&2
fi

# 10. Configure Firewall Security Rules (UFW)
echo "⏳ Opening firewall ports (UFW)..."
ufw allow 'Nginx Full'
ufw allow OpenSSH
ufw --force enable
echo "✅ Firewall active."

# 11. Configure SSL via Let's Encrypt Certbot
echo "------------------------------------------------------------"
echo "🔒 SSL / HTTPS Configuration (Let's Encrypt)"
echo "------------------------------------------------------------"
read -p "Would you like to install and configure SSL (HTTPS) for $DOMAIN_NAME? (y/N): " SETUP_SSL
if [[ "$SETUP_SSL" =~ ^[Yy]$ ]]; then
  echo "⏳ Installing Certbot and plugins..."
  apt install -y certbot python3-certbot-nginx
  
  echo "⏳ Requesting SSL Certificate for $DOMAIN_NAME..."
  # Run certbot non-interactively, agree to terms, redirect HTTP to HTTPS
  certbot --nginx -d "$DOMAIN_NAME" --non-interactive --agree-tos --register-unsafely-without-email --redirect
  
  if [ $? -eq 0 ]; then
    echo "✅ SSL Certificate successfully installed and Nginx configured for HTTPS!"
  else
    echo "⚠️ Certbot failed to obtain SSL certificate. Please ensure your domain DNS (A record) points to this server's IP address."
  fi
else
  echo "ℹ️ Skipping SSL Configuration. You can configure it manually later using Certbot."
fi

# 12. Setup Automated 2:00 AM SQLite Daily Backups
echo "⏳ Configuring Automated Database Backups (Cron)..."
CRON_LINE="0 2 * * * cd $APP_DIR && /usr/bin/npm run db:backup >> $APP_DIR/server/src/db/backups/cron_backup.log 2>&1"
# Append backup script to crontab if not already configured
(crontab -l 2>/dev/null | grep -F "db:backup" >/dev/null)
if [ $? -ne 0 ]; then
  (crontab -l 2>/dev/null; echo "$CRON_LINE") | crontab -
  echo "✅ Auto Backup scheduled via Crontab (Daily at 2:00 AM)."
else
  echo "✅ Auto Backup cron job is already registered."
fi

echo "------------------------------------------------------------"
echo "🎉 Deployment Completed Successfully!"
echo "------------------------------------------------------------"
echo "🌐 App is available at: http://$DOMAIN_NAME"
echo "💾 SQLite backups are saved at: $APP_DIR/server/src/db/backups/"
echo "------------------------------------------------------------"

# A4 Office POS — Handoff

Production operations are defined by `deploy.sh` and `DEPLOYMENT.md`: domain `a4office.cloud`, isolated user `a4pos`, loopback Express, Nginx/Certbot TLS, PM2, verified SQLite backups, and system-Chromium PDF exports.

## Runtime contracts

- The root `.env` is the only runtime environment file. Production secrets must be distinct, at least 32 characters, and free of placeholders.
- Express binds to `127.0.0.1:5000`; only Nginx is public.
- SQLite data, `.env`, logs, and backups are private to the application user. Nginx may read only `client/dist`.
- Database reset and demo user seeding are forbidden in production.
- Thermal receipts and labels use browser printing. Invoice/report PDFs use authenticated server-side Chromium.
- PM2 runs one fork process. Authenticated Admin SSE uses the process-local event bus with 15-second polling fallback; move the bus to Redis/pub-sub before enabling multiple processes. Keep Nginx `proxy_buffering off` for the stream.

## Release gate

Run `npm ci`, `npm run ci:all`, and `npm run check`. The deploy script repeats clean installation, validation, migrations, build, Nginx checks, PM2 startup, private and public health checks, TLS setup, and filesystem isolation checks.

Before an update, preserve the current checkout and ensure `/opt/a4-office/backups` has a recent verified database copy. The deploy script creates an additional `pre_deploy` backup when a production database exists.

## Operations

```bash
curl -fsS https://a4office.cloud/api/health
sudo -u a4pos -H env PM2_HOME=/var/lib/a4pos/.pm2 pm2 status
sudo -u a4pos -H env PM2_HOME=/var/lib/a4pos/.pm2 pm2 logs a4-pos-server
sudo nginx -t
sudo certbot renew --dry-run
```

Follow `DEPLOYMENT.md` for first-admin bootstrap, restore, rollback, Chromium diagnostics, and certificate renewal.

# A4 Office VPS Deployment

This project targets Ubuntu 22.04/24.04 at `https://a4office.cloud`. It stays operationally separate from `TEMPLETE-PROJECT`, with its own Nginx site, PM2 process, service account, database, backups, and certificate.

## Prerequisites and first deployment

- Point the `a4office.cloud` A record to the VPS public IPv4 address.
- Place the checkout outside `/root`, preferably at `/opt/a4-office`.
- Keep a provider snapshot before the first production migration.

```bash
cd /opt/a4-office
chmod +x deploy.sh
sudo ./deploy.sh
```

The script defaults to `a4office.cloud`. For intentional staging only, use `sudo DOMAIN_NAME=staging.a4office.cloud ./deploy.sh`.

It installs Node 20, Chromium, Noto Arabic fonts, Nginx, Certbot, SQLite, PM2 and UFW; creates the isolated `a4pos` account; generates independent secrets; runs clean installs, tests and builds; configures HTTPS; starts PM2; and schedules daily backups. Create the first administrator through the deploy prompt. No production credentials are committed or seeded.

## Updates and diagnostics

Pull or upload the release and run `sudo ./deploy.sh` again. Valid production secrets are retained. An integrity-checked `pre_deploy` database backup is created before installs and migrations. Production reset and demo seeding remain disabled.

```bash
curl -fsS https://a4office.cloud/api/health
sudo -u a4pos -H env PM2_HOME=/var/lib/a4pos/.pm2 pm2 status
sudo -u a4pos -H env PM2_HOME=/var/lib/a4pos/.pm2 pm2 logs a4-pos-server
sudo nginx -t
sudo certbot renew --dry-run
systemctl status certbot.timer
```

The health response exposes SQLite, migration and Chromium readiness without paths or secrets. Port 5000 binds to loopback and must not be opened externally.

## Backups, restore, and rollback

Daily verified backups are stored in `/opt/a4-office/backups` with a default retention of 10. Restore only after checking integrity:

```bash
sudo -u a4pos -H env PM2_HOME=/var/lib/a4pos/.pm2 pm2 stop a4-pos-server
sudo -u a4pos sqlite3 /opt/a4-office/backups/SELECTED.db 'PRAGMA integrity_check;'
sudo cp /opt/a4-office/server/src/db/a4_pos.db /opt/a4-office/backups/a4_pos.before_restore.db
sudo cp /opt/a4-office/backups/SELECTED.db /opt/a4-office/server/src/db/a4_pos.db
sudo chown a4pos:a4pos /opt/a4-office/server/src/db/a4_pos.db
sudo -u a4pos -H env PM2_HOME=/var/lib/a4pos/.pm2 pm2 restart a4-pos-server
curl -fsS https://a4office.cloud/api/health
```

For release rollback, restore the prior checkout and its matching pre-deployment database backup when the failed release applied migrations. Never run `db:reset` in production.

## Live updates and process topology

The supported production topology is one PM2 fork process. Admin live updates use an authenticated SSE invalidation stream backed by an in-memory event bus; Nginx therefore keeps `proxy_buffering off`. The client reloads authoritative HTTP data after an event, falls back to polling every 15 seconds after a stream failure, pauses while hidden, and resynchronizes when visible. User presence is reported by a visible-app heartbeat every 30 seconds and is considered offline after 90 seconds.

Do not increase the PM2 instance count with the in-memory event bus: events emitted in one process would not reach streams attached to another process. Before horizontal or cluster scaling, replace the event transport with Redis/pub-sub (or an equivalent shared broker) while retaining the same SSE contract and polling fallback.

## Printing

Thermal receipts, Admin-only CODE128 product labels, and reusable ID-1 (`85.6×54mm`) return-approval cards use browser printing. Invoice and report PDFs use `/usr/bin/chromium` with local Arabic fonts. PDF data comes only from authorized server records; values are escaped, jobs and record counts are bounded, and results are streamed without persistent temporary files. Cashier receipt/PDF output requires that Cashier's own `OPEN` shift; Admin output is an audited no-shift override.

If PDF readiness is false, check Chromium executable permissions for `a4pos`, Noto fonts, available memory, and PM2 error logs.

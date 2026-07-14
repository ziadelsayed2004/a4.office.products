import crypto from 'node:crypto';

export const version = '005';
export const name = 'live_admin_activity';
export const checksum = crypto
  .createHash('sha256')
  .update(`${version}:${name}:2026-07-15-v1`)
  .digest('hex');

async function hasColumn(db, table, column) {
  const columns = await db.all(`PRAGMA table_info(${table});`);
  return columns.some((candidate) => candidate.name === column);
}

export async function up(db) {
  if (!(await hasColumn(db, 'sessions', 'last_seen_at'))) {
    await db.run('ALTER TABLE sessions ADD COLUMN last_seen_at DATETIME;');
  }
  await db.exec(`
    UPDATE sessions SET last_seen_at = COALESCE(last_seen_at, created_at);

    CREATE INDEX IF NOT EXISTS idx_sessions_user_activity
      ON sessions(user_id, last_seen_at DESC);
    CREATE INDEX IF NOT EXISTS idx_sessions_expiry
      ON sessions(expires_at);
    CREATE INDEX IF NOT EXISTS idx_orders_shift_created
      ON orders(shift_id, created_at DESC, id DESC);
    CREATE INDEX IF NOT EXISTS idx_payments_shift_created
      ON payments(shift_id, created_at DESC, id DESC);
    CREATE INDEX IF NOT EXISTS idx_cash_movements_shift_created
      ON cash_movements(shift_id, created_at DESC, id DESC);
    CREATE INDEX IF NOT EXISTS idx_audit_user_action_created
      ON audit_logs(user_id, action_type, created_at DESC);
  `);
}

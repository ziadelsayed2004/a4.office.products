import crypto from 'node:crypto';

export const version = '010';
export const name = 'admin_notifications';
export const checksum = crypto
  .createHash('sha256')
  .update(`${version}:${name}:2026-07-18-v1`)
  .digest('hex');

export async function up(db) {
  await db.exec(`
    CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL,
      severity TEXT NOT NULL DEFAULT 'INFO'
        CHECK(severity IN ('INFO', 'SUCCESS', 'WARNING', 'ERROR')),
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      action_path TEXT,
      actor_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      source_type TEXT,
      source_id INTEGER,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS notification_reads (
      notification_id INTEGER NOT NULL REFERENCES notifications(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      read_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY(notification_id, user_id)
    );

    CREATE UNIQUE INDEX IF NOT EXISTS idx_notifications_source
      ON notifications(source_type, source_id)
      WHERE source_type IS NOT NULL AND source_id IS NOT NULL;
    CREATE INDEX IF NOT EXISTS idx_notifications_created
      ON notifications(created_at DESC, id DESC);
    CREATE INDEX IF NOT EXISTS idx_notification_reads_user
      ON notification_reads(user_id, read_at DESC);
  `);
}

import bcrypt from 'bcryptjs';
import { z } from 'zod';
import db, { withTransaction } from './index.js';
import { runMigrations } from './migrate.js';

const bootstrapInputSchema = z.object({
  username: z
    .string()
    .trim()
    .min(3)
    .max(64)
    .regex(/^[A-Za-z0-9._-]+$/),
  password: z.string().min(8).max(128),
  name: z.string().trim().min(2).max(120),
  phone: z.string().trim().max(30).optional(),
});

async function bootstrapAdmin() {
  const input = bootstrapInputSchema.parse({
    username: process.env.BOOTSTRAP_ADMIN_USERNAME || 'admin',
    password: process.env.BOOTSTRAP_ADMIN_PASSWORD,
    name: process.env.BOOTSTRAP_ADMIN_NAME || 'System Administrator',
    phone: process.env.BOOTSTRAP_ADMIN_PHONE || undefined,
  });

  // Reduce the lifetime of the clear-text password in the process environment.
  delete process.env.BOOTSTRAP_ADMIN_PASSWORD;

  await runMigrations();
  const passwordHash = await bcrypt.hash(input.password, 12);
  input.password = undefined;

  return withTransaction(async (connection) => {
    const existingAdmin = await connection.get(
      "SELECT id FROM users WHERE role = 'Admin' LIMIT 1;"
    );
    if (existingAdmin) {
      throw new Error(
        'An Admin account already exists; bootstrap is only available for the first Admin.'
      );
    }

    const usernameInUse = await connection.get('SELECT id FROM users WHERE username = ?;', [
      input.username,
    ]);
    if (usernameInUse) throw new Error('The bootstrap username is already in use.');

    const result = await connection.run(
      `INSERT INTO users (username, password_hash, role, name, phone)
       VALUES (?, ?, 'Admin', ?, ?);`,
      [input.username, passwordHash, input.name, input.phone || null]
    );
    return { id: result.lastID, username: input.username };
  });
}

try {
  if (!process.env.BOOTSTRAP_ADMIN_PASSWORD) {
    throw new Error('BOOTSTRAP_ADMIN_PASSWORD is required and must contain at least 8 characters.');
  }
  const admin = await bootstrapAdmin();
  console.log(`Initial Admin created successfully: ${admin.username} (id=${admin.id}).`);
} catch (error) {
  const message = error?.issues
    ? error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('; ')
    : error.message;
  console.error(`Admin bootstrap failed: ${message}`);
  process.exitCode = 1;
} finally {
  delete process.env.BOOTSTRAP_ADMIN_PASSWORD;
  await db.close();
}

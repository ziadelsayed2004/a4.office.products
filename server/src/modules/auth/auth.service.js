import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import db, { withTransaction } from '../../db/index.js';
import config from '../../config/index.js';
import { writeAuditLog } from '../../utils/auditLogger.js';
import { AppError } from '../../utils/errors.js';

function generateAccessToken(user, sessionId) {
  return jwt.sign(
    {
      id: user.id,
      sid: sessionId,
      username: user.username,
      role: user.role,
      name: user.name,
    },
    config.jwt.secret,
    { expiresIn: config.jwt.expiresIn }
  );
}

function publicUser(user) {
  return {
    id: user.id,
    username: user.username,
    role: user.role,
    name: user.name,
    phone: user.phone,
  };
}

export async function login(username, password) {
  const cleanUsername = String(username || '').trim();
  if (!cleanUsername || typeof password !== 'string') {
    throw new AppError('Username and password are required.', 400, 'LOGIN_FIELDS_REQUIRED');
  }
  const user = await db.get('SELECT * FROM users WHERE username = ? AND is_active = 1;', [
    cleanUsername,
  ]);
  const valid = user ? await bcrypt.compare(password, user.password_hash) : false;
  if (!valid) throw new AppError('Invalid username or password.', 401, 'INVALID_CREDENTIALS');

  const refreshToken = crypto.randomBytes(40).toString('hex');
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
  return withTransaction(async (connection) => {
    const session = await connection.run(
      'INSERT INTO sessions (user_id, token, expires_at) VALUES (?, ?, ?);',
      [user.id, refreshToken, expiresAt]
    );
    await writeAuditLog({
      userId: user.id,
      actionType: 'LOGIN',
      entityType: 'users',
      entityId: user.id,
      notes: 'User logged in successfully',
      connection,
    });
    return {
      user: publicUser(user),
      accessToken: generateAccessToken(user, session.lastID),
      refreshToken,
    };
  });
}

export async function refresh(refreshToken) {
  if (typeof refreshToken !== 'string' || !refreshToken) {
    throw new AppError('Refresh token is required.', 400, 'REFRESH_TOKEN_REQUIRED');
  }
  const session = await db.get(
    `SELECT s.*, u.username, u.role, u.name, u.phone, u.is_active
       FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token = ?;`,
    [refreshToken]
  );
  if (!session) throw new AppError('Session is invalid.', 401, 'INVALID_REFRESH_TOKEN');
  if (new Date(session.expires_at).getTime() <= Date.now()) {
    await withTransaction((connection) =>
      connection.run('DELETE FROM sessions WHERE id = ?;', [session.id])
    );
    throw new AppError('Session has expired.', 401, 'REFRESH_TOKEN_EXPIRED');
  }
  if (session.is_active !== 1) throw new AppError('User is inactive.', 401, 'INACTIVE_USER');
  return { accessToken: generateAccessToken(session, session.id) };
}

export async function logout(refreshToken) {
  if (typeof refreshToken !== 'string' || !refreshToken) return false;
  return withTransaction(async (connection) => {
    const session = await connection.get('SELECT * FROM sessions WHERE token = ?;', [refreshToken]);
    if (!session) return false;
    await connection.run('DELETE FROM sessions WHERE id = ?;', [session.id]);
    await writeAuditLog({
      userId: session.user_id,
      actionType: 'LOGOUT',
      entityType: 'users',
      entityId: session.user_id,
      notes: 'User logged out successfully',
      connection,
    });
    return true;
  });
}

export async function getUserById(id, connection = db) {
  return connection.get(
    'SELECT id, username, role, name, phone, is_active FROM users WHERE id = ?;',
    [id]
  );
}

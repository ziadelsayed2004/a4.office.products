import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import db from '../../db/index.js';
import config from '../../config/index.js';
import { writeAuditLog } from '../../utils/auditLogger.js';

/**
 * Sign a JWT access token with user details.
 */
function generateAccessToken(user) {
  return jwt.sign(
    {
      id: user.id,
      username: user.username,
      role: user.role,
      name: user.name
    },
    config.jwt.secret,
    { expiresIn: config.jwt.expiresIn }
  );
}

export async function login(username, password) {
  // Find active user
  const user = await db.get(
    'SELECT * FROM users WHERE username = ? AND is_active = 1;',
    [username]
  );

  if (!user) {
    throw new Error('اسم المستخدم أو كلمة المرور غير صحيحة.');
  }

  // Verify password hash
  const isMatch = await bcrypt.compare(password, user.password_hash);
  if (!isMatch) {
    throw new Error('اسم المستخدم أو كلمة المرور غير صحيحة.');
  }

  // Generate tokens
  const accessToken = generateAccessToken(user);
  const refreshToken = crypto.randomBytes(40).toString('hex');
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(); // 30 days expiry

  // Save session record
  await db.run(
    'INSERT INTO sessions (user_id, token, expires_at) VALUES (?, ?, ?);',
    [user.id, refreshToken, expiresAt]
  );

  // Write audit log
  await writeAuditLog({
    userId: user.id,
    actionType: 'LOGIN',
    entityType: 'users',
    entityId: user.id,
    notes: `تم تسجيل دخول المستخدم بنجاح`
  });

  return {
    user: {
      id: user.id,
      username: user.username,
      role: user.role,
      name: user.name,
      phone: user.phone
    },
    accessToken,
    refreshToken
  };
}

export async function refresh(refreshToken) {
  if (!refreshToken) {
    throw new Error('رمز التجديد مطلوب.');
  }

  // Verify if token exists in database and is not expired
  const session = await db.get(
    'SELECT * FROM sessions WHERE token = ?;',
    [refreshToken]
  );

  if (!session) {
    throw new Error('جلسة العمل غير صالحة.');
  }

  if (new Date(session.expires_at) < new Date()) {
    // Delete expired session
    await db.run('DELETE FROM sessions WHERE id = ?;', [session.id]);
    throw new Error('جلسة العمل منتهية الصلاحية.');
  }

  // Load user
  const user = await db.get(
    'SELECT * FROM users WHERE id = ? AND is_active = 1;',
    [session.user_id]
  );

  if (!user) {
    throw new Error('المستخدم غير موجود أو تم تعطيله.');
  }

  // Issue new access token
  const accessToken = generateAccessToken(user);

  return { accessToken };
}

export async function logout(refreshToken) {
  if (!refreshToken) {
    return false;
  }

  const session = await db.get(
    'SELECT * FROM sessions WHERE token = ?;',
    [refreshToken]
  );

  if (session) {
    // Delete session from DB
    await db.run('DELETE FROM sessions WHERE id = ?;', [session.id]);

    // Log the logout event
    await writeAuditLog({
      userId: session.user_id,
      actionType: 'LOGOUT',
      entityType: 'users',
      entityId: session.user_id,
      notes: `تم تسجيل خروج المستخدم بنجاح`
    });
    
    return true;
  }

  return false;
}

export async function getUserById(id) {
  const user = await db.get(
    'SELECT id, username, role, name, phone, is_active FROM users WHERE id = ?;',
    [id]
  );
  return user;
}

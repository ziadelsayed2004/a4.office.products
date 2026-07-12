import jwt from 'jsonwebtoken';
import config from '../config/index.js';
import db from '../db/index.js';

/**
 * Authentication middleware verifying JWT session keys.
 */
export const authenticate = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      error: 'غير مصرح. يرجى تسجيل الدخول أولاً.',
      code: 'UNAUTHORIZED'
    });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, config.jwt.secret);
    const user = await db.get(
      'SELECT id, username, role, name, phone, is_active FROM users WHERE id = ?;',
      [decoded.id]
    );
    if (!user || user.is_active !== 1) {
      return res.status(401).json({
        error: 'تم تعطيل الحساب أو حذفه. يرجى تسجيل الدخول بحساب نشط.',
        code: 'INACTIVE_USER'
      });
    }
    // The database is authoritative for current role and activity; JWT role
    // claims cannot outlive an Admin role change.
    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json({
      error: 'جلسة العمل منتهية الصلاحية أو غير صالحة. يرجى تسجيل الدخول مرة أخرى.',
      code: 'INVALID_TOKEN'
    });
  }
};

/**
 * RBAC Role enforcement middleware.
 */
export const requireRole = (allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        error: 'غير مصرح.',
        code: 'UNAUTHORIZED'
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        error: 'صلاحيات غير كافية لإجراء هذه العملية.',
        code: 'FORBIDDEN'
      });
    }

    next();
  };
};

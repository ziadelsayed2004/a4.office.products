/**
 * Authorization guard: restrict access to Admin role only
 */
export const isAdmin = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      error: 'غير مصرح. يرجى تسجيل الدخول أولاً.',
      code: 'UNAUTHORIZED',
    });
  }

  if (req.user.role !== 'Admin') {
    return res.status(403).json({
      error: 'صلاحيات غير كافية لإجراء هذه العملية. هذا الإجراء مخصص للمسؤولين فقط.',
      code: 'FORBIDDEN',
    });
  }

  next();
};

/**
 * Authorization guard: restrict access to Cashier role only
 */
export const isCashier = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      error: 'غير مصرح. يرجى تسجيل الدخول أولاً.',
      code: 'UNAUTHORIZED',
    });
  }

  if (req.user.role !== 'Cashier') {
    return res.status(403).json({
      error: 'صلاحيات غير كافية لإجراء هذه العملية. هذا الإجراء مخصص للكاشير فقط.',
      code: 'FORBIDDEN',
    });
  }

  next();
};

/**
 * Authorization guard: restrict access to Cashier or Admin role
 */
export const isCashierOrAdmin = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      error: 'غير مصرح. يرجى تسجيل الدخول أولاً.',
      code: 'UNAUTHORIZED',
    });
  }

  if (req.user.role !== 'Admin' && req.user.role !== 'Cashier') {
    return res.status(403).json({
      error: 'صلاحيات غير كافية لإجراء هذه العملية.',
      code: 'FORBIDDEN',
    });
  }

  next();
};

/**
 * Security policy: prevent Cashiers from updating credentials, permissions, or info
 */
export const restrictCashierSelfEdit = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      error: 'غير مصرح. يرجى تسجيل الدخول أولاً.',
      code: 'UNAUTHORIZED',
    });
  }

  if (req.user.role === 'Cashier') {
    return res.status(403).json({
      error: 'لا يسمح للكاشير بتعديل بيانات الحساب.',
      code: 'FORBIDDEN',
    });
  }

  next();
};

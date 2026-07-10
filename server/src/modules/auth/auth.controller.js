import * as authService from './auth.service.js';

export async function loginController(req, res, next) {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({
        error: 'اسم المستخدم وكلمة المرور مطلوبان.',
        code: 'VALIDATION_ERROR'
      });
    }

    const authData = await authService.login(username, password);
    return res.status(200).json({
      message: 'تم تسجيل الدخول بنجاح.',
      data: authData
    });
  } catch (error) {
    return res.status(400).json({
      error: error.message,
      code: 'AUTH_FAILED'
    });
  }
}

export async function refreshController(req, res, next) {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      return res.status(400).json({
        error: 'رمز التجديد مطلوب.',
        code: 'VALIDATION_ERROR'
      });
    }

    const tokenData = await authService.refresh(refreshToken);
    return res.status(200).json({
      message: 'تم تجديد رمز الوصول بنجاح.',
      data: tokenData
    });
  } catch (error) {
    return res.status(401).json({
      error: error.message,
      code: 'REFRESH_FAILED'
    });
  }
}

export async function logoutController(req, res, next) {
  try {
    const { refreshToken } = req.body;
    await authService.logout(refreshToken);
    
    return res.status(200).json({
      message: 'تم تسجيل الخروج بنجاح.'
    });
  } catch (error) {
    return res.status(400).json({
      error: error.message,
      code: 'LOGOUT_FAILED'
    });
  }
}

export async function meController(req, res, next) {
  try {
    // req.user is set by authenticate middleware
    const user = await authService.getUserById(req.user.id);
    if (!user || user.is_active !== 1) {
      return res.status(401).json({
        error: 'المستخدم غير موجود أو تم تعطيله.',
        code: 'UNAUTHORIZED'
      });
    }

    return res.status(200).json({
      data: {
        id: user.id,
        username: user.username,
        role: user.role,
        name: user.name,
        phone: user.phone
      }
    });
  } catch (error) {
    return res.status(500).json({
      error: 'حدث خطأ أثناء تحميل بيانات المستخدم.',
      code: 'SERVER_ERROR'
    });
  }
}

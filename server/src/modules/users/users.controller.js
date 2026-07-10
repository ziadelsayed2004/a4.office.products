import * as usersService from './users.service.js';

export async function getUsersListController(req, res, next) {
  try {
    const users = await usersService.getAllUsers();
    return res.status(200).json({
      status: 'success',
      data: users
    });
  } catch (error) {
    return res.status(500).json({
      error: 'حدث خطأ أثناء تحميل قائمة المستخدمين.',
      code: 'SERVER_ERROR'
    });
  }
}

export async function createUserController(req, res, next) {
  try {
    const { username, password, role, name, phone } = req.body;
    // req.user.id holds the authenticated admin user's ID
    const newUser = await usersService.createUser(
      { username, password, role, name, phone },
      req.user.id
    );

    return res.status(201).json({
      status: 'success',
      message: 'تم إنشاء المستخدم بنجاح.',
      data: newUser
    });
  } catch (error) {
    return res.status(400).json({
      error: error.message,
      code: 'CREATE_USER_FAILED'
    });
  }
}

export async function updateUserController(req, res, next) {
  try {
    const { id } = req.params;
    const { role, name, phone } = req.body;

    const updatedUser = await usersService.updateUser(
      parseInt(id, 10),
      { role, name, phone },
      req.user.id
    );

    return res.status(200).json({
      status: 'success',
      message: 'تم تحديث بيانات المستخدم بنجاح.',
      data: updatedUser
    });
  } catch (error) {
    return res.status(400).json({
      error: error.message,
      code: 'UPDATE_USER_FAILED'
    });
  }
}

export async function updatePasswordController(req, res, next) {
  try {
    const { id } = req.params;
    const { password } = req.body;

    if (!password) {
      return res.status(400).json({
        error: 'كلمة المرور الجديدة مطلوبة.',
        code: 'VALIDATION_ERROR'
      });
    }

    await usersService.updateUserPassword(
      parseInt(id, 10),
      password,
      req.user.id
    );

    return res.status(200).json({
      status: 'success',
      message: 'تم تغيير كلمة المرور بنجاح.'
    });
  } catch (error) {
    return res.status(400).json({
      error: error.message,
      code: 'UPDATE_PASSWORD_FAILED'
    });
  }
}

export async function disableUserController(req, res, next) {
  try {
    const { id } = req.params;

    // Prevent Admin from disabling themselves
    if (parseInt(id, 10) === req.user.id) {
      return res.status(400).json({
        error: 'لا يمكنك تعطيل حسابك الشخصي.',
        code: 'SELF_DISABLE_BLOCKED'
      });
    }

    await usersService.setUserActiveStatus(
      parseInt(id, 10),
      false,
      req.user.id
    );

    return res.status(200).json({
      status: 'success',
      message: 'تم تعطيل الحساب بنجاح.'
    });
  } catch (error) {
    return res.status(400).json({
      error: error.message,
      code: 'DISABLE_USER_FAILED'
    });
  }
}

export async function enableUserController(req, res, next) {
  try {
    const { id } = req.params;

    await usersService.setUserActiveStatus(
      parseInt(id, 10),
      true,
      req.user.id
    );

    return res.status(200).json({
      status: 'success',
      message: 'تم تفعيل الحساب بنجاح.'
    });
  } catch (error) {
    return res.status(400).json({
      error: error.message,
      code: 'ENABLE_USER_FAILED'
    });
  }
}

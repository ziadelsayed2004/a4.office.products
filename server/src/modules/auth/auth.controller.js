import * as authService from './auth.service.js';
import { AppError } from '../../utils/errors.js';

export async function loginController(req, res, next) {
  try {
    const authData = await authService.login(req.body.username, req.body.password);
    return res.status(200).json({ message: 'Login successful.', data: authData });
  } catch (error) {
    return next(error);
  }
}

export async function refreshController(req, res, next) {
  try {
    const tokenData = await authService.refresh(req.body.refreshToken);
    return res.status(200).json({ message: 'Access token refreshed.', data: tokenData });
  } catch (error) {
    return next(error);
  }
}

export async function logoutController(req, res, next) {
  try {
    await authService.logout(req.body.refreshToken);
    return res.status(200).json({ message: 'Logout successful.' });
  } catch (error) {
    return next(error);
  }
}

export async function meController(req, res, next) {
  try {
    const user = await authService.getUserById(req.user.id);
    if (!user || user.is_active !== 1)
      throw new AppError('User is inactive.', 401, 'INACTIVE_USER');
    return res.status(200).json({
      data: {
        id: user.id,
        username: user.username,
        role: user.role,
        name: user.name,
        phone: user.phone,
      },
    });
  } catch (error) {
    return next(error);
  }
}

export async function heartbeatController(req, res, next) {
  try {
    const data = await authService.heartbeat(req.user.id, req.user.sessionId);
    return res.status(200).json({ status: 'success', data });
  } catch (error) {
    return next(error);
  }
}

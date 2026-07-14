import * as usersService from './users.service.js';
import { AppError } from '../../utils/errors.js';
import { publishLiveEvent } from '../liveAdmin/liveEvents.js';

export async function getUsersListController(req, res, next) {
  try {
    return res.status(200).json({ status: 'success', data: await usersService.getAllUsers() });
  } catch (error) {
    return next(error);
  }
}

export async function createUserController(req, res, next) {
  try {
    const user = await usersService.createUser(req.body, req.user.id);
    publishLiveEvent('user.created', { userId: user.id });
    return res
      .status(201)
      .json({ status: 'success', message: 'User created successfully.', data: user });
  } catch (error) {
    return next(error);
  }
}

export async function updateUserController(req, res, next) {
  try {
    const user = await usersService.updateUser(req.params.id, req.body, req.user.id);
    publishLiveEvent('user.updated', { userId: Number(req.params.id) });
    return res
      .status(200)
      .json({ status: 'success', message: 'User updated successfully.', data: user });
  } catch (error) {
    return next(error);
  }
}

export async function updatePasswordController(req, res, next) {
  try {
    await usersService.updateUserPassword(req.params.id, req.body.password, req.user.id);
    publishLiveEvent('user.password-changed', { userId: Number(req.params.id) });
    return res
      .status(200)
      .json({ status: 'success', message: 'Password changed and sessions revoked.' });
  } catch (error) {
    return next(error);
  }
}

export async function disableUserController(req, res, next) {
  try {
    if (req.params.id === req.user.id) {
      throw new AppError('You cannot disable your own account.', 409, 'SELF_DISABLE_BLOCKED');
    }
    await usersService.setUserActiveStatus(req.params.id, false, req.user.id);
    publishLiveEvent('user.disabled', { userId: Number(req.params.id) });
    return res.status(200).json({ status: 'success', message: 'User disabled successfully.' });
  } catch (error) {
    return next(error);
  }
}

export async function enableUserController(req, res, next) {
  try {
    await usersService.setUserActiveStatus(req.params.id, true, req.user.id);
    publishLiveEvent('user.enabled', { userId: Number(req.params.id) });
    return res.status(200).json({ status: 'success', message: 'User enabled successfully.' });
  } catch (error) {
    return next(error);
  }
}

export async function getUserSessionsController(req, res, next) {
  try {
    const data = await usersService.listUserSessions(req.params.id);
    return res.status(200).json({ status: 'success', data });
  } catch (error) {
    return next(error);
  }
}

export async function revokeUserSessionsController(req, res, next) {
  try {
    const data = await usersService.revokeUserSessions(
      req.params.id,
      req.user.id,
      req.params.sessionId ?? null
    );
    publishLiveEvent('user.sessions-revoked', {
      userId: Number(req.params.id),
      revokedCount: data.revokedCount,
    });
    return res.status(200).json({
      status: 'success',
      message: 'User sessions revoked successfully.',
      data,
    });
  } catch (error) {
    return next(error);
  }
}

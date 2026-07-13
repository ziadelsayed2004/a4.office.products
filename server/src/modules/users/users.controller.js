import * as usersService from './users.service.js';
import { AppError } from '../../utils/errors.js';

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
    return res.status(200).json({ status: 'success', message: 'User disabled successfully.' });
  } catch (error) {
    return next(error);
  }
}

export async function enableUserController(req, res, next) {
  try {
    await usersService.setUserActiveStatus(req.params.id, true, req.user.id);
    return res.status(200).json({ status: 'success', message: 'User enabled successfully.' });
  } catch (error) {
    return next(error);
  }
}

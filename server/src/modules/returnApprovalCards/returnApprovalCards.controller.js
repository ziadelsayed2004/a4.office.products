import * as service from './returnApprovalCards.service.js';

export const list = async (req, res, next) => {
  try {
    res.json({ status: 'success', data: await service.listCards() });
  } catch (error) {
    next(error);
  }
};
export const detail = async (req, res, next) => {
  try {
    res.json({ status: 'success', data: await service.getCard(req.params.id) });
  } catch (error) {
    next(error);
  }
};
export const create = async (req, res, next) => {
  try {
    res.status(201).json({
      status: 'success',
      data: await service.createCard({ label: req.body.label, adminId: req.user.id }),
    });
  } catch (error) {
    next(error);
  }
};
export const rotate = async (req, res, next) => {
  try {
    res.json({ status: 'success', data: await service.rotateCard(req.params.id, req.user.id) });
  } catch (error) {
    next(error);
  }
};
export const enable = async (req, res, next) => {
  try {
    res.json({
      status: 'success',
      data: await service.setCardStatus(req.params.id, 'ACTIVE', { adminId: req.user.id }),
    });
  } catch (error) {
    next(error);
  }
};
export const disable = async (req, res, next) => {
  try {
    res.json({
      status: 'success',
      data: await service.setCardStatus(req.params.id, 'DISABLED', {
        adminId: req.user.id,
        reason: req.body.reason,
      }),
    });
  } catch (error) {
    next(error);
  }
};
export const print = async (req, res, next) => {
  try {
    const data = await service.requestPrint(req.params.id, req.body, req.user);
    res.setHeader('Idempotency-Replayed', String(data.replayed));
    res.json({ status: 'success', data });
  } catch (error) {
    next(error);
  }
};

import * as service from './cashierReturns.service.js';
export async function quote(req, res, next) {
  try {
    res.json({ status: 'success', data: await service.quoteReturn(req.body, req.user) });
  } catch (error) {
    next(error);
  }
}
export async function execute(req, res, next) {
  try {
    const result = await service.executeReturn({
      input: req.body,
      actor: req.user,
      idempotencyKey: req.get('Idempotency-Key'),
    });
    res.setHeader('Idempotency-Replayed', String(Boolean(result.replayed)));
    res.status(result.statusCode).json({ status: 'success', data: result.data });
  } catch (error) {
    next(error);
  }
}

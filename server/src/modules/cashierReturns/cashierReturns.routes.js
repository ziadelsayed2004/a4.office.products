import { Router } from 'express';
import { z } from 'zod';
import { authenticate, requireRole } from '../../middleware/auth.js';
import { isAdmin } from '../../middleware/rbac.js';
import { validate } from '../../middleware/validate.js';
import * as controller from './cashierReturns.controller.js';

const trimmed = (max) => z.string().trim().min(1).max(max);
const integer = (min = 1, max = Number.MAX_SAFE_INTEGER) =>
  z.coerce.number().int().min(min).max(max);
const optionalNullableText = (max) =>
  z
    .union([z.string().trim().max(max), z.null()])
    .optional()
    .transform((value) => value || null);

const returnItem = z
  .object({
    orderItemId: integer().optional(),
    order_item_id: integer().optional(),
    quantity: integer(),
    disposition: z.enum(['RESTOCK', 'NO_RESTOCK']),
    noRestockReason: optionalNullableText(500),
    no_restock_reason: optionalNullableText(500),
  })
  .superRefine((value, context) => {
    if (!value.orderItemId && !value.order_item_id) {
      context.addIssue({
        code: 'custom',
        path: ['orderItemId'],
        message: 'Invoice line identifier is required.',
      });
    }
    if (
      value.disposition === 'NO_RESTOCK' &&
      !String(value.noRestockReason || value.no_restock_reason || '').trim()
    ) {
      context.addIssue({
        code: 'custom',
        path: ['noRestockReason'],
        message: 'A non-restock reason is required.',
      });
    }
  });

const refundReference = z
  .object({
    paymentMethodId: integer().optional(),
    payment_method_id: integer().optional(),
    allocationId: integer().optional(),
    allocation_id: integer().optional(),
    referenceNumber: optionalNullableText(200),
    reference_number: optionalNullableText(200),
  })
  .refine(
    (value) =>
      value.paymentMethodId || value.payment_method_id || value.allocationId || value.allocation_id,
    'A refund payment method identifier is required.'
  );

const prepareBody = z.object({ invoiceCode: trimmed(500) });
const resolveItemBody = z.object({ orderId: integer(), code: trimmed(500) });
const quoteBody = z.object({
  orderId: integer(),
  items: z.array(returnItem).min(1).max(500),
  reason: trimmed(1000).optional(),
});
const executeBody = quoteBody.extend({
  reason: trimmed(1000),
  approvalCardToken: trimmed(500),
  refundReferences: z.array(refundReference).max(100).default([]),
  cashierNote: optionalNullableText(1000),
});
const idParams = z.object({ id: integer() });
const date = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .optional();
const adminListQuery = z
  .object({
    returnNumber: trimmed(200).optional(),
    invoiceNumber: trimmed(200).optional(),
    q: trimmed(200).optional(),
    cashierId: integer().optional(),
    shiftId: integer().optional(),
    approvalCardId: integer().optional(),
    startDate: date,
    endDate: date,
    from: date,
    to: date,
    limit: integer(1, 100).default(50),
    offset: integer(0).optional(),
    page: integer(1).default(1),
  })
  .refine(
    (value) =>
      !(value.startDate || value.from) ||
      !(value.endDate || value.to) ||
      (value.startDate || value.from) <= (value.endDate || value.to),
    'startDate cannot be after endDate.'
  );

const cashierRouter = Router();
cashierRouter.use(authenticate, requireRole(['Cashier']));
cashierRouter.post('/prepare', validate({ body: prepareBody }), controller.prepare);
cashierRouter.post('/items/resolve', validate({ body: resolveItemBody }), controller.resolveItem);
cashierRouter.post('/quote', validate({ body: quoteBody }), controller.quote);
cashierRouter.post('/execute', validate({ body: executeBody }), controller.execute);

const adminRouter = Router();
adminRouter.use(authenticate, isAdmin);
adminRouter.get('/', validate({ query: adminListQuery }), controller.listAdmin);
adminRouter.get('/:id', validate({ params: idParams }), controller.detailAdmin);

export { adminRouter as adminReturnRoutes };
export default cashierRouter;

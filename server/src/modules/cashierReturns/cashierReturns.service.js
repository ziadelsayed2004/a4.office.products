import db, { withTransaction } from '../../db/index.js';
import { AppError } from '../../utils/financial.js';
import { writeAuditLog } from '../../utils/auditLogger.js';
import {
  quoteReturnAuthorization,
  createReturnAuthorization,
  executeReturnAuthorization,
} from '../returnAuthorizations/returnAuthorizations.service.js';
import { requireActiveCard } from '../returnApprovalCards/returnApprovalCards.service.js';

function requireCashier(actor) {
  if (actor?.role !== 'Cashier')
    throw new AppError('Cashier role required.', 403, 'CASHIER_REQUIRED');
}

export async function quoteReturn(input, actor) {
  requireCashier(actor);
  const shift = await db.get("SELECT id FROM shifts WHERE user_id=? AND status='OPEN';", [
    actor.id,
  ]);
  if (!shift) throw new AppError('An open cashier shift is required.', 409, 'OPEN_SHIFT_REQUIRED');
  return quoteReturnAuthorization({ orderId: input.orderId, items: input.items });
}

export async function executeReturn({ input, actor, idempotencyKey }) {
  requireCashier(actor);
  if (!idempotencyKey)
    throw new AppError('Idempotency-Key is required.', 400, 'IDEMPOTENCY_KEY_REQUIRED');
  const card = await requireActiveCard(input.approvalCardToken, db);
  const issued = await createReturnAuthorization({
    adminId: card.owner_admin_id,
    input: { orderId: input.orderId, items: input.items, reason: input.reason },
    idempotencyKey: `${idempotencyKey}:approval`,
  });
  const result = await executeReturnAuthorization({
    cashierId: actor.id,
    token: issued.data.qrToken,
    expectedOrderId: input.orderId,
    refundReferences: input.refundReferences.map((reference) => {
      const requestedMethod = Number(reference.allocationId ?? reference.allocation_id);
      const allocation = issued.data.allocations.find(
        (candidate) => Number(candidate.paymentMethodId) === requestedMethod
      );
      return {
        allocationId: allocation?.id || requestedMethod,
        referenceNumber: reference.referenceNumber ?? reference.reference_number,
      };
    }),
    cashierNote: input.cashierNote,
    idempotencyKey,
  });
  await withTransaction(async (connection) => {
    await connection.run(
      `UPDATE returns SET approval_card_id=?, approval_card_version=?, approval_snapshot_json=? WHERE id=?;`,
      [
        card.id,
        card.token_version,
        JSON.stringify({
          cardNumber: card.card_number,
          label: card.label,
          ownerAdminId: card.owner_admin_id,
          tokenVersion: card.token_version,
        }),
        result.data.returnId,
      ]
    );
    await connection.run(
      'UPDATE return_approval_cards SET last_used_at=CURRENT_TIMESTAMP, updated_at=CURRENT_TIMESTAMP WHERE id=?;',
      [card.id]
    );
    await writeAuditLog({
      userId: actor.id,
      shiftId: result.data.shiftId || null,
      actionType: 'RETURN_APPROVAL_CARD_USE',
      entityType: 'returns',
      entityId: result.data.returnId,
      afterValues: {
        approvalCardId: card.id,
        approvalCardVersion: card.token_version,
        ownerAdminId: card.owner_admin_id,
      },
      connection,
    });
  });
  return result;
}

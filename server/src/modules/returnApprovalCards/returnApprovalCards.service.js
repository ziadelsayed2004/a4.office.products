import crypto from 'node:crypto';
import db, { withTransaction } from '../../db/index.js';
import config from '../../config/index.js';
import { AppError, nextDocumentNumber } from '../../utils/financial.js';
import { writeAuditLog } from '../../utils/auditLogger.js';

const PREFIX = 'rac_';
const sign = (payload) =>
  crypto.createHmac('sha256', config.returns.qrSecret).update(payload).digest('base64url');
const tokenFor = (card) => {
  const payload = Buffer.from(
    JSON.stringify({ i: card.id, v: card.token_version, n: card.token_nonce })
  ).toString('base64url');
  return `${PREFIX}${payload}.${sign(payload)}`;
};

function parseToken(token) {
  const match = String(token || '')
    .trim()
    .match(/^rac_([A-Za-z0-9_-]+)\.([A-Za-z0-9_-]+)$/);
  if (!match) throw new AppError('Approval card is invalid.', 404, 'INVALID_APPROVAL_CARD');
  const expected = Buffer.from(sign(match[1]));
  const supplied = Buffer.from(match[2]);
  if (expected.length !== supplied.length || !crypto.timingSafeEqual(expected, supplied)) {
    throw new AppError('Approval card is invalid.', 404, 'INVALID_APPROVAL_CARD');
  }
  try {
    const value = JSON.parse(Buffer.from(match[1], 'base64url').toString('utf8'));
    if (
      !Number.isSafeInteger(value.i) ||
      !Number.isSafeInteger(value.v) ||
      String(value.n).length < 20
    )
      throw new Error();
    return value;
  } catch {
    throw new AppError('Approval card is invalid.', 404, 'INVALID_APPROVAL_CARD');
  }
}

const present = (row, includeToken = false) => ({
  id: row.id,
  cardNumber: row.card_number,
  label: row.label,
  status: row.status,
  ownerAdminId: row.owner_admin_id,
  ownerAdminName: row.owner_admin_name,
  tokenVersion: row.token_version,
  printCount: row.print_count,
  lastPrintedAt: row.last_printed_at,
  lastUsedAt: row.last_used_at,
  createdAt: row.created_at,
  ...(includeToken ? { qrToken: tokenFor(row) } : {}),
});

const select = `SELECT c.*, u.name AS owner_admin_name FROM return_approval_cards c JOIN users u ON u.id = c.owner_admin_id`;

export async function listCards(connection = db) {
  return (await connection.all(`${select} ORDER BY c.created_at DESC, c.id DESC;`)).map((row) =>
    present(row)
  );
}
export async function getCard(id, connection = db, includeToken = true) {
  const row = await connection.get(`${select} WHERE c.id = ?;`, [Number(id)]);
  if (!row) throw new AppError('Approval card not found.', 404, 'APPROVAL_CARD_NOT_FOUND');
  return present(row, includeToken && row.status === 'ACTIVE');
}
export async function createCard({ label, adminId }) {
  return withTransaction(async (connection) => {
    const owner = await connection.get(
      "SELECT id FROM users WHERE id = ? AND role = 'Admin' AND is_active = 1;",
      [adminId]
    );
    if (!owner) throw new AppError('Active Admin required.', 403, 'ADMIN_REQUIRED');
    const cardNumber = await nextDocumentNumber(connection, 'returnApprovalCard');
    const result = await connection.run(
      `INSERT INTO return_approval_cards (card_number,label,owner_admin_id,token_nonce) VALUES (?,?,?,?);`,
      [cardNumber, String(label).trim(), adminId, crypto.randomBytes(24).toString('base64url')]
    );
    await writeAuditLog({
      userId: adminId,
      actionType: 'RETURN_APPROVAL_CARD_CREATE',
      entityType: 'return_approval_cards',
      entityId: result.lastID,
      connection,
    });
    return getCard(result.lastID, connection);
  });
}
export async function setCardStatus(id, status, { adminId, reason = null }) {
  return withTransaction(async (connection) => {
    const card = await connection.get('SELECT * FROM return_approval_cards WHERE id = ?;', [
      Number(id),
    ]);
    if (!card) throw new AppError('Approval card not found.', 404, 'APPROVAL_CARD_NOT_FOUND');
    await connection.run(
      `UPDATE return_approval_cards SET status=?, disabled_at=${status === 'DISABLED' ? 'CURRENT_TIMESTAMP' : 'NULL'}, disabled_by=?, disabled_reason=?, updated_at=CURRENT_TIMESTAMP WHERE id=?;`,
      [
        status,
        status === 'DISABLED' ? adminId : null,
        status === 'DISABLED' ? String(reason || '').trim() : null,
        Number(id),
      ]
    );
    await writeAuditLog({
      userId: adminId,
      actionType: `RETURN_APPROVAL_CARD_${status === 'ACTIVE' ? 'ENABLE' : 'DISABLE'}`,
      entityType: 'return_approval_cards',
      entityId: Number(id),
      notes: reason,
      connection,
    });
    return getCard(id, connection);
  });
}
export async function rotateCard(id, adminId) {
  return withTransaction(async (connection) => {
    const result = await connection.run(
      `UPDATE return_approval_cards SET token_nonce=?, token_version=token_version+1, rotated_at=CURRENT_TIMESTAMP, rotated_by=?, updated_at=CURRENT_TIMESTAMP WHERE id=?;`,
      [crypto.randomBytes(24).toString('base64url'), adminId, Number(id)]
    );
    if (!result.changes)
      throw new AppError('Approval card not found.', 404, 'APPROVAL_CARD_NOT_FOUND');
    await writeAuditLog({
      userId: adminId,
      actionType: 'RETURN_APPROVAL_CARD_ROTATE',
      entityType: 'return_approval_cards',
      entityId: Number(id),
      connection,
    });
    return getCard(id, connection);
  });
}
export async function resolveCardToken(token, connection = db) {
  const parsed = parseToken(token);
  const row = await connection.get(`${select} WHERE c.id = ?;`, [parsed.i]);
  if (!row) throw new AppError('Approval card is invalid.', 404, 'INVALID_APPROVAL_CARD');
  if (row.token_version !== parsed.v || row.token_nonce !== parsed.n)
    throw new AppError('Approval card was rotated.', 409, 'APPROVAL_CARD_SUPERSEDED');
  if (row.status !== 'ACTIVE')
    return {
      type: 'return_approval_card',
      action: 'BLOCKED',
      data: present(row),
      message: 'Approval card is disabled.',
    };
  return { type: 'return_approval_card', action: 'VALID', data: present(row) };
}
export async function requireActiveCard(token, connection) {
  const resolved = await resolveCardToken(token, connection);
  if (resolved.action !== 'VALID')
    throw new AppError('Approval card is disabled.', 409, 'APPROVAL_CARD_DISABLED');
  return connection.get('SELECT * FROM return_approval_cards WHERE id = ?;', [resolved.data.id]);
}
export async function requestPrint(id, input, actor) {
  return withTransaction(async (connection) => {
    const existing = await connection.get(
      'SELECT * FROM return_approval_card_print_requests WHERE user_id=? AND request_key=?;',
      [actor.id, input.requestKey]
    );
    if (existing)
      return { replayed: true, card: await getCard(id, connection), copies: existing.copies };
    const card = await connection.get(
      "SELECT * FROM return_approval_cards WHERE id=? AND status='ACTIVE';",
      [Number(id)]
    );
    if (!card)
      throw new AppError('Active approval card not found.', 409, 'APPROVAL_CARD_NOT_ACTIVE');
    await connection.run(
      'INSERT INTO return_approval_card_print_requests (card_id,user_id,request_key,copies,reason) VALUES (?,?,?,?,?);',
      [Number(id), actor.id, input.requestKey, input.copies || 1, input.reason || null]
    );
    await connection.run(
      'UPDATE return_approval_cards SET print_count=print_count+?, last_printed_at=CURRENT_TIMESTAMP WHERE id=?;',
      [input.copies || 1, Number(id)]
    );
    await writeAuditLog({
      userId: actor.id,
      actionType: 'RETURN_APPROVAL_CARD_PRINT',
      entityType: 'return_approval_cards',
      entityId: Number(id),
      connection,
    });
    return { replayed: false, card: await getCard(id, connection), copies: input.copies || 1 };
  });
}

import crypto from 'crypto';
import { withTransaction } from '../db/index.js';

export class AppError extends Error {
  constructor(message, status = 400, code = 'VALIDATION_ERROR') {
    super(message);
    this.name = 'AppError';
    this.status = status;
    this.code = code;
  }
}

export function requireInteger(value, field, { min = Number.MIN_SAFE_INTEGER, max = Number.MAX_SAFE_INTEGER } = {}) {
  if (!Number.isSafeInteger(value) || value < min || value > max) {
    throw new AppError(`${field} must be a safe integer between ${min} and ${max}.`, 400, 'INVALID_INTEGER_PIASTERS');
  }
  return value;
}

export function requirePiasters(value, field, { allowZero = true } = {}) {
  return requireInteger(value, field, { min: allowZero ? 0 : 1 });
}

export function aggregateItems(items) {
  if (!Array.isArray(items) || items.length === 0) {
    throw new AppError('At least one item is required.', 400, 'ITEMS_REQUIRED');
  }

  const aggregated = new Map();
  for (const raw of items) {
    const productId = requireInteger(Number(raw?.product_id), 'product_id', { min: 1 });
    const quantity = requireInteger(Number(raw?.quantity), 'quantity', { min: 1 });
    const priceTierId = requireInteger(Number(raw?.price_tier_id), 'price_tier_id', { min: 1 });
    const existing = aggregated.get(productId);
    if (existing && existing.price_tier_id !== priceTierId) {
      throw new AppError('Duplicate product lines must use the same price tier.', 400, 'AMBIGUOUS_DUPLICATE_ITEM');
    }
    if (existing) existing.quantity += quantity;
    else aggregated.set(productId, { product_id: productId, quantity, price_tier_id: priceTierId });
  }
  return [...aggregated.values()];
}

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === 'object') {
    return Object.keys(value).sort().reduce((result, key) => {
      result[key] = stableValue(value[key]);
      return result;
    }, {});
  }
  return value;
}

export function requestHash(payload) {
  return crypto.createHash('sha256').update(JSON.stringify(stableValue(payload))).digest('hex');
}

export function cairoDateKey(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Cairo', year: 'numeric', month: '2-digit', day: '2-digit'
  }).formatToParts(date);
  const byType = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${byType.year}${byType.month}${byType.day}`;
}

export async function nextDocumentNumber(connection, kind) {
  const definitions = {
    invoice: { prefix: 'INV', width: 4 },
    receipt: { prefix: 'REC', width: 4 },
    preorder: { prefix: 'PR', width: 4 }
  };
  const definition = definitions[kind];
  if (!definition) throw new AppError(`Unknown document sequence: ${kind}`, 500, 'UNKNOWN_DOCUMENT_SEQUENCE');
  const dateKey = cairoDateKey();
  await connection.run(
    `INSERT INTO document_sequences (document_type, cairo_date, last_value)
     VALUES (?, ?, 1)
     ON CONFLICT(document_type, cairo_date)
     DO UPDATE SET last_value = last_value + 1;`,
    [kind, dateKey]
  );
  const row = await connection.get(
    'SELECT last_value FROM document_sequences WHERE document_type = ? AND cairo_date = ?;',
    [kind, dateKey]
  );
  return `${definition.prefix}-${dateKey}-${String(row.last_value).padStart(definition.width, '0')}`;
}

export function generateSecureToken(type) {
  const prefixes = { product: 'prod_', preorder: 'pre_', invoice: 'inv_' };
  if (!prefixes[type]) throw new AppError('Unsupported secure token type.', 500, 'UNKNOWN_TOKEN_TYPE');
  return `${prefixes[type]}${crypto.randomBytes(24).toString('base64url')}`;
}

export async function saveSecureToken(connection, type, referenceId, existingToken = null) {
  const current = await connection.get(
    'SELECT token FROM secure_tokens WHERE token_type = ? AND reference_id = ?;',
    [type, referenceId]
  );
  if (current) return current.token;
  const token = existingToken || generateSecureToken(type);
  await connection.run(
    'INSERT INTO secure_tokens (token, token_type, reference_id) VALUES (?, ?, ?);',
    [token, type, referenceId]
  );
  return token;
}

/**
 * Requires and persists idempotency inside the same transaction as the result.
 * A retry cannot observe a committed business mutation without its response.
 */
export async function withIdempotency({ key, userId, operation, payload }, work) {
  if (typeof key !== 'string' || key.trim().length < 8 || key.length > 200) {
    throw new AppError('Idempotency-Key header is required (8-200 characters).', 400, 'IDEMPOTENCY_KEY_REQUIRED');
  }
  const normalizedKey = key.trim();
  const hash = requestHash(payload);

  return withTransaction(async (connection) => {
    const existing = await connection.get(
      'SELECT * FROM idempotency_records WHERE idempotency_key = ?;',
      [normalizedKey]
    );
    if (existing) {
      if (existing.user_id !== userId || existing.operation !== operation || existing.request_hash !== hash) {
        throw new AppError('Idempotency key was already used with different input.', 409, 'IDEMPOTENCY_KEY_CONFLICT');
      }
      if (existing.status === 'COMMITTED') {
        return {
          data: JSON.parse(existing.response_json),
          statusCode: existing.status_code,
          replayed: true
        };
      }
      throw new AppError('A request with this idempotency key is already in progress.', 409, 'IDEMPOTENCY_IN_PROGRESS');
    }

    await connection.run(
      `INSERT INTO idempotency_records
       (idempotency_key, user_id, operation, request_hash, status)
       VALUES (?, ?, ?, ?, 'PROCESSING');`,
      [normalizedKey, userId, operation, hash]
    );

    const result = await work(connection);
    const statusCode = result?.statusCode || 200;
    const data = result?.data ?? result;
    await connection.run(
      `UPDATE idempotency_records
       SET status = 'COMMITTED', status_code = ?, response_json = ?, committed_at = CURRENT_TIMESTAMP
       WHERE idempotency_key = ?;`,
      [statusCode, JSON.stringify(data), normalizedKey]
    );
    return { data, statusCode, replayed: false };
  });
}

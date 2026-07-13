import assert from 'node:assert/strict';
import http from 'node:http';
import {
  closeTestServer,
  createTestEnvironment,
  disposeTestEnvironment,
  seedCatalogFixture,
} from './test-environment.js';

const testEnvironment = createTestEnvironment('api-contracts');
process.env.RATE_LIMIT_MAX = '5000';
process.env.LOGIN_RATE_LIMIT_MAX = '100';

let server;
let db;

const longQuery = encodeURIComponent('x'.repeat(201));
const reversedDates = 'startDate=2026-07-13&endDate=2026-07-12';

const OPERATIONS = [
  {
    name: 'auth login',
    method: 'POST',
    path: '/api/auth/login',
    access: 'public',
    invalid: { body: {} },
  },
  {
    name: 'auth refresh',
    method: 'POST',
    path: '/api/auth/refresh',
    access: 'public',
    invalid: { body: { refreshToken: 1 } },
  },
  {
    name: 'auth logout',
    method: 'POST',
    path: '/api/auth/logout',
    access: 'public',
    invalid: { body: { refreshToken: 1 } },
  },
  { name: 'auth me', method: 'GET', path: '/api/auth/me', access: 'protected' },

  {
    name: 'audit list',
    method: 'GET',
    path: '/api/admin/audit-logs',
    access: 'admin',
    invalid: { path: '/api/admin/audit-logs?limit=101' },
  },

  { name: 'users list', method: 'GET', path: '/api/admin/users', access: 'admin' },
  {
    name: 'users create',
    method: 'POST',
    path: '/api/admin/users',
    access: 'admin',
    invalid: { body: {} },
  },
  {
    name: 'users update',
    method: 'PATCH',
    path: '/api/admin/users/1',
    access: 'admin',
    invalid: { path: '/api/admin/users/0', body: { name: 'x' } },
  },
  {
    name: 'users password',
    method: 'PATCH',
    path: '/api/admin/users/1/password',
    access: 'admin',
    invalid: { body: { password: 'short' } },
  },
  {
    name: 'users disable',
    method: 'PATCH',
    path: '/api/admin/users/1/disable',
    access: 'admin',
    invalid: { path: '/api/admin/users/0/disable' },
  },
  {
    name: 'users enable',
    method: 'PATCH',
    path: '/api/admin/users/1/enable',
    access: 'admin',
    invalid: { path: '/api/admin/users/0/enable' },
  },

  {
    name: 'categories list',
    method: 'GET',
    path: '/api/categories',
    access: 'protected',
    invalid: { path: '/api/categories?activeOnly=yes' },
  },
  {
    name: 'categories create',
    method: 'POST',
    path: '/api/admin/categories',
    access: 'admin',
    invalid: { body: {} },
  },
  {
    name: 'categories update',
    method: 'PATCH',
    path: '/api/admin/categories/1',
    access: 'admin',
    invalid: { path: '/api/admin/categories/0', body: { name: 'x' } },
  },
  {
    name: 'categories delete',
    method: 'DELETE',
    path: '/api/admin/categories/1',
    access: 'admin',
    invalid: { path: '/api/admin/categories/0' },
  },

  {
    name: 'price tiers list',
    method: 'GET',
    path: '/api/admin/price-tiers',
    access: 'protected',
    invalid: { path: '/api/admin/price-tiers?activeOnly=yes' },
  },
  {
    name: 'price tiers create',
    method: 'POST',
    path: '/api/admin/price-tiers',
    access: 'admin',
    invalid: { body: {} },
  },
  {
    name: 'price tiers update',
    method: 'PATCH',
    path: '/api/admin/price-tiers/1',
    access: 'admin',
    invalid: { path: '/api/admin/price-tiers/0', body: { name: 'x' } },
  },
  {
    name: 'price tiers delete',
    method: 'DELETE',
    path: '/api/admin/price-tiers/1',
    access: 'admin',
    invalid: { path: '/api/admin/price-tiers/0' },
  },

  {
    name: 'products list',
    method: 'GET',
    path: '/api/products',
    access: 'protected',
    invalid: { path: '/api/products?categoryId=0' },
  },
  {
    name: 'products detail',
    method: 'GET',
    path: '/api/products/1',
    access: 'protected',
    invalid: { path: '/api/products/0' },
  },
  {
    name: 'products create',
    method: 'POST',
    path: '/api/admin/products',
    access: 'admin',
    invalid: { body: {} },
  },
  {
    name: 'products update',
    method: 'PATCH',
    path: '/api/admin/products/1',
    access: 'admin',
    invalid: { path: '/api/admin/products/0', body: { name: 'x' } },
  },
  {
    name: 'products delete',
    method: 'DELETE',
    path: '/api/admin/products/1',
    access: 'admin',
    invalid: { path: '/api/admin/products/0' },
  },
  {
    name: 'product labels',
    method: 'POST',
    path: '/api/admin/products/1/qr-labels',
    access: 'admin',
    invalid: { path: '/api/admin/products/0/qr-labels', body: { quantity: 1 } },
  },

  {
    name: 'inventory ledger',
    method: 'GET',
    path: '/api/admin/inventory',
    access: 'admin',
    invalid: { path: `/api/admin/inventory?${reversedDates}` },
  },
  {
    name: 'inventory adjustment',
    method: 'POST',
    path: '/api/admin/inventory/adjust',
    access: 'admin',
    invalid: { body: {} },
  },

  {
    name: 'payment methods list',
    method: 'GET',
    path: '/api/payment-methods',
    access: 'protected',
  },
  {
    name: 'payment methods active update',
    method: 'POST',
    path: '/api/payment-methods/admin',
    access: 'admin',
    invalid: { body: {} },
  },
  {
    name: 'payment method create',
    method: 'POST',
    path: '/api/payment-methods/admin/methods',
    access: 'admin',
    invalid: { body: {} },
  },
  {
    name: 'payment method update',
    method: 'PATCH',
    path: '/api/payment-methods/admin/methods/1',
    access: 'admin',
    invalid: { path: '/api/payment-methods/admin/methods/0', body: { name_ar: 'x' } },
  },
  {
    name: 'payment method delete',
    method: 'DELETE',
    path: '/api/payment-methods/admin/methods/1',
    access: 'admin',
    invalid: { path: '/api/payment-methods/admin/methods/0' },
  },

  {
    name: 'customers search',
    method: 'GET',
    path: '/api/customers',
    access: 'protected',
    invalid: { path: `/api/customers?q=${longQuery}` },
  },
  {
    name: 'customers create',
    method: 'POST',
    path: '/api/customers',
    access: 'protected',
    invalid: { body: {} },
  },
  {
    name: 'admin customers update',
    method: 'PATCH',
    path: '/api/admin/customers/1',
    access: 'admin',
    invalid: { path: '/api/admin/customers/0', body: { name: 'x', phone: '01000000000' } },
  },
  {
    name: 'admin customers delete',
    method: 'DELETE',
    path: '/api/admin/customers/1',
    access: 'admin',
    invalid: { path: '/api/admin/customers/0' },
  },

  {
    name: 'pos resolve scan',
    method: 'POST',
    path: '/api/pos/scan/resolve',
    access: 'protected',
    invalid: { body: {} },
  },
  {
    name: 'pos scan product',
    method: 'POST',
    path: '/api/pos/scan-product',
    access: 'protected',
    invalid: { body: {} },
  },
  {
    name: 'pos product search',
    method: 'GET',
    path: '/api/pos/products/search',
    access: 'protected',
    invalid: { path: `/api/pos/products/search?q=${longQuery}` },
  },
  {
    name: 'pos checkout',
    method: 'POST',
    path: '/api/pos/orders/checkout',
    access: 'protected',
    invalid: { body: {} },
  },
  {
    name: 'pos return',
    method: 'POST',
    path: '/api/pos/orders/1/return',
    access: 'protected',
    invalid: { path: '/api/pos/orders/0/return', body: {} },
  },
  {
    name: 'return authorization quote',
    method: 'POST',
    path: '/api/admin/return-authorizations/quote',
    access: 'admin',
    invalid: { body: {} },
  },
  {
    name: 'return authorization create',
    method: 'POST',
    path: '/api/admin/return-authorizations',
    access: 'admin',
    invalid: { body: {} },
  },
  {
    name: 'return authorization list',
    method: 'GET',
    path: '/api/admin/return-authorizations',
    access: 'admin',
    invalid: { path: '/api/admin/return-authorizations?limit=101' },
  },
  {
    name: 'return authorization detail',
    method: 'GET',
    path: '/api/admin/return-authorizations/1',
    access: 'admin',
    invalid: { path: '/api/admin/return-authorizations/0' },
  },
  {
    name: 'return authorization revoke',
    method: 'POST',
    path: '/api/admin/return-authorizations/1/revoke',
    access: 'admin',
    invalid: { body: {} },
  },
  {
    name: 'return authorization reissue',
    method: 'POST',
    path: '/api/admin/return-authorizations/1/reissue',
    access: 'admin',
    invalid: { path: '/api/admin/return-authorizations/0/reissue', body: {} },
  },
  {
    name: 'return authorization print request',
    method: 'POST',
    path: '/api/admin/return-authorizations/1/print-request',
    access: 'admin',
    invalid: { body: { copies: 0 } },
  },
  {
    name: 'return authorization execute',
    method: 'POST',
    path: '/api/pos/return-authorizations/execute',
    access: 'protected',
    invalid: { body: {} },
  },

  {
    name: 'receipt detail',
    method: 'GET',
    path: '/api/pos/receipts/1',
    access: 'protected',
    invalid: { path: '/api/pos/receipts/%20' },
  },
  {
    name: 'receipt print request',
    method: 'POST',
    path: '/api/pos/receipts/1/print-request',
    access: 'protected',
    invalid: { body: { copies: 0 } },
  },
  {
    name: 'receipt reprint',
    method: 'POST',
    path: '/api/pos/receipts/1/reprint',
    access: 'protected',
    invalid: { body: { copies: 0 } },
  },

  {
    name: 'admin invoices list',
    method: 'GET',
    path: '/api/admin/invoices',
    access: 'admin',
    invalid: { path: `/api/admin/invoices?${reversedDates}` },
  },
  {
    name: 'admin invoice detail',
    method: 'GET',
    path: '/api/admin/invoices/1',
    access: 'admin',
    invalid: { path: '/api/admin/invoices/0' },
  },
  {
    name: 'cashier invoice lookup',
    method: 'GET',
    path: '/api/pos/invoices/lookup',
    access: 'protected',
    invalid: { path: '/api/pos/invoices/lookup?limit=0' },
  },
  {
    name: 'cashier invoice detail',
    method: 'GET',
    path: '/api/pos/invoices/1',
    access: 'protected',
    invalid: { path: '/api/pos/invoices/0' },
  },

  {
    name: 'preorders create',
    method: 'POST',
    path: '/api/pos/preorders',
    access: 'protected',
    invalid: { body: {} },
  },
  {
    name: 'preorders scan',
    method: 'POST',
    path: '/api/pos/preorders/scan',
    access: 'protected',
    invalid: { body: {} },
  },
  {
    name: 'preorders search',
    method: 'GET',
    path: '/api/pos/preorders/search',
    access: 'protected',
    invalid: { path: `/api/pos/preorders/search?q=${longQuery}` },
  },
  {
    name: 'preorders pickup',
    method: 'POST',
    path: '/api/pos/preorders/1/pickup',
    access: 'protected',
    invalid: { path: '/api/pos/preorders/0/pickup', body: {} },
  },
  {
    name: 'admin preorders list',
    method: 'GET',
    path: '/api/admin/preorders',
    access: 'admin',
    invalid: { path: '/api/admin/preorders?status=UNKNOWN' },
  },
  {
    name: 'admin preorder status',
    method: 'PATCH',
    path: '/api/admin/preorders/1/status',
    access: 'admin',
    invalid: { path: '/api/admin/preorders/0/status', body: { status: 'DRAFT' } },
  },

  {
    name: 'shifts open',
    method: 'POST',
    path: '/api/shifts/open',
    access: 'protected',
    invalid: { body: {} },
  },
  { name: 'shifts current', method: 'GET', path: '/api/shifts/current', access: 'protected' },
  {
    name: 'shifts current summary',
    method: 'GET',
    path: '/api/shifts/current/summary',
    access: 'protected',
  },
  {
    name: 'shifts close request',
    method: 'POST',
    path: '/api/shifts/current/close-request',
    access: 'protected',
    invalid: { body: {} },
  },
  {
    name: 'shifts cash movement',
    method: 'POST',
    path: '/api/shifts/current/cash-movement',
    access: 'protected',
    invalid: { body: {} },
  },
  {
    name: 'shifts pending review',
    method: 'GET',
    path: '/api/shifts/pending-review',
    access: 'admin',
  },
  {
    name: 'shifts all',
    method: 'GET',
    path: '/api/shifts/all',
    access: 'admin',
    invalid: { path: `/api/shifts/all?${reversedDates}` },
  },
  {
    name: 'shift detail',
    method: 'GET',
    path: '/api/shifts/1',
    access: 'admin',
    invalid: { path: '/api/shifts/0' },
  },
  {
    name: 'shift approve',
    method: 'POST',
    path: '/api/shifts/1/approve',
    access: 'admin',
    invalid: { body: { adminNotes: 1 } },
  },
  {
    name: 'shift reject',
    method: 'POST',
    path: '/api/shifts/1/reject',
    access: 'admin',
    invalid: { body: {} },
  },

  { name: 'admin kpis', method: 'GET', path: '/api/admin/kpis', access: 'admin' },
  {
    name: 'sales report',
    method: 'GET',
    path: '/api/admin/reports/sales',
    access: 'admin',
    invalid: { path: `/api/admin/reports/sales?${reversedDates}` },
  },
  {
    name: 'preorders report',
    method: 'GET',
    path: '/api/admin/reports/preorders',
    access: 'admin',
    invalid: { path: '/api/admin/reports/preorders?startDate=2026-02-30' },
  },
  {
    name: 'inventory report',
    method: 'GET',
    path: '/api/admin/reports/inventory',
    access: 'admin',
    invalid: { path: '/api/admin/reports/inventory?categoryId=0' },
  },
  {
    name: 'shifts report',
    method: 'GET',
    path: '/api/admin/reports/shifts',
    access: 'admin',
    invalid: { path: '/api/admin/reports/shifts?limit=101' },
  },
  {
    name: 'invoices report',
    method: 'GET',
    path: '/api/admin/reports/invoices',
    access: 'admin',
    invalid: { path: '/api/admin/reports/invoices?offset=-1' },
  },
  {
    name: 'payments report',
    method: 'GET',
    path: '/api/admin/reports/payments',
    access: 'admin',
    invalid: { path: '/api/admin/reports/payments?direction=SIDEWAYS' },
  },
  {
    name: 'cashiers report',
    method: 'GET',
    path: '/api/admin/reports/cashiers',
    access: 'admin',
    invalid: { path: '/api/admin/reports/cashiers?endDate=bad-date' },
  },
  {
    name: 'reports export',
    method: 'GET',
    path: '/api/admin/reports/export?type=inventory&format=csv',
    access: 'admin',
    invalid: { path: '/api/admin/reports/export?type=unknown' },
  },

  {
    name: 'safe printer settings',
    method: 'GET',
    path: '/api/printer-settings',
    access: 'protected',
  },
  {
    name: 'admin printer settings',
    method: 'GET',
    path: '/api/admin/printer-settings',
    access: 'admin',
  },
  {
    name: 'admin printer settings update',
    method: 'POST',
    path: '/api/admin/printer-settings',
    access: 'admin',
    invalid: { body: { print_mode: 'direct' } },
  },

  { name: 'health', method: 'GET', path: '/api/health', access: 'public' },
  {
    name: 'legacy print tombstone',
    method: 'GET',
    path: '/api/admin/print-job/token',
    access: 'admin',
  },
];

function authorization(token) {
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function send(baseUrl, operation, { token, invalid = false } = {}) {
  const input = invalid ? operation.invalid : undefined;
  const body = input?.body;
  const headers = { ...authorization(token) };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  return fetch(`${baseUrl}${input?.path || operation.path}`, {
    method: operation.method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

async function json(response) {
  assert.match(response.headers.get('content-type') || '', /application\/json/i);
  return response.json();
}

function assertErrorEnvelope(payload, expectedCode) {
  assert.equal(typeof payload.error, 'string');
  assert.ok(payload.error.length > 0);
  assert.equal(payload.code, expectedCode);
  const serialized = JSON.stringify(payload);
  assert.doesNotMatch(serialized, /node_modules|SQLITE_(?:ERROR|MISUSE|CONSTRAINT)|"stack"/i);
}

async function login(baseUrl, username, password) {
  const response = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  assert.equal(response.status, 200);
  const payload = await json(response);
  assert.ok(payload.data.accessToken);
  assert.ok(payload.data.refreshToken);
  return payload.data;
}

async function run() {
  const [{ default: app }, dbModule, migrationModule, errorsModule] = await Promise.all([
    import('../app.js'),
    import('../db/index.js'),
    import('../db/migrate.js'),
    import('../utils/errors.js'),
  ]);
  db = dbModule.default;
  assert.equal(dbModule.dbPath, testEnvironment.databasePath);
  await migrationModule.runMigrations();
  const productId = await seedCatalogFixture(db);

  server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  const admin = await login(baseUrl, 'admin', 'admin123');
  const cashier = await login(baseUrl, 'cashier', 'cashier123');

  const internalSecret = 'SECRET_SQL: SELECT password_hash FROM users; STACK_PRIVATE_PATH';
  const captured = { status: undefined, payload: undefined, nextCalled: false };
  const harnessResponse = {
    headersSent: false,
    status(status) {
      captured.status = status;
      return this;
    },
    json(payload) {
      captured.payload = payload;
      return this;
    },
  };
  const originalHarnessConsoleError = console.error;
  console.error = () => {};
  try {
    errorsModule.errorHandler(new Error(internalSecret), {}, harnessResponse, () => {
      captured.nextCalled = true;
    });
  } finally {
    console.error = originalHarnessConsoleError;
  }
  assert.equal(captured.status, 500);
  assert.deepEqual(captured.payload, {
    error: 'Internal Server Error',
    code: 'INTERNAL_SERVER_ERROR',
  });
  assert.equal(captured.nextCalled, false);
  assert.doesNotMatch(
    JSON.stringify(captured.payload),
    /SECRET_SQL|password_hash|STACK_PRIVATE_PATH/
  );

  assert.equal(OPERATIONS.length, 86, 'the canonical API inventory must contain 86 operations');
  const protectedOperations = OPERATIONS.filter((operation) => operation.access !== 'public');
  const adminOperations = OPERATIONS.filter((operation) => operation.access === 'admin');
  const validatedOperations = OPERATIONS.filter((operation) => operation.invalid);
  assert.equal(protectedOperations.length, 82, '82 operations must require authentication');
  assert.equal(adminOperations.length, 53, '53 operations must require Admin role');
  assert.equal(validatedOperations.length, 75, '75 operations must be Zod-validated');

  for (const operation of protectedOperations) {
    const response = await send(baseUrl, operation);
    assert.equal(response.status, 401, `${operation.name} must reject a missing token`);
    assertErrorEnvelope(await json(response), 'UNAUTHORIZED');
  }

  for (const operation of adminOperations) {
    const response = await send(baseUrl, operation, { token: cashier.accessToken });
    assert.equal(response.status, 403, `${operation.name} must reject the Cashier role`);
    assertErrorEnvelope(await json(response), 'FORBIDDEN');
  }

  for (const operation of validatedOperations) {
    const token = operation.access === 'admin' ? admin.accessToken : cashier.accessToken;
    const response = await send(baseUrl, operation, { token, invalid: true });
    assert.equal(response.status, 400, `${operation.name} must reject its invalid request`);
    const payload = await json(response);
    assertErrorEnvelope(payload, 'VALIDATION_ERROR');
    assert.ok(
      Array.isArray(payload.details) && payload.details.length > 0,
      `${operation.name} must return validation details`
    );
  }

  const malformedResponse = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{"username":',
  });
  assert.equal(malformedResponse.status, 400);
  assertErrorEnvelope(await json(malformedResponse), 'INVALID_JSON');

  const missingResponse = await fetch(`${baseUrl}/api/products/999999`, {
    headers: authorization(cashier.accessToken),
  });
  assert.equal(missingResponse.status, 404);
  assertErrorEnvelope(await json(missingResponse), 'PRODUCT_NOT_FOUND');

  const existingCategory = await db.get('SELECT name FROM categories ORDER BY id LIMIT 1;');
  const duplicateCategoryResponse = await fetch(`${baseUrl}/api/admin/categories`, {
    method: 'POST',
    headers: { ...authorization(admin.accessToken), 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: existingCategory.name }),
  });
  assert.equal(duplicateCategoryResponse.status, 409);
  assertErrorEnvelope(await json(duplicateCategoryResponse), 'CATEGORY_CONFLICT');

  const validAdjustment = {
    product_id: productId,
    adjustment_type: 'ADD',
    quantity: 1,
    notes: 'Contract test must require an idempotency key.',
  };
  const ledgerBefore = await db.get('SELECT COUNT(*) AS count FROM inventory_ledger;');
  const missingInventoryKeyResponse = await fetch(`${baseUrl}/api/admin/inventory/adjust`, {
    method: 'POST',
    headers: { ...authorization(admin.accessToken), 'Content-Type': 'application/json' },
    body: JSON.stringify(validAdjustment),
  });
  assert.equal(missingInventoryKeyResponse.status, 400);
  assertErrorEnvelope(await json(missingInventoryKeyResponse), 'IDEMPOTENCY_KEY_REQUIRED');
  const ledgerAfter = await db.get('SELECT COUNT(*) AS count FROM inventory_ledger;');
  assert.equal(ledgerAfter.count, ledgerBefore.count);

  const validCashMovement = { type: 'PAY_IN', amount: 100, notes: 'Contract test cash movement.' };
  const missingCashKeyResponse = await fetch(`${baseUrl}/api/shifts/current/cash-movement`, {
    method: 'POST',
    headers: { ...authorization(cashier.accessToken), 'Content-Type': 'application/json' },
    body: JSON.stringify(validCashMovement),
  });
  assert.equal(missingCashKeyResponse.status, 400);
  assertErrorEnvelope(await json(missingCashKeyResponse), 'IDEMPOTENCY_KEY_REQUIRED');

  const noShiftResponse = await fetch(`${baseUrl}/api/shifts/current/cash-movement`, {
    method: 'POST',
    headers: {
      ...authorization(cashier.accessToken),
      'Content-Type': 'application/json',
      'Idempotency-Key': 'api-contracts-no-open-shift',
    },
    body: JSON.stringify(validCashMovement),
  });
  assert.equal(noShiftResponse.status, 409);
  assertErrorEnvelope(await json(noShiftResponse), 'OPEN_SHIFT_REQUIRED');

  const lastAdminResponse = await fetch(`${baseUrl}/api/admin/users/${admin.user.id}`, {
    method: 'PATCH',
    headers: { ...authorization(admin.accessToken), 'Content-Type': 'application/json' },
    body: JSON.stringify({ role: 'Cashier' }),
  });
  assert.equal(lastAdminResponse.status, 409);
  assertErrorEnvelope(await json(lastAdminResponse), 'LAST_ACTIVE_ADMIN');

  const legacySettings = {
    receipt_printer_type: 'legacy-usb',
    receipt_printer_address: 'legacy-receipt-address',
    qr_printer_type: 'legacy-network',
    qr_printer_address: 'legacy-label-address',
  };
  for (const [key, value] of Object.entries(legacySettings)) {
    await db.run(
      `INSERT INTO printer_settings (key, value) VALUES (?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value;`,
      [key, value]
    );
  }
  const legacyBefore = await db.all(
    `SELECT key, value FROM printer_settings
      WHERE key IN ('receipt_printer_type', 'receipt_printer_address', 'qr_printer_type', 'qr_printer_address')
      ORDER BY key;`
  );
  const printerUpdateResponse = await fetch(`${baseUrl}/api/admin/printer-settings`, {
    method: 'POST',
    headers: { ...authorization(admin.accessToken), 'Content-Type': 'application/json' },
    body: JSON.stringify({
      print_mode: 'browser',
      receipt_printer_width: '58mm',
      qr_printer_width: '38',
      qr_printer_height: '25',
      receipt_printer_type: 'attempted-overwrite',
      receipt_printer_address: 'attempted-overwrite',
      qr_printer_type: 'attempted-overwrite',
      qr_printer_address: 'attempted-overwrite',
    }),
  });
  assert.equal(printerUpdateResponse.status, 200);
  const printerUpdatePayload = await json(printerUpdateResponse);
  for (const key of Object.keys(legacySettings)) assert.ok(!(key in printerUpdatePayload.data));
  const legacyAfter = await db.all(
    `SELECT key, value FROM printer_settings
      WHERE key IN ('receipt_printer_type', 'receipt_printer_address', 'qr_printer_type', 'qr_printer_address')
      ORDER BY key;`
  );
  assert.deepEqual(legacyAfter, legacyBefore);

  const safePrinterResponse = await fetch(`${baseUrl}/api/printer-settings`, {
    headers: authorization(cashier.accessToken),
  });
  assert.equal(safePrinterResponse.status, 200);
  const safePrinterPayload = await json(safePrinterResponse);
  for (const key of Object.keys(legacySettings)) assert.ok(!(key in safePrinterPayload.data));

  const inventoryResponse = await fetch(`${baseUrl}/api/admin/inventory?limit=1&offset=0`, {
    headers: authorization(admin.accessToken),
  });
  assert.equal(inventoryResponse.status, 200);
  const inventoryPayload = await json(inventoryResponse);
  assert.equal(inventoryPayload.status, 'success');
  assert.ok(Array.isArray(inventoryPayload.data.ledger));
  assert.equal(typeof inventoryPayload.data.total, 'number');
  assert.deepEqual(inventoryPayload.data.pagination, { limit: 1, offset: 0 });

  const csvResponse = await fetch(`${baseUrl}/api/admin/reports/export?type=inventory&format=csv`, {
    headers: authorization(admin.accessToken),
  });
  assert.equal(csvResponse.status, 200);
  assert.match(csvResponse.headers.get('content-type') || '', /^text\/csv/i);
  assert.match(
    csvResponse.headers.get('content-disposition') || '',
    /^attachment; filename=report_inventory_/
  );
  const csvBytes = new Uint8Array(await csvResponse.arrayBuffer());
  assert.deepEqual(csvBytes.slice(0, 3), new Uint8Array([0xef, 0xbb, 0xbf]));
  const csv = new TextDecoder().decode(csvBytes);
  assert.ok(csv.split('\r\n')[0].includes(','));

  const healthyResponse = await fetch(`${baseUrl}/api/health`);
  assert.equal(healthyResponse.status, 200);
  const healthyPayload = await json(healthyResponse);
  assert.equal(healthyPayload.status, 'ok');
  assert.equal(healthyPayload.database.engine, 'SQLite');

  const notFoundResponse = await fetch(`${baseUrl}/api/not-a-real-route`);
  assert.equal(notFoundResponse.status, 404);
  assertErrorEnvelope(await json(notFoundResponse), 'ROUTE_NOT_FOUND');

  await db.close();
  const originalConsoleError = console.error;
  console.error = () => {};
  let unavailableResponse;
  try {
    unavailableResponse = await fetch(`${baseUrl}/api/health`);
  } finally {
    console.error = originalConsoleError;
  }
  assert.equal(unavailableResponse.status, 503);
  const unavailablePayload = await json(unavailableResponse);
  assertErrorEnvelope(unavailablePayload, 'DATABASE_UNAVAILABLE');
  assert.equal(unavailablePayload.error, 'Database unavailable.');
  assert.deepEqual(unavailablePayload.database, { engine: 'SQLite', available: false });

  console.log(
    'API contract matrix passed: 86 operations, 82 auth guards, 53 Admin guards, 75 validation contracts.'
  );
}

run()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    try {
      await closeTestServer(server);
      await disposeTestEnvironment(testEnvironment, db);
    } catch (error) {
      console.error(error);
      process.exitCode = 1;
    }
  });

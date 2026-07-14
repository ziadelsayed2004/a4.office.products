import assert from 'node:assert/strict';
import http from 'node:http';
import {
  closeTestServer,
  createTestEnvironment,
  disposeTestEnvironment,
  seedCatalogFixture,
} from './test-environment.js';

const environment = createTestEnvironment('live-admin');
process.env.RATE_LIMIT_MAX = '5000';
process.env.LOGIN_RATE_LIMIT_MAX = '100';

let server;
let db;

async function login(baseUrl, username, password) {
  const response = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  assert.equal(response.status, 200);
  return (await response.json()).data;
}

async function jsonRequest(baseUrl, path, { token, method = 'GET', body, headers = {} } = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      ...headers,
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const payload = await response.json();
  return { response, payload };
}

try {
  const [{ default: app }, dbModule, migrationModule, liveEvents] = await Promise.all([
    import('../app.js'),
    import('../db/index.js'),
    import('../db/migrate.js'),
    import('../modules/liveAdmin/liveEvents.js'),
  ]);
  db = dbModule.default;
  await migrationModule.runMigrations();

  const sessionColumns = await db.all('PRAGMA table_info(sessions);');
  assert.ok(sessionColumns.some((column) => column.name === 'last_seen_at'));
  const productId = await seedCatalogFixture(db);
  const price = await db.get(
    'SELECT price_tier_id, price FROM product_prices WHERE product_id = ? LIMIT 1;',
    [productId]
  );
  await db.run(
    `INSERT INTO inventory_ledger
     (product_id, transaction_type, quantity_changed, before_quantity, after_quantity,
      reference_type, user_id, notes)
     VALUES (?, 'STOCK_IN', 10, 0, 10, 'test', 1, 'Live admin fixture');`,
    [productId]
  );

  server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  const admin = await login(baseUrl, 'admin', 'admin123');
  const cashier = await login(baseUrl, 'cashier', 'cashier123');

  await db.run("UPDATE sessions SET last_seen_at = '2000-01-01 00:00:00' WHERE user_id = ?;", [
    cashier.user.id,
  ]);
  const heartbeat = await jsonRequest(baseUrl, '/api/auth/heartbeat', {
    token: cashier.accessToken,
    method: 'POST',
  });
  assert.equal(heartbeat.response.status, 200);
  assert.ok(heartbeat.payload.data.lastSeenAt);
  assert.notEqual(heartbeat.payload.data.lastSeenAt, '2000-01-01 00:00:00');

  const open = await jsonRequest(baseUrl, '/api/shifts/open', {
    token: cashier.accessToken,
    method: 'POST',
    body: { openingCash: 1000 },
  });
  assert.equal(open.response.status, 200);
  const shiftId = open.payload.data.shift.id;

  await db.run(
    "UPDATE sessions SET last_seen_at = datetime('now', '-91 seconds') WHERE user_id = ?;",
    [cashier.user.id]
  );
  const offlineOverview = await jsonRequest(baseUrl, '/api/admin/live-overview', {
    token: admin.accessToken,
  });
  assert.equal(offlineOverview.response.status, 200);
  assert.equal(offlineOverview.payload.data.openShifts[0].isOnline, false);
  const offlineUsers = await jsonRequest(baseUrl, '/api/admin/users', {
    token: admin.accessToken,
  });
  assert.equal(offlineUsers.payload.data.find((user) => user.id === cashier.user.id).is_online, 0);

  const onlineHeartbeat = await jsonRequest(baseUrl, '/api/auth/heartbeat', {
    token: cashier.accessToken,
    method: 'POST',
  });
  assert.equal(onlineHeartbeat.response.status, 200);
  const onlineOverview = await jsonRequest(baseUrl, '/api/admin/live-overview', {
    token: admin.accessToken,
  });
  assert.equal(onlineOverview.payload.data.openShifts[0].isOnline, true);
  const onlineUsers = await jsonRequest(baseUrl, '/api/admin/users', {
    token: admin.accessToken,
  });
  assert.equal(onlineUsers.payload.data.find((user) => user.id === cashier.user.id).is_online, 1);

  const blockedRole = await jsonRequest(baseUrl, `/api/admin/users/${cashier.user.id}`, {
    token: admin.accessToken,
    method: 'PATCH',
    body: { role: 'Admin' },
  });
  assert.equal(blockedRole.response.status, 409);
  assert.equal(blockedRole.payload.code, 'USER_HAS_UNFINISHED_SHIFT');
  const blockedDisable = await jsonRequest(baseUrl, `/api/admin/users/${cashier.user.id}/disable`, {
    token: admin.accessToken,
    method: 'PATCH',
  });
  assert.equal(blockedDisable.response.status, 409);
  assert.equal(blockedDisable.payload.code, 'USER_HAS_UNFINISHED_SHIFT');

  let deliveredEvent;
  const unsubscribe = liveEvents.subscribeToLiveEvents((event) => {
    deliveredEvent = event;
  });
  liveEvents.publishLiveEvent('test.changed', { shiftId });
  unsubscribe();
  assert.equal(deliveredEvent.type, 'test.changed');
  assert.equal(liveEvents.liveEventListenerCount(), 0);

  let healthyEvent;
  const unsubscribeBroken = liveEvents.subscribeToLiveEvents(() => {
    throw new Error('simulated disconnected SSE listener');
  });
  const unsubscribeHealthy = liveEvents.subscribeToLiveEvents((event) => {
    healthyEvent = event;
  });
  const originalConsoleError = console.error;
  console.error = () => {};
  try {
    assert.doesNotThrow(() => liveEvents.publishLiveEvent('test.listener-isolation'));
  } finally {
    console.error = originalConsoleError;
    unsubscribeBroken();
    unsubscribeHealthy();
  }
  assert.equal(healthyEvent.type, 'test.listener-isolation');

  const sale = await jsonRequest(baseUrl, '/api/pos/orders/checkout', {
    token: cashier.accessToken,
    method: 'POST',
    headers: { 'Idempotency-Key': 'live-admin-sale-0001' },
    body: {
      items: [{ product_id: productId, quantity: 1, price_tier_id: price.price_tier_id }],
      discount: 0,
      payments: [{ method: 'Cash', amount: price.price, cashReceived: price.price }],
    },
  });
  assert.equal(sale.response.status, 201);

  const overview = await jsonRequest(baseUrl, '/api/admin/live-overview', {
    token: admin.accessToken,
  });
  assert.equal(overview.response.status, 200);
  assert.equal(overview.payload.data.summary.grossSales, price.price);
  assert.equal(overview.payload.data.summary.invoiceCount, 1);
  assert.equal(overview.payload.data.openShifts.length, 1);
  assert.equal(overview.payload.data.openShifts[0].id, shiftId);
  assert.equal(overview.payload.data.openShifts[0].isOnline, true);
  assert.equal(overview.payload.data.openShifts[0].paymentBreakdown.Cash, price.price);

  const users = await jsonRequest(baseUrl, '/api/admin/users', { token: admin.accessToken });
  assert.equal(users.response.status, 200);
  const cashierActivity = users.payload.data.find((user) => user.id === cashier.user.id);
  assert.equal(cashierActivity.open_shift_id, shiftId);
  assert.equal(cashierActivity.is_online, 1);
  assert.equal(cashierActivity.today_sales, price.price);
  assert.equal(cashierActivity.today_sales_count, 1);

  const shifts = await jsonRequest(baseUrl, '/api/shifts/all?status=OPEN', {
    token: admin.accessToken,
  });
  assert.equal(shifts.response.status, 200);
  assert.equal(shifts.payload.data[0].system_total_cash, 1000 + price.price);
  assert.equal(shifts.payload.data[0].payment_breakdown.Cash, 1000 + price.price);
  assert.ok(shifts.payload.data[0].last_activity_at);

  const details = await jsonRequest(baseUrl, `/api/shifts/${shiftId}`, {
    token: admin.accessToken,
  });
  assert.equal(details.response.status, 200);
  assert.equal(details.payload.data.invoices.length, 1);
  assert.deepEqual(details.payload.data.returns, []);

  const saleOrderId = sale.payload.data.id;
  const customer = await db.run(
    "INSERT INTO customers (name, phone) VALUES ('Pickup receipt fixture', 'pickup-receipt-fixture');"
  );
  await db.run(
    `INSERT INTO preorders
     (preorder_number, shift_id, cashier_id, customer_id, status, qr_pickup_token)
     VALUES ('PRE-DUMMY-DETAIL', ?, ?, ?, 'CANCELLED', 'pickup-detail-dummy-token');`,
    [shiftId, cashier.user.id, customer.lastID]
  );
  const pickupPreorder = await db.run(
    `INSERT INTO preorders
     (preorder_number, shift_id, cashier_id, customer_id, status, subtotal, total_amount,
      deposit_required, deposit_paid, remaining_amount, qr_pickup_token, pickup_order_id)
     VALUES ('PRE-PICKUP-DETAIL', ?, ?, ?, 'PICKED_UP', ?, ?, 0, 0, 0,
             'pickup-detail-target-token', ?);`,
    [shiftId, cashier.user.id, customer.lastID, price.price, price.price, saleOrderId]
  );
  await db.run("UPDATE orders SET origin = 'PREORDER_PICKUP', preorder_id = ? WHERE id = ?;", [
    pickupPreorder.lastID,
    saleOrderId,
  ]);
  await db.run(
    `INSERT INTO receipts
     (receipt_number, reference_type, reference_id, printed_by, print_count, qr_token)
     VALUES ('RCT-PREORDER-PICKUP-DETAIL', 'preorder_pickup', ?, ?, 1,
             'pickup-detail-receipt-token');`,
    [pickupPreorder.lastID, cashier.user.id]
  );
  const pickupDetails = await jsonRequest(baseUrl, `/api/shifts/${shiftId}`, {
    token: admin.accessToken,
  });
  assert.equal(pickupDetails.response.status, 200);
  assert.equal(pickupDetails.payload.data.invoices[0].receipt_number, 'RCT-PREORDER-PICKUP-DETAIL');

  const sseAbort = new AbortController();
  const sse = await fetch(`${baseUrl}/api/admin/live-events`, {
    headers: { Authorization: `Bearer ${admin.accessToken}` },
    signal: sseAbort.signal,
  });
  assert.equal(sse.status, 200);
  assert.match(sse.headers.get('content-type'), /text\/event-stream/);
  const reader = sse.body.getReader();
  const ready = await reader.read();
  assert.match(new TextDecoder().decode(ready.value), /event: ready/);
  liveEvents.publishLiveEvent('test.sse-changed', { shiftId });
  const invalidation = await reader.read();
  assert.match(new TextDecoder().decode(invalidation.value), /event: invalidate/);
  sseAbort.abort();
  try {
    await reader.cancel();
  } catch (error) {
    if (error?.name !== 'AbortError') throw error;
  }

  const adminPassword = await db.get('SELECT password_hash FROM users WHERE id = ?;', [
    admin.user.id,
  ]);
  const streamAdminUser = await db.run(
    `INSERT INTO users (username, password_hash, role, name, is_active)
     VALUES ('stream-admin', ?, 'Admin', 'Stream Admin', 1);`,
    [adminPassword.password_hash]
  );
  const streamAdmin = await login(baseUrl, 'stream-admin', 'admin123');
  const revokedStream = await fetch(`${baseUrl}/api/admin/live-events`, {
    headers: { Authorization: `Bearer ${streamAdmin.accessToken}` },
  });
  assert.equal(revokedStream.status, 200);
  const revokedReader = revokedStream.body.getReader();
  const revokedReady = await revokedReader.read();
  assert.match(new TextDecoder().decode(revokedReady.value), /event: ready/);
  const disableStreamAdmin = await jsonRequest(
    baseUrl,
    `/api/admin/users/${streamAdminUser.lastID}/disable`,
    { token: admin.accessToken, method: 'PATCH' }
  );
  assert.equal(disableStreamAdmin.response.status, 200);
  const closedStream = await Promise.race([
    revokedReader.read(),
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error('SSE did not close after Admin deactivation.')), 2000)
    ),
  ]);
  assert.equal(closedStream.done, true);

  const actuals = { Cash: 1000 + price.price, Card: 0, InstaPay: 0, Wallet: 0, Transfer: 0 };
  const emergency = await jsonRequest(baseUrl, `/api/shifts/${shiftId}/admin-close`, {
    token: admin.accessToken,
    method: 'POST',
    body: { actuals, reason: 'Emergency handover test' },
  });
  assert.equal(emergency.response.status, 200);
  assert.equal(emergency.payload.data.shift.status, 'CLOSED');
  assert.equal(emergency.payload.data.invoices.length, 1);
  assert.equal(emergency.payload.data.closeRevisions[0].status, 'APPROVED');
  assert.equal(emergency.payload.data.closeRevisions[0].admin_reason, 'Emergency handover test');
  const emergencyAudit = await db.get(
    "SELECT * FROM audit_logs WHERE action_type = 'SHIFT_EMERGENCY_CLOSE' AND shift_id = ?;",
    [shiftId]
  );
  assert.ok(emergencyAudit);

  const auxiliaryAdmin = await login(baseUrl, 'admin', 'admin123');
  const sessions = await jsonRequest(baseUrl, `/api/admin/users/${admin.user.id}/sessions`, {
    token: admin.accessToken,
  });
  assert.equal(sessions.response.status, 200);
  assert.ok(sessions.payload.data.length >= 2);
  const auxiliarySessionId = sessions.payload.data[0].id;
  const revoked = await jsonRequest(
    baseUrl,
    `/api/admin/users/${admin.user.id}/sessions/${auxiliarySessionId}`,
    { token: admin.accessToken, method: 'DELETE' }
  );
  assert.equal(revoked.response.status, 200);
  assert.equal(revoked.payload.data.revokedCount, 1);
  const revokedMe = await jsonRequest(baseUrl, '/api/auth/me', {
    token: auxiliaryAdmin.accessToken,
  });
  assert.equal(revokedMe.response.status, 401);
  assert.equal(revokedMe.payload.code, 'SESSION_REVOKED');

  const revokedCashierSessions = await jsonRequest(
    baseUrl,
    `/api/admin/users/${cashier.user.id}/revoke-sessions`,
    { token: admin.accessToken, method: 'POST', body: {} }
  );
  assert.equal(revokedCashierSessions.response.status, 200);
  assert.equal(revokedCashierSessions.payload.data.revokedCount, 1);

  const allowedDisable = await jsonRequest(baseUrl, `/api/admin/users/${cashier.user.id}/disable`, {
    token: admin.accessToken,
    method: 'PATCH',
  });
  assert.equal(allowedDisable.response.status, 200);

  console.log('Live Admin, activity, session, and emergency-close tests passed.');
} finally {
  await closeTestServer(server);
  await disposeTestEnvironment(environment, db);
}

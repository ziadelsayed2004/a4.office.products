import assert from 'assert';
import http from 'http';
import {
  closeTestServer,
  createTestEnvironment,
  disposeTestEnvironment,
} from './test-environment.js';

let server;
let db;
const testEnvironment = createTestEnvironment('services');

function assertApiError(body, expectedCode) {
  assert.strictEqual(typeof body.error, 'string');
  assert.ok(body.error.length > 0);
  assert.strictEqual(body.code, expectedCode);
}

async function runServicesTests() {
  console.log('========================================');
  console.log(' STARTING COMPREHENSIVE SERVICE TESTS');
  console.log('========================================');

  const [{ default: app }, dbModule, migrationModule, categoriesService] = await Promise.all([
    import('../app.js'),
    import('../db/index.js'),
    import('../db/migrate.js'),
    import('../modules/categories/categories.service.js'),
  ]);
  db = dbModule.default;
  assert.strictEqual(
    dbModule.dbPath,
    testEnvironment.databasePath,
    'service test must use its isolated database'
  );
  await migrationModule.runMigrations();
  await assert.rejects(
    categoriesService.createCategory('Transaction rollback probe', 999999),
    (error) => error.code === 'SQLITE_CONSTRAINT'
  );
  assert.strictEqual(
    await db.get('SELECT id FROM categories WHERE name = ?;', ['Transaction rollback probe']),
    undefined,
    'business mutation must roll back when its audit write fails'
  );
  console.log(`✔ Fresh isolated database created at ${testEnvironment.databasePath}.`);

  // Start temporary test server
  server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  const BASE_URL = `http://127.0.0.1:${port}`;
  console.log(`Test server listening on port ${port}`);

  try {
    let adminToken;
    let cashierToken;
    let testUserId;
    let testCategoryId;
    let testPriceTierId;
    let testProductId;
    let testCustomerId;
    let testShiftId;
    let testReceiptId;
    let testPreorderId;
    let testPreorderToken;

    const healthRes = await fetch(`${BASE_URL}/api/health`);
    assert.strictEqual(healthRes.status, 200);
    assert.strictEqual((await healthRes.json()).status, 'ok');

    const notFoundRes = await fetch(`${BASE_URL}/api/route-that-does-not-exist`);
    assert.strictEqual(notFoundRes.status, 404);
    assertApiError(await notFoundRes.json(), 'ROUTE_NOT_FOUND');

    // ------------------------------------------------------------------------
    // SETUP: LOGIN AUTHENTICATION
    // ------------------------------------------------------------------------
    console.log('\n[AUTH SERVICE] Logging in as Admin...');
    const loginAdminRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'admin123' }),
    });
    assert.strictEqual(loginAdminRes.status, 200);
    const adminLoginData = await loginAdminRes.json();
    adminToken = adminLoginData.data.accessToken;

    const refreshAdminRes = await fetch(`${BASE_URL}/api/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: adminLoginData.data.refreshToken }),
    });
    assert.strictEqual(refreshAdminRes.status, 200);
    const refreshAdminData = await refreshAdminRes.json();
    assert.ok(refreshAdminData.data.accessToken);
    adminToken = refreshAdminData.data.accessToken;

    const auxiliaryLoginRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'admin123' }),
    });
    assert.strictEqual(auxiliaryLoginRes.status, 200);
    const auxiliaryLoginData = await auxiliaryLoginRes.json();
    const auxiliaryLogoutRes = await fetch(`${BASE_URL}/api/auth/logout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: auxiliaryLoginData.data.refreshToken }),
    });
    assert.strictEqual(auxiliaryLogoutRes.status, 200);
    const revokedAccessRes = await fetch(`${BASE_URL}/api/auth/me`, {
      headers: { Authorization: `Bearer ${auxiliaryLoginData.data.accessToken}` },
    });
    assert.strictEqual(revokedAccessRes.status, 401);
    assertApiError(await revokedAccessRes.json(), 'SESSION_REVOKED');
    const revokedRefreshRes = await fetch(`${BASE_URL}/api/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: auxiliaryLoginData.data.refreshToken }),
    });
    assert.strictEqual(revokedRefreshRes.status, 401);
    assertApiError(await revokedRefreshRes.json(), 'INVALID_REFRESH_TOKEN');
    console.log('✔ Admin logged in.');

    console.log('\n[AUTH SERVICE] Logging in as Cashier...');
    const loginCashierRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'cashier', password: 'cashier123' }),
    });
    assert.strictEqual(loginCashierRes.status, 200);
    const cashierLoginData = await loginCashierRes.json();
    cashierToken = cashierLoginData.data.accessToken;
    console.log('✔ Cashier logged in.');

    // ------------------------------------------------------------------------
    // 1. USERS SERVICE TESTS
    // ------------------------------------------------------------------------
    console.log('\n[USERS SERVICE] Creating new Cashier...');
    const createUserRes = await fetch(`${BASE_URL}/api/admin/users`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: 'كاشير فحص',
        username: 'cashier_test_service',
        password: 'password123',
        phone: '01200000000',
        role: 'Cashier',
      }),
    });
    assert.strictEqual(createUserRes.status, 201);
    const createUserData = await createUserRes.json();
    testUserId = createUserData.data.id;
    console.log(`✔ Cashier created with ID: ${testUserId}`);

    console.log('\n[USERS SERVICE] Modifying user details...');
    const updateUserRes = await fetch(`${BASE_URL}/api/admin/users/${testUserId}`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: 'كاشير فحص معدل',
        phone: '01233333333',
      }),
    });
    assert.strictEqual(updateUserRes.status, 200);
    console.log('✔ User details modified.');

    const managedUserLoginRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'cashier_test_service', password: 'password123' }),
    });
    assert.strictEqual(managedUserLoginRes.status, 200);
    const managedUserLoginData = await managedUserLoginRes.json();

    console.log('\n[USERS SERVICE] Updating user password...');
    const updatePasswordRes = await fetch(`${BASE_URL}/api/admin/users/${testUserId}/password`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        password: 'newpassword123',
      }),
    });
    assert.strictEqual(updatePasswordRes.status, 200);
    const passwordRevokedAccessRes = await fetch(`${BASE_URL}/api/auth/me`, {
      headers: { Authorization: `Bearer ${managedUserLoginData.data.accessToken}` },
    });
    assert.strictEqual(passwordRevokedAccessRes.status, 401);
    assertApiError(await passwordRevokedAccessRes.json(), 'SESSION_REVOKED');
    const passwordRevokedRefreshRes = await fetch(`${BASE_URL}/api/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: managedUserLoginData.data.refreshToken }),
    });
    assert.strictEqual(passwordRevokedRefreshRes.status, 401);
    assertApiError(await passwordRevokedRefreshRes.json(), 'INVALID_REFRESH_TOKEN');
    console.log('✔ User password updated.');

    const managedUserReloginRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'cashier_test_service', password: 'newpassword123' }),
    });
    assert.strictEqual(managedUserReloginRes.status, 200);
    const managedUserReloginData = await managedUserReloginRes.json();

    console.log('\n[USERS SERVICE] Disabling user...');
    const disableUserRes = await fetch(`${BASE_URL}/api/admin/users/${testUserId}/disable`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.strictEqual(disableUserRes.status, 200);
    const disabledAccessRes = await fetch(`${BASE_URL}/api/auth/me`, {
      headers: { Authorization: `Bearer ${managedUserReloginData.data.accessToken}` },
    });
    assert.strictEqual(disabledAccessRes.status, 401);
    assertApiError(await disabledAccessRes.json(), 'INACTIVE_USER');
    const disabledRefreshRes = await fetch(`${BASE_URL}/api/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: managedUserReloginData.data.refreshToken }),
    });
    assert.strictEqual(disabledRefreshRes.status, 401);
    assertApiError(await disabledRefreshRes.json(), 'INVALID_REFRESH_TOKEN');
    console.log('✔ User account disabled.');

    console.log('\n[USERS SERVICE] Enabling user...');
    const enableUserRes = await fetch(`${BASE_URL}/api/admin/users/${testUserId}/enable`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.strictEqual(enableUserRes.status, 200);
    console.log('✔ User account re-enabled.');

    console.log('\n[USERS SERVICE] Listing all users...');
    const listUsersRes = await fetch(`${BASE_URL}/api/admin/users`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.strictEqual(listUsersRes.status, 200);
    const listUsersData = await listUsersRes.json();
    assert.ok(Array.isArray(listUsersData.data));
    const foundUser = listUsersData.data.find((u) => u.id === testUserId);
    assert.ok(foundUser, 'Should find the newly created user in the list');

    const demoteLastAdminRes = await fetch(
      `${BASE_URL}/api/admin/users/${adminLoginData.data.user.id}`,
      {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${adminToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ role: 'Cashier' }),
      }
    );
    assert.strictEqual(demoteLastAdminRes.status, 409);
    assertApiError(await demoteLastAdminRes.json(), 'LAST_ACTIVE_ADMIN');

    const shortPasswordRes = await fetch(`${BASE_URL}/api/admin/users`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        username: 'short_password',
        password: '1234',
        role: 'Cashier',
        name: 'Invalid',
      }),
    });
    assert.strictEqual(shortPasswordRes.status, 400);
    const shortPasswordData = await shortPasswordRes.json();
    assertApiError(shortPasswordData, 'VALIDATION_ERROR');
    assert.ok(Array.isArray(shortPasswordData.details));
    console.log('✔ Users listed successfully.');

    // ------------------------------------------------------------------------
    // 2. CATEGORIES SERVICE TESTS
    // ------------------------------------------------------------------------
    console.log('\n[CATEGORIES SERVICE] Creating category...');
    const createCatRes = await fetch(`${BASE_URL}/api/admin/categories`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: 'دفاتر كشكول',
        description: 'دفاتر وكشاكيل دراسية ومكتبية',
      }),
    });
    assert.strictEqual(createCatRes.status, 201);
    const createCatData = await createCatRes.json();
    testCategoryId = createCatData.data.id;
    console.log(`✔ Category created with ID: ${testCategoryId}`);

    console.log('\n[CATEGORIES SERVICE] Listing categories...');
    const getCatsRes = await fetch(`${BASE_URL}/api/categories`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.strictEqual(getCatsRes.status, 200);
    const getCatsData = await getCatsRes.json();
    assert.ok(getCatsData.data.some((c) => c.id === testCategoryId));
    console.log('✔ Categories list verified.');

    console.log('\n[CATEGORIES SERVICE] Updating category...');
    const updateCatRes = await fetch(`${BASE_URL}/api/admin/categories/${testCategoryId}`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: 'كشاكيل ودفاتر فاخرة',
        description: 'دفاتر دراسية ومكتبية معدلة',
      }),
    });
    assert.strictEqual(updateCatRes.status, 200);
    console.log('✔ Category updated.');

    // ------------------------------------------------------------------------
    // 3. PRICE TIERS SERVICE TESTS
    // ------------------------------------------------------------------------
    console.log('\n[PRICE TIERS SERVICE] Creating price tier...');
    const createPTRes = await fetch(`${BASE_URL}/api/admin/price-tiers`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: 'جملة تجاري خاص',
        description: 'فئة الأسعار المخصصة للمحلات التجارية الكبرى',
      }),
    });
    assert.strictEqual(createPTRes.status, 201);
    const createPTData = await createPTRes.json();
    testPriceTierId = createPTData.data.id;
    console.log(`✔ Price tier created with ID: ${testPriceTierId}`);

    console.log('\n[PRICE TIERS SERVICE] Listing price tiers...');
    const getPTsRes = await fetch(`${BASE_URL}/api/admin/price-tiers`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.strictEqual(getPTsRes.status, 200);
    const getPTsData = await getPTsRes.json();
    assert.ok(getPTsData.data.some((pt) => pt.id === testPriceTierId));
    console.log('✔ Price tiers list verified.');

    console.log('\n[PRICE TIERS SERVICE] Updating price tier...');
    const updatePTRes = await fetch(`${BASE_URL}/api/admin/price-tiers/${testPriceTierId}`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: 'جملة تجاري مخفض جداً',
        description: 'تعديل الوصف لفئة السعر التجاري',
      }),
    });
    assert.strictEqual(updatePTRes.status, 200);
    console.log('✔ Price tier updated.');

    // ------------------------------------------------------------------------
    // 4. PRODUCTS SERVICE TESTS
    // ------------------------------------------------------------------------
    console.log('\n[PRODUCTS SERVICE] Creating new product...');
    const createProdRes = await fetch(`${BASE_URL}/api/admin/products`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: 'كشكول سلك مسطر A4',
        sku: 'SKU-KASHK-A4-WIRE',
        barcode: '6221100220033',
        category_id: testCategoryId,
        availabilityPolicy: 'STOCK_WITH_PREORDER_WHEN_OUT_OF_STOCK',
        isActive: true,
        initialStock: 50,
        lowStockThreshold: 10,
        purchaseCost: 0,
        is_book: 0,
        prices: getPTsData.data.map((tier) => ({
          price_tier_id: tier.id,
          price: tier.id === testPriceTierId ? 10000 : 12000,
        })),
      }),
    });
    if (createProdRes.status !== 201) {
      const errBody = await createProdRes.json().catch(() => ({}));
      console.error('Product creation failed body:', errBody);
    }
    assert.strictEqual(createProdRes.status, 201);
    const createProdData = await createProdRes.json();
    testProductId = createProdData.data.id;
    console.log(`✔ Product created with ID: ${testProductId}`);

    console.log('\n[PRODUCTS SERVICE] Fetching product details...');
    const getProdRes = await fetch(`${BASE_URL}/api/products/${testProductId}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.strictEqual(getProdRes.status, 200);
    const getProdData = await getProdRes.json();
    assert.strictEqual(getProdData.data.name, 'كشكول سلك مسطر A4');

    const updateProductRes = await fetch(`${BASE_URL}/api/admin/products/${testProductId}`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ notes: 'Product API update contract verified' }),
    });
    assert.strictEqual(updateProductRes.status, 200);
    assert.strictEqual(
      (await updateProductRes.json()).data.notes,
      'Product API update contract verified'
    );

    const cashierProductUpdateRes = await fetch(`${BASE_URL}/api/admin/products/${testProductId}`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${cashierToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ notes: 'forbidden' }),
    });
    assert.strictEqual(cashierProductUpdateRes.status, 403);
    assertApiError(await cashierProductUpdateRes.json(), 'FORBIDDEN');
    console.log('✔ Product details verified.');

    console.log('\n[PRODUCTS SERVICE] Generating QR labels...');
    const printQRRes = await fetch(`${BASE_URL}/api/admin/products/${testProductId}/qr-labels`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ quantity: 10, label_size: '50x25' }),
    });
    assert.strictEqual(printQRRes.status, 200);
    const printQRData = await printQRRes.json();
    assert.ok(printQRData.data.token);
    console.log('✔ QR labels token generated.');

    console.log('\n[PRODUCTS SERVICE] Verifying legacy print preview is retired...');
    const printJobRes = await fetch(
      `${BASE_URL}/api/admin/print-job/${printQRData.data.token}?qty=5&size=medium`,
      {
        headers: { Authorization: `Bearer ${adminToken}` },
      }
    );
    assert.strictEqual(printJobRes.status, 410);
    const printJobData = await printJobRes.json();
    assert.strictEqual(printJobData.code, 'LEGACY_PRINT_ROUTE_REMOVED');
    console.log('✔ Legacy CDN-backed print preview is retired.');

    // ------------------------------------------------------------------------
    // 5. INVENTORY SERVICE TESTS
    // ------------------------------------------------------------------------
    console.log('\n[INVENTORY SERVICE] Adjusting stock level...');
    const adjustStockRes = await fetch(`${BASE_URL}/api/admin/inventory/adjust`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': 'services-inventory-adjust-001',
      },
      body: JSON.stringify({
        product_id: testProductId,
        adjustment_type: 'ADD',
        quantity: 30,
        notes: 'إضافة رصيد استلام بضاعة جديدة',
      }),
    });
    if (adjustStockRes.status !== 200) {
      const errBody = await adjustStockRes.json().catch(() => ({}));
      console.error('Stock adjustment failed body:', errBody);
    }
    assert.strictEqual(adjustStockRes.status, 200);
    const adjustStockData = await adjustStockRes.json();
    assert.strictEqual(adjustStockRes.headers.get('idempotency-replayed'), 'false');

    const adjustReplayRes = await fetch(`${BASE_URL}/api/admin/inventory/adjust`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': 'services-inventory-adjust-001',
      },
      body: JSON.stringify({
        product_id: testProductId,
        adjustment_type: 'ADD',
        quantity: 30,
        notes: 'إضافة رصيد استلام بضاعة جديدة',
      }),
    });
    assert.strictEqual(adjustReplayRes.status, 200);
    assert.strictEqual(adjustReplayRes.headers.get('idempotency-replayed'), 'true');
    const adjustReplayData = await adjustReplayRes.json();
    assert.strictEqual(adjustReplayData.data.id, adjustStockData.data.id);

    const adjustConflictRes = await fetch(`${BASE_URL}/api/admin/inventory/adjust`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': 'services-inventory-adjust-001',
      },
      body: JSON.stringify({
        product_id: testProductId,
        adjustment_type: 'ADD',
        quantity: 31,
        notes: 'إضافة رصيد استلام بضاعة جديدة',
      }),
    });
    assert.strictEqual(adjustConflictRes.status, 409);
    assert.strictEqual((await adjustConflictRes.json()).code, 'IDEMPOTENCY_KEY_CONFLICT');

    const concurrentAdjustments = await Promise.all(
      ['services-inventory-concurrent-001', 'services-inventory-concurrent-002'].map((key) =>
        fetch(`${BASE_URL}/api/admin/inventory/adjust`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${adminToken}`,
            'Content-Type': 'application/json',
            'Idempotency-Key': key,
          },
          body: JSON.stringify({
            product_id: testProductId,
            adjustment_type: 'ADD',
            quantity: 1,
            notes: 'Concurrent inventory continuity test',
          }),
        })
      )
    );
    assert.deepStrictEqual(
      concurrentAdjustments.map((response) => response.status),
      [200, 200]
    );
    const concurrentRows = await Promise.all(
      concurrentAdjustments.map((response) => response.json())
    );
    const orderedRows = concurrentRows
      .map((body) => body.data)
      .sort((left, right) => left.id - right.id);
    assert.strictEqual(orderedRows[0].after_quantity, orderedRows[1].before_quantity);
    console.log('✔ Stock successfully adjusted.');

    console.log('\n[INVENTORY SERVICE] Listing ledger logs...');
    const getInvRes = await fetch(`${BASE_URL}/api/admin/inventory?productId=${testProductId}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.strictEqual(getInvRes.status, 200);
    const getInvData = await getInvRes.json();
    assert.ok(getInvData.data.ledger.length > 0);
    assert.ok(getInvData.data.ledger.some((log) => log.quantity_changed === 30));
    assert.ok(getInvData.data.total >= getInvData.data.ledger.length);
    assert.deepStrictEqual(getInvData.data.pagination, { limit: 50, offset: 0 });

    const invalidInventoryPageRes = await fetch(`${BASE_URL}/api/admin/inventory?limit=101`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.strictEqual(invalidInventoryPageRes.status, 400);
    assertApiError(await invalidInventoryPageRes.json(), 'VALIDATION_ERROR');
    console.log('✔ Inventory logs listed.');

    // ------------------------------------------------------------------------
    // 6. PAYMENTS SERVICE TESTS
    // ------------------------------------------------------------------------
    console.log('\n[PAYMENTS SERVICE] Getting active payment channels...');
    const getPayRes = await fetch(`${BASE_URL}/api/payment-methods`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.strictEqual(getPayRes.status, 200);
    const getPayData = await getPayRes.json();
    assert.ok(getPayData.data.length > 0);
    console.log('✔ Active payment channels loaded.');

    console.log('\n[PAYMENTS SERVICE] Updating payment channels configuration...');
    // Enable/toggle status of payment methods
    const updatePayRes = await fetch(`${BASE_URL}/api/payment-methods/admin`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        active_ids: getPayData.data.map((m) => m.id),
      }),
    });
    if (updatePayRes.status !== 200) {
      const errBody = await updatePayRes.json().catch(() => ({}));
      console.error('Update payments failed body:', errBody);
    }
    assert.strictEqual(updatePayRes.status, 200);

    const cashierCreatePaymentMethodRes = await fetch(
      `${BASE_URL}/api/payment-methods/admin/methods`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${cashierToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ code: 'Voucher', name_ar: 'قسيمة', is_active: false }),
      }
    );
    assert.strictEqual(cashierCreatePaymentMethodRes.status, 403);
    assertApiError(await cashierCreatePaymentMethodRes.json(), 'FORBIDDEN');

    const createPaymentMethodRes = await fetch(`${BASE_URL}/api/payment-methods/admin/methods`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ code: 'Voucher', name_ar: 'قسيمة', is_active: false, sort_order: 99 }),
    });
    assert.strictEqual(createPaymentMethodRes.status, 201);
    const createdPaymentMethod = (await createPaymentMethodRes.json()).data;
    assert.strictEqual(createdPaymentMethod.is_active, 0);

    const updatePaymentMethodRes = await fetch(
      `${BASE_URL}/api/payment-methods/admin/methods/${createdPaymentMethod.id}`,
      {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${adminToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name_ar: 'قسيمة محدثة', accepts_cash_received: false }),
      }
    );
    assert.strictEqual(updatePaymentMethodRes.status, 200);
    assert.strictEqual((await updatePaymentMethodRes.json()).data.name_ar, 'قسيمة محدثة');

    const missingPaymentMethodRes = await fetch(
      `${BASE_URL}/api/payment-methods/admin/methods/999999`,
      {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${adminToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name_ar: 'غير موجود' }),
      }
    );
    assert.strictEqual(missingPaymentMethodRes.status, 404);
    assertApiError(await missingPaymentMethodRes.json(), 'PAYMENT_METHOD_NOT_FOUND');
    console.log('✔ Payment configurations saved.');

    // ------------------------------------------------------------------------
    // 7. CUSTOMERS SERVICE TESTS
    // ------------------------------------------------------------------------
    console.log('\n[CUSTOMERS SERVICE] Registering new customer...');
    const createCustRes = await fetch(`${BASE_URL}/api/customers`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: 'عميل تجربة الخدمة',
        phone: '01099998888',
        email: 'customer@test-service.com',
      }),
    });
    assert.strictEqual(createCustRes.status, 201);
    const createCustData = await createCustRes.json();
    testCustomerId = createCustData.data.id;
    console.log(`✔ Customer registered with ID: ${testCustomerId}`);

    console.log('\n[CUSTOMERS SERVICE] Searching registered customers...');
    const searchCustRes = await fetch(`${BASE_URL}/api/customers?q=01099998888`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.strictEqual(searchCustRes.status, 200);
    const searchCustData = await searchCustRes.json();
    assert.ok(searchCustData.data.some((c) => c.id === testCustomerId));
    console.log('✔ Customer search matched.');

    // ------------------------------------------------------------------------
    // 8. SHIFTS SERVICE TESTS
    // ------------------------------------------------------------------------
    console.log('\n[SHIFTS SERVICE] Checking shift endpoints...');
    // We already have a cashier shift open in smoke test, but let's do cash movement / close / approve flows
    const getCurrentShiftRes = await fetch(`${BASE_URL}/api/shifts/current`, {
      headers: { Authorization: `Bearer ${cashierToken}` },
    });
    assert.strictEqual(getCurrentShiftRes.status, 200);
    const currentShiftData = await getCurrentShiftRes.json();
    testShiftId = currentShiftData.data ? currentShiftData.data.id : null;

    if (!testShiftId) {
      console.log('No shift active, opening test shift...');
      const openShiftRes = await fetch(`${BASE_URL}/api/shifts/open`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${cashierToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ openingCash: 100000 }), // 1000 EGP in piastres
      });
      assert.strictEqual(openShiftRes.status, 200);
      const openShiftData = await openShiftRes.json();
      testShiftId = openShiftData.data.shift.id;
    }
    console.log(`✔ Active Cashier Shift ID: ${testShiftId}`);

    console.log('\n[SHIFTS SERVICE] Registering cash movement pay-out...');
    const cashMoveRes = await fetch(`${BASE_URL}/api/shifts/current/cash-movement`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${cashierToken}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': 'services-cash-movement-001',
      },
      body: JSON.stringify({
        type: 'PAY_OUT',
        amount: 5000, // 50 EGP
        notes: 'شراء ضيافة شاي وقهوة',
      }),
    });
    assert.strictEqual(cashMoveRes.status, 200);
    assert.strictEqual(cashMoveRes.headers.get('idempotency-replayed'), 'false');

    const cashMoveReplayRes = await fetch(`${BASE_URL}/api/shifts/current/cash-movement`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${cashierToken}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': 'services-cash-movement-001',
      },
      body: JSON.stringify({ type: 'PAY_OUT', amount: 5000, notes: 'شراء ضيافة شاي وقهوة' }),
    });
    assert.strictEqual(cashMoveReplayRes.status, 200);
    assert.strictEqual(cashMoveReplayRes.headers.get('idempotency-replayed'), 'true');

    const cashMoveConflictRes = await fetch(`${BASE_URL}/api/shifts/current/cash-movement`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${cashierToken}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': 'services-cash-movement-001',
      },
      body: JSON.stringify({ type: 'PAY_OUT', amount: 5001, notes: 'conflicting movement' }),
    });
    assert.strictEqual(cashMoveConflictRes.status, 409);
    assert.strictEqual((await cashMoveConflictRes.json()).code, 'IDEMPOTENCY_KEY_CONFLICT');
    console.log('✔ Cash movement registered.');

    console.log('\n[SHIFTS SERVICE] Loading cashier shift metrics summary...');
    const getSummaryRes = await fetch(`${BASE_URL}/api/shifts/current/summary`, {
      headers: { Authorization: `Bearer ${cashierToken}` },
    });
    assert.strictEqual(getSummaryRes.status, 200);
    const summaryData = await getSummaryRes.json();
    assert.ok(summaryData.data.shift.opening_cash);
    console.log('✔ Session metrics loaded.');

    console.log('\n[SHIFTS SERVICE] Requesting shift close...');
    const reqCloseRes = await fetch(`${BASE_URL}/api/shifts/current/close-request`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${cashierToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        actualClosingCash: 95000, // 950 EGP (variance check)
      }),
    });
    if (reqCloseRes.status !== 200)
      console.error('Shift close request failed:', await reqCloseRes.clone().json());
    assert.strictEqual(reqCloseRes.status, 200);
    console.log('✔ Shift close requested.');

    console.log('\n[SHIFTS SERVICE] Listing pending review shifts (Admin)...');
    const getPendingRes = await fetch(`${BASE_URL}/api/shifts/pending-review`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.strictEqual(getPendingRes.status, 200);
    const pendingData = await getPendingRes.json();
    assert.ok(pendingData.data.some((s) => s.id === testShiftId));
    console.log('✔ Shift found in pending queue.');

    console.log('\n[SHIFTS SERVICE] Approving shift close (Admin)...');
    const approveShiftRes = await fetch(`${BASE_URL}/api/shifts/${testShiftId}/approve`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ notes: 'تمت الموافقة ومطابقة العجز المذكور' }),
    });
    assert.strictEqual(approveShiftRes.status, 200);
    console.log('✔ Shift successfully approved & closed.');

    // ------------------------------------------------------------------------
    // 9. POS SERVICE TESTS
    // ------------------------------------------------------------------------
    console.log('\n[POS SERVICE] Opening a new shift to start POS checkout...');
    const openShift2Res = await fetch(`${BASE_URL}/api/shifts/open`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${cashierToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ openingCash: 100000 }),
    });
    assert.strictEqual(openShift2Res.status, 200);

    console.log('\n[POS SERVICE] Scanning product barcode...');
    const scanProdRes = await fetch(`${BASE_URL}/api/pos/scan-product`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${cashierToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ code: '6221100220033' }),
    });
    assert.strictEqual(scanProdRes.status, 200);
    const scanProdData = await scanProdRes.json();
    assert.strictEqual(scanProdData.data.sku, 'SKU-KASHK-A4-WIRE');
    console.log('✔ Scan matched Rotring Pen.');

    console.log('\n[POS SERVICE] Searching catalog items in POS search index...');
    const posSearchRes = await fetch(`${BASE_URL}/api/pos/products/search?q=كشكول`, {
      headers: { Authorization: `Bearer ${cashierToken}` },
    });
    assert.strictEqual(posSearchRes.status, 200);
    const posSearchData = await posSearchRes.json();
    assert.ok(posSearchData.data.some((p) => p.id === testProductId));
    console.log('✔ Search index matched Rotring Pen.');

    console.log('\n[POS SERVICE] Checkout order with split payments...');
    const checkoutRes = await fetch(`${BASE_URL}/api/pos/orders/checkout`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${cashierToken}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': 'services-sale-checkout-001',
      },
      body: JSON.stringify({
        customerId: testCustomerId,
        items: [{ product_id: testProductId, quantity: 2, price_tier_id: 1 }],
        discount: 2000, // 20 EGP discount
        payments: [
          { method: 'Cash', amount: 12000, cashReceived: 15000 }, // 120 EGP applied, 150 EGP tendered
          { method: 'Card', amount: 10000 }, // 100 EGP card (subtotal is 240, net is 220)
        ],
      }),
    });
    assert.strictEqual(checkoutRes.status, 201);
    const checkoutData = await checkoutRes.json();
    testReceiptId = checkoutData.data.receipt_id;
    const testOrderId = checkoutData.data.id;
    const invoiceNumber = checkoutData.data.invoice_number;
    const invoiceToken = checkoutData.data.invoice_qr_token;

    const adminInvoicesRes = await fetch(
      `${BASE_URL}/api/admin/invoices?invoiceNumber=${encodeURIComponent(invoiceNumber)}&paymentMethod=Cash`,
      { headers: { Authorization: `Bearer ${adminToken}` } }
    );
    assert.strictEqual(adminInvoicesRes.status, 200);
    const adminInvoicesData = await adminInvoicesRes.json();
    assert.strictEqual(adminInvoicesData.data.total, 1);
    assert.strictEqual(adminInvoicesData.data.rows[0].id, testOrderId);

    const adminInvoiceDetailRes = await fetch(`${BASE_URL}/api/admin/invoices/${testOrderId}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.strictEqual(adminInvoiceDetailRes.status, 200);
    const adminInvoiceDetailData = await adminInvoiceDetailRes.json();
    assert.strictEqual(adminInvoiceDetailData.data.invoice_number, invoiceNumber);
    assert.ok(adminInvoiceDetailData.data.items.length > 0);
    assert.ok(adminInvoiceDetailData.data.payments.length > 0);
    const returnOrderItemId = adminInvoiceDetailData.data.items[0].order_item_id;
    assert.ok(returnOrderItemId > 0);

    const cashierLookupRes = await fetch(
      `${BASE_URL}/api/pos/invoices/lookup?invoiceNumber=${encodeURIComponent(invoiceNumber)}`,
      { headers: { Authorization: `Bearer ${cashierToken}` } }
    );
    assert.strictEqual(cashierLookupRes.status, 200);
    const cashierLookupData = await cashierLookupRes.json();
    assert.strictEqual(cashierLookupData.data.rows[0].id, testOrderId);

    const cashierInvoiceDetailRes = await fetch(`${BASE_URL}/api/pos/invoices/${testOrderId}`, {
      headers: { Authorization: `Bearer ${cashierToken}` },
    });
    assert.strictEqual(cashierInvoiceDetailRes.status, 200);
    assert.strictEqual((await cashierInvoiceDetailRes.json()).data.invoice_number, invoiceNumber);

    const invalidInvoiceIdRes = await fetch(`${BASE_URL}/api/pos/invoices/not-a-number`, {
      headers: { Authorization: `Bearer ${cashierToken}` },
    });
    assert.strictEqual(invalidInvoiceIdRes.status, 400);
    const invalidInvoiceIdData = await invalidInvoiceIdRes.json();
    assertApiError(invalidInvoiceIdData, 'VALIDATION_ERROR');
    assert.ok(Array.isArray(invalidInvoiceIdData.details));

    const cashierGlobalInvoicesRes = await fetch(`${BASE_URL}/api/admin/invoices`, {
      headers: { Authorization: `Bearer ${cashierToken}` },
    });
    assert.strictEqual(cashierGlobalInvoicesRes.status, 403);

    const scanSideEffectsBefore = {
      orders: (await db.get('SELECT COUNT(*) count FROM orders;')).count,
      receipts: (await db.get('SELECT COUNT(*) count FROM receipts;')).count,
      payments: (await db.get('SELECT COUNT(*) count FROM payments;')).count,
      inventory: (await db.get('SELECT COUNT(*) count FROM inventory_ledger;')).count,
    };
    const invoiceScanRes = await fetch(`${BASE_URL}/api/pos/scan/resolve`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${cashierToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ code: invoiceToken }),
    });
    assert.strictEqual(invoiceScanRes.status, 200);
    const invoiceScanData = await invoiceScanRes.json();
    assert.strictEqual(invoiceScanData.data.type, 'invoice');
    assert.strictEqual(invoiceScanData.data.action, 'READ_ONLY');
    assert.strictEqual(invoiceScanData.data.data.id, testOrderId);
    const scanSideEffectsAfter = {
      orders: (await db.get('SELECT COUNT(*) count FROM orders;')).count,
      receipts: (await db.get('SELECT COUNT(*) count FROM receipts;')).count,
      payments: (await db.get('SELECT COUNT(*) count FROM payments;')).count,
      inventory: (await db.get('SELECT COUNT(*) count FROM inventory_ledger;')).count,
    };
    assert.deepStrictEqual(
      scanSideEffectsAfter,
      scanSideEffectsBefore,
      'invoice QR resolution must be side-effect free'
    );
    console.log(`✔ Checkout success! Receipt ID: ${testReceiptId}, Order ID: ${testOrderId}`);

    console.log('\n[POS SERVICE] Testing return items for order...');
    const unauthorizedLegacyReturn = await fetch(
      `${BASE_URL}/api/pos/orders/${testOrderId}/return`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${cashierToken}`,
          'Content-Type': 'application/json',
          'Idempotency-Key': 'services-order-return-without-card',
        },
        body: JSON.stringify({
          items: [{ productId: testProductId, quantity: 1 }],
          payments: [{ method: 'Cash', amount: 11000 }],
        }),
      }
    );
    assert.strictEqual(unauthorizedLegacyReturn.status, 409);
    assertApiError(await unauthorizedLegacyReturn.json(), 'RETURN_AUTHORIZATION_REQUIRED');

    const returnQuoteRes = await fetch(`${BASE_URL}/api/admin/return-authorizations/quote`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        orderId: testOrderId,
        items: [{ orderItemId: returnOrderItemId, quantity: 1, disposition: 'RESTOCK' }],
      }),
    });
    assert.strictEqual(returnQuoteRes.status, 200);
    const returnQuote = (await returnQuoteRes.json()).data;
    assert.strictEqual(returnQuote.totalRefund, 11000);

    const issueReturnRes = await fetch(`${BASE_URL}/api/admin/return-authorizations`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': 'services-order-return-issue-001',
      },
      body: JSON.stringify({
        orderId: testOrderId,
        reason: 'Service integration return',
        items: [{ orderItemId: returnOrderItemId, quantity: 1, disposition: 'RESTOCK' }],
      }),
    });
    assert.strictEqual(issueReturnRes.status, 201);
    const issuedReturn = (await issueReturnRes.json()).data;
    const externalAllocation = issuedReturn.allocations.find(
      (allocation) => allocation.refundMode === 'EXTERNAL_REFERENCE'
    );
    assert.ok(externalAllocation);

    const returnScanBefore = await db.get('SELECT COUNT(*) AS count FROM returns;');
    const returnScanRes = await fetch(`${BASE_URL}/api/pos/scan/resolve`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${cashierToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ code: issuedReturn.qrToken }),
    });
    assert.strictEqual(returnScanRes.status, 200);
    const returnScan = (await returnScanRes.json()).data;
    assert.strictEqual(returnScan.type, 'return_authorization');
    assert.strictEqual(returnScan.action, 'RETURN_REVIEW');
    assert.deepStrictEqual(
      await db.get('SELECT COUNT(*) AS count FROM returns;'),
      returnScanBefore
    );

    const returnRes = await fetch(`${BASE_URL}/api/pos/return-authorizations/execute`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${cashierToken}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': 'services-order-return-execute-001',
      },
      body: JSON.stringify({
        token: issuedReturn.qrToken,
        refundReferences: [
          { allocationId: externalAllocation.id, referenceNumber: 'SERVICES-REFUND-001' },
        ],
      }),
    });
    assert.strictEqual(returnRes.status, 201);
    const returnData = (await returnRes.json()).data;
    assert.strictEqual(returnData.totalRefunded, 11000);
    assert.ok(returnData.receiptId);
    console.log('✔ Admin-authorized return order processed.');

    console.log('\n[PREORDERS SERVICE] Reducing physical stock to exactly zero...');
    const stockBeforePreorderRes = await fetch(`${BASE_URL}/api/products/${testProductId}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.strictEqual(stockBeforePreorderRes.status, 200);
    const stockBeforePreorderData = await stockBeforePreorderRes.json();
    const stockBeforePreorder = Number(
      stockBeforePreorderData.data.stock ?? stockBeforePreorderData.data.stock_on_hand ?? 0
    );
    assert.ok(
      stockBeforePreorder > 0,
      'sale/return fixture should leave positive stock before depletion'
    );
    const depleteStockRes = await fetch(`${BASE_URL}/api/admin/inventory/adjust`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': 'services-inventory-deplete-001',
      },
      body: JSON.stringify({
        product_id: testProductId,
        adjustment_type: 'SUB',
        quantity: stockBeforePreorder,
        notes: 'Test fixture: reach zero stock before preorder',
      }),
    });
    assert.strictEqual(depleteStockRes.status, 200);

    // ------------------------------------------------------------------------
    // 10. PREORDERS SERVICE TESTS
    // ------------------------------------------------------------------------
    console.log('\n[PREORDERS SERVICE] Creating preorder...');
    const preorderRes = await fetch(`${BASE_URL}/api/pos/preorders`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${cashierToken}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': 'services-preorder-create-001',
      },
      body: JSON.stringify({
        customerName: 'صلاح الدين',
        customerPhone: '01511223344',
        items: [{ product_id: testProductId, quantity: 3, price_tier_id: 1 }],
        depositPaid: 18000, // 180 EGP deposit (subtotal is 360)
        payments: [{ method: 'Cash', amount: 18000, cashReceived: 18000 }],
      }),
    });
    if (preorderRes.status !== 201) {
      const errBody = await preorderRes.json().catch(() => ({}));
      console.error('Preorder creation failed error:', errBody);
    }
    assert.strictEqual(preorderRes.status, 201);
    const preorderData = await preorderRes.json();
    testPreorderId = preorderData.data.id;
    testPreorderToken = preorderData.data.qr_pickup_token;
    console.log(`✔ Preorder created. ID: ${testPreorderId}, token: ${testPreorderToken}`);

    console.log('\n[PREORDERS SERVICE] Listing preorders (Admin)...');
    const getPreordersRes = await fetch(`${BASE_URL}/api/admin/preorders`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.strictEqual(getPreordersRes.status, 200);
    const getPreordersData = await getPreordersRes.json();
    assert.ok(getPreordersData.data.some((p) => p.id === testPreorderId));

    const cashierPreorderSearchRes = await fetch(
      `${BASE_URL}/api/pos/preorders/search?q=${encodeURIComponent('01511223344')}`,
      { headers: { Authorization: `Bearer ${cashierToken}` } }
    );
    assert.strictEqual(cashierPreorderSearchRes.status, 200);
    assert.ok(
      (await cashierPreorderSearchRes.json()).data.some(
        (preorder) => preorder.id === testPreorderId
      )
    );
    console.log('✔ Preorders listed in admin tracker.');

    console.log('\n[PREORDERS SERVICE] Scanning pickup token...');
    const scanPickupRes = await fetch(`${BASE_URL}/api/pos/preorders/scan`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${cashierToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ token: testPreorderToken }),
    });
    assert.strictEqual(scanPickupRes.status, 200);
    const scanPickupData = await scanPickupRes.json();
    assert.strictEqual(scanPickupData.data.preorder.id, testPreorderId);
    console.log('✔ Pickup scan matched.');

    console.log('\n[PREORDERS SERVICE] Receiving stock and marking preorder ready...');
    const receivePreorderStockRes = await fetch(`${BASE_URL}/api/admin/inventory/adjust`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': 'services-inventory-receive-001',
      },
      body: JSON.stringify({
        product_id: testProductId,
        adjustment_type: 'STOCK_IN',
        quantity: 3,
        notes: 'Test fixture: stock received for preorder pickup',
      }),
    });
    assert.strictEqual(receivePreorderStockRes.status, 200);

    const markReadyRes = await fetch(`${BASE_URL}/api/admin/preorders/${testPreorderId}/status`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ status: 'READY_FOR_PICKUP' }),
    });
    assert.strictEqual(markReadyRes.status, 200);

    console.log('\n[PREORDERS SERVICE] Finalizing pickup checkout...');
    const pickupCheckoutRes = await fetch(
      `${BASE_URL}/api/pos/preorders/${testPreorderId}/pickup`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${cashierToken}`,
          'Content-Type': 'application/json',
          'Idempotency-Key': 'services-preorder-pickup-001',
        },
        body: JSON.stringify({
          payments: [{ method: 'Cash', amount: 18000, cashReceived: 18000 }],
        }),
      }
    );
    if (pickupCheckoutRes.status !== 200) {
      const errBody = await pickupCheckoutRes.json().catch(() => ({}));
      console.error('Preorder pickup failed error:', errBody);
    }
    assert.strictEqual(pickupCheckoutRes.status, 200);
    console.log('✔ Preorder pickup completed.');

    // ------------------------------------------------------------------------
    // 11. RECEIPTS SERVICE TESTS
    // ------------------------------------------------------------------------
    console.log('\n[RECEIPTS SERVICE] Getting receipt details...');
    const getReceiptRes = await fetch(`${BASE_URL}/api/pos/receipts/${testReceiptId}`, {
      headers: { Authorization: `Bearer ${cashierToken}` },
    });
    assert.strictEqual(getReceiptRes.status, 200);
    const getReceiptData = await getReceiptRes.json();
    assert.strictEqual(getReceiptData.data.id, testReceiptId);

    const unauthenticatedPrintRequestRes = await fetch(
      `${BASE_URL}/api/pos/receipts/${testReceiptId}/print-request`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestKey: 'services-unauth-print-001', copies: 1 }),
      }
    );
    assert.strictEqual(unauthenticatedPrintRequestRes.status, 401);
    assertApiError(await unauthenticatedPrintRequestRes.json(), 'UNAUTHORIZED');

    const printRequestRes = await fetch(
      `${BASE_URL}/api/pos/receipts/${testReceiptId}/print-request`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${cashierToken}`,
          'Content-Type': 'application/json',
          'Idempotency-Key': 'services-receipt-print-001',
        },
        body: JSON.stringify({ copies: 1, isReprint: false }),
      }
    );
    assert.strictEqual(printRequestRes.status, 200);
    assert.strictEqual(printRequestRes.headers.get('idempotency-replayed'), 'false');
    assert.ok((await printRequestRes.json()).data.request_id);
    console.log('✔ Receipt details loaded.');

    console.log('\n[RECEIPTS SERVICE] Reprinting receipt ticket...');
    const reprintRes = await fetch(`${BASE_URL}/api/pos/receipts/${testReceiptId}/reprint`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${cashierToken}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': 'services-receipt-reprint-001',
      },
      body: JSON.stringify({ reason: 'طلب العميل نسخة إضافية للمحاسب' }),
    });
    assert.strictEqual(reprintRes.status, 200);
    console.log('✔ Receipt reprint completed.');

    const closeForRejectRes = await fetch(`${BASE_URL}/api/shifts/current/close-request`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${cashierToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ actualClosingCash: 0, cashierNote: 'Exercise Admin rejection flow' }),
    });
    assert.strictEqual(closeForRejectRes.status, 200);

    const cashierAllShiftsRes = await fetch(`${BASE_URL}/api/shifts/all`, {
      headers: { Authorization: `Bearer ${cashierToken}` },
    });
    assert.strictEqual(cashierAllShiftsRes.status, 403);
    assertApiError(await cashierAllShiftsRes.json(), 'FORBIDDEN');

    const allShiftsRes = await fetch(`${BASE_URL}/api/shifts/all?status=PENDING_ADMIN_REVIEW`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.strictEqual(allShiftsRes.status, 200);
    const pendingShift = (await allShiftsRes.json()).data.find(
      (shift) => shift.status === 'PENDING_ADMIN_REVIEW'
    );
    assert.ok(pendingShift);

    const shiftDetailRes = await fetch(`${BASE_URL}/api/shifts/${pendingShift.id}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.strictEqual(shiftDetailRes.status, 200);
    assert.strictEqual((await shiftDetailRes.json()).data.shift.id, pendingShift.id);

    const rejectShiftRes = await fetch(`${BASE_URL}/api/shifts/${pendingShift.id}/reject`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ reason: 'Cashier must recount the drawer' }),
    });
    assert.strictEqual(rejectShiftRes.status, 200);
    assert.strictEqual((await rejectShiftRes.json()).data.shift.status, 'OPEN');

    // ------------------------------------------------------------------------
    // 12. REPORTS SERVICE TESTS
    // ------------------------------------------------------------------------
    console.log('\n[REPORTS SERVICE] Loading KPIs dashboard indicators...');
    const kpiRes = await fetch(`${BASE_URL}/api/admin/kpis`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.strictEqual(kpiRes.status, 200);
    console.log('✔ KPIs indicators loaded.');

    console.log('\n[REPORTS SERVICE] Fetching sales reports...');
    const rSalesRes = await fetch(
      `${BASE_URL}/api/admin/reports/sales?startDate=2026-01-01&endDate=2026-12-31`,
      {
        headers: { Authorization: `Bearer ${adminToken}` },
      }
    );
    assert.strictEqual(rSalesRes.status, 200);
    const otherCategory = getCatsData.data.find((category) => category.id !== testCategoryId);
    assert.ok(otherCategory);
    const [matchingCategorySalesRes, otherCategorySalesRes] = await Promise.all([
      fetch(`${BASE_URL}/api/admin/reports/sales?categoryId=${testCategoryId}`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      }),
      fetch(`${BASE_URL}/api/admin/reports/sales?categoryId=${otherCategory.id}`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      }),
    ]);
    assert.strictEqual(matchingCategorySalesRes.status, 200);
    assert.strictEqual(otherCategorySalesRes.status, 200);
    const matchingCategorySales = await matchingCategorySalesRes.json();
    const otherCategorySales = await otherCategorySalesRes.json();
    assert.ok(matchingCategorySales.data.total > 0);
    assert.strictEqual(otherCategorySales.data.total, 0);
    console.log('✔ Sales reports loaded.');

    const [rInvoicesRes, rPaymentsRes, rCashiersRes] = await Promise.all([
      fetch(
        `${BASE_URL}/api/admin/reports/invoices?invoiceNumber=${encodeURIComponent(invoiceNumber)}&paymentMethod=Cash`,
        {
          headers: { Authorization: `Bearer ${adminToken}` },
        }
      ),
      fetch(
        `${BASE_URL}/api/admin/reports/payments?method=Cash&startDate=2026-01-01&endDate=2026-12-31`,
        {
          headers: { Authorization: `Bearer ${adminToken}` },
        }
      ),
      fetch(`${BASE_URL}/api/admin/reports/cashiers?startDate=2026-01-01&endDate=2026-12-31`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      }),
    ]);
    assert.strictEqual(rInvoicesRes.status, 200);
    assert.strictEqual(rPaymentsRes.status, 200);
    assert.strictEqual(rCashiersRes.status, 200);
    const rInvoicesData = await rInvoicesRes.json();
    assert.strictEqual(rInvoicesData.data.total, 1);

    console.log('\n[REPORTS SERVICE] Fetching preorders reports...');
    const rPreRes = await fetch(
      `${BASE_URL}/api/admin/reports/preorders?startDate=2026-01-01&endDate=2026-12-31`,
      {
        headers: { Authorization: `Bearer ${adminToken}` },
      }
    );
    assert.strictEqual(rPreRes.status, 200);
    console.log('✔ Preorders reports loaded.');

    console.log('\n[REPORTS SERVICE] Fetching inventory warnings reports...');
    const rInvRes = await fetch(`${BASE_URL}/api/admin/reports/inventory`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.strictEqual(rInvRes.status, 200);
    console.log('✔ Inventory warnings loaded.');

    console.log('\n[REPORTS SERVICE] Fetching shifts reports...');
    const rShiftsRes = await fetch(
      `${BASE_URL}/api/admin/reports/shifts?startDate=2026-01-01&endDate=2026-12-31`,
      {
        headers: { Authorization: `Bearer ${adminToken}` },
      }
    );
    assert.strictEqual(rShiftsRes.status, 200);
    console.log('✔ Shifts reports loaded.');

    console.log('\n[REPORTS SERVICE] Exporting data formats...');
    const rExportRes = await fetch(
      `${BASE_URL}/api/admin/reports/export?type=sales&format=csv&startDate=2026-01-01&endDate=2026-12-31`,
      {
        headers: { Authorization: `Bearer ${adminToken}` },
      }
    );
    assert.strictEqual(rExportRes.status, 200);
    console.log('✔ Export format generated.');

    // ------------------------------------------------------------------------
    // 13. PRINTER SETTINGS SERVICE TESTS
    // ------------------------------------------------------------------------
    console.log('\n[PRINTERS SERVICE] Loading settings configurations...');
    const getPrnRes = await fetch(`${BASE_URL}/api/admin/printer-settings`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.strictEqual(getPrnRes.status, 200);
    const getPrnData = await getPrnRes.json();
    assert.strictEqual(getPrnData.data.print_mode, 'browser');
    assert.ok(Object.hasOwn(getPrnData.data, 'qr_printer_width'));
    assert.ok(Object.hasOwn(getPrnData.data, 'qr_printer_height'));
    assert.ok(Object.hasOwn(getPrnData.data, 'qr_label_count'));
    assert.ok(!Object.hasOwn(getPrnData.data, 'receipt_printer_type'));
    assert.ok(!Object.hasOwn(getPrnData.data, 'receipt_printer_address'));
    assert.ok(!Object.hasOwn(getPrnData.data, 'qr_printer_type'));
    assert.ok(!Object.hasOwn(getPrnData.data, 'qr_printer_address'));

    const safePrinterSettingsRes = await fetch(`${BASE_URL}/api/printer-settings`, {
      headers: { Authorization: `Bearer ${cashierToken}` },
    });
    assert.strictEqual(safePrinterSettingsRes.status, 200);
    const safePrinterSettingsData = (await safePrinterSettingsRes.json()).data;
    assert.deepStrictEqual(
      Object.keys(safePrinterSettingsData).sort(),
      Object.keys(getPrnData.data).sort()
    );

    const unauthenticatedPrinterSettingsRes = await fetch(`${BASE_URL}/api/printer-settings`);
    assert.strictEqual(unauthenticatedPrinterSettingsRes.status, 401);
    assertApiError(await unauthenticatedPrinterSettingsRes.json(), 'UNAUTHORIZED');
    console.log('✔ Settings loaded.');

    console.log('\n[PRINTERS SERVICE] Updating printer parameters...');
    const savePrnRes = await fetch(`${BASE_URL}/api/admin/printer-settings`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ...getPrnData.data,
        receipt_printer_width: '80mm',
        print_show_customer: 'true',
        qr_printer_width: '38',
        qr_printer_height: '25',
        qr_label_count: '4',
        receipt_printer_type: 'legacy-value-must-be-ignored',
        qr_printer_address: 'legacy-secret-must-be-ignored',
      }),
    });
    assert.strictEqual(savePrnRes.status, 200);
    const savePrnData = await savePrnRes.json();
    assert.strictEqual(savePrnData.data.qr_printer_width, '38');
    assert.strictEqual(savePrnData.data.qr_printer_height, '25');
    assert.strictEqual(savePrnData.data.qr_label_count, '4');
    assert.ok(!Object.hasOwn(savePrnData.data, 'receipt_printer_type'));
    assert.ok(!Object.hasOwn(savePrnData.data, 'qr_printer_address'));

    const unsupportedPrintModeRes = await fetch(`${BASE_URL}/api/admin/printer-settings`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ print_mode: 'kiosk' }),
    });
    assert.strictEqual(unsupportedPrintModeRes.status, 400);
    const unsupportedPrintModeData = await unsupportedPrintModeRes.json();
    assert.strictEqual(unsupportedPrintModeData.code, 'VALIDATION_ERROR');
    assert.ok(Array.isArray(unsupportedPrintModeData.details));
    console.log('✔ Settings saved.');

    // ------------------------------------------------------------------------
    // 14. AUDIT LOGS SERVICE TESTS
    // ------------------------------------------------------------------------
    console.log('\n[AUDIT SERVICE] Checking log audit trails...');
    const getLogsRes = await fetch(`${BASE_URL}/api/admin/audit-logs`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.strictEqual(getLogsRes.status, 200);
    const getLogsData = await getLogsRes.json();
    assert.ok(getLogsData.data.logs.length > 0);
    assert.ok(getLogsData.data.pagination.limit >= 1 && getLogsData.data.pagination.limit <= 100);
    const invalidAuditPageRes = await fetch(`${BASE_URL}/api/admin/audit-logs?limit=101`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.strictEqual(invalidAuditPageRes.status, 400);
    assertApiError(await invalidAuditPageRes.json(), 'VALIDATION_ERROR');
    console.log('✔ Audit logs successfully fetched.');

    console.log('\n========================================');
    console.log(' ALL INTEGRATION SERVICE TESTS PASSED!');
    console.log('========================================');
  } catch (error) {
    console.error('\n❌ SERVICE TESTS RUN FAILED:', error.stack || error.message);
    process.exitCode = 1;
  } finally {
    // Shutdown temporary server
    console.log('\nStopping test server...');
    await closeTestServer(server);
  }
}

try {
  await runServicesTests();
} catch (error) {
  console.error('\n❌ SERVICE TEST SETUP FAILED:', error.stack || error.message);
  process.exitCode = 1;
} finally {
  await closeTestServer(server);
  await disposeTestEnvironment(testEnvironment, db);
}

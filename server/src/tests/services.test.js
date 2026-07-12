import assert from 'assert';
import http from 'http';
import {
  closeTestServer,
  createTestEnvironment,
  disposeTestEnvironment
} from './test-environment.js';

let server;
let db;
const testEnvironment = createTestEnvironment('services');

async function runServicesTests() {
  console.log('========================================');
  console.log(' STARTING COMPREHENSIVE SERVICE TESTS');
  console.log('========================================');

  const [{ default: app }, dbModule, migrationModule] = await Promise.all([
    import('../app.js'),
    import('../db/index.js'),
    import('../db/migrate.js')
  ]);
  db = dbModule.default;
  assert.strictEqual(dbModule.dbPath, testEnvironment.databasePath, 'service test must use its isolated database');
  await migrationModule.runMigrations();
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

    // ------------------------------------------------------------------------
    // SETUP: LOGIN AUTHENTICATION
    // ------------------------------------------------------------------------
    console.log('\n[AUTH SERVICE] Logging in as Admin...');
    const loginAdminRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'admin123' })
    });
    assert.strictEqual(loginAdminRes.status, 200);
    const adminLoginData = await loginAdminRes.json();
    adminToken = adminLoginData.data.accessToken;
    console.log('✔ Admin logged in.');

    console.log('\n[AUTH SERVICE] Logging in as Cashier...');
    const loginCashierRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'cashier', password: 'cashier123' })
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
        'Authorization': `Bearer ${adminToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: 'كاشير فحص',
        username: 'cashier_test_service',
        password: 'password123',
        phone: '01200000000',
        role: 'Cashier'
      })
    });
    assert.strictEqual(createUserRes.status, 201);
    const createUserData = await createUserRes.json();
    testUserId = createUserData.data.id;
    console.log(`✔ Cashier created with ID: ${testUserId}`);

    console.log('\n[USERS SERVICE] Modifying user details...');
    const updateUserRes = await fetch(`${BASE_URL}/api/admin/users/${testUserId}`, {
      method: 'PATCH',
      headers: { 
        'Authorization': `Bearer ${adminToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: 'كاشير فحص معدل',
        phone: '01233333333'
      })
    });
    assert.strictEqual(updateUserRes.status, 200);
    console.log('✔ User details modified.');

    console.log('\n[USERS SERVICE] Updating user password...');
    const updatePasswordRes = await fetch(`${BASE_URL}/api/admin/users/${testUserId}/password`, {
      method: 'PATCH',
      headers: { 
        'Authorization': `Bearer ${adminToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        password: 'newpassword123'
      })
    });
    assert.strictEqual(updatePasswordRes.status, 200);
    console.log('✔ User password updated.');

    console.log('\n[USERS SERVICE] Disabling user...');
    const disableUserRes = await fetch(`${BASE_URL}/api/admin/users/${testUserId}/disable`, {
      method: 'PATCH',
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    assert.strictEqual(disableUserRes.status, 200);
    console.log('✔ User account disabled.');

    console.log('\n[USERS SERVICE] Enabling user...');
    const enableUserRes = await fetch(`${BASE_URL}/api/admin/users/${testUserId}/enable`, {
      method: 'PATCH',
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    assert.strictEqual(enableUserRes.status, 200);
    console.log('✔ User account re-enabled.');

    console.log('\n[USERS SERVICE] Listing all users...');
    const listUsersRes = await fetch(`${BASE_URL}/api/admin/users`, {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    assert.strictEqual(listUsersRes.status, 200);
    const listUsersData = await listUsersRes.json();
    assert.ok(Array.isArray(listUsersData.data));
    const foundUser = listUsersData.data.find(u => u.id === testUserId);
    assert.ok(foundUser, 'Should find the newly created user in the list');
    console.log('✔ Users listed successfully.');

    // ------------------------------------------------------------------------
    // 2. CATEGORIES SERVICE TESTS
    // ------------------------------------------------------------------------
    console.log('\n[CATEGORIES SERVICE] Creating category...');
    const createCatRes = await fetch(`${BASE_URL}/api/admin/categories`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${adminToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: 'دفاتر كشكول',
        description: 'دفاتر وكشاكيل دراسية ومكتبية'
      })
    });
    assert.strictEqual(createCatRes.status, 201);
    const createCatData = await createCatRes.json();
    testCategoryId = createCatData.data.id;
    console.log(`✔ Category created with ID: ${testCategoryId}`);

    console.log('\n[CATEGORIES SERVICE] Listing categories...');
    const getCatsRes = await fetch(`${BASE_URL}/api/categories`, {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    assert.strictEqual(getCatsRes.status, 200);
    const getCatsData = await getCatsRes.json();
    assert.ok(getCatsData.data.some(c => c.id === testCategoryId));
    console.log('✔ Categories list verified.');

    console.log('\n[CATEGORIES SERVICE] Updating category...');
    const updateCatRes = await fetch(`${BASE_URL}/api/admin/categories/${testCategoryId}`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${adminToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: 'كشاكيل ودفاتر فاخرة',
        description: 'دفاتر دراسية ومكتبية معدلة'
      })
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
        'Authorization': `Bearer ${adminToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: 'جملة تجاري خاص',
        description: 'فئة الأسعار المخصصة للمحلات التجارية الكبرى'
      })
    });
    assert.strictEqual(createPTRes.status, 201);
    const createPTData = await createPTRes.json();
    testPriceTierId = createPTData.data.id;
    console.log(`✔ Price tier created with ID: ${testPriceTierId}`);

    console.log('\n[PRICE TIERS SERVICE] Listing price tiers...');
    const getPTsRes = await fetch(`${BASE_URL}/api/admin/price-tiers`, {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    assert.strictEqual(getPTsRes.status, 200);
    const getPTsData = await getPTsRes.json();
    assert.ok(getPTsData.data.some(pt => pt.id === testPriceTierId));
    console.log('✔ Price tiers list verified.');

    console.log('\n[PRICE TIERS SERVICE] Updating price tier...');
    const updatePTRes = await fetch(`${BASE_URL}/api/admin/price-tiers/${testPriceTierId}`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${adminToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: 'جملة تجاري مخفض جداً',
        description: 'تعديل الوصف لفئة السعر التجاري'
      })
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
        'Authorization': `Bearer ${adminToken}`,
        'Content-Type': 'application/json'
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
          price: tier.id === testPriceTierId ? 10000 : 12000
        }))
      })
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
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    assert.strictEqual(getProdRes.status, 200);
    const getProdData = await getProdRes.json();
    assert.strictEqual(getProdData.data.name, 'كشكول سلك مسطر A4');
    console.log('✔ Product details verified.');

    console.log('\n[PRODUCTS SERVICE] Generating QR labels...');
    const printQRRes = await fetch(`${BASE_URL}/api/admin/products/${testProductId}/qr-labels`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${adminToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ quantity: 10, label_size: '50x25' })
    });
    assert.strictEqual(printQRRes.status, 200);
    const printQRData = await printQRRes.json();
    assert.ok(printQRData.data.token);
    console.log('✔ QR labels token generated.');

    console.log('\n[PRODUCTS SERVICE] Verifying legacy print preview is retired...');
    const printJobRes = await fetch(`${BASE_URL}/api/admin/print-job/${printQRData.data.token}?qty=5&size=medium`, {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
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
        'Authorization': `Bearer ${adminToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        product_id: testProductId,
        adjustment_type: 'ADD',
        quantity: 30,
        notes: 'إضافة رصيد استلام بضاعة جديدة'
      })
    });
    if (adjustStockRes.status !== 200) {
      const errBody = await adjustStockRes.json().catch(() => ({}));
      console.error('Stock adjustment failed body:', errBody);
    }
    assert.strictEqual(adjustStockRes.status, 200);
    console.log('✔ Stock successfully adjusted.');

    console.log('\n[INVENTORY SERVICE] Listing ledger logs...');
    const getInvRes = await fetch(`${BASE_URL}/api/admin/inventory?productId=${testProductId}`, {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    assert.strictEqual(getInvRes.status, 200);
    const getInvData = await getInvRes.json();
    assert.ok(getInvData.data.ledger.length > 0);
    assert.ok(getInvData.data.ledger.some(log => log.quantity_changed === 30));
    console.log('✔ Inventory logs listed.');

    // ------------------------------------------------------------------------
    // 6. PAYMENTS SERVICE TESTS
    // ------------------------------------------------------------------------
    console.log('\n[PAYMENTS SERVICE] Getting active payment channels...');
    const getPayRes = await fetch(`${BASE_URL}/api/payment-methods`, {
      headers: { 'Authorization': `Bearer ${adminToken}` }
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
        'Authorization': `Bearer ${adminToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        active_ids: getPayData.data.map(m => m.id)
      })
    });
    if (updatePayRes.status !== 200) {
      const errBody = await updatePayRes.json().catch(() => ({}));
      console.error('Update payments failed body:', errBody);
    }
    assert.strictEqual(updatePayRes.status, 200);
    console.log('✔ Payment configurations saved.');

    // ------------------------------------------------------------------------
    // 7. CUSTOMERS SERVICE TESTS
    // ------------------------------------------------------------------------
    console.log('\n[CUSTOMERS SERVICE] Registering new customer...');
    const createCustRes = await fetch(`${BASE_URL}/api/customers`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${adminToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: 'عميل تجربة الخدمة',
        phone: '01099998888',
        email: 'customer@test-service.com'
      })
    });
    assert.strictEqual(createCustRes.status, 201);
    const createCustData = await createCustRes.json();
    testCustomerId = createCustData.data.id;
    console.log(`✔ Customer registered with ID: ${testCustomerId}`);

    console.log('\n[CUSTOMERS SERVICE] Searching registered customers...');
    const searchCustRes = await fetch(`${BASE_URL}/api/customers?q=01099998888`, {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    assert.strictEqual(searchCustRes.status, 200);
    const searchCustData = await searchCustRes.json();
    assert.ok(searchCustData.data.some(c => c.id === testCustomerId));
    console.log('✔ Customer search matched.');

    // ------------------------------------------------------------------------
    // 8. SHIFTS SERVICE TESTS
    // ------------------------------------------------------------------------
    console.log('\n[SHIFTS SERVICE] Checking shift endpoints...');
    // We already have a cashier shift open in smoke test, but let's do cash movement / close / approve flows
    const getCurrentShiftRes = await fetch(`${BASE_URL}/api/shifts/current`, {
      headers: { 'Authorization': `Bearer ${cashierToken}` }
    });
    assert.strictEqual(getCurrentShiftRes.status, 200);
    const currentShiftData = await getCurrentShiftRes.json();
    testShiftId = currentShiftData.data ? currentShiftData.data.id : null;

    if (!testShiftId) {
      console.log('No shift active, opening test shift...');
      const openShiftRes = await fetch(`${BASE_URL}/api/shifts/open`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${cashierToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ openingCash: 100000 }) // 1000 EGP in piastres
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
        'Authorization': `Bearer ${cashierToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        type: 'PAY_OUT',
        amount: 5000, // 50 EGP
        notes: 'شراء ضيافة شاي وقهوة'
      })
    });
    assert.strictEqual(cashMoveRes.status, 200);
    console.log('✔ Cash movement registered.');

    console.log('\n[SHIFTS SERVICE] Loading cashier shift metrics summary...');
    const getSummaryRes = await fetch(`${BASE_URL}/api/shifts/current/summary`, {
      headers: { 'Authorization': `Bearer ${cashierToken}` }
    });
    assert.strictEqual(getSummaryRes.status, 200);
    const summaryData = await getSummaryRes.json();
    assert.ok(summaryData.data.shift.opening_cash);
    console.log('✔ Session metrics loaded.');

    console.log('\n[SHIFTS SERVICE] Requesting shift close...');
    const reqCloseRes = await fetch(`${BASE_URL}/api/shifts/current/close-request`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${cashierToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        actualClosingCash: 95000 // 950 EGP (variance check)
      })
    });
    assert.strictEqual(reqCloseRes.status, 200);
    console.log('✔ Shift close requested.');

    console.log('\n[SHIFTS SERVICE] Listing pending review shifts (Admin)...');
    const getPendingRes = await fetch(`${BASE_URL}/api/shifts/pending-review`, {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    assert.strictEqual(getPendingRes.status, 200);
    const pendingData = await getPendingRes.json();
    assert.ok(pendingData.data.some(s => s.id === testShiftId));
    console.log('✔ Shift found in pending queue.');

    console.log('\n[SHIFTS SERVICE] Approving shift close (Admin)...');
    const approveShiftRes = await fetch(`${BASE_URL}/api/shifts/${testShiftId}/approve`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${adminToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ notes: 'تمت الموافقة ومطابقة العجز المذكور' })
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
        'Authorization': `Bearer ${cashierToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ openingCash: 100000 })
    });
    assert.strictEqual(openShift2Res.status, 200);

    console.log('\n[POS SERVICE] Scanning product barcode...');
    const scanProdRes = await fetch(`${BASE_URL}/api/pos/scan-product`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${cashierToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ code: '6221100220033' })
    });
    assert.strictEqual(scanProdRes.status, 200);
    const scanProdData = await scanProdRes.json();
    assert.strictEqual(scanProdData.data.sku, 'SKU-KASHK-A4-WIRE');
    console.log('✔ Scan matched Rotring Pen.');

    console.log('\n[POS SERVICE] Searching catalog items in POS search index...');
    const posSearchRes = await fetch(`${BASE_URL}/api/pos/products/search?q=كشكول`, {
      headers: { 'Authorization': `Bearer ${cashierToken}` }
    });
    assert.strictEqual(posSearchRes.status, 200);
    const posSearchData = await posSearchRes.json();
    assert.ok(posSearchData.data.some(p => p.id === testProductId));
    console.log('✔ Search index matched Rotring Pen.');

    console.log('\n[POS SERVICE] Checkout order with split payments...');
    const checkoutRes = await fetch(`${BASE_URL}/api/pos/orders/checkout`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${cashierToken}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': 'services-sale-checkout-001'
      },
      body: JSON.stringify({
        customerId: testCustomerId,
        items: [{ product_id: testProductId, quantity: 2, price_tier_id: 1 }],
        discount: 2000, // 20 EGP discount
        payments: [
          { method: 'Cash', amount: 12000, cashReceived: 15000 }, // 120 EGP applied, 150 EGP tendered
          { method: 'Card', amount: 10000 }   // 100 EGP card (subtotal is 240, net is 220)
        ]
      })
    });
    assert.strictEqual(checkoutRes.status, 201);
    const checkoutData = await checkoutRes.json();
    testReceiptId = checkoutData.data.receipt_id;
    const testOrderId = checkoutData.data.id;
    console.log(`✔ Checkout success! Receipt ID: ${testReceiptId}, Order ID: ${testOrderId}`);

    console.log('\n[POS SERVICE] Testing return items for order...');
    const returnRes = await fetch(`${BASE_URL}/api/pos/orders/${testOrderId}/return`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${cashierToken}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': 'services-order-return-001'
      },
      body: JSON.stringify({
        items: [{ productId: testProductId, quantity: 1 }],
        payments: [{ method: 'Cash', amount: 11000, cashReceived: 11000 }]
      })
    });
    assert.strictEqual(returnRes.status, 201);
    console.log('✔ Return order processed.');

    console.log('\n[PREORDERS SERVICE] Reducing physical stock to exactly zero...');
    const stockBeforePreorderRes = await fetch(`${BASE_URL}/api/products/${testProductId}`, {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    assert.strictEqual(stockBeforePreorderRes.status, 200);
    const stockBeforePreorderData = await stockBeforePreorderRes.json();
    const stockBeforePreorder = Number(
      stockBeforePreorderData.data.stock ?? stockBeforePreorderData.data.stock_on_hand ?? 0
    );
    assert.ok(stockBeforePreorder > 0, 'sale/return fixture should leave positive stock before depletion');
    const depleteStockRes = await fetch(`${BASE_URL}/api/admin/inventory/adjust`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${adminToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        product_id: testProductId,
        adjustment_type: 'SUB',
        quantity: stockBeforePreorder,
        notes: 'Test fixture: reach zero stock before preorder'
      })
    });
    assert.strictEqual(depleteStockRes.status, 200);

    // ------------------------------------------------------------------------
    // 10. PREORDERS SERVICE TESTS
    // ------------------------------------------------------------------------
    console.log('\n[PREORDERS SERVICE] Creating preorder...');
    const preorderRes = await fetch(`${BASE_URL}/api/pos/preorders`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${cashierToken}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': 'services-preorder-create-001'
      },
      body: JSON.stringify({
        customerName: 'صلاح الدين',
        customerPhone: '01511223344',
        items: [{ product_id: testProductId, quantity: 3, price_tier_id: 1 }],
        depositPaid: 18000, // 180 EGP deposit (subtotal is 360)
        payments: [{ method: 'Cash', amount: 18000, cashReceived: 18000 }]
      })
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
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    assert.strictEqual(getPreordersRes.status, 200);
    const getPreordersData = await getPreordersRes.json();
    assert.ok(getPreordersData.data.some(p => p.id === testPreorderId));
    console.log('✔ Preorders listed in admin tracker.');

    console.log('\n[PREORDERS SERVICE] Scanning pickup token...');
    const scanPickupRes = await fetch(`${BASE_URL}/api/pos/preorders/scan`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${cashierToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ token: testPreorderToken })
    });
    assert.strictEqual(scanPickupRes.status, 200);
    const scanPickupData = await scanPickupRes.json();
    assert.strictEqual(scanPickupData.data.preorder.id, testPreorderId);
    console.log('✔ Pickup scan matched.');

    console.log('\n[PREORDERS SERVICE] Receiving stock and marking preorder ready...');
    const receivePreorderStockRes = await fetch(`${BASE_URL}/api/admin/inventory/adjust`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${adminToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        product_id: testProductId,
        adjustment_type: 'STOCK_IN',
        quantity: 3,
        notes: 'Test fixture: stock received for preorder pickup'
      })
    });
    assert.strictEqual(receivePreorderStockRes.status, 200);

    const markReadyRes = await fetch(`${BASE_URL}/api/admin/preorders/${testPreorderId}/status`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${adminToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ status: 'READY_FOR_PICKUP' })
    });
    assert.strictEqual(markReadyRes.status, 200);

    console.log('\n[PREORDERS SERVICE] Finalizing pickup checkout...');
    const pickupCheckoutRes = await fetch(`${BASE_URL}/api/pos/preorders/${testPreorderId}/pickup`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${cashierToken}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': 'services-preorder-pickup-001'
      },
      body: JSON.stringify({
        payments: [{ method: 'Cash', amount: 18000, cashReceived: 18000 }]
      })
    });
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
      headers: { 'Authorization': `Bearer ${cashierToken}` }
    });
    assert.strictEqual(getReceiptRes.status, 200);
    const getReceiptData = await getReceiptRes.json();
    assert.strictEqual(getReceiptData.data.id, testReceiptId);
    console.log('✔ Receipt details loaded.');

    console.log('\n[RECEIPTS SERVICE] Reprinting receipt ticket...');
    const reprintRes = await fetch(`${BASE_URL}/api/pos/receipts/${testReceiptId}/reprint`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${cashierToken}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': 'services-receipt-reprint-001'
      },
      body: JSON.stringify({ reason: 'طلب العميل نسخة إضافية للمحاسب' })
    });
    assert.strictEqual(reprintRes.status, 200);
    console.log('✔ Receipt reprint completed.');

    // ------------------------------------------------------------------------
    // 12. REPORTS SERVICE TESTS
    // ------------------------------------------------------------------------
    console.log('\n[REPORTS SERVICE] Loading KPIs dashboard indicators...');
    const kpiRes = await fetch(`${BASE_URL}/api/admin/kpis`, {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    assert.strictEqual(kpiRes.status, 200);
    console.log('✔ KPIs indicators loaded.');

    console.log('\n[REPORTS SERVICE] Fetching sales reports...');
    const rSalesRes = await fetch(`${BASE_URL}/api/admin/reports/sales?startDate=2026-01-01&endDate=2026-12-31`, {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    assert.strictEqual(rSalesRes.status, 200);
    console.log('✔ Sales reports loaded.');

    console.log('\n[REPORTS SERVICE] Fetching preorders reports...');
    const rPreRes = await fetch(`${BASE_URL}/api/admin/reports/preorders?startDate=2026-01-01&endDate=2026-12-31`, {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    assert.strictEqual(rPreRes.status, 200);
    console.log('✔ Preorders reports loaded.');

    console.log('\n[REPORTS SERVICE] Fetching inventory warnings reports...');
    const rInvRes = await fetch(`${BASE_URL}/api/admin/reports/inventory`, {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    assert.strictEqual(rInvRes.status, 200);
    console.log('✔ Inventory warnings loaded.');

    console.log('\n[REPORTS SERVICE] Fetching shifts reports...');
    const rShiftsRes = await fetch(`${BASE_URL}/api/admin/reports/shifts?startDate=2026-01-01&endDate=2026-12-31`, {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    assert.strictEqual(rShiftsRes.status, 200);
    console.log('✔ Shifts reports loaded.');

    console.log('\n[REPORTS SERVICE] Exporting data formats...');
    const rExportRes = await fetch(`${BASE_URL}/api/admin/reports/export?type=sales&format=csv&startDate=2026-01-01&endDate=2026-12-31`, {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    assert.strictEqual(rExportRes.status, 200);
    console.log('✔ Export format generated.');

    // ------------------------------------------------------------------------
    // 13. PRINTER SETTINGS SERVICE TESTS
    // ------------------------------------------------------------------------
    console.log('\n[PRINTERS SERVICE] Loading settings configurations...');
    const getPrnRes = await fetch(`${BASE_URL}/api/admin/printer-settings`, {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    assert.strictEqual(getPrnRes.status, 200);
    const getPrnData = await getPrnRes.json();
    console.log('✔ Settings loaded.');

    console.log('\n[PRINTERS SERVICE] Updating printer parameters...');
    const savePrnRes = await fetch(`${BASE_URL}/api/admin/printer-settings`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${adminToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        ...getPrnData.data,
        receipt_printer_width: '80mm',
        print_show_customer: 'true'
      })
    });
    assert.strictEqual(savePrnRes.status, 200);
    console.log('✔ Settings saved.');

    // ------------------------------------------------------------------------
    // 14. AUDIT LOGS SERVICE TESTS
    // ------------------------------------------------------------------------
    console.log('\n[AUDIT SERVICE] Checking log audit trails...');
    const getLogsRes = await fetch(`${BASE_URL}/api/admin/audit-logs`, {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    assert.strictEqual(getLogsRes.status, 200);
    const getLogsData = await getLogsRes.json();
    assert.ok(getLogsData.data.logs.length > 0);
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

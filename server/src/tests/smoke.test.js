import assert from 'assert';
import http from 'http';
import app from '../app.js';
import db from '../db/index.js';
import { runMigrations } from '../db/migrate.js';

const PORT = 5999;
const BASE_URL = `http://localhost:${PORT}`;

let server;

async function runTests() {
  console.log('========================================');
  console.log(' STARTING INTEGRATION SMOKE TESTS');
  console.log('========================================');

  // Perform database cleanup & fresh seeding
  try {
    await db.run('PRAGMA foreign_keys = OFF;');
    const tables = [
      'preorder_items', 'preorders', 'return_items', 'returns',
      'payments', 'order_items', 'orders', 'qr_tokens',
      'inventory_ledger', 'product_prices', 'product_book_details',
      'products', 'categories', 'price_tiers', 'users', 'customers',
      'printer_settings', 'shifts', 'cash_movements', 'audit_logs', 'sessions', 'sqlite_sequence'
    ];
    for (const table of tables) {
      try {
        await db.run(`DELETE FROM ${table}`);
      } catch (err) {
        console.error(`Failed to delete from ${table}:`, err.message);
        throw err;
      }
    }
    
    // Execute migrations with foreign keys temporarily disabled to prevent seed order conflicts
    await runMigrations();
    
    await db.run('PRAGMA foreign_keys = ON;');
    console.log('✔ Database reset and seeded.');
  } catch (dbErr) {
    console.error('Warning: DB reset failed:', dbErr.message);
  }

  // Start temporary test server
  server = http.createServer(app);
  await new Promise((resolve) => server.listen(PORT, resolve));
  console.log(`Test server listening on port ${PORT}`);

  try {
    let adminToken;
    let cashierToken;
    let targetProductId;
    let targetPriceTierId;

    // Test 1: Admin Login
    console.log('\nRunning: Admin Login...');
    const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'admin123' })
    });
    assert.strictEqual(loginRes.status, 200, 'Admin login should succeed');
    const loginData = await loginRes.json();
    assert.ok(loginData.data.accessToken, 'Should return accessToken');
    assert.strictEqual(loginData.data.user.role, 'Admin', 'Logged in user should be Admin');
    adminToken = loginData.data.accessToken;
    console.log('✔ Passed');

    // Test 2: Cashier Login
    console.log('\nRunning: Cashier Login...');
    const cashierLoginRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'cashier', password: 'cashier123' })
    });
    assert.strictEqual(cashierLoginRes.status, 200, 'Cashier login should succeed');
    const cashierLoginData = await cashierLoginRes.json();
    assert.ok(cashierLoginData.data.accessToken, 'Should return accessToken');
    assert.strictEqual(cashierLoginData.data.user.role, 'Cashier', 'Logged in user should be Cashier');
    cashierToken = cashierLoginData.data.accessToken;
    console.log('✔ Passed');

    // Test 3: Invalid Login
    console.log('\nRunning: Invalid Login check...');
    const invalidLoginRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'wrongpassword' })
    });
    assert.ok(invalidLoginRes.status === 400 || invalidLoginRes.status === 401, 'Should fail with 400 or 401');
    console.log('✔ Passed');

    // Test 4: Auth me endpoint (Admin)
    console.log('\nRunning: GET /api/auth/me (Admin)...');
    const meRes = await fetch(`${BASE_URL}/api/auth/me`, {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    assert.strictEqual(meRes.status, 200, 'GET me should succeed');
    const meData = await meRes.json();
    assert.strictEqual(meData.data.username, 'admin');
    console.log('✔ Passed');

    // Test 5: Get Catalog Categories
    console.log('\nRunning: GET /api/categories...');
    const catRes = await fetch(`${BASE_URL}/api/categories`, {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    assert.strictEqual(catRes.status, 200, 'GET categories should succeed');
    const catData = await catRes.json();
    assert.ok(Array.isArray(catData.data), 'Response data should be an array');
    console.log('✔ Passed');

    // Test 5b: Get Price Tiers Catalog
    console.log('\nRunning: GET /api/admin/price-tiers...');
    const ptRes = await fetch(`${BASE_URL}/api/admin/price-tiers`, {
      headers: { 'Authorization': `Bearer ${cashierToken}` }
    });
    assert.strictEqual(ptRes.status, 200, 'GET price-tiers should succeed');
    const ptData = await ptRes.json();
    console.log('Available Price Tiers:', ptData.data);
    assert.ok(Array.isArray(ptData.data), 'Response data should be an array');
    assert.ok(ptData.data.length > 0, 'Price tiers list should not be empty');
    targetPriceTierId = ptData.data.find(pt => pt.id === 1)?.id || ptData.data[0].id;
    console.log('✔ Passed');

    // Test 6: Get Products Catalog
    console.log('\nRunning: GET /api/products...');
    const prodRes = await fetch(`${BASE_URL}/api/products`, {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    assert.strictEqual(prodRes.status, 200, 'GET products should succeed');
    const prodData = await prodRes.json();
    assert.ok(Array.isArray(prodData.data), 'Response data should be an array');
    assert.ok(prodData.data.length > 0, 'Catalog should not be empty');
    targetProductId = prodData.data[0].id;
    
    // Pick price tier dynamically from the selected product prices to guarantee validity
    const productPrices = prodData.data[0].prices || [];
    targetPriceTierId = productPrices.length > 0 ? productPrices[0].price_tier_id : 1;
    console.log('✔ Passed');

    // Test 7: POS Scan Product search
    console.log('\nRunning: GET /api/pos/products/search...');
    const searchRes = await fetch(`${BASE_URL}/api/pos/products/search?q=NOTE`, {
      headers: { 'Authorization': `Bearer ${cashierToken}` }
    });
    assert.strictEqual(searchRes.status, 200, 'POS search should succeed');
    const searchData = await searchRes.json();
    assert.ok(Array.isArray(searchData.data), 'Search results should be an array');
    console.log('✔ Passed');

    // Test 8: Get Shifts check
    console.log('\nRunning: GET /api/shifts/current...');
    const shiftRes = await fetch(`${BASE_URL}/api/shifts/current`, {
      headers: { 'Authorization': `Bearer ${cashierToken}` }
    });
    assert.strictEqual(shiftRes.status, 200, 'GET current shift should succeed');
    console.log('✔ Passed');

    // Test 9: RBAC Authorization Check (Admin KPIs - Admin)
    console.log('\nRunning: RBAC Check: GET /api/admin/kpis (Admin)...');
    const kpisRes = await fetch(`${BASE_URL}/api/admin/kpis`, {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    assert.strictEqual(kpisRes.status, 200, 'Admin should access KPIs');
    console.log('✔ Passed');

    // Test 10: RBAC Authorization Check (Admin KPIs - Cashier restriction)
    console.log('\nRunning: RBAC Check: GET /api/admin/kpis (Cashier - restricted)...');
    const kpisCashierRes = await fetch(`${BASE_URL}/api/admin/kpis`, {
      headers: { 'Authorization': `Bearer ${cashierToken}` }
    });
    assert.strictEqual(kpisCashierRes.status, 403, 'Cashier should be blocked with 403 Forbidden');
    console.log('✔ Passed');

    // Test 11: Product QR label generation
    console.log(`\nRunning: POST /api/admin/products/${targetProductId}/qr-labels (Admin)...`);
    const qrRes = await fetch(`${BASE_URL}/api/admin/products/${targetProductId}/qr-labels`, {
      method: 'POST',
      headers: { 
        'Authorization': `Bearer ${adminToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ quantity: 5, label_size: '50x25' })
    });
    if (qrRes.status !== 200) {
      const errBody = await qrRes.json().catch(() => ({}));
      console.error('QR generation failed error:', errBody);
    }
    assert.strictEqual(qrRes.status, 200, 'Product QR generation should succeed');
    const qrData = await qrRes.json();
    assert.strictEqual(qrData.status, 'success');
    assert.ok(qrData.data.token, 'Should return token');
    console.log('✔ Passed');

    // Test 12: Open Shift for cashier (required to create preorders)
    console.log('\nRunning: POST /api/shifts/open...');
    const openShiftRes = await fetch(`${BASE_URL}/api/shifts/open`, {
      method: 'POST',
      headers: { 
        'Authorization': `Bearer ${cashierToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ openingCash: 250.00 })
    });
    assert.strictEqual(openShiftRes.status, 200, 'Opening cashier shift should succeed');
    console.log('✔ Passed');

    // Test 13: Preorder creation returning a pickup QR code/token
    console.log('\nRunning: POST /api/pos/preorders (Cashier)...');
    const detailRes = await fetch(`${BASE_URL}/api/products/${targetProductId}`, {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    const detailData = await detailRes.json();
    const targetProduct = detailData.data;
    const targetPriceObj = (targetProduct.prices || []).find(pr => pr.price_tier_id === targetPriceTierId) || (targetProduct.prices || []).find(pr => pr.price > 0) || (targetProduct.prices || [])[0];
    const targetUnitPrice = targetPriceObj ? targetPriceObj.price : 10000;
    const targetTotalAmount = targetUnitPrice * 2;
    const targetDepositPaid = targetTotalAmount;

    const actualPriceTierId = targetPriceObj ? targetPriceObj.price_tier_id : 1;

    const preorderRes = await fetch(`${BASE_URL}/api/pos/preorders`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${cashierToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        customerName: 'محمد أحمد',
        customerPhone: '01122334455',
        items: [{ product_id: targetProductId, quantity: 2, price_tier_id: actualPriceTierId }],
        depositPaid: targetDepositPaid,
        payments: [{ method: 'Cash', amount: targetDepositPaid }]
      })
    });
    if (preorderRes.status !== 201) {
      const errBody = await preorderRes.json().catch(() => ({}));
      console.error('Preorder creation failed error:', errBody);
    }
    assert.strictEqual(preorderRes.status, 201, 'Preorder creation should succeed');
    const preorderData = await preorderRes.json();
    assert.ok(preorderData.data.qr_pickup_token, 'Should return qr_pickup_token');
    assert.ok(preorderData.data.receipt_id, 'Should return receipt_id');
    const createdReceiptId = preorderData.data.receipt_id;
    console.log('✔ Passed');

    // Test 14: Reprint Receipt and reprint audit logging
    console.log(`\nRunning: POST /api/pos/receipts/${createdReceiptId}/reprint (Cashier)...`);
    const reprintRes = await fetch(`${BASE_URL}/api/pos/receipts/${createdReceiptId}/reprint`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${cashierToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ reason: 'نسخة مكررة للعميل' })
    });
    assert.strictEqual(reprintRes.status, 200, 'Reprinting receipt should succeed');
    const reprintData = await reprintRes.json();
    assert.strictEqual(reprintData.data.print_count, 2, 'Receipt print counter should increment to 2');
    console.log('✔ Passed');

    console.log('\n========================================');
    console.log(' ALL INTEGRATION SMOKE TESTS PASSED!');
    console.log('========================================');
  } catch (error) {
    console.error('\n❌ TEST RUN FAILED:', error.message);
    process.exitCode = 1;
  } finally {
    // Shutdown temporary server
    console.log('\nStopping test server...');
    server.close();
  }
}

runTests();

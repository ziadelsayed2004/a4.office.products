import assert from 'node:assert/strict';
import http from 'node:http';
import {
  closeTestServer,
  createTestEnvironment,
  disposeTestEnvironment,
} from './test-environment.js';

const environment = createTestEnvironment('safe-delete');
let db;
let server;

function expectCode(code) {
  return (error) => error?.code === code;
}

async function run() {
  const [
    { default: app },
    dbModule,
    migrationModule,
    categoriesService,
    priceTiersService,
    productsService,
    customersService,
    paymentsService,
  ] = await Promise.all([
    import('../app.js'),
    import('../db/index.js'),
    import('../db/migrate.js'),
    import('../modules/categories/categories.service.js'),
    import('../modules/priceTiers/priceTiers.service.js'),
    import('../modules/products/products.service.js'),
    import('../modules/customers/customers.service.js'),
    import('../modules/payments/payments.service.js'),
  ]);
  db = dbModule.default;
  assert.equal(dbModule.dbPath, environment.databasePath);
  await migrationModule.runMigrations();

  const admin = await db.get("SELECT id FROM users WHERE role = 'Admin' ORDER BY id LIMIT 1;");
  const cashier = await db.get("SELECT id FROM users WHERE role = 'Cashier' ORDER BY id LIMIT 1;");
  assert.ok(admin && cashier);

  const rollbackCategory = await categoriesService.createCategory(
    'Safe delete rollback category',
    admin.id
  );
  await assert.rejects(
    categoriesService.deleteCategory(rollbackCategory.id, 999999),
    (error) => error?.code === 'SQLITE_CONSTRAINT' || error?.code === 'SQLITE_CONSTRAINT_FOREIGNKEY'
  );
  assert.ok(
    await db.get('SELECT id FROM categories WHERE id = ?;', [rollbackCategory.id]),
    'an audit failure must roll back the category deletion'
  );
  assert.deepEqual(await categoriesService.deleteCategory(rollbackCategory.id, admin.id), {
    id: rollbackCategory.id,
  });
  assert.equal(
    (
      await db.get(
        "SELECT COUNT(*) AS count FROM audit_logs WHERE action_type = 'CATEGORY_DELETE' AND entity_id = ?;",
        [rollbackCategory.id]
      )
    ).count,
    1
  );

  const removableTier = await priceTiersService.createPriceTier(
    { name: 'Safe removable tier', description: 'No catalog or history links' },
    admin.id
  );
  assert.equal(removableTier.can_delete, true);
  assert.deepEqual(await priceTiersService.deletePriceTier(removableTier.id, admin.id), {
    id: removableTier.id,
  });

  const linkedTier = await priceTiersService.createPriceTier(
    { name: 'Safe linked tier', description: 'Used by an unsold product' },
    admin.id
  );
  const category = await db.get('SELECT id FROM categories ORDER BY id LIMIT 1;');
  const activeTiers = await priceTiersService.getAllPriceTiers(true);
  const removableProduct = await productsService.createProduct(
    {
      name: 'Never used removable product',
      sku: 'SAFE-DELETE-UNUSED-001',
      categoryId: category.id,
      isActive: true,
      availabilityPolicy: 'STOCK_ONLY',
      lowStockThreshold: 0,
      purchaseCost: 0,
      initialStock: 0,
      isBook: true,
      bookDetails: { subject: 'Safe deletion fixture' },
      prices: activeTiers.map((tier) => ({ priceTierId: tier.id, price: 1000 })),
    },
    admin.id
  );
  assert.equal(removableProduct.can_delete, true);
  assert.deepEqual(removableProduct.dependency_counts, {
    order_items: 0,
    preorder_items: 0,
    inventory_entries: 0,
    return_items: 0,
    return_authorization_items: 0,
    open_preorder_quantity: 0,
  });
  assert.equal(removableProduct.cleanup_counts.book_details, 1);
  assert.equal(removableProduct.cleanup_counts.secure_tokens, 1);
  assert.ok(removableProduct.cleanup_counts.product_prices >= 1);

  const linkedCategory = await categoriesService.getCategoryById(category.id);
  assert.equal(linkedCategory.can_delete, false);
  assert.ok(linkedCategory.dependency_counts.products >= 1);
  await assert.rejects(
    categoriesService.deleteCategory(category.id, admin.id),
    (error) => error?.code === 'CATEGORY_IN_USE' && error?.details?.products >= 1
  );
  const linkedTierState = await priceTiersService.getPriceTierById(linkedTier.id);
  assert.equal(linkedTierState.can_delete, false);
  assert.equal(linkedTierState.dependency_counts.product_prices, 1);
  await assert.rejects(
    priceTiersService.deletePriceTier(linkedTier.id, admin.id),
    (error) => error?.code === 'PRICE_TIER_IN_USE' && error?.details?.product_prices === 1
  );
  await priceTiersService.updatePriceTier(linkedTier.id, { is_active: 0 }, admin.id);
  await productsService.updateProduct(
    removableProduct.id,
    { unlinkPriceTierIds: [linkedTier.id] },
    admin.id
  );
  const unlinkedTierState = await priceTiersService.getPriceTierById(linkedTier.id);
  assert.equal(unlinkedTierState.can_delete, true);
  assert.equal(unlinkedTierState.dependency_counts.product_prices, 0);
  assert.deepEqual(await priceTiersService.deletePriceTier(linkedTier.id, admin.id), {
    id: linkedTier.id,
  });

  assert.deepEqual(await productsService.deleteProduct(removableProduct.id, admin.id), {
    id: removableProduct.id,
  });
  for (const [table, clause] of [
    ['products', 'id = ?'],
    ['product_prices', 'product_id = ?'],
    ['product_book_details', 'product_id = ?'],
    ['secure_tokens', "token_type = 'product' AND reference_id = ?"],
    ['qr_tokens', "type = 'product' AND reference_id = ?"],
  ]) {
    const row = await db.get(`SELECT COUNT(*) AS count FROM ${table} WHERE ${clause};`, [
      removableProduct.id,
    ]);
    assert.equal(row.count, 0, `${table} must not retain a deleted product link`);
  }
  const currentTiers = await priceTiersService.getAllPriceTiers(true);
  const historicalProduct = await productsService.createProduct(
    {
      name: 'Inventory history protected product',
      sku: 'SAFE-DELETE-HISTORY-001',
      categoryId: category.id,
      isActive: true,
      availabilityPolicy: 'STOCK_ONLY',
      lowStockThreshold: 0,
      purchaseCost: 0,
      initialStock: 1,
      prices: currentTiers.map((tier) => ({ priceTierId: tier.id, price: 1000 })),
    },
    admin.id
  );
  assert.equal(historicalProduct.can_delete, false);
  assert.equal(historicalProduct.dependency_counts.inventory_entries, 1);
  await assert.rejects(
    productsService.deleteProduct(historicalProduct.id, admin.id),
    (error) => error?.code === 'PRODUCT_IN_USE' && error?.details?.inventory_entries === 1
  );
  assert.ok(await db.get('SELECT id FROM products WHERE id = ?;', [historicalProduct.id]));

  const removableCustomer = await customersService.createCustomer(
    { name: 'Removable Customer', phone: '01011112222' },
    admin.id
  );
  const updatedCustomer = await customersService.updateCustomer(
    removableCustomer.id,
    { name: 'Updated Removable Customer' },
    admin.id
  );
  assert.equal(updatedCustomer.name, 'Updated Removable Customer');
  assert.equal(updatedCustomer.can_delete, true);
  assert.deepEqual(await customersService.deleteCustomer(removableCustomer.id, admin.id), {
    id: removableCustomer.id,
  });

  const protectedCustomer = await customersService.createCustomer(
    { name: 'Historical Customer', phone: '01033334444' },
    admin.id
  );
  const shift = await db.run(
    "INSERT INTO shifts (user_id, status, opening_cash) VALUES (?, 'OPEN', 0);",
    [cashier.id]
  );
  const order = await db.run(
    `INSERT INTO orders (invoice_number, shift_id, cashier_id, customer_id, subtotal, discount, total)
     VALUES ('INV-SAFE-DELETE-001', ?, ?, ?, 1000, 0, 1000);`,
    [shift.lastID, cashier.id, protectedCustomer.id]
  );
  const protectedState = await customersService.getCustomerById(protectedCustomer.id);
  assert.equal(protectedState.can_delete, false);
  assert.equal(protectedState.dependency_counts.orders, 1);
  await assert.rejects(
    customersService.deleteCustomer(protectedCustomer.id, admin.id),
    (error) => error?.code === 'CUSTOMER_IN_USE' && error?.details?.orders === 1
  );

  const activeCustomMethod = await paymentsService.createPaymentMethod(
    {
      code: 'SafeCustom',
      name_ar: 'طريقة اختبار آمنة',
      is_active: 1,
      refund_mode: 'DISABLED',
    },
    admin.id
  );
  assert.equal(activeCustomMethod.refund_mode, 'DISABLED');
  await assert.rejects(
    paymentsService.deletePaymentMethod(activeCustomMethod.id, admin.id),
    expectCode('PAYMENT_METHOD_MUST_BE_DISABLED')
  );
  const updatedCustomMethod = await paymentsService.updatePaymentMethod(
    activeCustomMethod.id,
    { is_active: 0, refund_mode: 'EXTERNAL_REFERENCE' },
    admin.id
  );
  assert.equal(updatedCustomMethod.refund_mode, 'EXTERNAL_REFERENCE');
  assert.deepEqual(await paymentsService.deletePaymentMethod(activeCustomMethod.id, admin.id), {
    id: activeCustomMethod.id,
  });

  const usedCustomMethod = await paymentsService.createPaymentMethod(
    { code: 'SafeUsed', name_ar: 'طريقة مستخدمة', is_active: 0 },
    admin.id
  );
  await db.run(
    `INSERT INTO payments
     (shift_id, cashier_id, reference_type, reference_id, payment_method, amount, method_id,
      stage, direction, applied_amount, method_snapshot)
     VALUES (?, ?, 'order', ?, ?, 1000, ?, 'SALE', 'IN', 1000, ?);`,
    [
      shift.lastID,
      cashier.id,
      order.lastID,
      usedCustomMethod.code,
      usedCustomMethod.id,
      usedCustomMethod.name_ar,
    ]
  );
  const usedMethodState = (await paymentsService.getPaymentMethods()).find(
    (method) => method.id === usedCustomMethod.id
  );
  assert.equal(usedMethodState.can_delete, false);
  assert.equal(usedMethodState.dependency_counts.payments, 1);
  await assert.rejects(
    paymentsService.deletePaymentMethod(usedCustomMethod.id, admin.id),
    (error) => error?.code === 'PAYMENT_METHOD_IN_USE' && error?.details?.payments === 1
  );
  const cashMethod = (await paymentsService.getPaymentMethods()).find(
    (method) => method.code === 'Cash'
  );
  assert.equal(cashMethod.is_system, 1);
  await assert.rejects(
    paymentsService.deletePaymentMethod(cashMethod.id, admin.id),
    expectCode('SYSTEM_PAYMENT_METHOD')
  );

  server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  const login = async (username, password) => {
    const response = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    assert.equal(response.status, 200);
    return (await response.json()).data.accessToken;
  };
  const adminToken = await login('admin', 'admin123');
  const cashierToken = await login('cashier', 'cashier123');
  const apiCategory = await categoriesService.createCategory('API removable category', admin.id);
  const cashierDelete = await fetch(`${baseUrl}/api/admin/categories/${apiCategory.id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${cashierToken}` },
  });
  assert.equal(cashierDelete.status, 403);
  assert.equal((await cashierDelete.json()).code, 'FORBIDDEN');
  const invalidDelete = await fetch(`${baseUrl}/api/admin/categories/0`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert.equal(invalidDelete.status, 400);
  assert.equal((await invalidDelete.json()).code, 'VALIDATION_ERROR');
  const adminDelete = await fetch(`${baseUrl}/api/admin/categories/${apiCategory.id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert.equal(adminDelete.status, 200);
  assert.deepEqual(await adminDelete.json(), {
    status: 'success',
    message: 'Category deleted successfully.',
    data: { id: apiCategory.id },
  });
  const missingDelete = await fetch(`${baseUrl}/api/admin/categories/${apiCategory.id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert.equal(missingDelete.status, 404);
  assert.equal((await missingDelete.json()).code, 'CATEGORY_NOT_FOUND');

  const apiTier = await priceTiersService.createPriceTier(
    { name: 'API removable tier', description: null },
    admin.id
  );
  const tierDelete = await fetch(`${baseUrl}/api/admin/price-tiers/${apiTier.id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert.equal(tierDelete.status, 200);
  assert.deepEqual((await tierDelete.json()).data, { id: apiTier.id });

  const apiCustomer = await customersService.createCustomer(
    { name: 'API Customer', phone: '01077778888' },
    admin.id
  );
  const customerPatch = await fetch(`${baseUrl}/api/admin/customers/${apiCustomer.id}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${adminToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ name: 'API Customer Updated' }),
  });
  assert.equal(customerPatch.status, 200);
  assert.equal((await customerPatch.json()).data.name, 'API Customer Updated');
  const customerDelete = await fetch(`${baseUrl}/api/admin/customers/${apiCustomer.id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert.equal(customerDelete.status, 200);
  assert.deepEqual((await customerDelete.json()).data, { id: apiCustomer.id });

  const methodCreate = await fetch(`${baseUrl}/api/payment-methods/admin/methods`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${adminToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      code: 'ApiDelete',
      name_ar: 'حذف واجهة',
      is_active: false,
      refund_mode: 'DISABLED',
    }),
  });
  assert.equal(methodCreate.status, 201);
  const apiMethod = (await methodCreate.json()).data;
  assert.equal(apiMethod.refund_mode, 'DISABLED');
  const methodUpdate = await fetch(`${baseUrl}/api/payment-methods/admin/methods/${apiMethod.id}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${adminToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ refund_mode: 'EXTERNAL_REFERENCE' }),
  });
  assert.equal(methodUpdate.status, 200);
  assert.equal((await methodUpdate.json()).data.refund_mode, 'EXTERNAL_REFERENCE');
  const methodDelete = await fetch(`${baseUrl}/api/payment-methods/admin/methods/${apiMethod.id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert.equal(methodDelete.status, 200);
  assert.deepEqual((await methodDelete.json()).data, { id: apiMethod.id });

  const apiProductTiers = await priceTiersService.getAllPriceTiers(true);
  const apiProduct = await productsService.createProduct(
    {
      name: 'API removable product',
      sku: 'SAFE-DELETE-API-001',
      categoryId: category.id,
      isActive: true,
      availabilityPolicy: 'STOCK_ONLY',
      lowStockThreshold: 0,
      purchaseCost: 0,
      initialStock: 0,
      prices: apiProductTiers.map((tier) => ({ priceTierId: tier.id, price: 1000 })),
    },
    admin.id
  );
  const productDelete = await fetch(`${baseUrl}/api/admin/products/${apiProduct.id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert.equal(productDelete.status, 200);
  assert.deepEqual((await productDelete.json()).data, { id: apiProduct.id });

  assert.deepEqual(await db.all('PRAGMA foreign_key_check;'), []);
  console.log('Safe deletion tests passed on an isolated SQLite database.');
}

run()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    try {
      await closeTestServer(server);
      await disposeTestEnvironment(environment, db);
    } catch (error) {
      console.error(error);
      process.exitCode = 1;
    }
  });

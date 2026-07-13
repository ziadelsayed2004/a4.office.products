import assert from 'node:assert/strict';
import {
  createTestEnvironment,
  disposeTestEnvironment,
  seedCatalogFixture,
} from './test-environment.js';

const testEnvironment = createTestEnvironment('backend-correctness');
let db;

function shiftTimestamp(timestamp, seconds) {
  const iso = timestamp.replace(' ', 'T');
  return new Date(Date.parse(`${iso}Z`) + seconds * 1000)
    .toISOString()
    .slice(0, 19)
    .replace('T', ' ');
}

async function run() {
  const [
    dbModule,
    migrationModule,
    posService,
    shiftsService,
    inventoryService,
    printerSettingsService,
    productsService,
    preordersService,
    schemas,
    invoiceDates,
    returnAuthorizationsService,
  ] = await Promise.all([
    import('../db/index.js'),
    import('../db/migrate.js'),
    import('../modules/pos/pos.service.js'),
    import('../modules/shifts/shifts.service.js'),
    import('../modules/inventory/inventory.service.js'),
    import('../modules/printerSettings/printerSettings.service.js'),
    import('../modules/products/products.service.js'),
    import('../modules/preorders/preorders.service.js'),
    import('../validation/schemas.js'),
    import('../modules/invoices/invoices.service.js'),
    import('../modules/returnAuthorizations/returnAuthorizations.service.js'),
  ]);
  db = dbModule.default;
  assert.equal(dbModule.dbPath, testEnvironment.databasePath);
  await migrationModule.runMigrations();
  const productId = await seedCatalogFixture(db);
  const admin = await db.get("SELECT id FROM users WHERE role = 'Admin' ORDER BY id LIMIT 1;");
  const cashier = await db.get("SELECT id FROM users WHERE role = 'Cashier' ORDER BY id LIMIT 1;");
  const price = await db.get(
    'SELECT price_tier_id FROM product_prices WHERE product_id = ? ORDER BY price_tier_id LIMIT 1;',
    [productId]
  );

  await db.run('UPDATE product_prices SET price = 1 WHERE product_id = ? AND price_tier_id = ?;', [
    productId,
    price.price_tier_id,
  ]);
  await db.run(
    `INSERT INTO inventory_ledger
     (product_id, transaction_type, quantity_changed, before_quantity, after_quantity, user_id, notes)
     VALUES (?, 'STOCK_IN', 3, 0, 3, ?, 'Correctness fixture stock');`,
    [productId, admin.id]
  );
  const opened = await shiftsService.openShift(cashier.id, 1000);
  const shiftId = opened.shift.id;

  const checkout = await posService.checkoutOrder({
    cashierId: cashier.id,
    items: [{ product_id: productId, quantity: 3, price_tier_id: price.price_tier_id }],
    discount: 1,
    payments: [{ method: 'Cash', amount: 2, cashReceived: 2 }],
    idempotencyKey: 'correctness-tiny-sale',
  });
  assert.equal(checkout.data.subtotal, 3);
  assert.equal(checkout.data.total, 2);
  const soldLine = await db.get('SELECT id FROM order_items WHERE order_id = ?;', [
    checkout.data.id,
  ]);
  assert.equal(
    schemas.returnAuthorizationQuoteBody.safeParse({
      orderId: checkout.data.id,
      items: [{ orderItemId: soldLine.id, quantity: 1, disposition: 'RESTOCK' }],
    }).success,
    true,
    'an exact invoice-line return authorization must validate'
  );

  const expectedSplitRefunds = [1, 0, 1];
  let cumulativeRefund = 0;
  for (const [index, expectedRefund] of expectedSplitRefunds.entries()) {
    const authorization = await returnAuthorizationsService.createReturnAuthorization({
      adminId: admin.id,
      input: {
        orderId: checkout.data.id,
        reason: `Correctness split return ${index + 1}`,
        items: [{ orderItemId: soldLine.id, quantity: 1, disposition: 'RESTOCK' }],
      },
      idempotencyKey: `correctness-create-return-${index + 1}`,
    });
    assert.equal(authorization.data.totalRefund, expectedRefund);
    const result = await returnAuthorizationsService.executeReturnAuthorization({
      cashierId: cashier.id,
      token: authorization.data.qrToken,
      refundReferences: [],
      idempotencyKey: `correctness-execute-return-${index + 1}`,
    });
    assert.equal(result.data.totalRefunded, expectedRefund);
    cumulativeRefund += result.data.totalRefunded;
    assert.ok(
      cumulativeRefund <= checkout.data.total,
      'cumulative refunds must never exceed the paid total'
    );
  }
  assert.equal(
    cumulativeRefund,
    checkout.data.total,
    'a full split return must refund the exact paid total'
  );
  const refundTotals = await db.get(
    `SELECT COUNT(*) AS count, COALESCE(SUM(total_refunded), 0) AS total
       FROM returns WHERE order_id = ?;`,
    [checkout.data.id]
  );
  assert.deepEqual(refundTotals, { count: 3, total: 2 });
  const refundPayments = await db.get(
    `SELECT COUNT(*) AS count, COALESCE(SUM(applied_amount), 0) AS total
       FROM payments WHERE reference_id = ? AND stage = 'REFUND' AND direction = 'OUT';`,
    [checkout.data.id]
  );
  assert.deepEqual(refundPayments, { count: 2, total: 2 });
  const generatedRefundMovements = await db.get(
    `SELECT COUNT(*) AS count FROM cash_movements
      WHERE shift_id = ? AND type = 'PAY_OUT' AND notes LIKE 'Cash refund for %';`,
    [shiftId]
  );
  assert.equal(
    generatedRefundMovements.count,
    0,
    'new refunds must not create a duplicate PAY_OUT movement'
  );

  let summary = await shiftsService.getCurrentShiftSummary(cashier.id);
  assert.equal(
    summary.expectedClosingCash,
    1000,
    'sale and refund payment rows must produce exact drawer cash'
  );
  await db.run(
    `INSERT INTO cash_movements (shift_id, user_id, type, amount, notes)
     VALUES (?, ?, 'PAY_OUT', 2, ?);`,
    [shiftId, cashier.id, `Cash refund for ${checkout.data.invoice_number}`]
  );
  summary = await shiftsService.getCurrentShiftSummary(cashier.id);
  assert.equal(
    summary.expectedClosingCash,
    1000,
    'legacy generated refund movements must not reduce cash twice'
  );
  assert.equal(summary.cashMovements.find((row) => row.type === 'PAY_OUT').total_amount, 0);

  const cairoDate = '2030-07-15';
  const startBoundary = invoiceDates.cairoMidnightUtc(cairoDate);
  const endBoundary = invoiceDates.cairoMidnightUtc(invoiceDates.addCalendarDay(cairoDate));
  const datedShiftIds = {};
  for (const [name, openedAt] of [
    ['before', shiftTimestamp(startBoundary, -1)],
    ['start', startBoundary],
    ['last', shiftTimestamp(endBoundary, -1)],
    ['end', endBoundary],
  ]) {
    const result = await db.run(
      `INSERT INTO shifts (user_id, status, opened_at, closed_at, opening_cash)
       VALUES (?, 'CLOSED', ?, ?, 0);`,
      [cashier.id, openedAt, openedAt]
    );
    datedShiftIds[name] = result.lastID;
  }
  const cairoDayShifts = await shiftsService.listAllShifts({
    startDate: cairoDate,
    endDate: cairoDate,
  });
  assert.deepEqual(
    cairoDayShifts.map((row) => row.id).sort((left, right) => left - right),
    [datedShiftIds.start, datedShiftIds.last].sort((left, right) => left - right),
    'shift date filters must use inclusive Cairo midnight and exclusive next Cairo midnight'
  );

  const legacyPrinterSettings = {
    receipt_printer_type: 'legacy-usb',
    receipt_printer_address: 'legacy-receipt-address',
    qr_printer_type: 'legacy-network',
    qr_printer_address: 'legacy-label-address',
  };
  await db.run(
    `INSERT INTO printer_settings (key, value) VALUES ('print_mode', 'direct')
     ON CONFLICT(key) DO UPDATE SET value = excluded.value;`
  );
  for (const [key, value] of Object.entries(legacyPrinterSettings)) {
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
  assert.equal((await printerSettingsService.getSafePrinterSettings()).print_mode, 'browser');
  const updatedPrinterSettings = await printerSettingsService.updatePrinterSettings(
    { receipt_printer_width: '58mm' },
    admin.id
  );
  assert.equal(updatedPrinterSettings.print_mode, 'browser');
  assert.equal(
    (await db.get("SELECT value FROM printer_settings WHERE key = 'print_mode';")).value,
    'browser'
  );
  const legacyAfter = await db.all(
    `SELECT key, value FROM printer_settings
      WHERE key IN ('receipt_printer_type', 'receipt_printer_address', 'qr_printer_type', 'qr_printer_address')
      ORDER BY key;`
  );
  assert.deepEqual(
    legacyAfter,
    legacyBefore,
    'canonicalization must preserve inactive legacy addresses and types'
  );

  for (const [inputSize, expectedAlias] of [
    ['small', 'small'],
    ['medium', 'medium'],
    ['large', 'large'],
    ['38x25', 'small'],
    ['50x25', 'medium'],
    ['80x50', 'large'],
  ]) {
    const labels = await productsService.getOrCreateProductQrToken(
      productId,
      { quantity: 1, label_size: inputSize },
      admin.id
    );
    assert.equal(labels.label_size, expectedAlias, `${inputSize} must map to ${expectedAlias}`);
  }

  const preorderShape = {
    customerName: 'Schema Customer',
    customerPhone: '01012345678',
    items: [{ product_id: productId, quantity: 1, price_tier_id: price.price_tier_id }],
    depositPaid: 1,
    payments: [{ method: 'Cash', amount: 1 }],
  };
  assert.equal(
    schemas.preorderCreateBody.safeParse({
      ...preorderShape,
      expectedPickupDate: '2026-02-30',
    }).success,
    false
  );
  assert.equal(
    schemas.preorderCreateBody.safeParse({
      ...preorderShape,
      expectedPickupDate: '2027-02-29',
    }).success,
    false
  );
  assert.equal(
    schemas.preorderCreateBody.safeParse({
      ...preorderShape,
      expectedPickupDate: '2028-02-29',
    }).success,
    true
  );
  assert.equal(
    schemas.preorderCreateBody.safeParse({
      ...preorderShape,
      expectedPickupDate: '2028-03-01',
    }).success,
    true
  );
  assert.equal(
    schemas.preorderCreateBody.safeParse({
      ...preorderShape,
      expectedPickupDate: null,
    }).success,
    true
  );

  await inventoryService.adjustStock(
    {
      productId,
      adjustmentType: 'SUB',
      quantity: 3,
      notes: 'Prepare zero-stock preorder fixture.',
    },
    admin.id,
    null,
    'correctness-preorder-zero-stock'
  );
  const preorderInput = {
    customerName: 'Inline Audit Customer',
    customerPhone: '01099998888',
    items: [{ product_id: productId, quantity: 1, price_tier_id: price.price_tier_id }],
    discount: 0,
    depositPaid: 1,
    expectedPickupDate: '2028-02-29',
    payments: [{ method: 'Cash', amount: 1, cashReceived: 1 }],
  };
  const firstPreorder = await preordersService.createPreorder(
    preorderInput,
    cashier.id,
    'correctness-inline-customer-1'
  );
  const customerId = firstPreorder.data.customer_id;
  let customerAudits = await db.get(
    `SELECT COUNT(*) AS count FROM audit_logs
      WHERE action_type = 'CUSTOMER_CREATE' AND entity_type = 'customers' AND entity_id = ?;`,
    [customerId]
  );
  assert.equal(customerAudits.count, 1, 'inline customer creation must write one audit row');
  const audit = await db.get(
    `SELECT user_id, shift_id FROM audit_logs
      WHERE action_type = 'CUSTOMER_CREATE' AND entity_type = 'customers' AND entity_id = ?;`,
    [customerId]
  );
  assert.deepEqual(audit, { user_id: cashier.id, shift_id: shiftId });

  const replayedPreorder = await preordersService.createPreorder(
    preorderInput,
    cashier.id,
    'correctness-inline-customer-1'
  );
  assert.equal(replayedPreorder.replayed, true);
  assert.equal(replayedPreorder.data.id, firstPreorder.data.id);
  assert.equal(
    (
      await db.get('SELECT COUNT(*) AS count FROM customers WHERE name = ? AND phone = ?;', [
        preorderInput.customerName,
        preorderInput.customerPhone,
      ])
    ).count,
    1,
    'an idempotent preorder replay must not duplicate its customer'
  );
  assert.equal(
    (
      await db.get(
        `SELECT COUNT(*) AS count FROM audit_logs
      WHERE action_type = 'CUSTOMER_CREATE' AND entity_type = 'customers' AND entity_id = ?;`,
        [customerId]
      )
    ).count,
    1,
    'an idempotent preorder replay must not duplicate CUSTOMER_CREATE audit'
  );
  assert.equal(
    (
      await db.get('SELECT COUNT(*) AS count FROM idempotency_records WHERE idempotency_key = ?;', [
        'correctness-inline-customer-1',
      ])
    ).count,
    1
  );

  await preordersService.createPreorder(
    { ...preorderInput, expectedPickupDate: null },
    cashier.id,
    'correctness-inline-customer-2'
  );
  customerAudits = await db.get(
    `SELECT COUNT(*) AS count FROM audit_logs
      WHERE action_type = 'CUSTOMER_CREATE' AND entity_type = 'customers' AND entity_id = ?;`,
    [customerId]
  );
  assert.equal(
    customerAudits.count,
    1,
    'reusing an existing customer must not duplicate CUSTOMER_CREATE audit'
  );
  assert.equal(
    (
      await db.get('SELECT COUNT(*) AS count FROM customers WHERE name = ? AND phone = ?;', [
        preorderInput.customerName,
        preorderInput.customerPhone,
      ])
    ).count,
    1
  );

  const rollbackCustomer = {
    name: 'Rolled Back Customer',
    phone: '01000007777',
  };
  await assert.rejects(
    preordersService.createPreorder(
      {
        ...preorderInput,
        customerName: rollbackCustomer.name,
        customerPhone: rollbackCustomer.phone,
        items: [{ product_id: productId, quantity: 1, price_tier_id: 999999 }],
      },
      cashier.id,
      'correctness-customer-rollback'
    ),
    (error) => error?.code === 'PRICE_NOT_FOUND'
  );
  assert.equal(
    (
      await db.get('SELECT COUNT(*) AS count FROM customers WHERE name = ? AND phone = ?;', [
        rollbackCustomer.name,
        rollbackCustomer.phone,
      ])
    ).count,
    0,
    'a failed preorder must roll back its newly inserted customer'
  );
  assert.equal(
    (
      await db.get(
        `SELECT COUNT(*) AS count FROM audit_logs
      WHERE action_type = 'CUSTOMER_CREATE' AND after_values LIKE ?;`,
        [`%${rollbackCustomer.phone}%`]
      )
    ).count,
    0,
    'a failed preorder must roll back CUSTOMER_CREATE audit'
  );
  assert.equal(
    (
      await db.get('SELECT COUNT(*) AS count FROM idempotency_records WHERE idempotency_key = ?;', [
        'correctness-customer-rollback',
      ])
    ).count,
    0,
    'a failed preorder must roll back its idempotency reservation'
  );

  console.log('Backend correctness regressions passed.');
}

run()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    try {
      await disposeTestEnvironment(testEnvironment, db);
    } catch (error) {
      console.error(error);
      process.exitCode = 1;
    }
  });

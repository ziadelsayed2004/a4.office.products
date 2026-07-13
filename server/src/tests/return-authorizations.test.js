import assert from 'node:assert/strict';
import {
  createTestEnvironment,
  disposeTestEnvironment,
  seedCatalogFixture,
} from './test-environment.js';

const environment = createTestEnvironment('return-authorizations');
let db;

async function expectCode(promise, code) {
  await assert.rejects(promise, (error) => error?.code === code);
}

async function run() {
  const [dbModule, migrations, pos, shifts, returns, scanResolver] = await Promise.all([
    import('../db/index.js'),
    import('../db/migrate.js'),
    import('../modules/pos/pos.service.js'),
    import('../modules/shifts/shifts.service.js'),
    import('../modules/returnAuthorizations/returnAuthorizations.service.js'),
    import('../modules/pos/scanResolver.service.js'),
  ]);
  db = dbModule.default;
  await migrations.runMigrations();
  const productId = await seedCatalogFixture(db);
  const admin = await db.get(
    "SELECT id, role FROM users WHERE role = 'Admin' ORDER BY id LIMIT 1;"
  );
  const cashier = await db.get(
    "SELECT id, role FROM users WHERE role = 'Cashier' ORDER BY id LIMIT 1;"
  );
  const tier = await db.get(
    'SELECT price_tier_id FROM product_prices WHERE product_id = ? ORDER BY id LIMIT 1;',
    [productId]
  );
  await db.run('UPDATE product_prices SET price = 5000 WHERE product_id = ?;', [productId]);
  await db.run(
    `INSERT INTO inventory_ledger
     (product_id, transaction_type, quantity_changed, before_quantity, after_quantity, user_id, notes)
     VALUES (?, 'STOCK_IN', 10, 0, 10, ?, 'Return authorization fixture');`,
    [productId, admin.id]
  );
  const shift = (await shifts.openShift(cashier.id, 10000)).shift;

  const sale = await pos.checkoutOrder({
    cashierId: cashier.id,
    items: [{ product_id: productId, quantity: 2, price_tier_id: tier.price_tier_id }],
    discount: 0,
    payments: [
      { method: 'Cash', amount: 4000, cashReceived: 4000 },
      { method: 'Card', amount: 6000, referenceNumber: 'sale-card-1' },
    ],
    idempotencyKey: 'return-test-mixed-sale',
  });
  const orderItem = await db.get('SELECT id FROM order_items WHERE order_id = ?;', [sale.data.id]);
  const quote = await returns.quoteReturnAuthorization({
    orderId: sale.data.id,
    items: [{ orderItemId: orderItem.id, quantity: 1, disposition: 'RESTOCK' }],
  });
  assert.equal(quote.totalRefund, 5000);
  assert.deepEqual(
    quote.allocations.map(({ method, amount }) => ({ method, amount })),
    [
      { method: 'Cash', amount: 2000 },
      { method: 'Card', amount: 3000 },
    ],
    'mixed tender refund must use deterministic proportional allocation'
  );

  const issued = await returns.createReturnAuthorization({
    adminId: admin.id,
    input: {
      orderId: sale.data.id,
      reason: 'Customer returned one item',
      items: [{ orderItemId: orderItem.id, quantity: 1, disposition: 'RESTOCK' }],
    },
    idempotencyKey: 'return-test-issue-first',
  });
  assert.match(issued.data.authorizationNumber, /^RMA-\d{8}-\d{4}$/);
  assert.match(issued.data.qrToken, /^ret_/);
  assert.equal(
    (await scanResolver.resolveScan(issued.data.qrToken, cashier)).action,
    'RETURN_REVIEW'
  );
  const print = await returns.requestReturnAuthorizationPrint(
    issued.data.id,
    { requestKey: 'return-test-print-first', copies: 1 },
    admin
  );
  const printReplay = await returns.requestReturnAuthorizationPrint(
    issued.data.id,
    { requestKey: 'return-test-print-first', copies: 1 },
    admin
  );
  assert.equal(print.replayed, false);
  assert.equal(printReplay.replayed, true);
  assert.equal(printReplay.requestId, print.requestId);
  assert.equal(
    (await db.get('SELECT print_count FROM return_authorizations WHERE id = ?;', [issued.data.id]))
      .print_count,
    1,
    'print request replay must not increment the card twice'
  );

  const cardAllocation = issued.data.allocations.find((row) => row.method === 'Card');
  await expectCode(
    returns.executeReturnAuthorization({
      cashierId: cashier.id,
      token: issued.data.qrToken,
      refundReferences: [],
      idempotencyKey: 'return-test-missing-reference',
    }),
    'REFUND_REFERENCE_REQUIRED'
  );
  assert.equal(
    (await db.get('SELECT status FROM return_authorizations WHERE id = ?;', [issued.data.id]))
      .status,
    'ACTIVE',
    'a failed execution must leave the card active'
  );
  assert.equal((await db.get('SELECT COUNT(*) AS count FROM returns;')).count, 0);

  const executed = await returns.executeReturnAuthorization({
    cashierId: cashier.id,
    token: issued.data.qrToken,
    refundReferences: [
      { allocationId: cardAllocation.id, referenceNumber: 'card-refund-reference-1' },
    ],
    idempotencyKey: 'return-test-execute-first',
  });
  assert.match(executed.data.returnNumber, /^RTN-\d{8}-\d{4}$/);
  assert.deepEqual(executed.data.cashDrawerEffect, { amount: -2000, before: 14000, after: 12000 });
  assert.equal(
    (await db.get("SELECT COUNT(*) AS count FROM cash_movements WHERE type = 'PAY_OUT';")).count,
    0,
    'authorized refunds must never create a duplicate PAY_OUT movement'
  );
  assert.equal(
    (
      await db.get(
        "SELECT COUNT(*) AS count FROM inventory_ledger WHERE transaction_type = 'RETURN' AND reference_id = ?;",
        [executed.data.returnId]
      )
    ).count,
    1
  );
  assert.equal(
    (await db.get('SELECT reference_type FROM receipts WHERE id = ?;', [executed.data.receiptId]))
      .reference_type,
    'order_return'
  );
  const replay = await returns.executeReturnAuthorization({
    cashierId: cashier.id,
    token: issued.data.qrToken,
    refundReferences: [
      { allocationId: cardAllocation.id, referenceNumber: 'card-refund-reference-1' },
    ],
    idempotencyKey: 'return-test-execute-first',
  });
  assert.equal(replay.replayed, true);
  assert.equal(replay.data.returnId, executed.data.returnId);
  assert.equal((await db.get('SELECT COUNT(*) AS count FROM returns;')).count, 1);
  assert.equal((await scanResolver.resolveScan(issued.data.qrToken, cashier)).action, 'BLOCKED');

  const forged = `${issued.data.qrToken.slice(0, -1)}${issued.data.qrToken.endsWith('a') ? 'b' : 'a'}`;
  await expectCode(scanResolver.resolveScan(forged, cashier), 'INVALID_RETURN_QR');

  const noRestock = await returns.createReturnAuthorization({
    adminId: admin.id,
    input: {
      orderId: sale.data.id,
      reason: 'Damaged remaining item',
      items: [
        {
          orderItemId: orderItem.id,
          quantity: 1,
          disposition: 'NO_RESTOCK',
          noRestockReason: 'Water damaged',
        },
      ],
    },
    idempotencyKey: 'return-test-issue-second',
  });
  const oldToken = noRestock.data.qrToken;
  const reissued = await returns.reissueReturnAuthorization(noRestock.data.id, {
    adminId: admin.id,
  });
  assert.notEqual(reissued.qrToken, oldToken);
  await expectCode(scanResolver.resolveScan(oldToken, cashier), 'RETURN_QR_SUPERSEDED');
  const secondCard = reissued.allocations.find((row) => row.method === 'Card');
  const second = await returns.executeReturnAuthorization({
    cashierId: cashier.id,
    token: reissued.qrToken,
    refundReferences: [{ allocationId: secondCard.id, referenceNumber: 'card-refund-reference-2' }],
    idempotencyKey: 'return-test-execute-second',
  });
  assert.equal(second.data.invoiceStatus, 'RETURNED');
  assert.equal(
    (
      await db.get(
        "SELECT COUNT(*) AS count FROM inventory_ledger WHERE transaction_type = 'RETURN' AND reference_id = ?;",
        [second.data.returnId]
      )
    ).count,
    0,
    'NO_RESTOCK items must not enter sellable inventory'
  );

  const lowCashSale = await pos.checkoutOrder({
    cashierId: cashier.id,
    items: [{ product_id: productId, quantity: 1, price_tier_id: tier.price_tier_id }],
    discount: 0,
    payments: [{ method: 'Cash', amount: 5000, cashReceived: 5000 }],
    idempotencyKey: 'return-test-low-cash-sale',
  });
  const lowCashLine = await db.get('SELECT id FROM order_items WHERE order_id = ?;', [
    lowCashSale.data.id,
  ]);
  const drawer = await shifts.getCurrentShiftSummary(cashier.id);
  await db.run(
    `INSERT INTO cash_movements (shift_id, user_id, type, amount, notes)
     VALUES (?, ?, 'PAY_OUT', ?, 'Temporary isolated-test drawer removal');`,
    [shift.id, cashier.id, drawer.expectedClosingCash]
  );
  const lowCashCard = await returns.createReturnAuthorization({
    adminId: admin.id,
    input: {
      orderId: lowCashSale.data.id,
      reason: 'Cash drawer safety test',
      items: [{ orderItemId: lowCashLine.id, quantity: 1, disposition: 'RESTOCK' }],
    },
    idempotencyKey: 'return-test-low-cash-issue',
  });
  await expectCode(
    returns.executeReturnAuthorization({
      cashierId: cashier.id,
      token: lowCashCard.data.qrToken,
      idempotencyKey: 'return-test-low-cash-execute',
    }),
    'INSUFFICIENT_DRAWER_CASH'
  );
  assert.equal(
    (await db.get('SELECT status FROM return_authorizations WHERE id = ?;', [lowCashCard.data.id]))
      .status,
    'ACTIVE'
  );
  await db.run(
    "UPDATE return_authorizations SET expires_at = '2000-01-01 00:00:00' WHERE id = ?;",
    [lowCashCard.data.id]
  );
  const expiredScan = await scanResolver.resolveScan(lowCashCard.data.qrToken, cashier);
  assert.equal(expiredScan.action, 'BLOCKED');
  assert.equal(expiredScan.data.status, 'EXPIRED');
  await expectCode(
    returns.executeReturnAuthorization({
      cashierId: cashier.id,
      token: lowCashCard.data.qrToken,
      idempotencyKey: 'return-test-expired-execute',
    }),
    'RETURN_AUTHORIZATION_EXPIRED'
  );
  const replacement = await returns.createReturnAuthorization({
    adminId: admin.id,
    input: {
      orderId: lowCashSale.data.id,
      reason: 'Replacement after automatic expiry',
      items: [{ orderItemId: lowCashLine.id, quantity: 1, disposition: 'RESTOCK' }],
    },
    idempotencyKey: 'return-test-expired-replacement',
  });
  assert.equal(
    (await db.get('SELECT status FROM return_authorizations WHERE id = ?;', [lowCashCard.data.id]))
      .status,
    'EXPIRED',
    'issuing a replacement must persist the old ACTIVE timeout as EXPIRED'
  );
  assert.equal(
    (await scanResolver.resolveScan(lowCashCard.data.qrToken, cashier)).action,
    'BLOCKED'
  );
  const revoked = await returns.revokeReturnAuthorization(replacement.data.id, {
    adminId: admin.id,
    reason: 'Drawer could not fund refund',
  });
  assert.equal(revoked.status, 'REVOKED');
  assert.equal(
    (await scanResolver.resolveScan(replacement.data.qrToken, cashier)).action,
    'BLOCKED'
  );

  const concurrentSale = await pos.checkoutOrder({
    cashierId: cashier.id,
    items: [{ product_id: productId, quantity: 1, price_tier_id: tier.price_tier_id }],
    discount: 0,
    payments: [{ method: 'Card', amount: 5000, referenceNumber: 'sale-card-concurrent' }],
    idempotencyKey: 'return-test-concurrent-sale',
  });
  const concurrentLine = await db.get('SELECT id FROM order_items WHERE order_id = ?;', [
    concurrentSale.data.id,
  ]);
  const concurrentCard = await returns.createReturnAuthorization({
    adminId: admin.id,
    input: {
      orderId: concurrentSale.data.id,
      reason: 'Concurrent execution test',
      items: [{ orderItemId: concurrentLine.id, quantity: 1, disposition: 'RESTOCK' }],
    },
    idempotencyKey: 'return-test-concurrent-issue',
  });
  const concurrentAllocation = concurrentCard.data.allocations[0];
  const attempts = await Promise.allSettled([
    returns.executeReturnAuthorization({
      cashierId: cashier.id,
      token: concurrentCard.data.qrToken,
      refundReferences: [
        { allocationId: concurrentAllocation.id, referenceNumber: 'concurrent-refund-1' },
      ],
      idempotencyKey: 'return-test-concurrent-execute-1',
    }),
    returns.executeReturnAuthorization({
      cashierId: cashier.id,
      token: concurrentCard.data.qrToken,
      refundReferences: [
        { allocationId: concurrentAllocation.id, referenceNumber: 'concurrent-refund-2' },
      ],
      idempotencyKey: 'return-test-concurrent-execute-2',
    }),
  ]);
  assert.equal(attempts.filter((attempt) => attempt.status === 'fulfilled').length, 1);
  assert.equal(attempts.filter((attempt) => attempt.status === 'rejected').length, 1);
  assert.equal(
    attempts.find((attempt) => attempt.status === 'rejected').reason.code,
    'RETURN_AUTHORIZATION_CONSUMED'
  );
  const concurrentResult = attempts.find((attempt) => attempt.status === 'fulfilled').value;
  assert.equal(concurrentResult.data.cashDrawerEffect.amount, 0);
  assert.equal(
    concurrentResult.data.cashDrawerEffect.before,
    concurrentResult.data.cashDrawerEffect.after,
    'non-cash refunds must not change the drawer'
  );
  assert.equal(
    (
      await db.get('SELECT COUNT(*) AS count FROM returns WHERE authorization_id = ?;', [
        concurrentCard.data.id,
      ])
    ).count,
    1,
    'concurrent execution must consume exactly once'
  );

  const rawTokenInAudit = await db.get(
    "SELECT id FROM audit_logs WHERE instr(COALESCE(before_values, ''), 'ret_') > 0 OR instr(COALESCE(after_values, ''), 'ret_') > 0 OR instr(COALESCE(notes, ''), 'ret_') > 0 LIMIT 1;"
  );
  assert.equal(rawTokenInAudit, undefined, 'raw return QR tokens must never enter audit logs');
  assert.equal((await db.all('PRAGMA foreign_key_check;')).length, 0);
  const populatedCounts = {};
  for (const table of [
    'payments',
    'receipts',
    'print_requests',
    'inventory_ledger',
    'return_authorizations',
    'returns',
  ]) {
    populatedCounts[table] = (await db.get(`SELECT COUNT(*) AS count FROM ${table};`)).count;
  }
  await db.run("DELETE FROM schema_migrations WHERE version = '002';");
  await migrations.runMigrations();
  for (const [table, count] of Object.entries(populatedCounts)) {
    assert.equal(
      (await db.get(`SELECT COUNT(*) AS count FROM ${table};`)).count,
      count,
      `populated migration rebuild must preserve ${table}`
    );
  }
  assert.equal((await db.all('PRAGMA foreign_key_check;')).length, 0);
  console.log('Return authorization, QR, allocation, drawer, and rollback tests passed.');
}

run()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    try {
      await disposeTestEnvironment(environment, db);
    } catch (error) {
      console.error(error);
      process.exitCode = 1;
    }
  });

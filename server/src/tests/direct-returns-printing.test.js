import assert from 'node:assert/strict';
import {
  createTestEnvironment,
  disposeTestEnvironment,
  seedCatalogFixture,
} from './test-environment.js';

const environment = createTestEnvironment('direct-returns-printing');
let db;

async function expectCode(promise, code) {
  await assert.rejects(promise, (error) => error?.code === code);
}

function tamperToken(token) {
  const replacement = token.endsWith('A') ? 'B' : 'A';
  return `${token.slice(0, -1)}${replacement}`;
}

async function directReturnArtifactCounts(connection) {
  const [returns, items, payments, inventory, receipts, audits, idempotency] = await Promise.all([
    connection.get('SELECT COUNT(*) AS count FROM returns;'),
    connection.get('SELECT COUNT(*) AS count FROM return_items;'),
    connection.get(
      "SELECT COUNT(*) AS count FROM payments WHERE stage = 'REFUND' AND direction = 'OUT';"
    ),
    connection.get(
      "SELECT COUNT(*) AS count FROM inventory_ledger WHERE transaction_type = 'RETURN';"
    ),
    connection.get("SELECT COUNT(*) AS count FROM receipts WHERE reference_type = 'order_return';"),
    connection.get(
      `SELECT COUNT(*) AS count FROM audit_logs
        WHERE action_type IN ('ORDER_REFUND_APPROVAL_CARD', 'RETURN_APPROVAL_CARD_USE');`
    ),
    connection.get(
      "SELECT COUNT(*) AS count FROM idempotency_records WHERE operation = 'DIRECT_RETURN_EXECUTE';"
    ),
  ]);
  return {
    returns: Number(returns.count),
    items: Number(items.count),
    payments: Number(payments.count),
    inventory: Number(inventory.count),
    receipts: Number(receipts.count),
    audits: Number(audits.count),
    idempotency: Number(idempotency.count),
  };
}

try {
  const [dbModule, migrations, pos, shifts, cards, returns, receipts, invoices] = await Promise.all(
    [
      import('../db/index.js'),
      import('../db/migrate.js'),
      import('../modules/pos/pos.service.js'),
      import('../modules/shifts/shifts.service.js'),
      import('../modules/returnApprovalCards/returnApprovalCards.service.js'),
      import('../modules/cashierReturns/cashierReturns.service.js'),
      import('../modules/receipts/receipts.service.js'),
      import('../modules/invoices/invoices.service.js'),
    ]
  );
  db = dbModule.default;
  await migrations.runMigrations();

  const productId = await seedCatalogFixture(db);
  const admin = await db.get(
    "SELECT id, role FROM users WHERE role = 'Admin' ORDER BY id LIMIT 1;"
  );
  const sellingCashier = await db.get(
    "SELECT id, role FROM users WHERE role = 'Cashier' ORDER BY id LIMIT 1;"
  );
  const returningUser = await db.run(
    `INSERT INTO users (username, password_hash, role, name, is_active)
     VALUES ('returning-cashier', 'test-only-hash', 'Cashier', 'Returning cashier', 1);`
  );
  const noShiftUser = await db.run(
    `INSERT INTO users (username, password_hash, role, name, is_active)
     VALUES ('no-shift-cashier', 'test-only-hash', 'Cashier', 'No shift cashier', 1);`
  );
  const returningCashier = { id: returningUser.lastID, role: 'Cashier' };
  const noShiftCashier = { id: noShiftUser.lastID, role: 'Cashier' };

  const tier = await db.get(
    'SELECT price_tier_id FROM product_prices WHERE product_id = ? ORDER BY id LIMIT 1;',
    [productId]
  );
  await db.run('UPDATE product_prices SET price = 5000 WHERE product_id = ?;', [productId]);
  await db.run(
    `INSERT INTO inventory_ledger
     (product_id, transaction_type, quantity_changed, before_quantity, after_quantity, user_id, notes)
     VALUES (?, 'STOCK_IN', 10, 0, 10, ?, 'Direct return fixture');`,
    [productId, admin.id]
  );
  const sellingShift = (await shifts.openShift(sellingCashier.id, 10000)).shift;
  const returningShift = (await shifts.openShift(returningCashier.id, 10000)).shift;

  const sale = await pos.checkoutOrder({
    cashierId: sellingCashier.id,
    items: [{ product_id: productId, quantity: 2, price_tier_id: tier.price_tier_id }],
    discount: 0,
    payments: [
      { method: 'Cash', amount: 4000, cashReceived: 4000 },
      { method: 'Card', amount: 6000, referenceNumber: 'direct-return-sale-card' },
    ],
    idempotencyKey: 'direct-return-mixed-sale',
  });
  const order = await db.get('SELECT * FROM orders WHERE id = ?;', [sale.data.id]);
  const saleReceipt = await db.get(
    "SELECT * FROM receipts WHERE reference_type = 'order_sale' AND reference_id = ?;",
    [order.id]
  );
  const line = await db.get('SELECT id FROM order_items WHERE order_id = ?;', [order.id]);
  const product = await db.get('SELECT barcode FROM products WHERE id = ?;', [productId]);
  let card = await cards.createCard({ label: 'Reusable direct-return card', adminId: admin.id });

  await expectCode(
    returns.prepareReturn({ invoiceCode: order.invoice_number }, noShiftCashier),
    'OPEN_OWN_SHIFT_REQUIRED'
  );
  await expectCode(
    returns.prepareReturn({ invoiceCode: order.invoice_number }, admin),
    'CASHIER_REQUIRED'
  );
  const preparedByInvoice = await returns.prepareReturn(
    { invoiceCode: order.invoice_number },
    returningCashier
  );
  assert.equal(preparedByInvoice.order.id, order.id);
  assert.equal(preparedByInvoice.order.cashierId, sellingCashier.id);
  assert.equal(preparedByInvoice.shiftId, returningShift.id);
  assert.equal(
    (await returns.prepareReturn({ invoiceCode: saleReceipt.receipt_number }, returningCashier))
      .order.id,
    order.id
  );
  assert.equal(
    (await returns.prepareReturn({ invoiceCode: order.qr_token }, returningCashier)).order.id,
    order.id
  );

  await db.run('UPDATE products SET is_active = 0 WHERE id = ?;', [productId]);
  const resolved = await returns.resolveReturnItem(
    { orderId: order.id, code: product.barcode },
    returningCashier
  );
  assert.equal(resolved.item.orderItemId, line.id);
  assert.equal(resolved.item.productActive, false, 'inactive sold products remain returnable');

  const itemInput = [{ orderItemId: line.id, quantity: 1, disposition: 'RESTOCK' }];
  await expectCode(
    returns.quoteReturn(
      {
        orderId: order.id,
        items: [{ orderItemId: line.id, quantity: 3, disposition: 'RESTOCK' }],
      },
      returningCashier
    ),
    'RETURN_QUANTITY_EXCEEDED'
  );
  await expectCode(
    returns.quoteReturn(
      {
        orderId: order.id,
        items: [{ orderItemId: line.id, quantity: 1, disposition: 'NO_RESTOCK' }],
      },
      returningCashier
    ),
    'NO_RESTOCK_REASON_REQUIRED'
  );
  const quote = await returns.quoteReturn(
    { orderId: order.id, items: itemInput },
    returningCashier
  );
  assert.equal(quote.totalRefund, 5000);
  assert.deepEqual(
    quote.allocations.map(({ method, amount }) => ({ method, amount })),
    [
      { method: 'Cash', amount: 2000 },
      { method: 'Card', amount: 3000 },
    ]
  );
  const external = quote.allocations.find(
    (allocation) => allocation.refundMode === 'EXTERNAL_REFERENCE'
  );
  const executeInput = {
    orderId: order.id,
    items: itemInput,
    reason: 'Customer returned one notebook',
    approvalCardToken: card.qrToken,
    refundReferences: [],
  };
  const emptyArtifacts = await directReturnArtifactCounts(db);
  assert.deepEqual(emptyArtifacts, {
    returns: 0,
    items: 0,
    payments: 0,
    inventory: 0,
    receipts: 0,
    audits: 0,
    idempotency: 0,
  });

  await expectCode(
    returns.executeReturn({
      input: executeInput,
      actor: admin,
      idempotencyKey: 'direct-return-admin-denied',
    }),
    'CASHIER_REQUIRED'
  );

  await expectCode(
    returns.executeReturn({
      input: executeInput,
      actor: returningCashier,
      idempotencyKey: 'direct-return-missing-reference',
    }),
    'REFUND_REFERENCE_REQUIRED'
  );
  assert.deepEqual(await directReturnArtifactCounts(db), emptyArtifacts);
  assert.equal(
    (await db.get('SELECT COUNT(*) AS count FROM return_authorizations;')).count,
    0,
    'direct return failures must not create legacy authorizations'
  );

  const referencedInput = {
    ...executeInput,
    refundReferences: [
      { paymentMethodId: external.paymentMethodId, referenceNumber: 'failure-card-refund-ref' },
    ],
  };
  await expectCode(
    returns.executeReturn({
      input: {
        ...referencedInput,
        approvalCardToken: tamperToken(card.qrToken),
      },
      actor: returningCashier,
      idempotencyKey: 'direct-return-tampered-card',
    }),
    'INVALID_APPROVAL_CARD'
  );
  assert.deepEqual(await directReturnArtifactCounts(db), emptyArtifacts);

  await cards.setCardStatus(card.id, 'DISABLED', {
    adminId: admin.id,
    reason: 'Acceptance test disable',
  });
  await expectCode(
    returns.executeReturn({
      input: referencedInput,
      actor: returningCashier,
      idempotencyKey: 'direct-return-disabled-card',
    }),
    'APPROVAL_CARD_DISABLED'
  );
  assert.deepEqual(await directReturnArtifactCounts(db), emptyArtifacts);
  card = await cards.setCardStatus(card.id, 'ACTIVE', { adminId: admin.id });

  await db.run('UPDATE users SET is_active = 0 WHERE id = ?;', [admin.id]);
  await expectCode(
    returns.executeReturn({
      input: {
        ...executeInput,
        refundReferences: [
          { paymentMethodId: external.paymentMethodId, referenceNumber: 'inactive-owner-ref' },
        ],
      },
      actor: returningCashier,
      idempotencyKey: 'direct-return-inactive-owner',
    }),
    'APPROVAL_CARD_OWNER_INACTIVE'
  );
  assert.deepEqual(await directReturnArtifactCounts(db), emptyArtifacts);
  await db.run('UPDATE users SET is_active = 1 WHERE id = ?;', [admin.id]);

  const supersededCardToken = card.qrToken;
  card = await cards.rotateCard(card.id, admin.id);
  await expectCode(
    returns.executeReturn({
      input: { ...referencedInput, approvalCardToken: supersededCardToken },
      actor: returningCashier,
      idempotencyKey: 'direct-return-rotated-card',
    }),
    'APPROVAL_CARD_SUPERSEDED'
  );
  assert.deepEqual(await directReturnArtifactCounts(db), emptyArtifacts);

  await expectCode(
    returns.executeReturn({
      input: {
        ...referencedInput,
        items: [{ orderItemId: line.id, quantity: 3, disposition: 'RESTOCK' }],
        approvalCardToken: card.qrToken,
      },
      actor: returningCashier,
      idempotencyKey: 'direct-return-excess-quantity',
    }),
    'RETURN_QUANTITY_EXCEEDED'
  );
  assert.deepEqual(await directReturnArtifactCounts(db), emptyArtifacts);

  const originalOpeningCash = returningShift.opening_cash;
  await db.run('UPDATE shifts SET opening_cash = 1000 WHERE id = ?;', [returningShift.id]);
  try {
    await expectCode(
      returns.executeReturn({
        input: { ...referencedInput, approvalCardToken: card.qrToken },
        actor: returningCashier,
        idempotencyKey: 'direct-return-insufficient-cash',
      }),
      'INSUFFICIENT_DRAWER_CASH'
    );
  } finally {
    await db.run('UPDATE shifts SET opening_cash = ? WHERE id = ?;', [
      originalOpeningCash,
      returningShift.id,
    ]);
  }
  assert.deepEqual(
    await directReturnArtifactCounts(db),
    emptyArtifacts,
    'a failed direct return must roll back every financial, stock, receipt, audit, and idempotency row'
  );

  const successfulInput = {
    ...executeInput,
    approvalCardToken: card.qrToken,
    refundReferences: [
      { paymentMethodId: external.paymentMethodId, referenceNumber: 'direct-card-refund-1' },
    ],
  };
  const executed = await returns.executeReturn({
    input: successfulInput,
    actor: returningCashier,
    idempotencyKey: 'direct-return-success',
  });
  assert.equal(executed.statusCode, 201);
  assert.equal(executed.data.shiftId, returningShift.id);
  assert.equal(executed.data.approvalCardNumber, card.cardNumber);
  assert.equal((await db.get('SELECT COUNT(*) AS count FROM return_authorizations;')).count, 0);
  const persisted = await db.get('SELECT * FROM returns WHERE id = ?;', [executed.data.returnId]);
  assert.equal(persisted.cashier_id, returningCashier.id);
  assert.equal(persisted.shift_id, returningShift.id);
  assert.equal(persisted.authorization_id, null);
  assert.equal(persisted.approval_card_id, card.id);
  assert.equal(persisted.return_reason, executeInput.reason);
  assert.equal(JSON.parse(persisted.approval_snapshot_json).cardNumber, card.cardNumber);

  const replay = await returns.executeReturn({
    input: successfulInput,
    actor: returningCashier,
    idempotencyKey: 'direct-return-success',
  });
  assert.equal(replay.replayed, true);
  assert.equal(replay.data.returnId, executed.data.returnId);
  assert.equal((await db.get('SELECT COUNT(*) AS count FROM returns;')).count, 1);

  const afterFirstReturnArtifacts = await directReturnArtifactCounts(db);
  await expectCode(
    returns.executeReturn({
      input: { ...successfulInput, reason: 'A different payload must conflict' },
      actor: returningCashier,
      idempotencyKey: 'direct-return-success',
    }),
    'IDEMPOTENCY_KEY_CONFLICT'
  );
  assert.deepEqual(
    await directReturnArtifactCounts(db),
    afterFirstReturnArtifacts,
    'an idempotency conflict must not write a second return'
  );

  const partial = await returns.prepareReturn(
    { invoiceCode: order.invoice_number },
    returningCashier
  );
  assert.equal(partial.order.status, 'PARTIALLY_RETURNED');
  assert.equal(partial.previousReturns.length, 1);
  assert.equal(partial.items[0].returnedQuantity, 1);
  assert.equal(partial.items[0].remainingQuantity, 1);
  await expectCode(
    returns.quoteReturn(
      {
        orderId: order.id,
        items: [{ orderItemId: line.id, quantity: 2, disposition: 'RESTOCK' }],
      },
      returningCashier
    ),
    'RETURN_QUANTITY_EXCEEDED'
  );

  const finalItemInput = [
    {
      orderItemId: line.id,
      quantity: 1,
      disposition: 'NO_RESTOCK',
      noRestockReason: 'Cover damaged after sale',
    },
  ];
  const finalQuote = await returns.quoteReturn(
    { orderId: order.id, items: finalItemInput },
    returningCashier
  );
  assert.equal(finalQuote.totalRefund, 5000);
  assert.deepEqual(
    finalQuote.allocations.map(({ method, amount }) => ({ method, amount })),
    [
      { method: 'Cash', amount: 2000 },
      { method: 'Card', amount: 3000 },
    ]
  );
  const inventoryReturnsBeforeFinal = await db.get(
    "SELECT COUNT(*) AS count FROM inventory_ledger WHERE transaction_type = 'RETURN';"
  );
  const finalExecuted = await returns.executeReturn({
    input: {
      orderId: order.id,
      items: finalItemInput,
      reason: 'Second scan completes the invoice return',
      approvalCardToken: card.qrToken,
      refundReferences: [
        { paymentMethodId: external.paymentMethodId, referenceNumber: 'direct-card-refund-2' },
      ],
    },
    actor: returningCashier,
    idempotencyKey: 'direct-return-final-no-restock',
  });
  assert.equal(finalExecuted.data.invoiceStatus, 'RETURNED');
  assert.equal(finalExecuted.data.approvalCardNumber, card.cardNumber);
  const finalItem = await db.get('SELECT * FROM return_items WHERE return_id = ?;', [
    finalExecuted.data.returnId,
  ]);
  assert.equal(finalItem.disposition, 'NO_RESTOCK');
  assert.equal(finalItem.restocked, 0);
  assert.equal(finalItem.no_restock_reason, finalItemInput[0].noRestockReason);
  assert.equal(
    (
      await db.get(
        "SELECT COUNT(*) AS count FROM inventory_ledger WHERE transaction_type = 'RETURN';"
      )
    ).count,
    inventoryReturnsBeforeFinal.count,
    'NO_RESTOCK must not create inventory stock-in movement'
  );
  assert.equal(
    (
      await db.get(
        `SELECT COALESCE(SUM(ri.quantity), 0) AS quantity
           FROM return_items ri JOIN returns r ON r.id = ri.return_id
          WHERE r.order_id = ? AND ri.order_item_id = ?;`,
        [order.id, line.id]
      )
    ).quantity,
    2
  );
  assert.equal(
    (await db.get('SELECT status FROM orders WHERE id = ?;', [order.id])).status,
    'RETURNED'
  );
  await expectCode(
    returns.prepareReturn({ invoiceCode: order.invoice_number }, returningCashier),
    'INVOICE_NOT_RETURNABLE'
  );

  const adminList = await returns.listAdminReturns({ invoiceNumber: order.invoice_number });
  assert.equal(adminList.total, 2);
  assert.equal(adminList.returns[0].approvalCardNumber, card.cardNumber);
  const searchedAdminList = await returns.listAdminReturns({
    q: card.cardNumber,
    page: 1,
    limit: 1,
  });
  assert.equal(searchedAdminList.total, 2);
  assert.equal(searchedAdminList.pagination.page, 1);
  const adminDetail = await returns.getAdminReturn(executed.data.returnId);
  assert.equal(adminDetail.return.approvalSnapshot.cardNumber, card.cardNumber);
  assert.equal(adminDetail.items.length, 1);
  assert.equal(adminDetail.payments.length, 2);
  assert.equal(adminDetail.receipt.id, executed.data.receiptId);
  assert.equal(adminDetail.approvalCard.id, card.id);
  assert.equal(adminDetail.approvalCard.usedVersion, card.tokenVersion);
  assert.equal(adminDetail.approvalCard.currentVersion, card.tokenVersion);
  assert.equal(adminDetail.approvalCard.owner.id, admin.id);
  assert.equal(adminDetail.approvalCard.owner.role, 'Admin');
  assert.equal(adminDetail.approvalCard.owner.isActive, true);
  assert.equal(adminDetail.inventoryMovements.length, 1);
  assert.equal(adminDetail.inventoryMovements[0].productId, productId);
  assert.equal(adminDetail.inventoryMovements[0].quantityChanged, 1);
  assert.equal(adminDetail.inventoryMovements[0].referenceType, 'returns');
  assert.equal(adminDetail.inventoryMovements[0].referenceId, executed.data.returnId);
  const uses = await cards.listCardUses(card.id, { page: 1, limit: 1 });
  assert.equal(uses.total, 2);
  assert.equal(uses.uses[0].id, finalExecuted.data.returnId);

  await assert.rejects(
    db.run(
      `INSERT INTO returns (order_id, shift_id, cashier_id, total_refunded)
       VALUES (?, ?, ?, 0);`,
      [order.id, sellingShift.id, returningCashier.id]
    ),
    (error) => String(error?.message).includes('OPEN_OWN_SHIFT_REQUIRED')
  );

  const readable = await receipts.getReceiptDetails(saleReceipt.receipt_number, noShiftCashier);
  assert.equal(readable.id, saleReceipt.id, 'receipt viewing does not require a shift');
  await expectCode(
    receipts.requestReceiptPrint(
      saleReceipt.receipt_number,
      { requestKey: 'cashier-no-shift-print', copies: 1 },
      noShiftCashier
    ),
    'OPEN_OWN_SHIFT_REQUIRED'
  );
  const adminPrint = await receipts.requestReceiptPrint(
    saleReceipt.id,
    { requestKey: 'admin-print-override', copies: 1, isReprint: true },
    admin
  );
  assert.equal(adminPrint.admin_override, true);
  const printRow = await db.get('SELECT * FROM print_requests WHERE id = ?;', [
    adminPrint.request_id,
  ]);
  assert.equal(printRow.shift_id, null);
  assert.equal(printRow.actor_role_snapshot, 'Admin');
  assert.equal(printRow.admin_override, 1);
  assert.deepEqual(await invoices.authorizeInvoicePdfOutput(admin), {
    shiftId: null,
    actorRoleSnapshot: 'Admin',
    adminOverride: true,
  });
  await expectCode(invoices.authorizeInvoicePdfOutput(noShiftCashier), 'OPEN_OWN_SHIFT_REQUIRED');

  console.log(
    'Direct cross-cashier returns, reusable card validation, DB guards, and Admin print override passed.'
  );
} finally {
  await disposeTestEnvironment(environment, db);
}

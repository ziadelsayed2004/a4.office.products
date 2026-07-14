import assert from 'node:assert/strict';
import { createTestEnvironment, disposeTestEnvironment } from './test-environment.js';

const environment = createTestEnvironment('approval-cards');
let db;
try {
  const [dbModule, migrations, cards, shifts] = await Promise.all([
    import('../db/index.js'),
    import('../db/migrate.js'),
    import('../modules/returnApprovalCards/returnApprovalCards.service.js'),
    import('../modules/shifts/shifts.service.js'),
  ]);
  db = dbModule.default;
  await migrations.runMigrations();
  const admin = await db.get("SELECT * FROM users WHERE role='Admin' LIMIT 1;");
  const cashier = await db.get("SELECT * FROM users WHERE role='Cashier' LIMIT 1;");
  const card = await cards.createCard({ label: 'Main return approval', adminId: admin.id });
  assert.equal(card.status, 'ACTIVE');
  assert.match(card.qrToken, /^rac_/);
  assert.equal((await cards.resolveCardToken(card.qrToken)).action, 'VALID');
  assert.equal((await cards.resolveCardToken(card.qrToken)).type, 'return_approval_card');
  assert.equal((await cards.resolveCardToken(card.qrToken)).data.qrToken, undefined);
  const rotated = await cards.rotateCard(card.id, admin.id);
  await assert.rejects(
    () => cards.resolveCardToken(card.qrToken),
    (error) => error.code === 'APPROVAL_CARD_SUPERSEDED'
  );
  assert.equal((await cards.resolveCardToken(rotated.qrToken)).action, 'VALID');
  const disabled = await cards.setCardStatus(card.id, 'DISABLED', {
    adminId: admin.id,
    reason: 'lost',
  });
  assert.equal(disabled.status, 'DISABLED');
  assert.equal((await cards.resolveCardToken(rotated.qrToken)).action, 'BLOCKED');
  await cards.setCardStatus(card.id, 'ACTIVE', { adminId: admin.id });
  assert.equal((await cards.resolveCardToken(rotated.qrToken)).action, 'VALID');

  const printInput = {
    requestKey: 'approval-card-print-0001',
    copies: 2,
    reason: 'Admin desk copy',
  };
  const firstPrint = await cards.requestPrint(card.id, printInput, admin);
  assert.equal(firstPrint.replayed, false);
  assert.equal(firstPrint.card.printCount, 2);
  const replay = await cards.requestPrint(card.id, printInput, admin);
  assert.equal(replay.replayed, true);
  assert.equal(replay.card.printCount, 2);
  await assert.rejects(
    () => cards.requestPrint(card.id, { ...printInput, copies: 3 }, admin),
    (error) => error.code === 'PRINT_REQUEST_KEY_CONFLICT'
  );
  const secondCard = await cards.createCard({
    label: 'Second return approval',
    adminId: admin.id,
  });
  await assert.rejects(
    () => cards.requestPrint(secondCard.id, printInput, admin),
    (error) => error.code === 'PRINT_REQUEST_KEY_CONFLICT'
  );

  const auxiliaryAdmin = await db.run(
    `INSERT INTO users (username, password_hash, role, name, is_active)
     VALUES ('approval-card-admin', ?, 'Admin', 'Approval card Admin', 1);`,
    [admin.password_hash]
  );
  await cards.setCardStatus(card.id, 'DISABLED', {
    adminId: auxiliaryAdmin.lastID,
    reason: 'Owner status validation fixture',
  });
  await db.run('UPDATE users SET is_active = 0 WHERE id = ?;', [admin.id]);
  await assert.rejects(
    () =>
      cards.requestPrint(
        secondCard.id,
        { requestKey: 'approval-card-owner-check', copies: 1 },
        { id: auxiliaryAdmin.lastID, role: 'Admin' }
      ),
    (error) => error.code === 'APPROVAL_CARD_OWNER_INACTIVE'
  );
  await assert.rejects(
    () => cards.setCardStatus(card.id, 'ACTIVE', { adminId: auxiliaryAdmin.lastID }),
    (error) => error.code === 'APPROVAL_CARD_OWNER_INACTIVE'
  );
  await db.run('UPDATE users SET is_active = 1 WHERE id = ?;', [admin.id]);
  await cards.setCardStatus(card.id, 'ACTIVE', { adminId: auxiliaryAdmin.lastID });

  await assert.rejects(
    () => shifts.openShift(admin.id, 0),
    (error) => error.code === 'CASHIER_REQUIRED'
  );
  assert.equal((await shifts.openShift(cashier.id, 0)).shift.user_id, cashier.id);
  console.log('Reusable approval-card lifecycle and cashier shift isolation passed.');
} finally {
  await disposeTestEnvironment(environment, db);
}

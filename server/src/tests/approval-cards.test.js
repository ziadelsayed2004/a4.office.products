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
  await assert.rejects(
    () => shifts.openShift(admin.id, 0),
    (error) => error.code === 'CASHIER_REQUIRED'
  );
  assert.equal((await shifts.openShift(cashier.id, 0)).shift.user_id, cashier.id);
  console.log('Reusable approval-card lifecycle and cashier shift isolation passed.');
} finally {
  await disposeTestEnvironment(environment, db);
}

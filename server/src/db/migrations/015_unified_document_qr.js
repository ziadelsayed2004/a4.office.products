import crypto from 'node:crypto';

export const version = '015';
export const name = 'unified_document_qr';
export const checksum = crypto
  .createHash('sha256')
  .update(`${version}:${name}:2026-08-08-v1`)
  .digest('hex');

async function rememberAlias(db, alias, documentType, referenceId) {
  const value = String(alias || '').trim();
  if (!value || !referenceId) return;
  await db.run(
    `INSERT OR IGNORE INTO document_qr_aliases (alias, document_type, reference_id)
     VALUES (?, ?, ?);`,
    [value, documentType, referenceId]
  );
}

function snapshotQr(snapshot, qrToken) {
  if (!snapshot || typeof snapshot !== 'object') return snapshot;
  return { ...snapshot, qrToken };
}

export async function up(db) {
  await db.exec(`
    CREATE TABLE IF NOT EXISTS document_qr_aliases (
      alias TEXT PRIMARY KEY,
      document_type TEXT NOT NULL CHECK (document_type IN ('preorder', 'invoice', 'return')),
      reference_id INTEGER NOT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_document_qr_aliases_reference
      ON document_qr_aliases(document_type, reference_id);
  `);

  const preorders = await db.all(
    'SELECT id, preorder_number, qr_pickup_token FROM preorders WHERE preorder_number IS NOT NULL;'
  );
  for (const row of preorders) {
    if (row.qr_pickup_token && row.qr_pickup_token !== row.preorder_number) {
      await rememberAlias(db, row.qr_pickup_token, 'preorder', row.id);
    }
    await db.run('UPDATE preorders SET qr_pickup_token = ? WHERE id = ?;', [
      row.preorder_number,
      row.id,
    ]);
    await db.run(
      `UPDATE secure_tokens SET token = ?
       WHERE token_type = 'preorder' AND reference_id = ?;`,
      [row.preorder_number, row.id]
    );
    await db.run("UPDATE qr_tokens SET token = ? WHERE type = 'preorder' AND reference_id = ?;", [
      row.preorder_number,
      row.id,
    ]);
  }

  const orders = await db.all(
    'SELECT id, invoice_number, qr_token FROM orders WHERE invoice_number IS NOT NULL;'
  );
  for (const row of orders) {
    if (row.qr_token && row.qr_token !== row.invoice_number) {
      await rememberAlias(db, row.qr_token, 'invoice', row.id);
    }
    await db.run('UPDATE orders SET qr_token = ? WHERE id = ?;', [row.invoice_number, row.id]);
    await db.run(
      `UPDATE secure_tokens SET token = ?
       WHERE token_type = 'invoice' AND reference_id = ?;`,
      [row.invoice_number, row.id]
    );
  }

  const returns = await db.all(
    `SELECT r.id, r.return_number, rec.qr_token
       FROM returns r LEFT JOIN receipts rec
         ON rec.reference_type = 'order_return' AND rec.reference_id = r.id;`
  );
  for (const row of returns) {
    if (row.qr_token && row.qr_token !== row.return_number) {
      await rememberAlias(db, row.qr_token, 'return', row.id);
    }
  }

  await db.run(`
    UPDATE receipts
       SET qr_token = (
         SELECT p.preorder_number FROM preorders p
          WHERE receipts.reference_type = 'preorder_deposit' AND receipts.reference_id = p.id
       )
     WHERE reference_type = 'preorder_deposit';
  `);
  await db.run(`
    UPDATE receipts
       SET qr_token = (
         SELECT o.invoice_number FROM orders o
          WHERE receipts.reference_type = 'order_sale' AND receipts.reference_id = o.id
       )
     WHERE reference_type = 'order_sale';
  `);
  await db.run(`
    UPDATE receipts
       SET qr_token = (
         SELECT o.invoice_number FROM preorders p JOIN orders o ON o.id = p.pickup_order_id
          WHERE receipts.reference_type = 'preorder_pickup' AND receipts.reference_id = p.id
       )
     WHERE reference_type = 'preorder_pickup';
  `);
  await db.run(`
    UPDATE receipts
       SET qr_token = (
         SELECT r.return_number FROM returns r
          WHERE receipts.reference_type = 'order_return' AND receipts.reference_id = r.id
       )
     WHERE reference_type = 'order_return';
  `);

  const receipts = await db.all(
    `SELECT id, reference_type, reference_id, snapshot_json, qr_token
       FROM receipts WHERE qr_token IS NOT NULL;`
  );
  for (const receipt of receipts) {
    let snapshot = null;
    try {
      snapshot = JSON.parse(receipt.snapshot_json || 'null');
    } catch {
      snapshot = null;
    }
    if (snapshot && receipt.qr_token) {
      await db.run('UPDATE receipts SET snapshot_json = ? WHERE id = ?;', [
        JSON.stringify(snapshotQr(snapshot, receipt.qr_token)),
        receipt.id,
      ]);
    }
  }
}

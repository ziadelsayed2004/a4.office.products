const db = require('../../db');
const paymentsService = require('../payments/paymentsService');

/**
 * Record a manual financial adjustment (deposit, withdrawal, or receivable credit/debit adjustment).
 */
async function recordManualAdjustment({ outletId, amount, adjustmentType, title, notes, userId }) {
  const isOutletRequired = adjustmentType !== 'salary';
  const resolvedOutletId = outletId ? parseInt(outletId, 10) : null;

  if (isOutletRequired && !resolvedOutletId) {
    throw new Error('Outlet ID is required');
  }
  const parsedAmount = parseFloat(amount);
  if (isNaN(parsedAmount) || parsedAmount <= 0) {
    throw new Error('Amount must be a positive number');
  }
  if (!adjustmentType || !['deposit', 'withdrawal', 'credit_adjustment', 'debit_adjustment', 'expense', 'salary'].includes(adjustmentType)) {
    throw new Error('Invalid adjustment type');
  }
  if (!notes || notes.trim() === '') {
    throw new Error('Notes/Reason is required for manual adjustments');
  }

  if (resolvedOutletId) {
    const outlet = await db.get('SELECT id FROM outlets WHERE id = ?', [resolvedOutletId]);
    if (!outlet) {
      throw new Error(`Outlet with ID ${resolvedOutletId} does not exist`);
    }
  }

  await db.exec('BEGIN TRANSACTION;');

  try {
    let signedAmount = parsedAmount;
    if (['withdrawal', 'credit_adjustment', 'expense', 'salary'].includes(adjustmentType)) {
      signedAmount = -parsedAmount;
    }

    const adjSql = `
      INSERT INTO manual_adjustments (outlet_id, amount, adjustment_type, title, notes, created_by)
      VALUES (?, ?, ?, ?, ?, ?)
    `;
    const adjResult = await db.run(adjSql, [resolvedOutletId, signedAmount, adjustmentType, title ? title.trim() : null, notes.trim(), userId]);
    const adjId = adjResult.lastID;

    let cashImpact = 0;
    let receivableImpact = 0;

    if (adjustmentType === 'deposit') {
      cashImpact = parsedAmount;
    } else if (adjustmentType === 'withdrawal') {
      cashImpact = -parsedAmount;
    } else if (adjustmentType === 'credit_adjustment') {
      receivableImpact = -parsedAmount;
    } else if (adjustmentType === 'debit_adjustment') {
      receivableImpact = parsedAmount;
    } else if (adjustmentType === 'expense') {
      cashImpact = -parsedAmount;
    } else if (adjustmentType === 'salary') {
      cashImpact = -parsedAmount;
    }

    await db.run(`
      INSERT INTO finance_ledger_entries (
        outlet_id, entry_type, reference_type, reference_id,
        cash_amount, receivable_amount, title, notes, created_by
      ) VALUES (?, 'manual_adjustment', 'manual', ?, ?, ?, ?, ?, ?)
    `, [resolvedOutletId, adjId, cashImpact, receivableImpact, title ? title.trim() : null, notes.trim(), userId]);

    await db.exec('COMMIT;');
    return {
      id: adjId,
      outletId: resolvedOutletId,
      amount: signedAmount,
      adjustmentType,
      title: title ? title.trim() : null,
      notes: notes.trim(),
      createdBy: userId
    };
  } catch (err) {
    await db.exec('ROLLBACK;');
    throw err;
  }
}

/**
 * Fetch overview finance metrics in Egypt timezone and EGP.
 */
async function getFinanceSummary(outletIds = null, authorIds = null) {
  let totalInvoicesSql = `
    SELECT COALESCE(SUM(total_price), 0) as total, COUNT(*) as count
    FROM invoices i
    WHERE i.payment_status != 'cancelled'
  `;
  let ledgerSql = `
    SELECT 
      COALESCE(SUM(cash_amount), 0) as totalCollected,
      COALESCE(SUM(receivable_amount), 0) as totalReceivables
    FROM finance_ledger_entries fle
    WHERE 1=1
  `;
  let partialShipmentsSql = `
    SELECT COUNT(*) as count
    FROM invoices i
    WHERE i.shipping_status = 'partial' AND i.payment_status != 'cancelled'
  `;

  const params = [];
  const ledgerParams = [];

  if (outletIds && outletIds.length > 0) {
    const placeholders = outletIds.map(() => '?').join(',');
    totalInvoicesSql += ` AND i.outlet_id IN (${placeholders})`;
    ledgerSql += ` AND fle.outlet_id IN (${placeholders})`;
    partialShipmentsSql += ` AND i.outlet_id IN (${placeholders})`;
    params.push(...outletIds);
    ledgerParams.push(...outletIds);
  } else if (outletIds) {
    totalInvoicesSql += ` AND 0=1`;
    ledgerSql += ` AND 0=1`;
    partialShipmentsSql += ` AND 0=1`;
  }

  if (authorIds && authorIds.length > 0) {
    const placeholders = authorIds.map(() => '?').join(',');
    const authorFilter = ` AND i.id IN (
      SELECT ii.invoice_id
      FROM invoice_items ii
      JOIN product_authors pa ON pa.product_id = ii.product_id
      WHERE pa.author_id IN (${placeholders})
    )`;
    totalInvoicesSql += authorFilter;
    partialShipmentsSql += authorFilter;
    params.push(...authorIds);
  } else if (authorIds) {
    totalInvoicesSql += ` AND 0=1`;
    partialShipmentsSql += ` AND 0=1`;
  }

  let suppliedSql = `
    SELECT COALESCE(SUM(p.amount), 0) as total
    FROM invoice_payments p
    JOIN invoices i ON i.id = p.invoice_id
    WHERE i.payment_status != 'cancelled' AND p.supply_status = 'supplied' AND p.receipt_status = 'approved'
  `;
  let unsuppliedSql = `
    SELECT COALESCE(SUM(p.amount), 0) as total
    FROM invoice_payments p
    JOIN invoices i ON i.id = p.invoice_id
    WHERE i.payment_status != 'cancelled' AND p.supply_status = 'not_supplied' AND p.receipt_status = 'approved'
  `;
  let unreviewedReceiptsSql = `
    SELECT COALESCE(SUM(p.amount), 0) as total, COUNT(p.id) as count
    FROM invoice_payments p
    JOIN invoices i ON i.id = p.invoice_id
    WHERE i.payment_status != 'cancelled' AND p.receipt_status = 'pending_review'
  `;
  let rejectedReceiptsSql = `
    SELECT COALESCE(SUM(p.amount), 0) as total
    FROM invoice_payments p
    JOIN invoices i ON i.id = p.invoice_id
    WHERE i.payment_status != 'cancelled' AND p.receipt_status = 'rejected'
  `;
  let returnsSql = `
    SELECT COALESCE(SUM(return_value), 0) as total
    FROM returns r
    WHERE r.status = 'approved'
  `;

  const subParams = [];
  if (outletIds && outletIds.length > 0) {
    const placeholders = outletIds.map(() => '?').join(',');
    suppliedSql += ` AND i.outlet_id IN (${placeholders})`;
    unsuppliedSql += ` AND i.outlet_id IN (${placeholders})`;
    unreviewedReceiptsSql += ` AND i.outlet_id IN (${placeholders})`;
    rejectedReceiptsSql += ` AND i.outlet_id IN (${placeholders})`;
    returnsSql += ` AND r.outlet_id IN (${placeholders})`;
    subParams.push(...outletIds);
  } else if (outletIds) {
    suppliedSql += ` AND 0=1`;
    unsuppliedSql += ` AND 0=1`;
    unreviewedReceiptsSql += ` AND 0=1`;
    rejectedReceiptsSql += ` AND 0=1`;
    returnsSql += ` AND 0=1`;
  }

  if (authorIds && authorIds.length > 0) {
    const placeholders = authorIds.map(() => '?').join(',');
    const authorFilter = ` AND i.id IN (
      SELECT ii.invoice_id
      FROM invoice_items ii
      JOIN product_authors pa ON pa.product_id = ii.product_id
      WHERE pa.author_id IN (${placeholders})
    )`;
    suppliedSql += authorFilter;
    unsuppliedSql += authorFilter;
    unreviewedReceiptsSql += authorFilter;
    rejectedReceiptsSql += authorFilter;
    subParams.push(...authorIds);

    returnsSql += ` AND r.invoice_id IN (
      SELECT ii.invoice_id
      FROM invoice_items ii
      JOIN product_authors pa ON pa.product_id = ii.product_id
      WHERE pa.author_id IN (${placeholders})
    )`;
    subParams.push(...authorIds);
  } else if (authorIds) {
    suppliedSql += ` AND 0=1`;
    unsuppliedSql += ` AND 0=1`;
    unreviewedReceiptsSql += ` AND 0=1`;
    rejectedReceiptsSql += ` AND 0=1`;
    returnsSql += ` AND 0=1`;
  }

  let stockAlertsSql = `
    SELECT COUNT(*) as count FROM (
      SELECT p.id, COALESCE(SUM(t.quantity), 0) as stock
      FROM products p
      LEFT JOIN inventory_transactions t ON t.product_id = p.id
      LEFT JOIN product_authors pa ON pa.product_id = p.id
      WHERE p.status = 'active' AND p.stock_policy != 'ignore'
  `;
  const stockParams = [];
  if (authorIds && authorIds.length > 0) {
    const placeholders = authorIds.map(() => '?').join(',');
    stockAlertsSql += ` AND pa.author_id IN (${placeholders})`;
    stockParams.push(...authorIds);
  }
  stockAlertsSql += ` GROUP BY p.id HAVING stock <= 10 )`;

  const invoiceRow = await db.get(totalInvoicesSql, params);
  const ledgerRow = await db.get(ledgerSql, ledgerParams);
  const suppliedRow = await db.get(suppliedSql, subParams);
  const unsuppliedRow = await db.get(unsuppliedSql, subParams);
  const unreviewedRow = await db.get(unreviewedReceiptsSql, subParams);
  const rejectedRow = await db.get(rejectedReceiptsSql, subParams);
  const returnsRow = await db.get(returnsSql, subParams);
  const partialShipmentsRow = await db.get(partialShipmentsSql, params);
  const stockAlertsRow = await db.get(stockAlertsSql, stockParams);

  const totalInvoices = invoiceRow.total;
  const totalInvoicesCount = invoiceRow.count;
  const totalCollected = ledgerRow.totalCollected;
  const totalReceivables = ledgerRow.totalReceivables;
  const suppliedBalance = suppliedRow.total;
  const unsuppliedBalance = unsuppliedRow.total;
  const unreviewedBalance = unreviewedRow.total;
  const unreviewedCount = unreviewedRow.count || 0;
  const rejectedBalance = rejectedRow.total;
  const returnBalance = returnsRow.total;
  const partialShipmentsCount = partialShipmentsRow ? partialShipmentsRow.count : 0;
  const stockAlertsCount = stockAlertsRow ? stockAlertsRow.count : 0;

  return {
    totalInvoices,
    totalInvoicesCount,
    totalCollected,
    totalReceivables,
    totalOverdue: 0,

    invoice_total: totalInvoices,
    collected_total: totalCollected,
    pending_balance: totalReceivables,
    pendingBalance: totalReceivables,
    actualBalance: totalCollected,
    suppliedBalance,
    unsuppliedBalance,
    supplied_balance: suppliedBalance,
    unsupplied_balance: unsuppliedBalance,

    pending: totalReceivables,
    collected: totalCollected,
    supplied: suppliedBalance,
    unsupplied: unsuppliedBalance,
    unreviewedReceipts: unreviewedBalance,
    unreviewedCount,
    rejectedReceipts: rejectedBalance,
    unreviewed_receipts: unreviewedBalance,
    unreviewed_count: unreviewedCount,
    rejected_receipts: rejectedBalance,
    returns: returnBalance,
    partialShipmentsCount,
    stockAlertsCount
  };
}

/**
 * Retrieve finance ledger entries history.
 */
async function getLedgerHistory({ limit = 50, offset = 0, outletId = null, startDate = '', endDate = '', entryType = '', outletIds = null } = {}) {
  let sql = `
    SELECT fle.*, o.name as outlet_name, u.full_name as user_full_name
    FROM finance_ledger_entries fle
    LEFT JOIN outlets o ON o.id = fle.outlet_id
    LEFT JOIN users u ON u.id = fle.created_by
    WHERE 1=1
  `;
  const params = [];

  if (outletId) {
    sql += ` AND fle.outlet_id = ?`;
    params.push(outletId);
  }
  if (startDate) {
    sql += ` AND fle.created_at >= ?`;
    params.push(startDate);
  }
  if (endDate) {
    sql += ` AND fle.created_at <= ?`;
    params.push(endDate);
  }
  if (entryType) {
    sql += ` AND fle.entry_type = ?`;
    params.push(entryType);
  }
  if (outletIds && outletIds.length > 0) {
    sql += ` AND fle.outlet_id IN (${outletIds.map(() => '?').join(',')})`;
    params.push(...outletIds);
  } else if (outletIds) {
    sql += ` AND 0=1`;
  }

  sql += ` ORDER BY fle.created_at DESC, fle.id DESC LIMIT ? OFFSET ?`;
  params.push(limit, offset);

  return await db.all(sql, params);
}

/**
 * Group balances by outlet.
 */
async function getBalancesByOutlet(outletIds = null) {
  let sql = `
    SELECT 
      o.id, 
      o.name, 
      o.governorate, 
      ot.name as outlet_type_name,
      o.credit_limit
    FROM outlets o
    JOIN outlet_types ot ON ot.id = o.outlet_type_id
    WHERE 1=1
  `;
  const params = [];
  if (outletIds && outletIds.length > 0) {
    sql += ` AND o.id IN (${outletIds.map(() => '?').join(',')})`;
    params.push(...outletIds);
  } else if (outletIds) {
    sql += ` AND 0=1`;
  }
  
  sql += ` ORDER BY o.name ASC`;
  const outlets = await db.all(sql, params);

  const results = [];
  for (const outlet of outlets) {
    const summary = await getFinanceSummary([outlet.id]);
    results.push({
      id: outlet.id,
      name: outlet.name,
      governorate: outlet.governorate,
      outlet_type_name: outlet.outlet_type_name,
      credit_limit: outlet.credit_limit,
      invoice_total: summary.totalInvoices,
      collected_total: summary.totalCollected,
      pending_balance: summary.pendingBalance,
      supplied_balance: summary.suppliedBalance,
      unsupplied_balance: summary.unsuppliedBalance,
      collected_balance: summary.totalCollected,
      receivable_balance: summary.totalReceivables,
      return_balance: summary.returns
    });
  }
  return results;
}

/**
 * Group balances by governorate.
 */
async function getBalancesByGovernorate() {
  const sql = `
    SELECT 
      o.governorate,
      COALESCE(SUM(fle.cash_amount), 0) as collected_balance,
      COALESCE(SUM(fle.receivable_amount), 0) as receivable_balance
    FROM outlets o
    LEFT JOIN finance_ledger_entries fle ON fle.outlet_id = o.id
    GROUP BY o.governorate
    ORDER BY o.governorate ASC
  `;
  return await db.all(sql);
}

/**
 * Group balances by outlet type.
 */
async function getBalancesByOutletType() {
  const sql = `
    SELECT 
      ot.id,
      ot.name as outlet_type_name,
      COALESCE(SUM(fle.cash_amount), 0) as collected_balance,
      COALESCE(SUM(fle.receivable_amount), 0) as receivable_balance
    FROM outlet_types ot
    LEFT JOIN outlets o ON o.outlet_type_id = ot.id
    LEFT JOIN finance_ledger_entries fle ON fle.outlet_id = o.id
    GROUP BY ot.id
    ORDER BY ot.name ASC
  `;
  return await db.all(sql);
}

/**
 * Generate per-outlet statement of account in chronological order.
 */
async function getOutletStatement(outletId) {
  const outlet = await db.get('SELECT * FROM outlets WHERE id = ?', [outletId]);
  if (!outlet) {
    throw new Error(`Outlet with ID ${outletId} does not exist`);
  }

  const entries = await db.all(`
    SELECT fle.*, u.full_name as user_full_name
    FROM finance_ledger_entries fle
    LEFT JOIN users u ON u.id = fle.created_by
    WHERE fle.outlet_id = ?
    ORDER BY fle.created_at ASC, fle.id ASC
  `, [outletId]);

  let runningReceivable = 0;
  let runningCash = 0;

  const statement = entries.map(entry => {
    runningReceivable += entry.receivable_amount;
    runningCash += entry.cash_amount;
    return {
      id: entry.id,
      entry_type: entry.entry_type,
      reference_type: entry.reference_type,
      reference_id: entry.reference_id,
      cash_amount: entry.cash_amount,
      receivable_amount: entry.receivable_amount,
      notes: entry.notes,
      created_by: entry.created_by,
      user_full_name: entry.user_full_name,
      created_at: entry.created_at,
      running_receivable: parseFloat(runningReceivable.toFixed(2)),
      running_cash: parseFloat(runningCash.toFixed(2))
    };
  });

  const summary = await getFinanceSummary([outletId]);

  return {
    outlet: {
      id: outlet.id,
      name: outlet.name,
      governorate: outlet.governorate,
      credit_limit: outlet.credit_limit
    },
    summary: {
      invoice_total: summary.invoice_total,
      collected_total: summary.collected_total,
      supplied_balance: summary.supplied_balance,
      unsupplied_balance: summary.unsupplied_balance,
      return_balance: summary.returns,
      pending_balance: summary.pending_balance,
      net_exposure: summary.pending_balance
    },
    statement
  };
}

module.exports = {
  recordManualAdjustment,
  getFinanceSummary,
  getLedgerHistory,
  getBalancesByOutlet,
  getBalancesByGovernorate,
  getBalancesByOutletType,
  getOutletStatement
};

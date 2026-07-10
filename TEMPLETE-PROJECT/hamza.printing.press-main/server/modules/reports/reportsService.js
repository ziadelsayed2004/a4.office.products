const db = require('../../db');

/**
 * Get overall financial summary.
 */
async function getFinancialSummary({ startDate = '', endDate = '', outletId = null, outletTypeId = null, governorate = '', authorIds = null } = {}) {
  // 1. Calculate sales metrics from invoices table
  let salesSql = `
    SELECT 
      COALESCE(SUM(i.total_price), 0) as totalSales,
      COALESCE(SUM(i.shipping_cost), 0) as totalShipping,
      COALESCE(SUM(i.discount), 0) as totalDiscount,
      COALESCE(SUM(i.subtotal), 0) as totalSubtotal,
      COALESCE(SUM(CASE WHEN i.payment_type = 'deferred' THEN i.total_price ELSE 0 END), 0) as totalDeferredRemaining,
      COALESCE(SUM(CASE WHEN i.payment_type = 'cash' THEN i.total_price ELSE 0 END), 0) as totalCashSales
    FROM invoices i
    JOIN outlets o ON o.id = i.outlet_id
    WHERE i.payment_status != 'cancelled'
  `;
  const salesParams = [];

  if (authorIds && authorIds.length > 0) {
    salesSql += ` AND i.id IN (
      SELECT ii.invoice_id
      FROM invoice_items ii
      JOIN product_authors pa ON pa.product_id = ii.product_id
      WHERE pa.author_id IN (${authorIds.map(() => '?').join(',')})
    )`;
    salesParams.push(...authorIds);
  } else if (authorIds) {
    salesSql += ` AND 0=1`;
  }

  if (startDate) {
    salesSql += ` AND i.created_at >= ?`;
    salesParams.push(startDate);
  }
  if (endDate) {
    salesSql += ` AND i.created_at <= ?`;
    salesParams.push(endDate);
  }
  if (outletId) {
    salesSql += ` AND i.outlet_id = ?`;
    salesParams.push(outletId);
  }
  if (outletTypeId) {
    salesSql += ` AND o.outlet_type_id = ?`;
    salesParams.push(outletTypeId);
  }
  if (governorate) {
    salesSql += ` AND o.governorate = ?`;
    salesParams.push(governorate);
  }

  const salesRow = await db.get(salesSql, salesParams);

  // 2. Calculate paid & remaining metrics from finance ledger
  let ledgerSql = `
    SELECT 
      COALESCE(SUM(fle.cash_amount), 0) as totalCollected,
      COALESCE(SUM(fle.receivable_amount), 0) as totalReceivables
    FROM finance_ledger_entries fle
    JOIN outlets o ON o.id = fle.outlet_id
    WHERE 1=1
  `;
  const ledgerParams = [];

  if (authorIds && authorIds.length > 0) {
    ledgerSql += ` AND (
      (fle.reference_type = 'invoice' AND fle.reference_id IN (
        SELECT ii.invoice_id
        FROM invoice_items ii
        JOIN product_authors pa ON pa.product_id = ii.product_id
        WHERE pa.author_id IN (${authorIds.map(() => '?').join(',')})
      ))
      OR
      (fle.reference_type = 'payment' AND fle.reference_id IN (
        SELECT ip.id
        FROM invoice_payments ip
        WHERE ip.invoice_id IN (
          SELECT ii.invoice_id
          FROM invoice_items ii
          JOIN product_authors pa ON pa.product_id = ii.product_id
          WHERE pa.author_id IN (${authorIds.map(() => '?').join(',')})
        )
      ))
    )`;
    ledgerParams.push(...authorIds, ...authorIds);
  } else if (authorIds) {
    ledgerSql += ` AND 0=1`;
  }

  if (startDate) {
    ledgerSql += ` AND fle.created_at >= ?`;
    ledgerParams.push(startDate);
  }
  if (endDate) {
    ledgerSql += ` AND fle.created_at <= ?`;
    ledgerParams.push(endDate);
  }
  if (outletId) {
    ledgerSql += ` AND fle.outlet_id = ?`;
    ledgerParams.push(outletId);
  }
  if (outletTypeId) {
    ledgerSql += ` AND o.outlet_type_id = ?`;
    ledgerParams.push(outletTypeId);
  }
  if (governorate) {
    ledgerSql += ` AND o.governorate = ?`;
    ledgerParams.push(governorate);
  }

  const ledgerRow = await db.get(ledgerSql, ledgerParams);

  // 3. Calculate supplied & unsupplied payment metrics from invoice_payments table
  let paymentSql = `
    SELECT 
      COALESCE(SUM(CASE WHEN ip.supply_status = 'supplied' THEN ip.amount ELSE 0 END), 0) as totalSupplied,
      COALESCE(SUM(CASE WHEN ip.supply_status = 'not_supplied' THEN ip.amount ELSE 0 END), 0) as totalUnsupplied
    FROM invoice_payments ip
    JOIN invoices i ON i.id = ip.invoice_id
    JOIN outlets o ON o.id = i.outlet_id
    WHERE i.payment_status != 'cancelled'
  `;
  const paymentParams = [];

  if (authorIds && authorIds.length > 0) {
    paymentSql += ` AND i.id IN (
      SELECT ii.invoice_id
      FROM invoice_items ii
      JOIN product_authors pa ON pa.product_id = ii.product_id
      WHERE pa.author_id IN (${authorIds.map(() => '?').join(',')})
    )`;
    paymentParams.push(...authorIds);
  } else if (authorIds) {
    paymentSql += ` AND 0=1`;
  }

  if (startDate) {
    paymentSql += ` AND ip.payment_date >= ?`;
    paymentParams.push(startDate);
  }
  if (endDate) {
    paymentSql += ` AND ip.payment_date <= ?`;
    paymentParams.push(endDate);
  }
  if (outletId) {
    paymentSql += ` AND i.outlet_id = ?`;
    paymentParams.push(outletId);
  }
  if (outletTypeId) {
    paymentSql += ` AND o.outlet_type_id = ?`;
    paymentParams.push(outletTypeId);
  }
  if (governorate) {
    paymentSql += ` AND o.governorate = ?`;
    paymentParams.push(governorate);
  }

  const paymentRow = await db.get(paymentSql, paymentParams);

  // 4. Calculate invoice shipping status counts
  let shipSql = `
    SELECT 
      COALESCE(SUM(CASE WHEN i.shipping_status = 'shipped' OR i.shipping_status = 'delivered' THEN 1 ELSE 0 END), 0) as countShipped,
      COALESCE(SUM(CASE WHEN i.shipping_status = 'partially_shipped' THEN 1 ELSE 0 END), 0) as countPartiallyShipped,
      COALESCE(SUM(CASE WHEN i.shipping_status = 'pending' THEN 1 ELSE 0 END), 0) as countNotShipped
    FROM invoices i
    JOIN outlets o ON o.id = i.outlet_id
    WHERE i.payment_status != 'cancelled'
  `;
  const shipParams = [];

  if (authorIds && authorIds.length > 0) {
    shipSql += ` AND i.id IN (
      SELECT ii.invoice_id
      FROM invoice_items ii
      JOIN product_authors pa ON pa.product_id = ii.product_id
      WHERE pa.author_id IN (${authorIds.map(() => '?').join(',')})
    )`;
    shipParams.push(...authorIds);
  } else if (authorIds) {
    shipSql += ` AND 0=1`;
  }

  if (startDate) {
    shipSql += ` AND i.created_at >= ?`;
    shipParams.push(startDate);
  }
  if (endDate) {
    shipSql += ` AND i.created_at <= ?`;
    shipParams.push(endDate);
  }
  if (outletId) {
    shipSql += ` AND i.outlet_id = ?`;
    shipParams.push(outletId);
  }
  if (outletTypeId) {
    shipSql += ` AND o.outlet_type_id = ?`;
    shipParams.push(outletTypeId);
  }
  if (governorate) {
    shipSql += ` AND o.governorate = ?`;
    shipParams.push(governorate);
  }

  const shipRow = await db.get(shipSql, shipParams);

  const totalSales = parseFloat(salesRow.totalSales || 0);
  const totalPaid = parseFloat(ledgerRow.totalCollected || 0);
  const totalRemaining = parseFloat(ledgerRow.totalReceivables || 0);

  return {
    totalSales,
    totalPaid,
    totalRemaining,
    totalShipping: parseFloat(salesRow.totalShipping || 0),
    totalDiscount: parseFloat(salesRow.totalDiscount || 0),
    totalSubtotal: parseFloat(salesRow.totalSubtotal || 0),
    totalDeferredRemaining: parseFloat(salesRow.totalDeferredRemaining || 0),
    totalCashSales: parseFloat(salesRow.totalCashSales || 0),
    totalSupplied: parseFloat(paymentRow.totalSupplied || 0),
    totalUnsupplied: parseFloat(paymentRow.totalUnsupplied || 0),
    countShipped: parseInt(shipRow.countShipped || 0, 10),
    countPartiallyShipped: parseInt(shipRow.countPartiallyShipped || 0, 10),
    countNotShipped: parseInt(shipRow.countNotShipped || 0, 10)
  };
}

/**
 * Get balances grouped by outlet.
 */
async function getBalancesByOutlet({ startDate = '', endDate = '', governorate = '', outletTypeId = null, outletIds = null } = {}) {
  let sql = `
    SELECT 
      o.id as outletId,
      o.name as outletName,
      ot.name as outletTypeName,
      o.governorate,
      o.credit_limit as creditLimit,
      COALESCE(i_sum.totalSales, 0) as totalSales,
      COALESCE(fle_sum.totalCollected, 0) as totalPaid,
      COALESCE(fle_sum.totalReceivables, 0) as remainingAmount
    FROM outlets o
    JOIN outlet_types ot ON ot.id = o.outlet_type_id
    LEFT JOIN (
      SELECT 
        i.outlet_id,
        SUM(i.total_price) as totalSales
      FROM invoices i
      WHERE i.payment_status != 'cancelled'
  `;
  const params = [];
  if (startDate) {
    sql += ` AND i.created_at >= ?`;
    params.push(startDate);
  }
  if (endDate) {
    sql += ` AND i.created_at <= ?`;
    params.push(endDate);
  }
  if (outletIds && outletIds.length > 0) {
    sql += ` AND i.outlet_id IN (${outletIds.map(() => '?').join(',')})`;
    params.push(...outletIds);
  }
  sql += `
      GROUP BY i.outlet_id
    ) i_sum ON i_sum.outlet_id = o.id
    LEFT JOIN (
      SELECT 
        fle.outlet_id,
        SUM(fle.cash_amount) as totalCollected,
        SUM(fle.receivable_amount) as totalReceivables
      FROM finance_ledger_entries fle
      WHERE 1=1
  `;
  
  const fleParams = [];
  if (startDate) {
    sql += ` AND fle.created_at >= ?`;
    fleParams.push(startDate);
  }
  if (endDate) {
    sql += ` AND fle.created_at <= ?`;
    fleParams.push(endDate);
  }
  if (outletIds && outletIds.length > 0) {
    sql += ` AND fle.outlet_id IN (${outletIds.map(() => '?').join(',')})`;
    fleParams.push(...outletIds);
  }
  sql += `
      GROUP BY fle.outlet_id
    ) fle_sum ON fle_sum.outlet_id = o.id
    WHERE 1=1
  `;

  const whereParams = [];
  if (governorate) {
    sql += ` AND o.governorate = ?`;
    whereParams.push(governorate);
  }
  if (outletTypeId) {
    sql += ` AND o.outlet_type_id = ?`;
    whereParams.push(outletTypeId);
  }
  if (outletIds && outletIds.length > 0) {
    sql += ` AND o.id IN (${outletIds.map(() => '?').join(',')})`;
    whereParams.push(...outletIds);
  } else if (outletIds) {
    sql += ` AND 0=1`;
  }
  sql += ` ORDER BY o.name ASC`;

  const allParams = [...params, ...fleParams, ...whereParams];
  return await db.all(sql, allParams);
}

/**
 * Get balances grouped by governorate.
 */
async function getBalancesByGovernorate({ startDate = '', endDate = '' } = {}) {
  let sql = `
    SELECT 
      o.governorate,
      COALESCE(i_sum.totalSales, 0) as totalSales,
      COALESCE(fle_sum.totalCollected, 0) as totalPaid,
      COALESCE(fle_sum.totalReceivables, 0) as remainingAmount
    FROM (SELECT DISTINCT governorate FROM outlets WHERE governorate IS NOT NULL AND governorate != '') o
    LEFT JOIN (
      SELECT 
        o2.governorate,
        SUM(i.total_price) as totalSales
      FROM invoices i
      JOIN outlets o2 ON o2.id = i.outlet_id
      WHERE i.payment_status != 'cancelled'
  `;
  const params = [];
  if (startDate) {
    sql += ` AND i.created_at >= ?`;
    params.push(startDate);
  }
  if (endDate) {
    sql += ` AND i.created_at <= ?`;
    params.push(endDate);
  }
  sql += `
      GROUP BY o2.governorate
    ) i_sum ON i_sum.governorate = o.governorate
    LEFT JOIN (
      SELECT 
        o3.governorate,
        SUM(fle.cash_amount) as totalCollected,
        SUM(fle.receivable_amount) as totalReceivables
      FROM finance_ledger_entries fle
      JOIN outlets o3 ON o3.id = fle.outlet_id
      WHERE 1=1
  `;
  const fleParams = [];
  if (startDate) {
    sql += ` AND fle.created_at >= ?`;
    fleParams.push(startDate);
  }
  if (endDate) {
    sql += ` AND fle.created_at <= ?`;
    fleParams.push(endDate);
  }
  sql += `
      GROUP BY o3.governorate
    ) fle_sum ON fle_sum.governorate = o.governorate
    ORDER BY o.governorate ASC
  `;
  const allParams = [...params, ...fleParams];
  return await db.all(sql, allParams);
}

/**
 * Get balances grouped by outlet type.
 */
async function getBalancesByOutletType({ startDate = '', endDate = '' } = {}) {
  let sql = `
    SELECT 
      ot.id as outletTypeId,
      ot.name as outletTypeName,
      COALESCE(i_sum.totalSales, 0) as totalSales,
      COALESCE(fle_sum.totalCollected, 0) as totalPaid,
      COALESCE(fle_sum.totalReceivables, 0) as remainingAmount
    FROM outlet_types ot
    LEFT JOIN (
      SELECT 
        o.outlet_type_id,
        SUM(i.total_price) as totalSales
      FROM invoices i
      JOIN outlets o ON o.id = i.outlet_id
      WHERE i.payment_status != 'cancelled'
  `;
  const params = [];
  if (startDate) {
    sql += ` AND i.created_at >= ?`;
    params.push(startDate);
  }
  if (endDate) {
    sql += ` AND i.created_at <= ?`;
    params.push(endDate);
  }
  sql += `
      GROUP BY o.outlet_type_id
    ) i_sum ON i_sum.outlet_type_id = ot.id
    LEFT JOIN (
      SELECT 
        o2.outlet_type_id,
        SUM(fle.cash_amount) as totalCollected,
        SUM(fle.receivable_amount) as totalReceivables
      FROM finance_ledger_entries fle
      JOIN outlets o2 ON o2.id = fle.outlet_id
      WHERE 1=1
  `;
  const fleParams = [];
  if (startDate) {
    sql += ` AND fle.created_at >= ?`;
    fleParams.push(startDate);
  }
  if (endDate) {
    sql += ` AND fle.created_at <= ?`;
    fleParams.push(endDate);
  }
  sql += `
      GROUP BY o2.outlet_type_id
    ) fle_sum ON fle_sum.outlet_type_id = ot.id
    ORDER BY ot.name ASC
  `;
  const allParams = [...params, ...fleParams];
  return await db.all(sql, allParams);
}

async function getStockReport({ search = '', category = '', status = '', authorIds = null } = {}) {
  let sql = `
    SELECT 
      p.id as productId,
      p.title as productTitle,
      p.code as productCode,
      p.category,
      p.status,
      p.stock_policy as stockPolicy,
      COALESCE(SUM(CASE WHEN t.transaction_type = 'receipt' THEN t.quantity ELSE 0 END), 0) as totalReceived,
      COALESCE(ABS(SUM(CASE WHEN t.transaction_type = 'sale' THEN t.quantity ELSE 0 END)), 0) as totalSold,
      COALESCE(SUM(CASE WHEN t.transaction_type = 'return' THEN t.quantity ELSE 0 END), 0) as totalReturned,
      COALESCE(SUM(CASE WHEN t.transaction_type = 'adjustment' THEN t.quantity ELSE 0 END), 0) as totalAdjusted,
      COALESCE(SUM(t.quantity), 0) as currentStock
    FROM products p
    LEFT JOIN inventory_transactions t ON t.product_id = p.id
    WHERE 1=1
  `;
  const params = [];

  if (authorIds && authorIds.length > 0) {
    sql += ` AND p.id IN (
      SELECT product_id FROM product_authors WHERE author_id IN (${authorIds.map(() => '?').join(',')})
    )`;
    params.push(...authorIds);
  } else if (authorIds) {
    sql += ` AND 0=1`;
  }

  if (search) {
    sql += ` AND (p.title LIKE ? OR p.code LIKE ?)`;
    const term = `%${search}%`;
    params.push(term, term);
  }
  if (category) {
    if (Number.isInteger(Number(category)) && String(category).trim() !== '') {
      sql += ` AND p.id IN (SELECT product_id FROM product_categories WHERE category_id = ?)`;
      params.push(Number(category));
    } else {
      sql += ` AND p.id IN (SELECT pc.product_id FROM product_categories pc JOIN categories c ON pc.category_id = c.id WHERE c.name = ?)`;
      params.push(category);
    }
  }
  if (status) {
    sql += ` AND p.status = ?`;
    params.push(status);
  }

  sql += ` GROUP BY p.id ORDER BY p.title ASC`;

  return await db.all(sql, params);
}

/**
 * Get authors report.
 */
async function getAuthorReport({ search = '', status = '', authorIds = null } = {}) {
  let sql = `
    SELECT 
      a.id as authorId,
      a.name as authorName,
      a.status,
      COUNT(DISTINCT pa.product_id) as totalBooks,
      COALESCE(SUM(ii.total_price), 0) as totalSales,
      COALESCE(SUM(ii.quantity), 0) as totalCopiesSold,
      COALESCE(stock_sum.currentStock, 0) as currentStock
    FROM authors a
    LEFT JOIN product_authors pa ON pa.author_id = a.id
    LEFT JOIN invoice_items ii ON ii.product_id = pa.product_id
    LEFT JOIN (
      SELECT pa2.author_id, COALESCE(SUM(t.quantity), 0) as currentStock
      FROM product_authors pa2
      LEFT JOIN inventory_transactions t ON t.product_id = pa2.product_id
      GROUP BY pa2.author_id
    ) stock_sum ON stock_sum.author_id = a.id
    WHERE 1=1
  `;
  const params = [];

  if (authorIds && authorIds.length > 0) {
    sql += ` AND a.id IN (${authorIds.map(() => '?').join(',')})`;
    params.push(...authorIds);
  } else if (authorIds) {
    sql += ` AND 0=1`;
  }

  if (search) {
    sql += ` AND a.name LIKE ?`;
    params.push(`%${search}%`);
  }
  if (status) {
    sql += ` AND a.status = ?`;
    params.push(status);
  }

  sql += ` GROUP BY a.id ORDER BY a.name ASC`;

  return await db.all(sql, params);
}

/**
 * Get supplier receipt summary report.
 */
async function getReceiptReport({ search = '', startDate = '', endDate = '', authorIds = null } = {}) {
  let sql = `
    SELECT 
      COALESCE(r.supplier_name, 'Unknown Supplier') as supplierName,
      COUNT(r.id) as totalReceipts,
      COALESCE(SUM(items_sum.totalQty), 0) as totalQuantity,
      COALESCE(SUM(items_sum.totalCost), 0) as totalCost
    FROM inventory_receipts r
    LEFT JOIN (
      SELECT 
        receipt_id,
        SUM(quantity) as totalQty,
        SUM(quantity * unit_cost) as totalCost
      FROM inventory_receipt_items
      GROUP BY receipt_id
    ) items_sum ON items_sum.receipt_id = r.id
    WHERE 1=1
  `;
  const params = [];

  if (authorIds && authorIds.length > 0) {
    sql += ` AND r.id IN (
      SELECT receipt_id FROM inventory_receipt_items WHERE product_id IN (
        SELECT product_id FROM product_authors WHERE author_id IN (${authorIds.map(() => '?').join(',')})
      )
    )`;
    params.push(...authorIds);
  } else if (authorIds) {
    sql += ` AND 0=1`;
  }

  if (search) {
    sql += ` AND r.supplier_name LIKE ?`;
    params.push(`%${search}%`);
  }
  if (startDate) {
    sql += ` AND r.received_date >= ?`;
    params.push(startDate);
  }
  if (endDate) {
    sql += ` AND r.received_date <= ?`;
    params.push(endDate);
  }

  sql += ` GROUP BY r.supplier_name ORDER BY r.supplier_name ASC`;

  return await db.all(sql, params);
}

module.exports = {
  getFinancialSummary,
  getBalancesByOutlet,
  getBalancesByGovernorate,
  getBalancesByOutletType,
  getStockReport,
  getAuthorReport,
  getReceiptReport
};

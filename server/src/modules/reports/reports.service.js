import db from '../../db/index.js';

/**
 * Calculates and returns key metrics and KPIs for the Admin dashboard.
 */
export async function getAdminKPIs() {
  // 1. Sales revenue and count
  const salesResult = await db.get(
    "SELECT COALESCE(SUM(total), 0) as total_sales, COUNT(*) as sales_count FROM orders;"
  );

  // 2. Deposits
  const depositsResult = await db.get(
    "SELECT COALESCE(SUM(deposit_paid), 0) as total_deposits FROM preorders;"
  );

  // 3. Preorders count
  const preordersResult = await db.get(
    "SELECT COUNT(*) as active_preorders_count FROM preorders WHERE status IN ('DEPOSIT_PAID_WAITING_STOCK', 'READY_FOR_PICKUP');"
  );

  // 4. Low stock count (active products with current stock <= threshold)
  const lowStockResult = await db.get(
    `SELECT COUNT(*) as low_stock_count FROM products p
     WHERE p.is_active = 1
       AND COALESCE((SELECT after_quantity FROM inventory_ledger WHERE product_id = p.id ORDER BY id DESC LIMIT 1), 0) <= p.low_stock_threshold;`
  );

  // 5. Pending shifts
  const pendingShiftsResult = await db.get(
    "SELECT COUNT(*) as pending_shifts_count FROM shifts WHERE status = 'PENDING_ADMIN_REVIEW';"
  );

  // 6. Top selling products
  const topProducts = await db.all(
    `SELECT p.id, p.name, p.sku, SUM(oi.quantity) as total_qty
     FROM order_items oi
     JOIN products p ON oi.product_id = p.id
     GROUP BY p.id
     ORDER BY total_qty DESC
     LIMIT 5;`
  );

  return {
    totalSales: salesResult.total_sales,
    salesCount: salesResult.sales_count,
    totalDeposits: depositsResult.total_deposits,
    activePreordersCount: preordersResult.active_preorders_count,
    lowStockCount: lowStockResult.low_stock_count,
    pendingShiftsCount: pendingShiftsResult.pending_shifts_count,
    topProducts
  };
}

/**
 * Retrieves the sales report based on filters.
 */
export async function getSalesReport(filters = {}) {
  const { startDate, endDate, cashierId, shiftId, categoryId } = filters;

  let query = `
    SELECT o.*, u.name as cashier_name
    FROM orders o
    JOIN users u ON o.cashier_id = u.id
    WHERE 1=1
  `;
  const params = [];

  if (startDate) {
    query += " AND o.created_at >= ?";
    params.push(startDate);
  }
  if (endDate) {
    query += " AND o.created_at <= ?";
    params.push(endDate);
  }
  if (cashierId) {
    query += " AND o.cashier_id = ?";
    params.push(cashierId);
  }
  if (shiftId) {
    query += " AND o.shift_id = ?";
    params.push(shiftId);
  }
  if (categoryId) {
    query += " AND o.id IN (SELECT order_id FROM order_items oi JOIN products p ON oi.product_id = p.id WHERE p.category_id = ?)";
    params.push(categoryId);
  }

  query += " ORDER BY o.created_at DESC";

  const orders = await db.all(query, params);

  let totalSales = 0;
  let totalDiscount = 0;
  let totalNet = 0;
  const paymentMethodsBreakdown = {};

  for (const o of orders) {
    totalSales += o.subtotal;
    totalDiscount += o.discount;
    totalNet += o.total;

    // Fetch payments for this order
    const payments = await db.all(
      "SELECT payment_method AS method, amount FROM payments WHERE reference_type = 'order' AND reference_id = ?;",
      [o.id]
    );
    o.payments = payments;
    for (const p of payments) {
      paymentMethodsBreakdown[p.method] = (paymentMethodsBreakdown[p.method] || 0) + p.amount;
    }

    // Fetch order items
    const items = await db.all(
      `SELECT oi.*, p.name as product_name, p.sku, p.barcode
       FROM order_items oi
       JOIN products p ON oi.product_id = p.id
       WHERE oi.order_id = ?;`,
      [o.id]
    );
    o.items = items;
  }

  return {
    summary: {
      total_sales: totalSales,
      total_discount: totalDiscount,
      total_net: totalNet,
      invoices_count: orders.length,
      payments_breakdown: paymentMethodsBreakdown
    },
    orders
  };
}

/**
 * Retrieves the preorders report based on filters.
 */
export async function getPreordersReport(filters = {}) {
  const { startDate, endDate, status, cashierId, search } = filters;

  let query = `
    SELECT pr.*, u.name as cashier_name
    FROM preorders pr
    JOIN users u ON pr.cashier_id = u.id
    WHERE 1=1
  `;
  const params = [];

  if (startDate) {
    query += " AND pr.created_at >= ?";
    params.push(startDate);
  }
  if (endDate) {
    query += " AND pr.created_at <= ?";
    params.push(endDate);
  }
  if (status) {
    query += " AND pr.status = ?";
    params.push(status);
  }
  if (cashierId) {
    query += " AND pr.cashier_id = ?";
    params.push(cashierId);
  }
  if (search) {
    query += " AND (pr.customer_name LIKE ? OR pr.customer_phone LIKE ? OR pr.preorder_number LIKE ?)";
    const wildcard = `%${search}%`;
    params.push(wildcard, wildcard, wildcard);
  }

  query += " ORDER BY pr.created_at DESC";

  const preorders = await db.all(query, params);

  let totalAmount = 0;
  let totalDepositPaid = 0;
  let totalRemainingAmount = 0;

  for (const pr of preorders) {
    totalAmount += pr.total_amount;
    totalDepositPaid += pr.deposit_paid;
    totalRemainingAmount += pr.remaining_amount;

    // Fetch items
    const items = await db.all(
      `SELECT pi.*, p.name as product_name, p.sku
       FROM preorder_items pi
       JOIN products p ON pi.product_id = p.id
       WHERE pi.preorder_id = ?;`,
      [pr.id]
    );
    pr.items = items;
  }

  return {
    summary: {
      total_count: preorders.length,
      total_amount: totalAmount,
      total_deposit_paid: totalDepositPaid,
      total_remaining_amount: totalRemainingAmount
    },
    preorders
  };
}

/**
 * Retrieves the inventory report based on filters.
 */
export async function getInventoryReport(filters = {}) {
  const { categoryId, stockStatus, search } = filters;

  let query = `
    SELECT p.*, c.name as category_name
    FROM products p
    LEFT JOIN categories c ON p.category_id = c.id
    WHERE p.is_active = 1
  `;
  const params = [];

  if (categoryId) {
    query += " AND p.category_id = ?";
    params.push(categoryId);
  }
  if (search) {
    query += " AND (p.name LIKE ? OR p.sku LIKE ? OR p.barcode LIKE ?)";
    const wildcard = `%${search}%`;
    params.push(wildcard, wildcard, wildcard);
  }

  const allProducts = await db.all(query, params);

  const products = [];
  let totalItemsCount = 0;
  let lowStockItemsCount = 0;
  let outOfStockItemsCount = 0;

  for (const p of allProducts) {
    const stockRow = await db.get(
      "SELECT after_quantity FROM inventory_ledger WHERE product_id = ? ORDER BY id DESC LIMIT 1;",
      [p.id]
    );
    p.current_stock = stockRow ? stockRow.after_quantity : 0;

    const preordersRow = await db.get(
      `SELECT COALESCE(SUM(pi.quantity), 0) as reserved
       FROM preorder_items pi
       JOIN preorders pr ON pi.preorder_id = pr.id
       WHERE pi.product_id = ? AND pr.status IN ('DEPOSIT_PAID_WAITING_STOCK', 'READY_FOR_PICKUP');`,
      [p.id]
    );
    p.reserved_stock = preordersRow ? preordersRow.reserved : 0;

    totalItemsCount++;
    if (p.current_stock === 0) {
      outOfStockItemsCount++;
    } else if (p.current_stock <= p.low_stock_threshold) {
      lowStockItemsCount++;
    }

    let matchesStatus = true;
    if (stockStatus === 'LOW_STOCK') {
      matchesStatus = p.current_stock > 0 && p.current_stock <= p.low_stock_threshold;
    } else if (stockStatus === 'OUT_OF_STOCK') {
      matchesStatus = p.current_stock === 0;
    }

    if (matchesStatus) {
      products.push(p);
    }
  }

  return {
    summary: {
      total_products: totalItemsCount,
      low_stock_count: lowStockItemsCount,
      out_of_stock_count: outOfStockItemsCount
    },
    products
  };
}

/**
 * Retrieves the shifts report based on filters.
 */
export async function getShiftsReport(filters = {}) {
  const { startDate, endDate, cashierId, status } = filters;

  let query = `
    SELECT s.*, u.name as cashier_name
    FROM shifts s
    JOIN users u ON s.user_id = u.id
    WHERE 1=1
  `;
  const params = [];

  if (startDate) {
    query += " AND s.opened_at >= ?";
    params.push(startDate);
  }
  if (endDate) {
    query += " AND s.opened_at <= ?";
    params.push(endDate);
  }
  if (cashierId) {
    query += " AND s.user_id = ?";
    params.push(cashierId);
  }
  if (status) {
    query += " AND s.status = ?";
    params.push(status);
  }

  query += " ORDER BY s.opened_at DESC";

  const shifts = await db.all(query, params);

  return {
    summary: {
      total_shifts: shifts.length,
      open_shifts: shifts.filter(s => s.status === 'OPEN').length,
      pending_review_shifts: shifts.filter(s => s.status === 'PENDING_ADMIN_REVIEW').length,
      closed_shifts: shifts.filter(s => s.status === 'CLOSED').length
    },
    shifts
  };
}

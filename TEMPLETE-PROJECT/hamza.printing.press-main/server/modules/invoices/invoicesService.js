const db = require('../../db');

/**
 * Calculate the actual physical stock currently present in the warehouse for a product.
 * Physical Stock = (Total Receipts + Returns + Adjustments) - Total Shipped
 */
async function getPhysicalStock(productId) {
  // Sum of receipts, returns, and adjustments
  const incomingRow = await db.get(`
    SELECT COALESCE(SUM(quantity), 0) as qty
    FROM inventory_transactions
    WHERE product_id = ? AND transaction_type IN ('receipt', 'return', 'adjustment')
  `, [productId]);

  // Sum of shipped items in non-cancelled shipments
  const shippedRow = await db.get(`
    SELECT COALESCE(SUM(si.quantity), 0) as qty
    FROM shipment_items si
    JOIN shipments s ON s.id = si.shipment_id
    JOIN invoice_items ii ON ii.id = si.invoice_item_id
    WHERE ii.product_id = ? AND s.status != 'cancelled'
  `, [productId]);

  return incomingRow.qty - shippedRow.qty;
}
const fs = require('fs');
const path = require('path');
const inventoryService = require('../inventory/inventoryService');
const notificationsService = require('../notifications/notificationsService');
const config = require('../../config');


/**
 * Create a new invoice.
 */
async function createInvoice({
  invoiceNumber: invoiceNumberInput = '',
  outletId,
  discount = 0,
  shippingCost = 0,
  paymentType = 'cash',
  notes = '',
  items = [],
  userId,
  paymentAmount = 0,
  paymentSupplyStatus = 'not_supplied',
  paymentNotes = '',
  paymentReceiptName = '',
  paymentReceiptData = ''
}) {
  if (!outletId) {
    throw new Error('Outlet ID is required');
  }
  if (!items || items.length === 0) {
    throw new Error('At least one item is required for invoices');
  }

  // 1. Fetch the outlet
  const outlet = await db.get('SELECT * FROM outlets WHERE id = ?', [outletId]);
  if (!outlet) {
    throw new Error(`Outlet with ID ${outletId} does not exist`);
  }
  if (outlet.status !== 'active') {
    throw new Error(`Outlet ${outlet.name} is not active`);
  }

  // 2. Fetch user if provided
  if (userId) {
    const user = await db.get('SELECT id FROM users WHERE id = ?', [userId]);
    if (!user) {
      throw new Error(`User with ID ${userId} does not exist`);
    }
  }

  // Generate/resolve unique invoice number
  let finalInvoiceNumber = invoiceNumberInput ? invoiceNumberInput.trim() : '';
  if (!finalInvoiceNumber) {
    const row = await db.get("SELECT invoice_number as val FROM invoices WHERE invoice_number LIKE 'INV-%' ORDER BY invoice_number DESC LIMIT 1");
    let nextNum = 1;
    if (row && row.val) {
      const match = row.val.match(/\d+$/);
      if (match) {
        nextNum = parseInt(match[0], 10) + 1;
      }
    }
    finalInvoiceNumber = `INV-${String(nextNum).padStart(7, '0')}`;
  }
  const invoiceNumber = finalInvoiceNumber;

  // Handle receipt file BEFORE opening transaction (file I/O outside transaction)
  let receiptOriginalName = null;
  let receiptStoredPath = null;
  let receiptMimeType = null;
  let receiptSize = null;
  let receiptStatusForPayment = 'approved';

  if (paymentReceiptData && paymentReceiptName) {
    const receiptsDir = path.join(config.uploadsDir, 'receipts');
    if (!fs.existsSync(receiptsDir)) {
      fs.mkdirSync(receiptsDir, { recursive: true });
    }
    const matches = paymentReceiptData.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
    let buffer;
    if (matches && matches.length === 3) {
      receiptMimeType = matches[1];
      buffer = Buffer.from(matches[2], 'base64');
    } else {
      receiptMimeType = 'application/octet-stream';
      buffer = Buffer.from(paymentReceiptData, 'base64');
    }
    receiptSize = buffer.length;
    receiptOriginalName = paymentReceiptName;
    const ext = (path.extname(paymentReceiptName) || '.bin').toLowerCase();
    const allowedMimeTypes = ['image/png', 'image/jpeg', 'image/gif', 'application/pdf'];
    const allowedExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.pdf'];
    if (!allowedMimeTypes.includes(receiptMimeType) || !allowedExtensions.includes(ext)) {
      throw new Error('Invalid file type. Only PNG, JPEG, GIF, and PDF are allowed.');
    }
    const MAX_SIZE = 5 * 1024 * 1024;
    if (receiptSize > MAX_SIZE) {
      throw new Error('File size exceeds the 5MB limit.');
    }
    const safeName = `receipt-${Date.now()}-${Math.floor(Math.random() * 100000)}${ext}`;
    receiptStoredPath = path.join(receiptsDir, safeName);
    fs.writeFileSync(receiptStoredPath, buffer);
    receiptStatusForPayment = 'approved';
  }

  // Begin Transaction
  await db.exec('BEGIN TRANSACTION;');

  try {
    let subtotal = 0;
    const validatedItems = [];

    // Validate pricing and stock policy for all items
    for (const item of items) {
      const { productId, quantity } = item;
      const qty = parseInt(quantity, 10);
      const freeQty = parseInt(item.freeQuantity || item.free_quantity, 10) || 0;

      if (!productId || isNaN(qty) || qty <= 0) {
        throw new Error('Valid Product ID and a positive quantity are required for all items');
      }
      if (freeQty < 0) {
        throw new Error('Free quantity cannot be negative');
      }
      if (freeQty > qty) {
        throw new Error('Free quantity cannot exceed physical quantity');
      }

      const product = await db.get('SELECT * FROM products WHERE id = ?', [productId]);
      if (!product) {
        throw new Error(`Product with ID ${productId} does not exist`);
      }
      if (product.status !== 'active') {
        throw new Error(`Product ${product.title} is not active`);
      }

      // Resolve price
      const priceRow = await db.get(
        'SELECT price FROM product_prices WHERE product_id = ? AND outlet_type_id = ?',
        [productId, outlet.outlet_type_id]
      );
      if (!priceRow || priceRow.price === null) {
        throw new Error(`No price configured for product "${product.title}" and outlet type ID ${outlet.outlet_type_id}`);
      }
      const unitPrice = parseFloat(priceRow.price);

      // Validate stock if policy is track
      if (product.stock_policy === 'track') {
        const currentStock = await inventoryService.getRealTimeStock(productId);
        // Stock checks are disabled to allow negative inventory on sales
        /*
        if (currentStock < qty) {
          const err = new Error(`المخزون غير كافٍ للكتاب "${product.title}". المتاح: ${currentStock}، المطلوب: ${qty}`);
          err.productId = productId;
          err.productTitle = product.title;
          err.currentStock = currentStock;
          err.qty = qty;
          throw err;
        }
        */
      }

      const billableQty = qty - freeQty;
      const itemTotalPrice = billableQty * unitPrice;
      subtotal += itemTotalPrice;

      validatedItems.push({
        productId,
        quantity: qty,
        freeQuantity: freeQty,
        unitPrice,
        totalPrice: itemTotalPrice,
        stockPolicy: product.stock_policy
      });
    }

    const sub = parseFloat(subtotal.toFixed(2));
    const disc = parseFloat(parseFloat(discount || 0).toFixed(2));
    const ship = parseFloat(parseFloat(shippingCost || 0).toFixed(2));
    const total = parseFloat((sub + ship - disc).toFixed(2));

    if (total < 0) {
      throw new Error('Total invoice price cannot be negative');
    }

    // Determine initial payment status and type
    const parsedPaymentAmount = parseFloat(paymentAmount) || 0;
    if (parsedPaymentAmount < 0) {
      throw new Error('Payment amount cannot be negative');
    }
    if (parsedPaymentAmount > total) {
      throw new Error(`Payment amount exceeds invoice total balance. Total: ${total}`);
    }

    let finalPaymentStatus = 'unpaid';
    if (parsedPaymentAmount >= total && total > 0) {
      finalPaymentStatus = 'paid';
    } else if (parsedPaymentAmount > 0) {
      finalPaymentStatus = 'partially_paid';
    }

    const finalPaymentType = parsedPaymentAmount >= total ? 'cash' : 'deferred';

    // Save invoice
    const invoiceSql = `
      INSERT INTO invoices (
        invoice_number, outlet_id, subtotal, discount, shipping_cost, total_price,
        payment_status, shipping_status, payment_type, notes, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    const invoiceResult = await db.run(invoiceSql, [
      invoiceNumber,
      outletId,
      sub,
      disc,
      ship,
      total,
      finalPaymentStatus,
      'pending',
      finalPaymentType,
      notes.trim(),
      userId
    ]);
    const invoiceId = invoiceResult.lastID;

    // Save items & create stock transactions
    for (const item of validatedItems) {
      const itemSql = `
        INSERT INTO invoice_items (invoice_id, product_id, quantity, free_quantity, unit_price, total_price)
        VALUES (?, ?, ?, ?, ?, ?)
      `;
      await db.run(itemSql, [invoiceId, item.productId, item.quantity, item.freeQuantity, item.unitPrice, item.totalPrice]);

      if (item.stockPolicy === 'track') {
        await inventoryService.createTransaction({
          productId: item.productId,
          transactionType: 'sale',
          quantity: -item.quantity,
          referenceType: 'invoice',
          referenceId: invoiceId,
          userId
        });
      }
    }

    // Save initial payment collection if any
    let paymentId = null;
    if (parsedPaymentAmount > 0) {
      const isSupplied = paymentSupplyStatus === 'supplied';
      const suppliedAt = isSupplied ? new Date().toISOString() : null;
      const suppliedBy = isSupplied ? userId : null;

      const paymentSql = `
        INSERT INTO invoice_payments (
          invoice_id, amount, payment_method, payment_date,
          reference_number, notes, recorded_by, supply_status,
          supplied_at, supplied_by,
          receipt_original_name, receipt_stored_path, receipt_mime_type, receipt_size, receipt_status
        ) VALUES (?, ?, 'cash', ?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;
      const paymentResult = await db.run(paymentSql, [
        invoiceId,
        parsedPaymentAmount,
        new Date().toISOString().split('T')[0],
        paymentNotes.trim() || 'تحصيل تلقائي عند إنشاء الفاتورة.',
        userId,
        paymentSupplyStatus,
        suppliedAt,
        suppliedBy,
        receiptOriginalName,
        receiptStoredPath,
        receiptMimeType,
        receiptSize,
        receiptStatusForPayment
      ]);
      paymentId = paymentResult.lastID;
    }

    // Log status history
    const historySql = `
      INSERT INTO invoice_status_history (invoice_id, status_type, old_status, new_status, changed_by, notes)
      VALUES (?, ?, ?, ?, ?, ?)
    `;
    await db.run(historySql, [invoiceId, 'payment', 'unpaid', finalPaymentStatus, userId, 'Invoice created.']);
    await db.run(historySql, [invoiceId, 'shipping', 'pending', 'pending', userId, 'Invoice created.']);

    // Record ledger entries
    await db.run(`
      INSERT INTO finance_ledger_entries (
        outlet_id, entry_type, reference_type, reference_id,
        cash_amount, receivable_amount, notes, created_by
      ) VALUES (?, 'invoice_created', 'invoice', ?, 0, ?, ?, ?)
    `, [outletId, invoiceId, total, `Invoice ${invoiceNumber} created.`, userId]);

    if (parsedPaymentAmount > 0 && paymentId) {
      await db.run(`
        INSERT INTO finance_ledger_entries (
          outlet_id, entry_type, reference_type, reference_id,
          cash_amount, receivable_amount, notes, created_by
        ) VALUES (?, 'payment_recorded', 'payment', ?, ?, ?, ?, ?)
      `, [
        outletId,
        paymentId,
        parsedPaymentAmount,
        -parsedPaymentAmount,
        `Payment for invoice ${invoiceNumber} recorded.`,
        userId
      ]);

      if (paymentSupplyStatus === 'supplied') {
        await db.run(`
          INSERT INTO finance_ledger_entries (
            outlet_id, entry_type, reference_type, reference_id,
            cash_amount, receivable_amount, notes, created_by
          ) VALUES (?, 'payment_supplied', 'payment', ?, 0, 0, ?, ?)
        `, [
          outletId,
          paymentId,
          `Payment marked as supplied upon recording.`,
          userId
        ]);
      }
    }

    await db.exec('COMMIT;');

    // Trigger notification checks after commit
    try {
      await notificationsService.checkOutletCreditLimitNotifications(outletId);
      for (const item of validatedItems) {
        await notificationsService.checkStockNotifications(item.productId);
      }
      
      if (parsedPaymentAmount > 0 && paymentId) {
        await notificationsService.createOrUpdateNotification({
          category: 'payment_received',
          severity: 'info',
          title: 'تم استلام دفعة مالية',
          message: `تم استلام دفعة بقيمة ${parsedPaymentAmount} EGP للفاتورة ${invoiceNumber}.`,
          source_type: 'payment',
          source_id: paymentId,
          dedupe_key: `payment_received:${paymentId}`,
          action_url: `/finance/invoices/${invoiceId}`
        });
        await notificationsService.checkOutletFinanceNotifications(outletId);
      }
    } catch (e) {
      console.error('Error running notification checks on invoice creation:', e);
    }

    return await getInvoiceById(invoiceId);
  } catch (err) {
    await db.exec('ROLLBACK;');
    if (err.productId && err.qty !== undefined) {
      try {
        await notificationsService.createOrUpdateNotification({
          category: 'stock_low',
          severity: 'critical',
          title: 'المخزون غير كافٍ للكتاب',
          message: `المخزون غير كافٍ للكتاب "${err.productTitle}" — المتاح: ${err.currentStock}، المطلوب: ${err.qty}.`,
          source_type: 'product',
          source_id: err.productId,
          dedupe_key: `insufficient_stock:${err.productId}:${err.currentStock}:${err.qty}`,
          action_url: '/inventory'
        });
      } catch (e) {
        console.error('Error creating insufficient stock notification in catch:', e);
      }
    }
    throw err;
  }
}

/**
 * Update an existing invoice.
 */
async function updateInvoice(invoiceId, { outletId, discount = 0, shippingCost = 0, paymentType = 'cash', notes = '', items = [], userId }) {
  if (!outletId) {
    throw new Error('Outlet ID is required');
  }
  if (!items || items.length === 0) {
    throw new Error('At least one item is required for invoices');
  }

  const existingInvoice = await db.get('SELECT * FROM invoices WHERE id = ?', [invoiceId]);
  if (!existingInvoice) {
    throw new Error(`Invoice with ID ${invoiceId} does not exist`);
  }

  // Get previous invoice items to compute delta stock levels
  const oldItems = await db.all('SELECT * FROM invoice_items WHERE invoice_id = ?', [invoiceId]);

  // 1. Fetch the outlet
  const outlet = await db.get('SELECT * FROM outlets WHERE id = ?', [outletId]);
  if (!outlet) {
    throw new Error(`Outlet with ID ${outletId} does not exist`);
  }
  if (outlet.status !== 'active') {
    throw new Error(`Outlet ${outlet.name} is not active`);
  }

  // Begin Transaction
  await db.exec('BEGIN TRANSACTION;');

  try {
    let subtotal = 0;
    const validatedItems = [];

    // Validate pricing and stock policy for all items
    for (const item of items) {
      const { productId, quantity } = item;
      const qty = parseInt(quantity, 10);
      const freeQty = parseInt(item.freeQuantity || item.free_quantity, 10) || 0;

      if (!productId || isNaN(qty) || qty <= 0) {
        throw new Error('Valid Product ID and a positive quantity are required for all items');
      }
      if (freeQty < 0) {
        throw new Error('Free quantity cannot be negative');
      }
      if (freeQty > qty) {
        throw new Error('Free quantity cannot exceed physical quantity');
      }

      const product = await db.get('SELECT * FROM products WHERE id = ?', [productId]);
      if (!product) {
        throw new Error(`Product with ID ${productId} does not exist`);
      }
      if (product.status !== 'active') {
        throw new Error(`Product ${product.title} is not active`);
      }

      // Resolve price
      const priceRow = await db.get(
        'SELECT price FROM product_prices WHERE product_id = ? AND outlet_type_id = ?',
        [productId, outlet.outlet_type_id]
      );
      if (!priceRow || priceRow.price === null) {
        throw new Error(`No price configured for product "${product.title}" and outlet type ID ${outlet.outlet_type_id}`);
      }
      const unitPrice = parseFloat(priceRow.price);

      // Validate stock if policy is track (taking into account old quantity already reserved by this invoice)
      if (product.stock_policy === 'track') {
        const oldItem = oldItems.find(i => i.product_id === productId);
        const oldQty = oldItem ? oldItem.quantity : 0;
        const currentStock = await inventoryService.getRealTimeStock(productId);
        const availableStock = currentStock + oldQty;
        // Stock checks are disabled to allow negative inventory on sales
      }

      const billableQty = qty - freeQty;
      const itemTotalPrice = billableQty * unitPrice;
      subtotal += itemTotalPrice;

      validatedItems.push({
        productId,
        quantity: qty,
        freeQuantity: freeQty,
        unitPrice,
        totalPrice: itemTotalPrice,
        stockPolicy: product.stock_policy
      });
    }

    const sub = parseFloat(subtotal.toFixed(2));
    const disc = parseFloat(parseFloat(discount || 0).toFixed(2));
    const ship = parseFloat(parseFloat(shippingCost || 0).toFixed(2));
    const total = parseFloat((sub + ship - disc).toFixed(2));

    if (total < 0) {
      throw new Error('Total invoice price cannot be negative');
    }

    // Update invoice header
    const updateSql = `
      UPDATE invoices
      SET outlet_id = ?, subtotal = ?, discount = ?, shipping_cost = ?, total_price = ?,
          payment_type = ?, notes = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `;
    await db.run(updateSql, [
      outletId,
      sub,
      disc,
      ship,
      total,
      paymentType,
      notes.trim(),
      invoiceId
    ]);

    // Save/update items
    const keptItemIds = [];
    for (const item of validatedItems) {
      const oldItem = oldItems.find(i => i.product_id === item.productId);
      if (oldItem) {
        // Update existing item in place to preserve its ID and not break foreign key references
        await db.run(
          `UPDATE invoice_items 
           SET quantity = ?, free_quantity = ?, unit_price = ?, total_price = ? 
           WHERE id = ?`,
          [item.quantity, item.freeQuantity, item.unitPrice, item.totalPrice, oldItem.id]
        );
        keptItemIds.push(oldItem.id);
      } else {
        // Insert new item
        const itemSql = `
          INSERT INTO invoice_items (invoice_id, product_id, quantity, free_quantity, unit_price, total_price)
          VALUES (?, ?, ?, ?, ?, ?)
        `;
        await db.run(itemSql, [
          invoiceId,
          item.productId,
          item.quantity,
          item.freeQuantity,
          item.unitPrice,
          item.totalPrice
        ]);
      }
    }

    // Process deleted items
    for (const oldItem of oldItems) {
      if (!keptItemIds.includes(oldItem.id)) {
        await db.run('DELETE FROM invoice_items WHERE id = ?', [oldItem.id]);
      }
    }

    // Compute and save delta stock transactions (append-only ledger)
    for (const item of validatedItems) {
      if (item.stockPolicy === 'track') {
        const oldItem = oldItems.find(i => i.product_id === item.productId);
        const oldQty = oldItem ? oldItem.quantity : 0;
        const deltaQty = oldQty - item.quantity;
        if (deltaQty !== 0) {
          await inventoryService.createTransaction({
            productId: item.productId,
            transactionType: deltaQty < 0 ? 'sale' : 'return',
            quantity: deltaQty,
            referenceType: 'invoice',
            referenceId: invoiceId,
            userId
          });
        }
      }
    }

    // Process items that were completely removed from the invoice (return their stock)
    for (const oldItem of oldItems) {
      const newItem = validatedItems.find(i => i.productId === oldItem.product_id);
      if (!newItem) {
        const product = await db.get('SELECT stock_policy FROM products WHERE id = ?', [oldItem.product_id]);
        if (product && product.stock_policy === 'track') {
          await inventoryService.createTransaction({
            productId: oldItem.product_id,
            transactionType: 'return',
            quantity: oldItem.quantity,
            referenceType: 'invoice',
            referenceId: invoiceId,
            userId
          });
        }
      }
    }

    // Reconcile ledger: delete previous invoice_created and insert new one
    await db.run('DELETE FROM finance_ledger_entries WHERE reference_type = "invoice" AND entry_type = "invoice_created" AND reference_id = ?', [invoiceId]);
    await db.run(`
      INSERT INTO finance_ledger_entries (
        outlet_id, entry_type, reference_type, reference_id,
        cash_amount, receivable_amount, notes, created_by
      ) VALUES (?, 'invoice_created', 'invoice', ?, 0, ?, ?, ?)
    `, [outletId, invoiceId, total, `Invoice ${existingInvoice.invoice_number} updated.`, userId]);

    // Recalculate payment status/metrics if invoice total price has changed
    const paymentsService = require('../payments/paymentsService');
    await paymentsService.recalculatePaymentMetrics(invoiceId);

    await db.exec('COMMIT;');

    // Trigger notification checks after commit
    try {
      await notificationsService.checkOutletCreditLimitNotifications(outletId);
      if (existingInvoice.outlet_id !== outletId) {
        await notificationsService.checkOutletCreditLimitNotifications(existingInvoice.outlet_id);
      }
      for (const item of validatedItems) {
        await notificationsService.checkStockNotifications(item.productId);
      }
      for (const oldItem of oldItems) {
        // Only check if it's not already in the new items list (to avoid double checks)
        if (!validatedItems.some(item => item.productId === oldItem.product_id)) {
          await notificationsService.checkStockNotifications(oldItem.product_id);
        }
      }
    } catch (e) {
      console.error('Error running notification checks on invoice update:', e);
    }

    return await getInvoiceById(invoiceId);
  } catch (err) {
    await db.exec('ROLLBACK;');
    if (err.productId && err.qty !== undefined) {
      try {
        await notificationsService.createOrUpdateNotification({
          category: 'stock_low',
          severity: 'critical',
          title: 'المخزون غير كافٍ للكتاب',
          message: `المخزون غير كافٍ للكتاب "${err.productTitle}" — المتاح: ${err.currentStock}، المطلوب: ${err.qty}.`,
          source_type: 'product',
          source_id: err.productId,
          dedupe_key: `insufficient_stock:${err.productId}:${err.currentStock}:${err.qty}`,
          action_url: '/inventory'
        });
      } catch (e) {
        console.error('Error creating insufficient stock notification in catch:', e);
      }
    }
    throw err;
  }
}

/**
 * Retrieve invoice by ID.
 */
async function getInvoiceById(id) {
  const sql = `
    SELECT i.*, o.name as outlet_name, o.outlet_type_id, o.governorate, o.address_details, o.phone, u.full_name as user_full_name,
           COALESCE(p.paid_amount, 0) as paid_amount,
           (i.total_price - COALESCE(p.paid_amount, 0)) as remaining_amount
    FROM invoices i
    JOIN outlets o ON o.id = i.outlet_id
    LEFT JOIN users u ON u.id = i.created_by
    LEFT JOIN (
      SELECT invoice_id, SUM(amount) as paid_amount
      FROM invoice_payments
      GROUP BY invoice_id
    ) p ON p.invoice_id = i.id
    WHERE i.id = ?
  `;
  const invoice = await db.get(sql, [id]);
  if (!invoice) return null;

  const items = await db.all(`
    SELECT ii.*, p.title as product_title, p.code as product_code,
      COALESCE((
        SELECT SUM(si.quantity)
        FROM shipment_items si
        JOIN shipments s ON s.id = si.shipment_id
        WHERE si.invoice_item_id = ii.id AND s.status IN ('shipped', 'delivered')
      ), 0) as shipped_quantity,
      COALESCE((
        SELECT SUM(ri.quantity)
        FROM return_items ri
        JOIN returns r ON r.id = ri.return_id
        WHERE ri.invoice_item_id = ii.id AND r.status != 'cancelled'
      ), 0) as returned_quantity
    FROM invoice_items ii
    JOIN products p ON p.id = ii.product_id
    WHERE ii.invoice_id = ?
  `, [id]);

  items.forEach(item => {
    item.ordered_quantity = item.quantity;
    item.remaining_quantity = Math.max(0, item.quantity - item.shipped_quantity);
    item.remaining_returnable_quantity = Math.max(0, item.quantity - item.returned_quantity);
  });

  const history = await db.all(`
    SELECT ish.*, u.full_name as user_full_name
    FROM invoice_status_history ish
    LEFT JOIN users u ON u.id = ish.changed_by
    WHERE ish.invoice_id = ?
    ORDER BY ish.created_at ASC
  `, [id]);

  const payments = await db.all(`
    SELECT ip.*, u.full_name as user_full_name
    FROM invoice_payments ip
    LEFT JOIN users u ON u.id = ip.recorded_by
    WHERE ip.invoice_id = ?
    ORDER BY ip.payment_date ASC
  `, [id]);

  const shipments = await db.all(`
    SELECT s.*, u.full_name as user_full_name
    FROM shipments s
    LEFT JOIN users u ON u.id = s.created_by
    WHERE s.invoice_id = ?
    ORDER BY s.created_at DESC
  `, [id]);

  for (const shipment of shipments) {
    shipment.items = await db.all(`
      SELECT si.*, p.title as product_title, p.code as product_code
      FROM shipment_items si
      JOIN invoice_items ii ON ii.id = si.invoice_item_id
      JOIN products p ON p.id = ii.product_id
      WHERE si.shipment_id = ?
    `, [shipment.id]);
  }

  const returns = await db.all(`
    SELECT r.*, u.full_name as user_full_name
    FROM returns r
    LEFT JOIN users u ON u.id = r.created_by
    WHERE r.invoice_id = ?
    ORDER BY r.created_at DESC
  `, [id]);

  for (const ret of returns) {
    ret.items = await db.all(`
      SELECT ri.*, p.title as product_title, p.code as product_code
      FROM return_items ri
      JOIN invoice_items ii ON ii.id = ri.invoice_item_id
      JOIN products p ON p.id = ii.product_id
      WHERE ri.return_id = ?
    `, [ret.id]);
  }

  invoice.items = items;
  invoice.history = history;
  invoice.payments = payments;
  invoice.shipments = shipments;
  invoice.returns = returns;

  return invoice;
}

/**
 * List/filter invoices.
 */
async function getInvoices({
  limit = 50,
  offset = 0,
  search = '',
  productId = null,
  authorId = null,
  outletId = null,
  outletTypeId = null,
  governorate = '',
  paymentStatus = '',
  shippingStatus = '',
  startDate = '',
  endDate = '',
  hasRemaining = '', // 'yes' or 'no'
  minRemaining = null,
  maxRemaining = null,
  authorIds = null,
  outletIds = null
} = {}) {
  let sql = `
    SELECT i.*, o.name as outlet_name, o.governorate, o.outlet_type_id,
           COALESCE(p.paid_amount, 0) as paid_amount,
           (i.total_price - COALESCE(p.paid_amount, 0)) as remaining_amount
    FROM invoices i
    JOIN outlets o ON o.id = i.outlet_id
    LEFT JOIN (
      SELECT invoice_id, SUM(amount) as paid_amount
      FROM invoice_payments
      GROUP BY invoice_id
    ) p ON p.invoice_id = i.id
    WHERE 1=1
  `;
  const params = [];

  if (outletIds && outletIds.length > 0) {
    sql += ` AND i.outlet_id IN (${outletIds.map(() => '?').join(',')})`;
    params.push(...outletIds);
  } else if (outletIds) {
    sql += ` AND 0=1`;
  }

  if (authorIds && authorIds.length > 0) {
    sql += ` AND i.id IN (
      SELECT ii.invoice_id
      FROM invoice_items ii
      JOIN product_authors pa ON pa.product_id = ii.product_id
      WHERE pa.author_id IN (${authorIds.map(() => '?').join(',')})
    )`;
    params.push(...authorIds);
  } else if (authorIds) {
    sql += ` AND 0=1`;
  }

  if (search) {
    sql += ` AND (i.invoice_number LIKE ? OR o.name LIKE ? OR i.notes LIKE ?)`;
    const term = `%${search}%`;
    params.push(term, term, term);
  }

  if (productId) {
    sql += ` AND i.id IN (SELECT invoice_id FROM invoice_items WHERE product_id = ?)`;
    params.push(productId);
  }

  if (authorId) {
    sql += ` AND i.id IN (
      SELECT ii.invoice_id
      FROM invoice_items ii
      JOIN product_authors pa ON pa.product_id = ii.product_id
      WHERE pa.author_id = ?
    )`;
    params.push(authorId);
  }

  if (outletId) {
    sql += ` AND i.outlet_id = ?`;
    params.push(outletId);
  }

  if (outletTypeId) {
    sql += ` AND o.outlet_type_id = ?`;
    params.push(outletTypeId);
  }

  if (governorate) {
    sql += ` AND o.governorate = ?`;
    params.push(governorate);
  }

  if (paymentStatus) {
    sql += ` AND i.payment_status = ?`;
    params.push(paymentStatus);
  }

  if (shippingStatus) {
    if (shippingStatus === 'delivered') {
      sql += ` AND i.shipping_status IN ('shipped', 'delivered')`;
    } else {
      sql += ` AND i.shipping_status = ?`;
      params.push(shippingStatus);
    }
  }

  if (startDate) {
    sql += ` AND i.created_at >= ?`;
    params.push(startDate);
  }

  if (endDate) {
    sql += ` AND i.created_at <= ?`;
    params.push(endDate);
  }

  if (hasRemaining === 'yes') {
    sql += ` AND (i.total_price - COALESCE(p.paid_amount, 0)) > 0`;
  } else if (hasRemaining === 'no') {
    sql += ` AND (i.total_price - COALESCE(p.paid_amount, 0)) <= 0`;
  }

  if (minRemaining !== null && minRemaining !== undefined) {
    sql += ` AND (i.total_price - COALESCE(p.paid_amount, 0)) >= ?`;
    params.push(minRemaining);
  }

  if (maxRemaining !== null && maxRemaining !== undefined) {
    sql += ` AND (i.total_price - COALESCE(p.paid_amount, 0)) <= ?`;
    params.push(maxRemaining);
  }

  sql += ` ORDER BY i.created_at DESC LIMIT ? OFFSET ?`;
  params.push(limit, offset);

  return await db.all(sql, params);
}

/**
 * Cancel an existing invoice.
 */
async function cancelInvoice(invoiceId, userId) {
  const invoice = await db.get('SELECT * FROM invoices WHERE id = ?', [invoiceId]);
  if (!invoice) {
    throw new Error(`Invoice with ID ${invoiceId} does not exist`);
  }
  if (invoice.payment_status === 'cancelled') {
    throw new Error('Invoice is already cancelled');
  }

  // Begin Transaction
  await db.exec('BEGIN TRANSACTION;');

  try {
    // 1. Update payment_status to 'cancelled'
    await db.run('UPDATE invoices SET payment_status = "cancelled", updated_at = CURRENT_TIMESTAMP WHERE id = ?', [invoiceId]);

    // 2. Log status history
    await db.run(`
      INSERT INTO invoice_status_history (invoice_id, status_type, old_status, new_status, changed_by, notes)
      VALUES (?, 'payment', ?, 'cancelled', ?, 'Invoice cancelled.')
    `, [invoiceId, invoice.payment_status, userId]);

    // 3. Return stock to inventory if product stock policy is 'track'
    const items = await db.all('SELECT * FROM invoice_items WHERE invoice_id = ?', [invoiceId]);
    for (const item of items) {
      const product = await db.get('SELECT stock_policy FROM products WHERE id = ?', [item.product_id]);
      if (product && product.stock_policy === 'track') {
        await inventoryService.createTransaction({
          productId: item.product_id,
          transactionType: 'return',
          quantity: item.quantity,
          referenceType: 'invoice',
          referenceId: invoiceId,
          userId
        });
      }
    }

    // 4. Record ledger entry reversing the remaining receivable
    const payments = await db.all('SELECT amount FROM invoice_payments WHERE invoice_id = ?', [invoiceId]);
    const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);
    const remaining = parseFloat((invoice.total_price - totalPaid).toFixed(2));

    if (remaining > 0) {
      await db.run(`
        INSERT INTO finance_ledger_entries (
          outlet_id, entry_type, reference_type, reference_id,
          cash_amount, receivable_amount, notes, created_by
        ) VALUES (?, 'invoice_cancelled', 'invoice', ?, 0, ?, 'Invoice cancelled.', ?)
      `, [invoice.outlet_id, invoiceId, -remaining, userId]);
    }

    await db.exec('COMMIT;');

    // Trigger notification checks after commit
    try {
      await notificationsService.checkOutletCreditLimitNotifications(invoice.outlet_id);
      for (const item of items) {
        await notificationsService.checkStockNotifications(item.product_id);
      }
      await notificationsService.resolveNotificationByDedupeKey(`invoice_overdue:${invoiceId}`);
    } catch (e) {
      console.error('Error running notification checks on invoice cancellation:', e);
    }

    return await getInvoiceById(invoiceId);
  } catch (err) {
    await db.exec('ROLLBACK;');
    throw err;
  }
}

/**
 * Bulk update shipping status for a list of invoices.
 */
async function bulkUpdateShippingStatus({ invoiceIds, shippingStatus, userId }) {
  if (!invoiceIds || !Array.isArray(invoiceIds) || invoiceIds.length === 0) {
    throw new Error('Invoice IDs must be a non-empty array.');
  }
  const allowedStatuses = ['pending', 'partially_shipped', 'shipped', 'delivered'];
  if (!allowedStatuses.includes(shippingStatus)) {
    throw new Error(`Invalid shipping status: ${shippingStatus}`);
  }

  // Begin Transaction
  await db.exec('BEGIN TRANSACTION;');

  try {
    for (const invoiceId of invoiceIds) {
      const invoice = await db.get('SELECT shipping_status, invoice_number, outlet_id FROM invoices WHERE id = ?', [invoiceId]);
      if (!invoice) {
        throw new Error(`Invoice with ID ${invoiceId} does not exist`);
      }
      
      if (shippingStatus !== invoice.shipping_status) {
        // If updating status to 'shipped' or 'delivered', validate physical stock and create shipments automatically
        if (shippingStatus === 'shipped' || shippingStatus === 'delivered') {
          const invoiceItems = await db.all('SELECT * FROM invoice_items WHERE invoice_id = ?', [invoiceId]);
          const shipmentItemsToCreate = [];
          
          for (const item of invoiceItems) {
            const product = await db.get('SELECT title, stock_policy FROM products WHERE id = ?', [item.product_id]);
            if (product && product.stock_policy === 'track') {
              // Calculate already shipped quantity
              const shippedRow = await db.get(`
                SELECT COALESCE(SUM(si.quantity), 0) as qty
                FROM shipment_items si
                JOIN shipments s ON s.id = si.shipment_id
                WHERE si.invoice_item_id = ? AND s.status != 'cancelled'
              `, [item.id]);
              
              const remainingQty = Math.max(0, item.quantity - shippedRow.qty);
              if (remainingQty > 0) {
                const physicalStock = await getPhysicalStock(item.product_id);
                if (physicalStock < remainingQty) {
                  throw new Error(`المخزون الفعلي المتاح للكتاب "${product.title}" في المستودع هو ${physicalStock}، وهو غير كافٍ لشحن الكمية المتبقية (${remainingQty}) للفاتورة رقم ${invoice.invoice_number}.`);
                }
                shipmentItemsToCreate.push({
                  invoiceItemId: item.id,
                  quantity: remainingQty
                });
              }
            } else {
              // For non-tracked products, we can ship remaining items without check
              const shippedRow = await db.get(`
                SELECT COALESCE(SUM(si.quantity), 0) as qty
                FROM shipment_items si
                JOIN shipments s ON s.id = si.shipment_id
                WHERE si.invoice_item_id = ? AND s.status != 'cancelled'
              `, [item.id]);
              
              const remainingQty = Math.max(0, item.quantity - shippedRow.qty);
              if (remainingQty > 0) {
                shipmentItemsToCreate.push({
                  invoiceItemId: item.id,
                  quantity: remainingQty
                });
              }
            }
          }
          
          // Create a shipment automatically so physical stock is correctly deducted in the ledger
          if (shipmentItemsToCreate.length > 0) {
            const shipmentNumber = `SHP-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;
            const shipmentSql = `
              INSERT INTO shipments (shipment_number, invoice_id, shipping_carrier, tracking_number, status, created_by)
              VALUES (?, ?, 'Bulk Update', NULL, 'delivered', ?)
            `;
            const shipmentResult = await db.run(shipmentSql, [
              shipmentNumber,
              invoiceId,
              userId
            ]);
            const shipmentId = shipmentResult.lastID;
            
            for (const shipItem of shipmentItemsToCreate) {
              await db.run(
                `INSERT INTO shipment_items (shipment_id, invoice_item_id, quantity) VALUES (?, ?, ?)`,
                [shipmentId, shipItem.invoiceItemId, shipItem.quantity]
              );
            }
            
            await db.run(`
              INSERT INTO shipment_status_history (shipment_id, old_status, new_status, changed_by, notes)
              VALUES (?, 'delivered', 'delivered', ?, 'Shipment created automatically via bulk shipping status update.')
            `, [shipmentId, userId]);
          }
        }

        await db.run('UPDATE invoices SET shipping_status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [shippingStatus, invoiceId]);
        
        await db.run(`
          INSERT INTO invoice_status_history (invoice_id, status_type, old_status, new_status, changed_by, notes)
          VALUES (?, 'shipping', ?, ?, ?, ?)
        `, [invoiceId, invoice.shipping_status, shippingStatus, userId, 'Bulk shipping status update.']);

        // Handle partial shipment notification
        try {
          if (shippingStatus === 'partially_shipped') {
            await notificationsService.createOrUpdateNotification({
              category: 'shipment_partial',
              severity: 'warning',
              title: 'شحنة جزئية للفاتورة',
              message: `تم شحن الفاتورة رقم ${invoice.invoice_number} شحناً جزئياً.`,
              source_type: 'invoice',
              source_id: invoiceId,
              dedupe_key: `shipment_partial:${invoiceId}`,
              action_url: `/operations/shipments`
            });
          } else {
            await notificationsService.resolveNotificationByDedupeKey(`shipment_partial:${invoiceId}`);
          }
        } catch (e) {
          console.error('Error triggering partial shipment notification check inside bulk update:', e);
        }
      }
    }

    await db.exec('COMMIT;');
  } catch (err) {
    await db.exec('ROLLBACK;');
    throw err;
  }
}

module.exports = {
  createInvoice,
  updateInvoice,
  getInvoiceById,
  getInvoices,
  cancelInvoice,
  bulkUpdateShippingStatus
};

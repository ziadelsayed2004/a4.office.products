import db from '../../db/index.js';
import { writeAuditLog } from '../../utils/auditLogger.js';
import crypto from 'crypto';

/**
 * Search and list products with optional filters.
 * Returns a list of matching items with category details.
 */
export async function searchProducts(filters = {}) {
  let query = `
    SELECT p.*, c.name AS category_name,
           COALESCE((SELECT after_quantity FROM inventory_ledger WHERE product_id = p.id ORDER BY id DESC LIMIT 1), 0) AS stock,
           COALESCE((SELECT SUM(pi.quantity) FROM preorder_items pi JOIN preorders pr ON pi.preorder_id = pr.id WHERE pi.product_id = p.id AND pr.status IN ('DEPOSIT_PAID_WAITING_STOCK', 'READY_FOR_PICKUP')), 0) AS open_preorders
    FROM products p
    LEFT JOIN categories c ON p.category_id = c.id
    WHERE 1=1
  `;
  const params = [];

  // Search keyword (fuzzy name, SKU, barcode)
  if (filters.q && filters.q.trim().length > 0) {
    const searchVal = `%${filters.q.trim()}%`;
    query += ' AND (p.name LIKE ? OR p.sku LIKE ? OR p.barcode LIKE ?)';
    params.push(searchVal, searchVal, searchVal);
  }

  // Category filter
  if (filters.categoryId) {
    query += ' AND p.category_id = ?';
    params.push(filters.categoryId);
  }

  // Active status filter
  if (filters.activeOnly) {
    query += ' AND p.is_active = 1';
  }

  // Sorting
  query += ' ORDER BY p.name ASC;';

  return await db.all(query, params);
}

/**
 * Retrieve comprehensive details for a product by ID,
 * joining category name, optional book details, and its prices list.
 */
export async function getProductDetails(id) {
  // Fetch main product details
  const product = await db.get(
    `SELECT p.*, c.name AS category_name,
            COALESCE((SELECT after_quantity FROM inventory_ledger WHERE product_id = p.id ORDER BY id DESC LIMIT 1), 0) AS stock,
            COALESCE((SELECT SUM(pi.quantity) FROM preorder_items pi JOIN preorders pr ON pi.preorder_id = pr.id WHERE pi.product_id = p.id AND pr.status IN ('DEPOSIT_PAID_WAITING_STOCK', 'READY_FOR_PICKUP')), 0) AS open_preorders
     FROM products p
     LEFT JOIN categories c ON p.category_id = c.id
     WHERE p.id = ?;`,
    [id]
  );

  if (!product) {
    return null;
  }

  // Fetch optional book details
  const bookDetails = await db.get(
    'SELECT * FROM product_book_details WHERE product_id = ?;',
    [id]
  );

  // Fetch pricing across active price tiers
  const prices = await db.all(
    `SELECT pt.id AS price_tier_id, pt.name AS price_tier_name, pp.price
     FROM price_tiers pt
     LEFT JOIN product_prices pp ON pp.price_tier_id = pt.id AND pp.product_id = ?
     WHERE pt.is_active = 1;`,
    [id]
  );

  // Parse money integer values (minor units) to human readable EGP when displaying,
  // but keep them in raw minor units for calculations. We will return minor units.
  return {
    ...product,
    book_details: bookDetails || null,
    prices: prices.map(p => ({
      price_tier_id: p.price_tier_id,
      price_tier_name: p.price_tier_name,
      price: p.price !== null && p.price !== undefined ? p.price : 0 // 0 if not set yet
    }))
  };
}

/**
 * Create a new product without images.
 */
export async function createProduct(productData, adminUserId) {
  const {
    name, sku, barcode, category_id, description, is_active,
    can_be_sold, can_be_preordered, default_preorder_deposit_pct,
    default_pickup_method, low_stock_threshold, purchase_cost, notes,
    is_book, book_details, prices
  } = productData;

  // 1. Validation
  if (!name || name.trim().length === 0) {
    throw new Error('اسم المنتج مطلوب.');
  }
  if (!sku || sku.trim().length === 0) {
    throw new Error('رمز SKU مطلوب.');
  }
  if (!category_id) {
    throw new Error('التصنيف مطلوب.');
  }

  // Verify category exists
  const category = await db.get('SELECT id FROM categories WHERE id = ?;', [category_id]);
  if (!category) {
    throw new Error('التصنيف المحدد غير موجود.');
  }

  // Verify SKU unique
  const existingProduct = await db.get('SELECT id FROM products WHERE sku = ?;', [sku.trim()]);
  if (existingProduct) {
    throw new Error('رمز SKU هذا مستخدم بالفعل لمنتج آخر.');
  }

  const depositPct = default_preorder_deposit_pct !== undefined ? parseInt(default_preorder_deposit_pct, 10) : 50;
  if (isNaN(depositPct) || depositPct < 0 || depositPct > 100) {
    throw new Error('نسبة عربون الحجز الافتراضية يجب أن تكون بين 0 و 100.');
  }

  const cost = purchase_cost !== undefined ? parseInt(purchase_cost, 10) : 0;
  if (isNaN(cost) || cost < 0) {
    throw new Error('تكلفة الشراء الافتراضية لا يمكن أن تكون أقل من صفر.');
  }

  // Begin transaction
  await db.run('BEGIN TRANSACTION;');
  try {
    const productResult = await db.run(
      `INSERT INTO products (
        name, sku, barcode, category_id, description, is_active, can_be_sold, can_be_preordered,
        default_preorder_deposit_pct, default_pickup_method, low_stock_threshold, purchase_cost, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
      [
        name.trim(),
        sku.trim(),
        barcode ? barcode.trim() : null,
        category_id,
        description || null,
        is_active === 0 ? 0 : 1,
        can_be_sold === 0 ? 0 : 1,
        can_be_preordered === 0 ? 0 : 1,
        depositPct,
        default_pickup_method || 'walk_in',
        low_stock_threshold !== undefined ? parseInt(low_stock_threshold, 10) : 5,
        cost,
        notes || null
      ]
    );

    const productId = productResult.lastID;

    // 2. Educational book details
    if (is_book && book_details) {
      const {
        book_type, school_grade, subject, teacher, publisher, release_year, term, educational_classification
      } = book_details;

      if (term && !['first', 'second'].includes(term)) {
        throw new Error('الترم الدراسي المحدد غير صالح (يجب أن يكون الفصل الدراسي الأول أو الثاني).');
      }

      if (educational_classification && !['external_book', 'school_book', 'booklet', 'notes'].includes(educational_classification)) {
        throw new Error('تصنيف الكتاب التعليمي غير صالح.');
      }

      await db.run(
        `INSERT INTO product_book_details (
          product_id, book_type, school_grade, subject, teacher, publisher, release_year, term, educational_classification
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);`,
        [
          productId,
          book_type || null,
          school_grade || null,
          subject || null,
          teacher || null,
          publisher || null,
          release_year ? parseInt(release_year, 10) : null,
          term || null,
          educational_classification || null
        ]
      );
    }

    // 3. Pricing tiers mapping
    if (Array.isArray(prices)) {
      for (const p of prices) {
        const { price_tier_id, price } = p;
        if (!price_tier_id) continue;
        const parsedPrice = parseInt(price, 10);
        if (isNaN(parsedPrice) || parsedPrice < 0) {
          throw new Error('السعر لا يمكن أن يكون أقل من صفر.');
        }

        // Verify tier exists
        const tier = await db.get('SELECT id FROM price_tiers WHERE id = ?;', [price_tier_id]);
        if (!tier) {
          throw new Error(`فئة السعر ذات المعرف (${price_tier_id}) غير موجودة.`);
        }

        await db.run(
          `INSERT INTO product_prices (product_id, price_tier_id, price) VALUES (?, ?, ?);`,
          [productId, price_tier_id, parsedPrice]
        );
      }
    }

    await db.run('COMMIT;');

    // Log audit trail
    await writeAuditLog({
      userId: adminUserId,
      actionType: 'PRODUCT_CREATE',
      entityType: 'products',
      entityId: productId,
      afterValues: { name: name.trim(), sku: sku.trim(), is_book },
      notes: `تم إنشاء المنتج الجديد بنجاح: ${name.trim()} (SKU: ${sku.trim()})`
    });

    return await getProductDetails(productId);
  } catch (err) {
    await db.run('ROLLBACK;');
    throw err;
  }
}

/**
 * Update an existing product.
 */
export async function updateProduct(id, productData, adminUserId) {
  const oldProduct = await getProductDetails(id);
  if (!oldProduct) {
    throw new Error('المنتج غير موجود.');
  }

  const {
    name, sku, barcode, category_id, description, is_active,
    can_be_sold, can_be_preordered, default_preorder_deposit_pct,
    default_pickup_method, low_stock_threshold, purchase_cost, notes,
    is_book, book_details, prices
  } = productData;

  // 1. Validation
  if (name !== undefined && (!name || name.trim().length === 0)) {
    throw new Error('اسم المنتج مطلوب.');
  }
  if (sku !== undefined && (!sku || sku.trim().length === 0)) {
    throw new Error('رمز SKU مطلوب.');
  }
  if (category_id !== undefined && !category_id) {
    throw new Error('التصنيف مطلوب.');
  }

  if (category_id !== undefined) {
    const category = await db.get('SELECT id FROM categories WHERE id = ?;', [category_id]);
    if (!category) {
      throw new Error('التصنيف المحدد غير موجود.');
    }
  }

  if (sku !== undefined && sku.trim() !== oldProduct.sku) {
    const existingProduct = await db.get('SELECT id FROM products WHERE sku = ?;', [sku.trim()]);
    if (existingProduct) {
      throw new Error('رمز SKU هذا مستخدم بالفعل لمنتج آخر.');
    }
  }

  const depositPct = default_preorder_deposit_pct !== undefined ? parseInt(default_preorder_deposit_pct, 10) : oldProduct.default_preorder_deposit_pct;
  if (isNaN(depositPct) || depositPct < 0 || depositPct > 100) {
    throw new Error('نسبة عربون الحجز الافتراضية يجب أن تكون بين 0 و 100.');
  }

  const cost = purchase_cost !== undefined ? parseInt(purchase_cost, 10) : oldProduct.purchase_cost;
  if (isNaN(cost) || cost < 0) {
    throw new Error('تكلفة الشراء الافتراضية لا يمكن أن تكون أقل من صفر.');
  }

  // Begin transaction
  await db.run('BEGIN TRANSACTION;');
  try {
    await db.run(
      `UPDATE products SET
        name = ?, sku = ?, barcode = ?, category_id = ?, description = ?, is_active = ?,
        can_be_sold = ?, can_be_preordered = ?, default_preorder_deposit_pct = ?,
        default_pickup_method = ?, low_stock_threshold = ?, purchase_cost = ?, notes = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?;`,
      [
        name !== undefined ? name.trim() : oldProduct.name,
        sku !== undefined ? sku.trim() : oldProduct.sku,
        barcode !== undefined ? (barcode ? barcode.trim() : null) : oldProduct.barcode,
        category_id !== undefined ? category_id : oldProduct.category_id,
        description !== undefined ? description : oldProduct.description,
        is_active !== undefined ? (is_active ? 1 : 0) : oldProduct.is_active,
        can_be_sold !== undefined ? (can_be_sold ? 1 : 0) : oldProduct.can_be_sold,
        can_be_preordered !== undefined ? (can_be_preordered ? 1 : 0) : oldProduct.can_be_preordered,
        depositPct,
        default_pickup_method !== undefined ? default_pickup_method : oldProduct.default_pickup_method,
        low_stock_threshold !== undefined ? parseInt(low_stock_threshold, 10) : oldProduct.low_stock_threshold,
        cost,
        notes !== undefined ? notes : oldProduct.notes,
        id
      ]
    );

    // 2. Educational book details
    if (is_book) {
      if (book_details) {
        const {
          book_type, school_grade, subject, teacher, publisher, release_year, term, educational_classification
        } = book_details;

        if (term && !['first', 'second'].includes(term)) {
          throw new Error('الترم الدراسي المحدد غير صالح.');
        }

        if (educational_classification && !['external_book', 'school_book', 'booklet', 'notes'].includes(educational_classification)) {
          throw new Error('تصنيف الكتاب التعليمي غير صالح.');
        }

        await db.run(
          `INSERT INTO product_book_details (
            product_id, book_type, school_grade, subject, teacher, publisher, release_year, term, educational_classification
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(product_id) DO UPDATE SET
            book_type = excluded.book_type,
            school_grade = excluded.school_grade,
            subject = excluded.subject,
            teacher = excluded.teacher,
            publisher = excluded.publisher,
            release_year = excluded.release_year,
            term = excluded.term,
            educational_classification = excluded.educational_classification;`,
          [
            id,
            book_type || null,
            school_grade || null,
            subject || null,
            teacher || null,
            publisher || null,
            release_year ? parseInt(release_year, 10) : null,
            term || null,
            educational_classification || null
          ]
        );
      }
    } else if (is_book === false) {
      // Explicitly removed book status
      await db.run('DELETE FROM product_book_details WHERE product_id = ?;', [id]);
    }

    // 3. Pricing tiers mapping
    if (Array.isArray(prices)) {
      for (const p of prices) {
        const { price_tier_id, price } = p;
        if (!price_tier_id) continue;
        const parsedPrice = parseInt(price, 10);
        if (isNaN(parsedPrice) || parsedPrice < 0) {
          throw new Error('السعر لا يمكن أن يكون أقل من صفر.');
        }

        // Verify tier exists
        const tier = await db.get('SELECT id FROM price_tiers WHERE id = ?;', [price_tier_id]);
        if (!tier) {
          throw new Error(`فئة السعر ذات المعرف (${price_tier_id}) غير موجودة.`);
        }

        await db.run(
          `INSERT INTO product_prices (product_id, price_tier_id, price) VALUES (?, ?, ?)
           ON CONFLICT(product_id, price_tier_id) DO UPDATE SET
             price = excluded.price,
             updated_at = CURRENT_TIMESTAMP;`,
          [id, price_tier_id, parsedPrice]
        );
      }
    }

    await db.run('COMMIT;');

    // Log audit trail
    await writeAuditLog({
      userId: adminUserId,
      actionType: 'PRODUCT_UPDATE',
      entityType: 'products',
      entityId: id,
      beforeValues: oldProduct,
      afterValues: { id, name, sku, is_book },
      notes: `تم تحديث بيانات المنتج ذو المعرف (${id}) بنجاح`
    });

    return await getProductDetails(id);
  } catch (err) {
    await db.run('ROLLBACK;');
    throw err;
  }
}

/**
 * Retrieve or generate a secure product QR token and log its label printing configuration to the audit ledger.
 */
export async function getOrCreateProductQrToken(productId, { quantity, label_size }, adminUserId) {
  const product = await getProductDetails(productId);
  if (!product) {
    throw new Error('المنتج غير موجود.');
  }

  let token;
  const existing = await db.get(
    "SELECT token FROM qr_tokens WHERE type = 'product' AND reference_id = ?;",
    [productId]
  );

  if (existing) {
    token = existing.token;
  } else {
    token = 'prod_' + crypto.randomBytes(16).toString('hex');
    await db.run(
      "INSERT INTO qr_tokens (token, type, reference_id) VALUES (?, 'product', ?);",
      [token, productId]
    );
  }

  const qty = parseInt(quantity, 10) || 1;

  // Log print action to audit log
  await writeAuditLog({
    userId: adminUserId,
    actionType: 'PRODUCT_QR_PRINT',
    entityType: 'products',
    entityId: productId,
    notes: `تم طباعة ملصقات رمز QR للمنتج: ${product.name} (عدد: ${qty}، مقاس: ${label_size})`
  });

  return {
    product: {
      id: product.id,
      name: product.name,
      sku: product.sku,
      barcode: product.barcode
    },
    token,
    quantity: qty,
    label_size
  };
}

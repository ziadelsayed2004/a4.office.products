import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import bcrypt from 'bcryptjs';
import db from './index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Automatically execute migrations to bootstrap schema tables if not present.
 */
export async function runMigrations() {
  try {
    console.log('----------------------------------------');
    console.log('Checking database migration status...');
    
    // Check if users table already exists to determine if initialization is required
    const tableCheck = await db.get(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='users';"
    );
    
    if (!tableCheck) {
      console.log('Database is not initialized. Bootstrapping schema...');
      
      const schemaPath = path.resolve(__dirname, 'schema.sql');
      const schemaSql = fs.readFileSync(schemaPath, 'utf8');
      
      // Execute the schema transaction
      await db.exec(schemaSql);
      console.log('Database schema successfully initialized with all target tables and indexes.');
    } else {
      console.log('Database schema is already initialized. Verifying returns tables...');
      // Ensure returns table is created in case db exists but returns doesn't
      await db.exec(`
        CREATE TABLE IF NOT EXISTS returns (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE RESTRICT,
            shift_id INTEGER NOT NULL REFERENCES shifts(id) ON DELETE RESTRICT,
            cashier_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
            total_refunded INTEGER NOT NULL CHECK(total_refunded >= 0),
            notes TEXT,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS return_items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            return_id INTEGER NOT NULL REFERENCES returns(id) ON DELETE CASCADE,
            product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
            quantity INTEGER NOT NULL CHECK(quantity > 0),
            refund_amount INTEGER NOT NULL CHECK(refund_amount >= 0),
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        );

        -- Apply new performance lookup indexes
        CREATE INDEX IF NOT EXISTS idx_inv_ledger_latest ON inventory_ledger(product_id, id DESC);
        CREATE INDEX IF NOT EXISTS idx_orders_date ON orders(created_at);
        CREATE INDEX IF NOT EXISTS idx_orders_shift ON orders(shift_id);
        CREATE INDEX IF NOT EXISTS idx_preorders_shift ON preorders(shift_id);
        CREATE INDEX IF NOT EXISTS idx_preorders_status ON preorders(status);
        CREATE INDEX IF NOT EXISTS idx_preorder_items_product ON preorder_items(product_id);
        CREATE INDEX IF NOT EXISTS idx_order_items_product ON order_items(product_id);
        CREATE INDEX IF NOT EXISTS idx_cash_movements_shift ON cash_movements(shift_id);
      `);
    }

    // Seed default admin and cashier accounts if empty
    const usersCount = await db.get("SELECT COUNT(*) AS count FROM users;");
    if (usersCount && usersCount.count === 0) {
      console.log('Seeding default Admin and Cashier accounts...');
      
      const adminHash = await bcrypt.hash('admin123', 10);
      const cashierHash = await bcrypt.hash('cashier123', 10);
      
      await db.run(
        "INSERT INTO users (username, password_hash, role, name, phone) VALUES (?, ?, ?, ?, ?);",
        ['admin', adminHash, 'Admin', 'مدير النظام', '01000000001']
      );
      
      await db.run(
        "INSERT INTO users (username, password_hash, role, name, phone) VALUES (?, ?, ?, ?, ?);",
        ['cashier', cashierHash, 'Cashier', 'كاشير المحل', '01000000002']
      );
      
      console.log('Default accounts seeded successfully.');
    }

    // Seed Demo Data (Categories, Price Tiers, Products, Payment Methods, Printer Settings)
    await seedDemoData();

    console.log('----------------------------------------');
  } catch (error) {
    console.error('FATAL: Database migration runner failed:', error.message);
    throw error;
  }
}

/**
 * Seed demo data for categories, price tiers, products, and default configurations.
 */
async function seedDemoData() {
  console.log('Checking demo data seeding status...');
  
  // 1. Categories
  const categoriesCount = await db.get("SELECT COUNT(*) AS count FROM categories;");
  if (categoriesCount && categoriesCount.count === 0) {
    console.log('Seeding default Categories...');
    await db.run("INSERT INTO categories (name, is_active) VALUES (?, ?);", ['كتب خارجية', 1]);
    await db.run("INSERT INTO categories (name, is_active) VALUES (?, ?);", ['أدوات مكتبية', 1]);
    await db.run("INSERT INTO categories (name, is_active) VALUES (?, ?);", ['أجهزة وآلات حاسبة', 1]);
  }

  // 2. Price Tiers
  const priceTiersCount = await db.get("SELECT COUNT(*) AS count FROM price_tiers;");
  if (priceTiersCount && priceTiersCount.count === 0) {
    console.log('Seeding default Price Tiers...');
    await db.run("INSERT INTO price_tiers (name, description, is_active) VALUES (?, ?, ?);", ['سعر التجزئة الافتراضي', 'السعر الافتراضي لبيع التجزئة للجمهور', 1]);
    await db.run("INSERT INTO price_tiers (name, description, is_active) VALUES (?, ?, ?);", ['سعر الجملة للشركات', 'سعر خاص للشركات والمؤسسات', 1]);
    await db.run("INSERT INTO price_tiers (name, description, is_active) VALUES (?, ?, ?);", ['خصم الطلاب والمعلمين', 'خصم مخصص للطلاب وهيئة التدريس', 1]);
  }

  // Fetch category and price tier mappings
  const categories = await db.all("SELECT id, name FROM categories;");
  const priceTiers = await db.all("SELECT id, name FROM price_tiers;");
  
  const categoryMap = {};
  categories.forEach(c => { categoryMap[c.name] = c.id; });
  
  const tierMap = {};
  priceTiers.forEach(t => { tierMap[t.name] = t.id; });

  // 3. Products
  const productsCount = await db.get("SELECT COUNT(*) AS count FROM products;");
  if (productsCount && productsCount.count === 0) {
    console.log('Seeding default Products and Inventory Ledger entries...');

    const demoProducts = [
      {
        name: 'كشكول سلك A4 مسطر 100 ورقة',
        sku: 'NOTE-A4-100',
        barcode: '6221234567890',
        category_name: 'أدوات مكتبية',
        description: 'دفتر سلك A4 فاخر مسطر مناسب للدراسة والمكتب',
        purchase_cost: 2500, // 25.00 EGP
        prices: {
          'سعر التجزئة الافتراضي': 4000,
          'سعر الجملة للشركات': 3600,
          'خصم الطلاب والمعلمين': 3400
        },
        initial_stock: 150,
        low_stock_threshold: 10,
        qr_token: 'QR-NOTE-A4-100'
      },
      {
        name: 'قلم جاف أزرق زيبرا 0.7 مم',
        sku: 'PEN-ZEBRA-BLU',
        barcode: '4901681123456',
        category_name: 'أدوات مكتبية',
        description: 'قلم جاف ياباني سريع الجفاف كتابة سلسة ومريحة',
        purchase_cost: 800, // 8.00 EGP
        prices: {
          'سعر التجزئة الافتراضي': 1500,
          'سعر الجملة للشركات': 1350,
          'خصم الطلاب والمعلمين': 1275
        },
        initial_stock: 500,
        low_stock_threshold: 25,
        qr_token: 'QR-PEN-ZEBRA-BLU'
      },
      {
        name: 'آلة حاسبة علمية كاسيو FX-991ARX',
        sku: 'CALC-CASIO-991',
        barcode: '4971850091234',
        category_name: 'أجهزة وآلات حاسبة',
        description: 'آلة حاسبة علمية كاسيو تدعم اللغة العربية والعمليات الرياضية المعقدة',
        purchase_cost: 45000, // 450.00 EGP
        prices: {
          'سعر التجزئة الافتراضي': 65000,
          'سعر الجملة للشركات': 58500,
          'خصم الطلاب والمعلمين': 55250
        },
        initial_stock: 30,
        low_stock_threshold: 5,
        qr_token: 'QR-CALC-CASIO-991'
      },
      {
        name: 'كتاب سلاح التلميذ - الرياضيات - الصف السادس الابتدائي',
        sku: 'BOOK-SELAH-MATH6',
        barcode: '6229876543210',
        category_name: 'كتب خارجية',
        description: 'كتاب الشرح والتمارين والامتحانات في الرياضيات للصف السادس الابتدائي الفصل الدراسي الأول',
        purchase_cost: 8000, // 80.00 EGP
        prices: {
          'سعر التجزئة الافتراضي': 12000,
          'سعر الجملة للشركات': 10800,
          'خصم الطلاب والمعلمين': 10200
        },
        initial_stock: 80,
        low_stock_threshold: 8,
        qr_token: 'QR-BOOK-SELAH-MATH6',
        book_details: {
          book_type: 'external_book',
          school_grade: 'الصف السادس الابتدائي',
          subject: 'الرياضيات',
          publisher: 'سلاح التلميذ',
          release_year: 2026
        }
      }
    ];

    for (const p of demoProducts) {
      const categoryId = categoryMap[p.category_name];
      if (!categoryId) continue;

      // 3.1 Insert Product
      const productResult = await db.run(
        `INSERT INTO products (
          name, sku, barcode, category_id, description, is_active, 
          can_be_sold, can_be_preordered, default_preorder_deposit_pct, 
          default_pickup_method, low_stock_threshold, purchase_cost
        ) VALUES (?, ?, ?, ?, ?, 1, 1, 1, 50, 'walk_in', ?, ?);`,
        [p.name, p.sku, p.barcode, categoryId, p.description, p.low_stock_threshold, p.purchase_cost]
      );
      
      const productId = productResult.lastID;

      // 3.2 Insert Product Prices (for each tier)
      for (const tier of priceTiers) {
        const priceValue = p.prices[tier.name] || p.prices['سعر التجزئة الافتراضي'];
        await db.run(
          `INSERT INTO product_prices (product_id, price_tier_id, price) VALUES (?, ?, ?);`,
          [productId, tier.id, priceValue]
        );
      }

      // 3.3 Insert QR Token
      await db.run(
        `INSERT INTO qr_tokens (token, type, reference_id) VALUES (?, 'product', ?);`,
        [p.qr_token, productId]
      );

      // 3.4 Insert Book Details (optional)
      if (p.book_details) {
        await db.run(
          `INSERT INTO product_book_details (
            product_id, book_type, school_grade, subject, publisher, release_year
          ) VALUES (?, ?, ?, ?, ?, ?);`,
          [productId, p.book_details.book_type, p.book_details.school_grade, p.book_details.subject, p.book_details.publisher, p.book_details.release_year]
        );
      }

      // 3.5 Insert Inventory Ledger starting balance
      await db.run(
        `INSERT INTO inventory_ledger (
          product_id, transaction_type, quantity_changed, before_quantity, after_quantity, user_id, notes
        ) VALUES (?, 'STOCK_IN', ?, 0, ?, 1, 'رصيد مخزون أول المدة التجريبي');`,
        [productId, p.initial_stock, p.initial_stock]
      );
    }
    console.log('Demo products and stock seeded successfully.');
  } else {
    // Make sure existing products have price mappings for all tiers
    const allProducts = await db.all("SELECT id, name, sku FROM products;");
    for (const prod of allProducts) {
      let defaultPrice = 4000;
      if (prod.sku === 'PEN-ZEBRA-BLU') defaultPrice = 1500;
      else if (prod.sku === 'CALC-CASIO-991') defaultPrice = 65000;
      else if (prod.sku === 'BOOK-SELAH-MATH6') defaultPrice = 12000;

      for (const tier of priceTiers) {
        let priceVal = defaultPrice;
        if (tier.name === 'سعر الجملة للشركات') priceVal = Math.round(defaultPrice * 0.9);
        else if (tier.name === 'خصم الطلاب والمعلمين') priceVal = Math.round(defaultPrice * 0.85);

        await db.run(
          `INSERT OR IGNORE INTO product_prices (product_id, price_tier_id, price) VALUES (?, ?, ?);`,
          [prod.id, tier.id, priceVal]
        );
      }
    }
  }

  // 4. Business Settings (Payment Methods)
  const activePaymentsCheck = await db.get(
    "SELECT value FROM business_settings WHERE key = 'active_payment_methods';"
  );
  if (!activePaymentsCheck) {
    console.log('Seeding default active payment methods in business settings...');
    const defaultActivePayments = ['Cash', 'Card', 'InstaPay', 'Wallet', 'Transfer'];
    await db.run(
      "INSERT INTO business_settings (key, value, updated_at) VALUES ('active_payment_methods', ?, CURRENT_TIMESTAMP);",
      [JSON.stringify(defaultActivePayments)]
    );
  }

  // 5. Printer Settings
  const printerSettingsCount = await db.get("SELECT COUNT(*) AS count FROM printer_settings;");
  if (printerSettingsCount && printerSettingsCount.count === 0) {
    console.log('Seeding default printer settings...');
    const defaultPrinterSettings = {
      receipt_printer_type: 'simulation',
      receipt_printer_address: '',
      receipt_printer_width: '80mm',
      receipt_printer_header: 'مكتبة A4 للأدوات المكتبية',
      receipt_printer_footer: 'شكراً لتعاملكم معنا!',
      qr_printer_type: 'simulation',
      qr_printer_address: '',
      qr_printer_width: '50',
      qr_printer_height: '25',
      print_show_customer: 'true',
      print_show_price_tier: 'true',
      print_show_qr: 'true'
    };
    
    for (const [key, value] of Object.entries(defaultPrinterSettings)) {
      await db.run(
        "INSERT INTO printer_settings (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP);",
        [key, value]
      );
    }
  }
}

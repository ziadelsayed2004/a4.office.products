-- A4 Office Products POS Platform - SQLite Database Schema Definition

-- Enable SQLite foreign key constraint checks (run in connection initialization)
-- PRAGMA foreign_keys = ON;

-- 1. USERS Table
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL CHECK(role IN ('Admin', 'Cashier')),
    name TEXT NOT NULL,
    phone TEXT,
    is_active INTEGER NOT NULL DEFAULT 1 CHECK(is_active IN (0, 1)),
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 2. SESSIONS Table (JWT token blacklist/refresh validation)
CREATE TABLE IF NOT EXISTS sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token TEXT UNIQUE NOT NULL,
    expires_at DATETIME NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 3. CATEGORIES Table
CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    is_active INTEGER NOT NULL DEFAULT 1 CHECK(is_active IN (0, 1)),
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 4. PRICE TIERS Table
CREATE TABLE IF NOT EXISTS price_tiers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    description TEXT,
    is_active INTEGER NOT NULL DEFAULT 1 CHECK(is_active IN (0, 1)),
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 5. PRODUCTS Table (Generic retail items, no images)
CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    sku TEXT UNIQUE NOT NULL,
    barcode TEXT,
    category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
    description TEXT,
    is_active INTEGER NOT NULL DEFAULT 1 CHECK(is_active IN (0, 1)),
    can_be_sold INTEGER NOT NULL DEFAULT 1 CHECK(can_be_sold IN (0, 1)),
    can_be_preordered INTEGER NOT NULL DEFAULT 1 CHECK(can_be_preordered IN (0, 1)),
    default_preorder_deposit_pct INTEGER NOT NULL DEFAULT 50 CHECK(default_preorder_deposit_pct BETWEEN 0 AND 100),
    default_pickup_method TEXT NOT NULL DEFAULT 'walk_in',
    low_stock_threshold INTEGER NOT NULL DEFAULT 5,
    purchase_cost INTEGER NOT NULL DEFAULT 0, -- Stored as integer minor units (piastres)
    notes TEXT,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 6. PRODUCT BOOK DETAILS Table (Optional bookstore/educational details)
CREATE TABLE IF NOT EXISTS product_book_details (
    product_id INTEGER PRIMARY KEY REFERENCES products(id) ON DELETE CASCADE,
    book_type TEXT,
    school_grade TEXT,
    subject TEXT,
    teacher TEXT,
    publisher TEXT,
    release_year INTEGER,
    term TEXT CHECK(term IN ('first', 'second')),
    educational_classification TEXT CHECK(educational_classification IN ('external_book', 'school_book', 'booklet', 'notes'))
);

-- 7. PRODUCT PRICES Table (Mapping price value to price tiers)
CREATE TABLE IF NOT EXISTS product_prices (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    price_tier_id INTEGER NOT NULL REFERENCES price_tiers(id) ON DELETE RESTRICT,
    price INTEGER NOT NULL CHECK(price >= 0), -- Stored as integer minor units (piastres)
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(product_id, price_tier_id)
);

-- 8. QR TOKENS Table (Secure references mapped to products or preorders)
CREATE TABLE IF NOT EXISTS qr_tokens (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    token TEXT UNIQUE NOT NULL,
    type TEXT NOT NULL CHECK(type IN ('product', 'preorder')),
    reference_id INTEGER NOT NULL, -- product_id or preorder_id
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 9. CUSTOMERS Table (Required for preorder records)
CREATE TABLE IF NOT EXISTS customers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    phone TEXT NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(name, phone)
);

-- 10. SHIFTS Table (Financial tracking per cashier account)
CREATE TABLE IF NOT EXISTS shifts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    status TEXT NOT NULL CHECK(status IN ('OPEN', 'PENDING_ADMIN_REVIEW', 'CLOSED', 'REJECTED')),
    opened_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    closed_at DATETIME,
    opening_cash INTEGER NOT NULL DEFAULT 0, -- Stored as integer minor units
    actual_closed_cash INTEGER,
    system_total_cash INTEGER NOT NULL DEFAULT 0,
    system_total_card INTEGER NOT NULL DEFAULT 0,
    system_total_instapay INTEGER NOT NULL DEFAULT 0,
    system_total_wallet INTEGER NOT NULL DEFAULT 0,
    system_total_transfer INTEGER NOT NULL DEFAULT 0,
    cashier_declared_cash INTEGER,
    cashier_declared_card INTEGER,
    cashier_declared_instapay INTEGER,
    cashier_declared_wallet INTEGER,
    cashier_declared_transfer INTEGER,
    admin_notes TEXT,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 11. ORDERS Table (Normal paid sales invoices)
CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    invoice_number TEXT UNIQUE NOT NULL,
    shift_id INTEGER NOT NULL REFERENCES shifts(id) ON DELETE RESTRICT,
    cashier_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    customer_id INTEGER REFERENCES customers(id) ON DELETE RESTRICT,
    subtotal INTEGER NOT NULL DEFAULT 0 CHECK(subtotal >= 0),
    discount INTEGER NOT NULL DEFAULT 0 CHECK(discount >= 0),
    total INTEGER NOT NULL DEFAULT 0 CHECK(total >= 0),
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 12. ORDER ITEMS Table (Normal paid sale invoice details)
CREATE TABLE IF NOT EXISTS order_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    quantity INTEGER NOT NULL CHECK(quantity > 0),
    unit_price INTEGER NOT NULL CHECK(unit_price >= 0),
    price_tier_id INTEGER REFERENCES price_tiers(id) ON DELETE RESTRICT,
    total_price INTEGER NOT NULL CHECK(total_price >= 0),
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 13. PREORDERS Table (Preorder deposit and pickup)
CREATE TABLE IF NOT EXISTS preorders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    preorder_number TEXT UNIQUE NOT NULL,
    shift_id INTEGER NOT NULL REFERENCES shifts(id) ON DELETE RESTRICT,
    cashier_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
    status TEXT NOT NULL CHECK(status IN ('DRAFT', 'DEPOSIT_PAID_WAITING_STOCK', 'READY_FOR_PICKUP', 'PICKED_UP', 'CANCELLED', 'EXPIRED')),
    subtotal INTEGER NOT NULL DEFAULT 0 CHECK(subtotal >= 0),
    discount INTEGER NOT NULL DEFAULT 0 CHECK(discount >= 0),
    total_amount INTEGER NOT NULL DEFAULT 0 CHECK(total_amount >= 0),
    deposit_required INTEGER NOT NULL DEFAULT 0 CHECK(deposit_required >= 0),
    deposit_paid INTEGER NOT NULL DEFAULT 0 CHECK(deposit_paid >= 0),
    remaining_amount INTEGER NOT NULL DEFAULT 0 CHECK(remaining_amount >= 0),
    pickup_method TEXT NOT NULL DEFAULT 'walk_in',
    expected_pickup_date DATETIME,
    notes TEXT,
    qr_pickup_token TEXT UNIQUE NOT NULL,
    pickup_order_id INTEGER REFERENCES orders(id) ON DELETE RESTRICT, -- Links to final invoice when picked up
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 14. PREORDER ITEMS Table (Preorder details)
CREATE TABLE IF NOT EXISTS preorder_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    preorder_id INTEGER NOT NULL REFERENCES preorders(id) ON DELETE CASCADE,
    product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    quantity INTEGER NOT NULL CHECK(quantity > 0),
    unit_price INTEGER NOT NULL CHECK(unit_price >= 0),
    price_tier_id INTEGER REFERENCES price_tiers(id) ON DELETE RESTRICT,
    total_price INTEGER NOT NULL CHECK(total_price >= 0),
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 15. PAYMENTS Table (Supports split payment methods)
CREATE TABLE IF NOT EXISTS payments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    shift_id INTEGER NOT NULL REFERENCES shifts(id) ON DELETE RESTRICT,
    cashier_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    reference_type TEXT NOT NULL CHECK(reference_type IN ('order', 'preorder')),
    reference_id INTEGER NOT NULL, -- order_id or preorder_id
    payment_method TEXT NOT NULL,
    amount INTEGER NOT NULL CHECK(amount > 0),
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    method_id INTEGER REFERENCES payment_methods(id) ON DELETE RESTRICT,
    stage TEXT NOT NULL DEFAULT 'SALE' CHECK(stage IN ('SALE', 'PREORDER_DEPOSIT', 'PREORDER_PICKUP', 'REFUND')),
    direction TEXT NOT NULL DEFAULT 'IN' CHECK(direction IN ('IN', 'OUT')),
    applied_amount INTEGER,
    reference_number TEXT,
    note TEXT,
    cash_received INTEGER,
    change_amount INTEGER NOT NULL DEFAULT 0,
    method_snapshot TEXT,
    is_excluded INTEGER NOT NULL DEFAULT 0 CHECK(is_excluded IN (0, 1)),
    exclusion_reason TEXT,
    return_id INTEGER REFERENCES returns(id) ON DELETE RESTRICT
);

-- 16. RECEIPTS Table (Thermal printer friendly records)
CREATE TABLE IF NOT EXISTS receipts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    receipt_number TEXT UNIQUE NOT NULL,
    reference_type TEXT NOT NULL CHECK(reference_type IN ('order_sale', 'preorder_deposit', 'preorder_pickup', 'order_return')),
    reference_id INTEGER NOT NULL,
    printed_by INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    print_count INTEGER NOT NULL DEFAULT 1 CHECK(print_count >= 1),
    last_printed_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    snapshot_json TEXT,
    qr_token TEXT
);

-- 17. INVENTORY LEDGER Table (Double entry-style transaction book)
CREATE TABLE IF NOT EXISTS inventory_ledger (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    transaction_type TEXT NOT NULL CHECK(transaction_type IN ('STOCK_IN', 'SALE', 'PREORDER_PICKUP', 'RETURN', 'ADJUSTMENT_ADD', 'ADJUSTMENT_SUB')),
    quantity_changed INTEGER NOT NULL CHECK(quantity_changed != 0),
    before_quantity INTEGER NOT NULL CHECK(before_quantity >= 0),
    after_quantity INTEGER NOT NULL CHECK(after_quantity >= 0), -- Enforces zero-negative physical stock constraint
    reference_type TEXT, -- order, preorder, audit_log, settings
    reference_id INTEGER,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    shift_id INTEGER REFERENCES shifts(id) ON DELETE RESTRICT,
    notes TEXT,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 18. CASH MOVEMENTS Table (Drawer transaction details)
CREATE TABLE IF NOT EXISTS cash_movements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    shift_id INTEGER NOT NULL REFERENCES shifts(id) ON DELETE RESTRICT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    type TEXT NOT NULL CHECK(type IN ('OPENING', 'CLOSING', 'PAY_IN', 'PAY_OUT')),
    amount INTEGER NOT NULL CHECK(amount >= 0),
    notes TEXT,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 19. AUDIT LOGS Table (Definitive security action trail)
CREATE TABLE IF NOT EXISTS audit_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    shift_id INTEGER REFERENCES shifts(id) ON DELETE SET NULL,
    action_type TEXT NOT NULL, -- e.g. LOGIN, SHIFT_OPEN, SALE_CHECKOUT, STOCK_ADJUST, USER_MANAGEMENT
    entity_type TEXT, -- e.g. users, products, orders, receipts
    entity_id INTEGER,
    before_values TEXT, -- JSON string
    after_values TEXT, -- JSON string
    notes TEXT,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 20. BUSINESS SETTINGS Table (A4 metadata configurations)
CREATE TABLE IF NOT EXISTS business_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 21. PRINTER SETTINGS Table (Default print layouts)
CREATE TABLE IF NOT EXISTS printer_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 22. RETURNS Table (Invoice returns tracker)
CREATE TABLE IF NOT EXISTS returns (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE RESTRICT,
    shift_id INTEGER NOT NULL REFERENCES shifts(id) ON DELETE RESTRICT,
    cashier_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    total_refunded INTEGER NOT NULL CHECK(total_refunded >= 0),
    notes TEXT,
    payment_method_snapshot TEXT,
    authorization_id INTEGER REFERENCES return_authorizations(id) ON DELETE RESTRICT,
    return_number TEXT UNIQUE,
    authorized_by INTEGER REFERENCES users(id) ON DELETE RESTRICT,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 23. RETURN ITEMS Table (Granular items returned)
CREATE TABLE IF NOT EXISTS return_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    return_id INTEGER NOT NULL REFERENCES returns(id) ON DELETE CASCADE,
    product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    order_item_id INTEGER REFERENCES order_items(id) ON DELETE RESTRICT,
    quantity INTEGER NOT NULL CHECK(quantity > 0),
    refund_amount INTEGER NOT NULL CHECK(refund_amount >= 0),
    disposition TEXT NOT NULL DEFAULT 'RESTOCK' CHECK(disposition IN ('RESTOCK', 'NO_RESTOCK')),
    restocked INTEGER NOT NULL DEFAULT 1 CHECK(restocked IN (0, 1)),
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Exact, one-time Admin return authorizations and immutable tender allocations.
CREATE TABLE IF NOT EXISTS return_authorizations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    authorization_number TEXT UNIQUE NOT NULL,
    order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE RESTRICT,
    status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK(status IN ('ACTIVE', 'CONSUMED', 'REVOKED', 'EXPIRED')),
    reason TEXT NOT NULL,
    total_refund INTEGER NOT NULL CHECK(total_refund >= 0),
    expires_at DATETIME NOT NULL,
    created_by INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    token_nonce TEXT NOT NULL,
    token_version INTEGER NOT NULL DEFAULT 1 CHECK(token_version > 0),
    consumed_return_id INTEGER UNIQUE REFERENCES returns(id) ON DELETE RESTRICT,
    consumed_by INTEGER REFERENCES users(id) ON DELETE RESTRICT,
    consumed_shift_id INTEGER REFERENCES shifts(id) ON DELETE RESTRICT,
    consumed_at DATETIME,
    revoked_by INTEGER REFERENCES users(id) ON DELETE RESTRICT,
    revoked_reason TEXT,
    revoked_at DATETIME,
    print_count INTEGER NOT NULL DEFAULT 0 CHECK(print_count >= 0),
    last_printed_at DATETIME,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS return_authorization_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    authorization_id INTEGER NOT NULL REFERENCES return_authorizations(id) ON DELETE CASCADE,
    order_item_id INTEGER NOT NULL REFERENCES order_items(id) ON DELETE RESTRICT,
    product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    product_name_snapshot TEXT NOT NULL,
    sku_snapshot TEXT,
    quantity INTEGER NOT NULL CHECK(quantity > 0),
    unit_price INTEGER NOT NULL CHECK(unit_price >= 0),
    refund_amount INTEGER NOT NULL CHECK(refund_amount >= 0),
    disposition TEXT NOT NULL CHECK(disposition IN ('RESTOCK', 'NO_RESTOCK')),
    no_restock_reason TEXT,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(authorization_id, order_item_id),
    CHECK(disposition = 'RESTOCK' OR length(trim(no_restock_reason)) > 0)
);

CREATE TABLE IF NOT EXISTS return_authorization_allocations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    authorization_id INTEGER NOT NULL REFERENCES return_authorizations(id) ON DELETE CASCADE,
    payment_method_id INTEGER NOT NULL REFERENCES payment_methods(id) ON DELETE RESTRICT,
    method_code_snapshot TEXT NOT NULL,
    method_name_snapshot TEXT NOT NULL,
    refund_mode TEXT NOT NULL CHECK(refund_mode IN ('CASH_DRAWER', 'EXTERNAL_REFERENCE', 'DISABLED')),
    amount INTEGER NOT NULL CHECK(amount > 0),
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(authorization_id, payment_method_id)
);

CREATE TABLE IF NOT EXISTS return_authorization_print_requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    authorization_id INTEGER NOT NULL REFERENCES return_authorizations(id) ON DELETE RESTRICT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    request_key TEXT NOT NULL,
    copies INTEGER NOT NULL DEFAULT 1 CHECK(copies BETWEEN 1 AND 20),
    reason TEXT,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, request_key)
);

-- DATABASE LOOKUP INDEXES (Required for fast scan search/filters)
CREATE INDEX IF NOT EXISTS idx_products_sku ON products(sku);
CREATE INDEX IF NOT EXISTS idx_products_barcode ON products(barcode);
CREATE INDEX IF NOT EXISTS idx_qr_tokens_token ON qr_tokens(token);
CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone);
CREATE INDEX IF NOT EXISTS idx_orders_invoice ON orders(invoice_number);
CREATE INDEX IF NOT EXISTS idx_preorders_number ON preorders(preorder_number);
CREATE INDEX IF NOT EXISTS idx_preorders_qr_token ON preorders(qr_pickup_token);
CREATE INDEX IF NOT EXISTS idx_shifts_user ON shifts(user_id);
CREATE INDEX IF NOT EXISTS idx_shifts_status ON shifts(status);
CREATE INDEX IF NOT EXISTS idx_payments_reference ON payments(reference_type, reference_id);
CREATE INDEX IF NOT EXISTS idx_inv_ledger_product ON inventory_ledger(product_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_date ON audit_logs(created_at);
CREATE UNIQUE INDEX IF NOT EXISTS idx_one_active_return_authorization ON return_authorizations(order_id) WHERE status = 'ACTIVE';
CREATE INDEX IF NOT EXISTS idx_return_authorizations_list ON return_authorizations(status, created_at DESC);

-- Additional Performance and Reporting Lookup Indexes
CREATE INDEX IF NOT EXISTS idx_inv_ledger_latest ON inventory_ledger(product_id, id DESC);
CREATE INDEX IF NOT EXISTS idx_orders_date ON orders(created_at);
CREATE INDEX IF NOT EXISTS idx_orders_shift ON orders(shift_id);
CREATE INDEX IF NOT EXISTS idx_preorders_shift ON preorders(shift_id);
CREATE INDEX IF NOT EXISTS idx_preorders_status ON preorders(status);
CREATE INDEX IF NOT EXISTS idx_preorder_items_product ON preorder_items(product_id);
CREATE INDEX IF NOT EXISTS idx_order_items_product ON order_items(product_id);
CREATE INDEX IF NOT EXISTS idx_cash_movements_shift ON cash_movements(shift_id);

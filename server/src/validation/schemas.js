import { z } from 'zod';

const trimmed = (max) => z.string().trim().min(1).max(max);
const optionalTrimmed = (max) => z.string().trim().max(max).optional();
const optionalNullableTrimmed = (max) => z.union([z.string().trim().max(max), z.null()]).optional();
const booleanFlag = z.union([z.boolean(), z.literal(0), z.literal(1)]);
const integer = (min = Number.MIN_SAFE_INTEGER, max = Number.MAX_SAFE_INTEGER) =>
  z.coerce.number().int().min(min).max(max);
const optionalInteger = (min = Number.MIN_SAFE_INTEGER, max = Number.MAX_SAFE_INTEGER) =>
  z.preprocess(
    (value) => (value === '' || value === undefined || value === null ? undefined : value),
    integer(min, max).optional()
  );
const date = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => {
    const [year, month, day] = value.split('-').map(Number);
    const parsed = new Date(Date.UTC(year, month - 1, day));
    return (
      parsed.getUTCFullYear() === year &&
      parsed.getUTCMonth() === month - 1 &&
      parsed.getUTCDate() === day
    );
  }, 'Date must be a valid calendar day.');
const isoTimestamp = z
  .string()
  .trim()
  .max(80)
  .refine((value) => {
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) && /[T ]/.test(value);
  }, 'Timestamp must be a valid ISO date and time.');
const dateRange = (schema) =>
  schema.refine((value) => !value.startDate || !value.endDate || value.startDate <= value.endDate, {
    path: ['endDate'],
    message: 'endDate must be on or after startDate.',
  });

export const idParams = z.object({ id: integer(1) });
export const loginBody = z.object({ username: trimmed(100), password: z.string().min(1).max(200) });
export const refreshBody = z.object({ refreshToken: z.string().min(20).max(500) });
export const logoutBody = z.object({ refreshToken: z.string().min(20).max(500).optional() });
export const customerSearchQuery = z.object({ q: optionalTrimmed(150) });
export const customerBody = z.object({ name: trimmed(200), phone: trimmed(30).min(5) });
export const customerUpdateBody = z
  .object({
    name: trimmed(200).optional(),
    phone: trimmed(30).min(5).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, 'At least one customer field is required.');

export const userCreateBody = z.object({
  username: trimmed(100),
  password: z.string().min(8).max(200),
  role: z.enum(['Admin', 'Cashier']),
  name: trimmed(150),
  phone: optionalNullableTrimmed(30),
});
export const userUpdateBody = z
  .object({
    role: z.enum(['Admin', 'Cashier']).optional(),
    name: trimmed(150).optional(),
    phone: optionalNullableTrimmed(30),
  })
  .refine((value) => Object.keys(value).length > 0, 'At least one user field is required.');
export const passwordBody = z.object({ password: z.string().min(8).max(200) });

export const categoryListQuery = z.object({ activeOnly: z.enum(['true', 'false']).optional() });
export const categoryCreateBody = z.object({ name: trimmed(150) });
export const categoryUpdateBody = z
  .object({
    name: trimmed(150).optional(),
    is_active: booleanFlag.optional(),
  })
  .refine((value) => Object.keys(value).length > 0, 'At least one category field is required.');

export const priceTierCreateBody = z.object({
  name: trimmed(150),
  description: optionalNullableTrimmed(500),
});
export const priceTierUpdateBody = z
  .object({
    name: trimmed(150).optional(),
    description: optionalNullableTrimmed(500),
    is_active: booleanFlag.optional(),
  })
  .refine((value) => Object.keys(value).length > 0, 'At least one price tier field is required.');

export const inventoryQuery = dateRange(
  z.object({
    productId: optionalInteger(1),
    transactionType: z
      .enum(['STOCK_IN', 'SALE', 'PREORDER_PICKUP', 'RETURN', 'ADJUSTMENT_ADD', 'ADJUSTMENT_SUB'])
      .optional(),
    startDate: date.optional(),
    endDate: date.optional(),
    limit: optionalInteger(1, 100).default(50),
    offset: optionalInteger(0).default(0),
  })
);
export const inventoryAdjustmentBody = z.object({
  product_id: integer(1),
  adjustment_type: z.enum(['STOCK_IN', 'ADD', 'SUB', 'ADJUSTMENT_ADD', 'ADJUSTMENT_SUB']),
  quantity: integer(1),
  notes: optionalNullableTrimmed(500),
});

export const auditQuery = dateRange(
  z.object({
    userId: optionalInteger(1),
    shiftId: optionalInteger(1),
    actionType: optionalTrimmed(100),
    entityType: optionalTrimmed(100),
    startDate: date.optional(),
    endDate: date.optional(),
    limit: optionalInteger(1, 100).default(100),
    offset: optionalInteger(0).default(0),
  })
);

export const openShiftBody = z.object({ openingCash: integer(0) });
export const cashMovementBody = z.object({
  type: z.enum(['PAY_IN', 'PAY_OUT']),
  amount: integer(1),
  notes: trimmed(500),
});
export const rejectShiftBody = z
  .object({
    reason: trimmed(500).optional(),
    adminNotes: trimmed(500).optional(),
  })
  .refine((value) => Boolean(value.reason || value.adminNotes), 'A rejection reason is required.');
export const approveShiftBody = z.object({
  adminNotes: optionalNullableTrimmed(500),
  notes: optionalNullableTrimmed(500),
});
export const shiftsListQuery = dateRange(
  z.object({
    status: z.enum(['OPEN', 'PENDING_ADMIN_REVIEW', 'CLOSED', 'REJECTED']).optional(),
    cashierId: optionalInteger(1),
    startDate: date.optional(),
    endDate: date.optional(),
  })
);

const reportQueryBase = z.object({
  startDate: date.optional(),
  endDate: date.optional(),
  cashierId: optionalInteger(1),
  shiftId: optionalInteger(1),
  categoryId: optionalInteger(1),
  limit: optionalInteger(1, 100),
  offset: optionalInteger(0),
  status: optionalTrimmed(60),
  origin: optionalTrimmed(60),
  paymentMethod: optionalTrimmed(60),
  method: optionalTrimmed(60),
  direction: z.enum(['IN', 'OUT']).optional(),
  stage: optionalTrimmed(80),
  customer: optionalTrimmed(200),
  productName: optionalTrimmed(200),
  sku: optionalTrimmed(200),
  invoiceNumber: optionalTrimmed(200),
  receiptNumber: optionalTrimmed(200),
  stockStatus: z.enum(['LOW_STOCK', 'OUT_OF_STOCK']).optional(),
  search: optionalTrimmed(200),
  availabilityPolicy: optionalTrimmed(80),
});
export const reportQuery = dateRange(reportQueryBase);
export const reportExportQuery = dateRange(
  reportQueryBase.extend({
    type: z.enum(['sales', 'invoices', 'preorders', 'inventory', 'payments', 'shifts', 'cashiers']),
    format: z.enum(['csv', 'pdf']).optional(),
  })
);

const optionalBooleanFlag = booleanFlag.optional();
const paymentRow = z
  .object({
    method: optionalTrimmed(40),
    methodId: optionalInteger(1),
    method_id: optionalInteger(1),
    amount: integer(1),
    cashReceived: optionalInteger(1),
    referenceNumber: optionalNullableTrimmed(200),
    note: optionalNullableTrimmed(500),
  })
  .passthrough()
  .refine(
    (value) => value.method || value.methodId || value.method_id,
    'A payment method is required.'
  );
const saleItem = z
  .object({
    product_id: optionalInteger(1),
    productId: optionalInteger(1),
    quantity: integer(1),
    price_tier_id: optionalInteger(1),
    priceTierId: optionalInteger(1),
  })
  .passthrough()
  .refine(
    (value) => (value.product_id || value.productId) && (value.price_tier_id || value.priceTierId),
    'Product and price tier identifiers are required.'
  );
export const productQuery = z.object({
  q: optionalTrimmed(200),
  categoryId: optionalInteger(1),
  activeOnly: z.enum(['true', 'false']).optional(),
  availabilityPolicy: z.enum(['STOCK_ONLY', 'STOCK_WITH_PREORDER_WHEN_OUT_OF_STOCK']).optional(),
});
const priceRow = z
  .object({
    priceTierId: optionalInteger(1),
    price_tier_id: optionalInteger(1),
    price: integer(0),
  })
  .passthrough()
  .refine(
    (value) => value.priceTierId || value.price_tier_id,
    'Price tier identifier is required.'
  );
const bookDetails = z
  .object({
    book_type: optionalNullableTrimmed(100),
    school_grade: optionalNullableTrimmed(100),
    subject: optionalNullableTrimmed(150),
    teacher: optionalNullableTrimmed(150),
    publisher: optionalNullableTrimmed(150),
    release_year: optionalInteger(1, 9999),
    term: z.enum(['first', 'second']).nullable().optional(),
    educational_classification: z
      .enum(['external_book', 'school_book', 'booklet', 'notes'])
      .nullable()
      .optional(),
  })
  .passthrough();
const productFields = {
  name: trimmed(250).optional(),
  sku: trimmed(150).optional(),
  barcode: optionalNullableTrimmed(150),
  categoryId: optionalInteger(1),
  category_id: optionalInteger(1),
  description: optionalNullableTrimmed(2000),
  isActive: optionalBooleanFlag,
  is_active: optionalBooleanFlag,
  canBeSold: optionalBooleanFlag,
  can_be_sold: optionalBooleanFlag,
  availabilityPolicy: z.enum(['STOCK_ONLY', 'STOCK_WITH_PREORDER_WHEN_OUT_OF_STOCK']).optional(),
  availability_policy: z.enum(['STOCK_ONLY', 'STOCK_WITH_PREORDER_WHEN_OUT_OF_STOCK']).optional(),
  defaultPreorderDepositPct: optionalInteger(0, 100),
  default_preorder_deposit_pct: optionalInteger(0, 100),
  defaultPickupMethod: optionalTrimmed(100),
  default_pickup_method: optionalTrimmed(100),
  preorderInstructions: optionalNullableTrimmed(2000),
  preorder_instructions: optionalNullableTrimmed(2000),
  lowStockThreshold: optionalInteger(0),
  low_stock_threshold: optionalInteger(0),
  purchaseCost: optionalInteger(0),
  purchase_cost: optionalInteger(0),
  initialStock: optionalInteger(0),
  initial_stock: optionalInteger(0),
  notes: optionalNullableTrimmed(2000),
  isBook: optionalBooleanFlag,
  is_book: optionalBooleanFlag,
  bookDetails: bookDetails.nullable().optional(),
  book_details: bookDetails.nullable().optional(),
  prices: z.array(priceRow).max(100).optional(),
  unlinkPriceTierIds: z.array(integer(1)).max(100).optional(),
  unlink_price_tier_ids: z.array(integer(1)).max(100).optional(),
};
export const productCreateBody = z
  .object(productFields)
  .passthrough()
  .superRefine((value, context) => {
    for (const [valid, path, message] of [
      [value.name, ['name'], 'Product name is required.'],
      [value.sku, ['sku'], 'SKU is required.'],
      [value.categoryId || value.category_id, ['categoryId'], 'Category is required.'],
      [
        value.isActive !== undefined || value.is_active !== undefined,
        ['isActive'],
        'Active status is required.',
      ],
      [
        value.lowStockThreshold !== undefined || value.low_stock_threshold !== undefined,
        ['lowStockThreshold'],
        'Low-stock threshold is required.',
      ],
      [
        value.availabilityPolicy || value.availability_policy,
        ['availabilityPolicy'],
        'Availability policy is required.',
      ],
      [Array.isArray(value.prices), ['prices'], 'Prices are required.'],
    ]) {
      if (!valid) context.addIssue({ code: 'custom', path, message });
    }
  });
export const productUpdateBody = z
  .object(productFields)
  .passthrough()
  .refine((value) => Object.keys(value).length > 0, 'At least one product field is required.');
export const qrLabelsBody = z.object({
  quantity: optionalInteger(1, 500).default(1),
  label_size: z.enum(['small', 'medium', 'large', '38x25', '50x25', '80x50']).optional(),
});

export const paymentMethodsUpdateBody = z.object({
  active_ids: z.array(z.union([z.string().trim().min(1), integer(1)])).max(100),
});
export const paymentMethodCreateBody = z
  .object({
    code: z
      .string()
      .trim()
      .regex(/^[A-Za-z][A-Za-z0-9_-]{1,39}$/),
    name_ar: trimmed(150).optional(),
    nameAr: trimmed(150).optional(),
    is_active: booleanFlag.optional(),
    accepts_cash_received: booleanFlag.optional(),
    refund_mode: z.enum(['CASH_DRAWER', 'EXTERNAL_REFERENCE', 'DISABLED']).optional(),
    sort_order: optionalInteger(0),
  })
  .passthrough()
  .refine((value) => value.name_ar || value.nameAr, 'Arabic payment method name is required.');
export const paymentMethodUpdateBody = z
  .object({
    name_ar: trimmed(150).optional(),
    nameAr: trimmed(150).optional(),
    is_active: booleanFlag.optional(),
    accepts_cash_received: booleanFlag.optional(),
    refund_mode: z.enum(['CASH_DRAWER', 'EXTERNAL_REFERENCE', 'DISABLED']).optional(),
    sort_order: optionalInteger(0),
  })
  .passthrough()
  .refine(
    (value) => Object.keys(value).length > 0,
    'At least one payment method field is required.'
  );

export const scanBody = z
  .object({
    code: trimmed(500).optional(),
    token: trimmed(500).optional(),
  })
  .refine((value) => value.code || value.token, 'A scan code or token is required.');
export const scanProductBody = z.object({ code: trimmed(500) });
export const posSearchQuery = z.object({ q: optionalTrimmed(200) });
export const checkoutBody = z
  .object({
    customerId: optionalInteger(1),
    items: z.array(saleItem).min(1).max(500),
    discount: optionalInteger(0).default(0),
    payments: z.array(paymentRow).max(20),
  })
  .passthrough();
const refundReference = z
  .object({
    allocationId: optionalInteger(1),
    allocation_id: optionalInteger(1),
    referenceNumber: optionalTrimmed(200),
    reference_number: optionalTrimmed(200),
  })
  .refine(
    (value) => value.allocationId || value.allocation_id,
    'A refund allocation identifier is required.'
  );

export const returnOrderBody = z
  .object({
    authorizationToken: optionalTrimmed(500),
    refundReferences: z.array(refundReference).max(100).default([]),
    cashierNote: optionalNullableTrimmed(1000),
  })
  .passthrough();

const authorizationItem = z
  .object({
    orderItemId: optionalInteger(1),
    order_item_id: optionalInteger(1),
    quantity: integer(1),
    disposition: z.enum(['RESTOCK', 'NO_RESTOCK']),
    noRestockReason: optionalNullableTrimmed(500),
    no_restock_reason: optionalNullableTrimmed(500),
  })
  .superRefine((value, context) => {
    if (!value.orderItemId && !value.order_item_id) {
      context.addIssue({
        code: 'custom',
        path: ['orderItemId'],
        message: 'Invoice line identifier is required.',
      });
    }
    if (
      value.disposition === 'NO_RESTOCK' &&
      !String(value.noRestockReason || value.no_restock_reason || '').trim()
    ) {
      context.addIssue({
        code: 'custom',
        path: ['noRestockReason'],
        message: 'A non-restock reason is required.',
      });
    }
  });

export const returnAuthorizationQuoteBody = z.object({
  orderId: integer(1),
  items: z.array(authorizationItem).min(1).max(500),
});
export const returnAuthorizationCreateBody = returnAuthorizationQuoteBody.extend({
  reason: trimmed(1000),
  expiresAt: isoTimestamp.optional(),
});
export const returnAuthorizationListQuery = dateRange(
  z.object({
    status: z.enum(['ACTIVE', 'CONSUMED', 'REVOKED', 'EXPIRED']).optional(),
    invoiceNumber: optionalTrimmed(200),
    orderId: optionalInteger(1),
    startDate: date.optional(),
    endDate: date.optional(),
    limit: optionalInteger(1, 100).default(50),
    offset: optionalInteger(0).default(0),
  })
);
export const returnAuthorizationRevokeBody = z.object({ reason: trimmed(1000) });
export const returnAuthorizationReissueBody = z.object({ expiresAt: isoTimestamp.optional() });
export const returnAuthorizationPrintBody = z
  .object({
    requestKey: optionalTrimmed(200),
    request_key: optionalTrimmed(200),
    copies: optionalInteger(1, 20).default(1),
    reason: optionalNullableTrimmed(500),
  })
  .refine((value) => value.requestKey || value.request_key, 'A print request key is required.');
export const returnAuthorizationExecuteBody = z.object({
  token: trimmed(500),
  refundReferences: z.array(refundReference).max(100).default([]),
  cashierNote: optionalNullableTrimmed(1000),
});
export const approvalCardCreateBody = z.object({ label: trimmed(120) });
export const approvalCardDisableBody = z.object({ reason: trimmed(500) });
export const approvalCardPrintBody = z.object({
  requestKey: trimmed(200),
  copies: optionalInteger(1, 20).default(1),
  reason: optionalNullableTrimmed(500),
});
export const cashierReturnQuoteBody = returnAuthorizationQuoteBody.extend({
  reason: trimmed(1000),
});
export const cashierReturnExecuteBody = cashierReturnQuoteBody.extend({
  approvalCardToken: trimmed(500),
  refundReferences: z.array(refundReference).max(100).default([]),
  cashierNote: optionalNullableTrimmed(1000),
});

export const preorderCreateBody = z
  .object({
    customerName: trimmed(200),
    customerPhone: trimmed(30).min(5),
    items: z.array(saleItem).min(1).max(500),
    discount: optionalInteger(0).default(0),
    depositPaid: optionalInteger(0),
    deposit_paid: optionalInteger(0),
    pickupMethod: optionalTrimmed(100),
    expectedPickupDate: date.nullable().optional(),
    notes: optionalNullableTrimmed(2000),
    payments: z.array(paymentRow).max(20),
  })
  .passthrough()
  .refine(
    (value) => value.depositPaid !== undefined || value.deposit_paid !== undefined,
    'Deposit amount is required.'
  );
export const preorderScanBody = z.object({ token: trimmed(500) });
export const preorderListQuery = z.object({
  status: z
    .enum([
      'DRAFT',
      'DEPOSIT_PAID_WAITING_STOCK',
      'READY_FOR_PICKUP',
      'PICKED_UP',
      'CANCELLED',
      'EXPIRED',
    ])
    .optional(),
  q: optionalTrimmed(200),
  cashierId: optionalInteger(1),
});
export const preorderSearchQuery = z.object({ q: optionalTrimmed(200) });
export const preorderStatusBody = z.object({
  status: z.enum([
    'DRAFT',
    'DEPOSIT_PAID_WAITING_STOCK',
    'READY_FOR_PICKUP',
    'CANCELLED',
    'EXPIRED',
  ]),
});
export const preorderPickupBody = z.object({ payments: z.array(paymentRow).max(20) }).passthrough();

export const receiptIdentifierParams = z.object({ id: trimmed(200) });
export const receiptPrintBody = z
  .object({
    requestKey: optionalTrimmed(200),
    request_key: optionalTrimmed(200),
    copies: optionalInteger(1, 20),
    reason: optionalNullableTrimmed(500),
    isReprint: z.boolean().optional(),
  })
  .passthrough();

export const invoiceListQuery = dateRange(
  z.object({
    invoiceNumber: optionalTrimmed(200),
    receiptNumber: optionalTrimmed(200),
    startDate: date.optional(),
    endDate: date.optional(),
    cashierId: optionalInteger(1),
    shiftId: optionalInteger(1),
    categoryId: optionalInteger(1),
    paymentMethod: optionalTrimmed(60),
    origin: optionalTrimmed(60),
    status: optionalTrimmed(60),
    customer: optionalTrimmed(200),
    productName: optionalTrimmed(200),
    sku: optionalTrimmed(200),
    barcode: optionalTrimmed(200),
    limit: optionalInteger(1, 100).default(50),
    offset: optionalInteger(0).default(0),
  })
);
export const invoiceLookupQuery = z.object({
  token: optionalTrimmed(500),
  invoiceNumber: optionalTrimmed(200),
  receiptNumber: optionalTrimmed(200),
  ownShift: z.enum(['true', 'false']).optional(),
  shiftId: optionalInteger(1),
  limit: optionalInteger(1, 100).default(50),
  offset: optionalInteger(0).default(0),
});
export const invoiceCredentialQuery = z.object({
  token: optionalTrimmed(500),
  invoiceNumber: optionalTrimmed(200),
  receiptNumber: optionalTrimmed(200),
});

export const shiftCloseBody = z
  .object({
    actuals: z.record(z.string(), integer(0)).optional(),
    actualClosingCash: optionalInteger(0),
    cashierNote: optionalNullableTrimmed(500),
  })
  .passthrough()
  .refine(
    (value) => value.actuals !== undefined || value.actualClosingCash !== undefined,
    'Per-method actuals or actualClosingCash is required.'
  );

export const printerSettingsBody = z
  .object({
    print_mode: z.literal('browser').optional(),
    receipt_printer_width: z
      .union([z.literal('58'), z.literal('58mm'), z.literal('80'), z.literal('80mm')])
      .optional(),
    receipt_printer_header: z.string().trim().max(300).optional(),
    receipt_printer_footer: z.string().trim().max(300).optional(),
    receipt_copies: optionalInteger(1, 20),
    auto_print_sale: z.union([z.boolean(), z.enum(['true', 'false'])]).optional(),
    auto_print_preorder_deposit: z.union([z.boolean(), z.enum(['true', 'false'])]).optional(),
    auto_print_preorder_pickup: z.union([z.boolean(), z.enum(['true', 'false'])]).optional(),
    print_show_customer: z.union([z.boolean(), z.enum(['true', 'false'])]).optional(),
    print_show_price_tier: z.union([z.boolean(), z.enum(['true', 'false'])]).optional(),
    print_show_qr: z.union([z.boolean(), z.enum(['true', 'false'])]).optional(),
    qr_printer_width: z
      .union([z.literal('38'), z.literal('50'), z.literal('80'), z.number()])
      .optional(),
    qr_printer_height: z.union([z.literal('25'), z.literal('50'), z.number()]).optional(),
    qr_label_count: optionalInteger(1, 500),
  })
  .passthrough();

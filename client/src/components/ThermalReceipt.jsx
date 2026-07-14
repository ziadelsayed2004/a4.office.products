import { QRCodeSVG } from 'qrcode.react';
import { dateTime, money, number, statusLabel } from '../utils/formatters.js';
import logo from '../assets/a4-logo.png';
import './ThermalReceipt.css';

function parseSnapshot(value) {
  if (!value) return {};
  if (typeof value === 'object') return value;
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function first(...values) {
  return values.find((value) => value !== undefined && value !== null && value !== '');
}

function firstPresent(...values) {
  return values.find((value) => value !== undefined && value !== null);
}

function asArray(...values) {
  const value = values.find(Array.isArray);
  return value || [];
}

function normalizePayment(payment) {
  return {
    id: first(payment.id, payment.payment_id),
    method: first(
      payment.methodName,
      payment.method_name_snapshot,
      payment.method_name,
      payment.payment_method,
      payment.method,
      '—'
    ),
    stage: first(payment.stage, payment.payment_stage),
    amount: Number(first(payment.applied_amount, payment.amount, 0)),
    cashReceived: first(payment.cash_received, payment.cashReceived),
    change: first(payment.changeAmount, payment.change_amount, payment.change),
    reference: first(payment.reference_number, payment.referenceNumber),
  };
}

function normalizeItem(item) {
  return {
    id: first(item.id, item.item_id),
    productId: first(item.product_id, item.productId),
    name: first(item.productName, item.product_name_snapshot, item.product_name, item.name, '—'),
    sku: first(
      item.productSku,
      item.product_sku_snapshot,
      item.sku_snapshot,
      item.product_sku,
      item.sku
    ),
    tier: first(
      item.priceTierName,
      item.price_tier_name_snapshot,
      item.price_tier_name,
      item.tier_name_snapshot,
      item.tier_name
    ),
    quantity: Number(first(item.quantity, item.qty, 0)),
    unitPrice: Number(
      first(item.unitPrice, item.unit_price_snapshot, item.unit_price, item.price, 0)
    ),
    lineTotal: first(item.totalPrice, item.line_total, item.total_price, item.total),
    returnedQuantity: Number(first(item.returned_quantity, item.returned_qty, 0)),
    disposition: first(item.disposition, item.stock_disposition),
  };
}

export function normalizeThermalReceipt(receipt = {}, settings = {}) {
  const snapshot = parseSnapshot(first(receipt.snapshot_json, receipt.snapshot));
  const snapshotReceipt = snapshot.receipt || {};
  const invoice = snapshot.invoice || receipt.invoice || {};
  const preorder = snapshot.preorder || receipt.preorder || {};
  const source = { ...receipt, ...snapshotReceipt, ...snapshot };
  const printSettings = {
    ...receipt.print_settings,
    ...(snapshot.print_settings || snapshot.printSettings),
    ...settings,
  };

  const referenceType = String(
    first(source.reference_type, source.referenceType, source.type, invoice.origin, '')
  ).toUpperCase();

  const variant = referenceType.includes('RETURN')
    ? 'return'
    : referenceType.includes('PICKUP')
      ? 'pickup'
      : referenceType.includes('DEPOSIT') || (preorder.id && !invoice.id)
        ? 'deposit'
        : 'sale';

  const widthSetting = String(
    first(
      printSettings.receipt_width,
      printSettings.receiptWidth,
      printSettings.receipt_printer_width,
      source.receipt_width,
      80
    )
  );
  const width = widthSetting.startsWith('58') ? '58' : '80';

  return {
    id: first(receipt.id, source.id),
    variant,
    width,
    businessName: firstPresent(
      printSettings.business_header,
      printSettings.business_name,
      printSettings.businessName,
      printSettings.receipt_printer_header,
      'مكتبة A4 فرع السويس'
    ),
    businessSubtitle: first(printSettings.business_subtitle, printSettings.businessSubtitle),
    footer: firstPresent(
      printSettings.receipt_footer,
      printSettings.footer,
      printSettings.receipt_printer_footer,
      'شكراً لتعاملكم معنا'
    ),
    receiptNumber: first(source.receipt_number, source.receiptNumber),
    invoiceNumber: first(source.invoice_number, invoice.invoice_number, invoice.invoiceNumber),
    preorderNumber: first(
      source.preorder_number,
      preorder.preorder_number,
      preorder.preorderNumber
    ),
    returnNumber: first(source.returnNumber, source.return_number),
    authorizationNumber: first(source.authorizationNumber, source.authorization_number),
    reason: first(source.reason, source.return_reason),
    createdAt: first(source.created_at, source.createdAt, invoice.created_at, preorder.created_at),
    cashier: first(
      source.cashierName,
      source.cashier_name_snapshot,
      source.cashier_name,
      source.printed_by_name,
      invoice.cashier_name
    ),
    customerName: first(
      source.customerName,
      source.customer_name_snapshot,
      source.customer_name,
      invoice.customer_name,
      preorder.customer_name
    ),
    customerPhone: first(
      source.customerPhone,
      source.customer_phone_snapshot,
      source.customer_phone,
      invoice.customer_phone,
      preorder.customer_phone
    ),
    status: first(source.status, invoice.status, preorder.status),
    subtotal: Number(first(source.subtotal, invoice.subtotal, preorder.subtotal, 0)),
    discount: Number(first(source.discount, invoice.discount, preorder.discount, 0)),
    total: Number(
      first(source.total, source.total_amount, invoice.total, preorder.total_amount, 0)
    ),
    depositPaid: first(source.depositPaid, source.deposit_paid, preorder.deposit_paid),
    remainingAmount: first(
      source.remainingAmount,
      source.remaining_amount,
      preorder.remaining_amount
    ),
    items: asArray(source.items, invoice.items, preorder.items).map(normalizeItem),
    payments: asArray(source.payments, invoice.payments, preorder.payments).map(normalizePayment),
    qrToken: first(
      source.invoice_qr_token,
      source.invoice_secure_token,
      invoice.qr_token,
      invoice.secure_token,
      source.qrToken,
      source.qr_token
    ),
    printCount: Number(first(receipt.print_count, source.print_count, 0)),
    showCustomer: String(first(printSettings.print_show_customer, false)) === 'true',
    showPriceTier: String(first(printSettings.print_show_price_tier, false)) === 'true',
    showQr: String(first(printSettings.print_show_qr, false)) === 'true',
  };
}

const variantLabels = {
  sale: 'إيصال بيع',
  deposit: 'إيصال عربون حجز',
  pickup: 'إيصال استلام حجز',
  return: 'إيصال مرتجع',
};

const stageLabels = {
  SALE: 'بيع',
  PREORDER_DEPOSIT: 'عربون',
  PREORDER_PICKUP: 'استلام',
  REFUND: 'مرتجع',
};

export function ThermalReceipt({ receipt, settings, reprint = false, copyNumber = 1, copies = 1 }) {
  const data = normalizeThermalReceipt(receipt, settings);
  const totalPaid = data.payments.reduce((sum, payment) => sum + payment.amount, 0);
  const className = `thermal-receipt thermal-receipt--${data.width}`;

  return (
    <article className={className} data-receipt-ready="true" data-receipt-width-mm={data.width}>
      <header className="thermal-receipt__brand">
        <img src={logo} alt="A4 Office Products" />
        <strong>{data.businessName}</strong>
        {data.businessSubtitle && <span>{data.businessSubtitle}</span>}
        <b>{variantLabels[data.variant]}</b>
        {reprint && <em>نسخة معاد طباعتها</em>}
        {copies > 1 && (
          <small>
            النسخة {number(copyNumber)} من {number(copies)}
          </small>
        )}
      </header>

      <section className="thermal-receipt__meta">
        <ReceiptRow label="رقم الإيصال" value={data.receiptNumber} ltr />
        {data.invoiceNumber && <ReceiptRow label="رقم الفاتورة" value={data.invoiceNumber} ltr />}
        {data.preorderNumber && <ReceiptRow label="رقم الحجز" value={data.preorderNumber} ltr />}
        {data.returnNumber && <ReceiptRow label="رقم المرتجع" value={data.returnNumber} ltr />}
        {data.authorizationNumber && (
          <ReceiptRow label="تصريح المرتجع" value={data.authorizationNumber} ltr />
        )}
        <ReceiptRow label="التاريخ" value={dateTime(data.createdAt)} />
        {data.cashier && <ReceiptRow label="الكاشير" value={data.cashier} />}
        {data.showCustomer && data.customerName && (
          <ReceiptRow label="العميل" value={data.customerName} />
        )}
        {data.showCustomer && data.customerPhone && (
          <ReceiptRow label="الهاتف" value={data.customerPhone} ltr />
        )}
        {data.status && <ReceiptRow label="الحالة" value={statusLabel(data.status)} />}
        {data.reason && <ReceiptRow label="سبب المرتجع" value={data.reason} />}
      </section>

      <section className="thermal-receipt__items">
        {data.items.map((item, index) => {
          const lineTotal = Number(first(item.lineTotal, item.quantity * item.unitPrice, 0));
          return (
            <div
              className="thermal-receipt__item"
              key={item.id || `${item.productId || item.sku}-${index}`}
            >
              <div className="thermal-receipt__item-heading">
                <strong>{item.name}</strong>
                {item.sku && <span dir="ltr">{item.sku}</span>}
              </div>
              {data.showPriceTier && item.tier && <small>{item.tier}</small>}
              <ReceiptRow
                label={`${number(item.quantity)} × ${money(item.unitPrice)}`}
                value={money(lineTotal)}
              />
              {item.returnedQuantity > 0 && (
                <small className="thermal-receipt__return">
                  مرتجع: {number(item.returnedQuantity)}
                </small>
              )}
              {data.variant === 'return' && item.disposition && (
                <small className="thermal-receipt__return">
                  {item.disposition === 'RESTOCK' ? 'عاد للمخزون' : 'لم يعد للمخزون'}
                </small>
              )}
            </div>
          );
        })}
      </section>

      <section className="thermal-receipt__totals">
        <ReceiptRow label="المجموع الفرعي" value={money(data.subtotal)} />
        {data.discount > 0 && <ReceiptRow label="الخصم" value={`- ${money(data.discount)}`} />}
        {data.depositPaid !== undefined && (
          <ReceiptRow label="العربون المدفوع" value={money(data.depositPaid)} />
        )}
        {data.remainingAmount !== undefined && (
          <ReceiptRow label="المتبقي" value={money(data.remainingAmount)} />
        )}
        <ReceiptRow
          className="thermal-receipt__grand-total"
          label={data.variant === 'return' ? 'إجمالي المبلغ المردود' : 'الإجمالي'}
          value={money(data.total)}
        />
      </section>

      {data.payments.length > 0 && (
        <section className="thermal-receipt__payments">
          <strong>المدفوعات</strong>
          {data.payments.map((payment, index) => (
            <div
              className="thermal-receipt__payment"
              key={payment.id || `${payment.method}-${index}`}
            >
              <ReceiptRow
                label={`${payment.method}${payment.stage ? ` · ${stageLabels[payment.stage] || payment.stage}` : ''}`}
                value={money(payment.amount)}
              />
              {payment.cashReceived !== undefined && (
                <ReceiptRow label="المستلم نقداً" value={money(payment.cashReceived)} />
              )}
              {payment.change !== undefined && (
                <ReceiptRow label="الباقي للعميل" value={money(payment.change)} />
              )}
              {payment.reference && <ReceiptRow label="المرجع" value={payment.reference} ltr />}
            </div>
          ))}
          <ReceiptRow label="إجمالي المسجل" value={money(totalPaid)} />
        </section>
      )}

      {data.showQr && data.qrToken && (
        <section className="thermal-receipt__qr">
          <QRCodeSVG value={String(data.qrToken)} size={112} level="M" includeMargin />
          <span>امسح الرمز لفتح الفاتورة بأمان</span>
          <code dir="ltr">{data.qrToken}</code>
        </section>
      )}

      <footer className="thermal-receipt__footer">
        <p>{data.footer}</p>
        <span>عدد طلبات الطباعة: {number(data.printCount)}</span>
      </footer>
    </article>
  );
}

function ReceiptRow({ label, value, ltr = false, className = '' }) {
  return (
    <div className={`thermal-receipt__row ${className}`.trim()}>
      <span>{label}</span>
      <strong dir={ltr ? 'ltr' : undefined}>{value ?? '—'}</strong>
    </div>
  );
}

export default ThermalReceipt;

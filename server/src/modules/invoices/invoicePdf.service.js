import fs from 'node:fs';
import path from 'node:path';
import QRCode from 'qrcode';
import { PROJECT_ROOT } from '../../config/env.js';
import { escapeHtml, renderPdf } from '../../utils/pdf.js';
import { getPrinterSettings } from '../printerSettings/printerSettings.service.js';
import { authorizeInvoicePdfOutput, getInvoiceDetail } from './invoices.service.js';

const logoDataUri = (() => {
  try {
    const logo = fs.readFileSync(path.join(PROJECT_ROOT, 'client', 'src', 'assets', 'a4-logo.png'));
    return `data:image/png;base64,${logo.toString('base64')}`;
  } catch {
    return '';
  }
})();

const first = (...values) =>
  values.find((value) => value !== undefined && value !== null && value !== '');

const money = (value) =>
  `${(Number(value || 0) / 100).toLocaleString('ar-EG', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} ج.م`;

const number = (value) => Number(value || 0).toLocaleString('ar-EG');

const dateTime = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat('ar-EG', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Africa/Cairo',
  }).format(date);
};

const statusLabels = {
  COMPLETED: 'مكتملة',
  PARTIALLY_RETURNED: 'مرتجع جزئي',
  RETURNED: 'مرتجعة',
  VOID: 'ملغاة',
  PICKED_UP: 'تم الاستلام',
};

const stageLabels = {
  SALE: 'بيع',
  PREORDER_DEPOSIT: 'عربون',
  PREORDER_PICKUP: 'استلام',
  REFUND: 'مرتجع',
};

function receiptRow(label, value, { ltr = false, className = '' } = {}) {
  return `<div class="thermal-receipt__row ${className}"><span>${escapeHtml(label)}</span><strong${ltr ? ' dir="ltr"' : ''}>${escapeHtml(value ?? '—')}</strong></div>`;
}

function receiptLabel(referenceType, origin) {
  const type = String(first(referenceType, origin, '')).toUpperCase();
  if (type.includes('RETURN')) return 'إيصال مرتجع';
  if (type.includes('PICKUP')) return 'إيصال استلام حجز';
  if (type.includes('DEPOSIT')) return 'إيصال عربون حجز';
  return 'إيصال بيع';
}

function booleanSetting(value) {
  return String(value).toLowerCase() === 'true';
}

function receiptWidth(settings) {
  return String(settings.receipt_printer_width || '80mm').startsWith('58') ? 58 : 80;
}

function normalizeItem(item) {
  const quantity = Number(first(item.quantity, item.qty, 0));
  const unitPrice = Number(
    first(item.unitPrice, item.unit_price_snapshot, item.unit_price, item.price, 0)
  );
  return {
    name: first(item.productName, item.product_name_snapshot, item.product_name, item.name, '—'),
    sku: first(item.productSku, item.product_sku_snapshot, item.product_sku, item.sku),
    tier: first(
      item.priceTierName,
      item.price_tier_name_snapshot,
      item.price_tier_name,
      item.tier_name
    ),
    quantity,
    unitPrice,
    total: Number(first(item.totalPrice, item.total_price, item.line_total, quantity * unitPrice)),
    returnedQuantity: Number(first(item.returned_quantity, item.returned_qty, 0)),
  };
}

function normalizePayment(payment) {
  return {
    method: first(
      payment.methodName,
      payment.method_name_snapshot,
      payment.method,
      payment.payment_method,
      '—'
    ),
    stage: first(payment.stage, payment.payment_stage),
    amount: Number(first(payment.applied_amount, payment.amount, 0)),
    cashReceived: first(payment.cash_received, payment.cashReceived),
    change: first(payment.change_amount, payment.changeAmount, payment.change),
    reference: first(payment.reference_number, payment.referenceNumber),
  };
}

export async function buildInvoicePdfDocument(invoice, settings) {
  const receipt = invoice.receipts?.[0] || {};
  const snapshot = receipt.snapshot || {};
  const itemsSource =
    Array.isArray(snapshot.items) && snapshot.items.length ? snapshot.items : invoice.items;
  const paymentsSource =
    Array.isArray(snapshot.payments) && snapshot.payments.length
      ? snapshot.payments
      : invoice.payments;
  const items = (itemsSource || []).map(normalizeItem);
  const payments = (paymentsSource || []).map(normalizePayment);
  const showCustomer = booleanSetting(settings.print_show_customer);
  const showPriceTier = booleanSetting(settings.print_show_price_tier);
  const showQr = booleanSetting(settings.print_show_qr);
  const width = receiptWidth(settings);
  const qrToken = first(receipt.qr_token, snapshot.qrToken, snapshot.qr_token, invoice.qr_token);
  const qrSvg =
    showQr && qrToken
      ? await QRCode.toString(String(qrToken), {
          type: 'svg',
          margin: 1,
          errorCorrectionLevel: 'M',
        })
      : '';
  const subtotal = Number(first(snapshot.subtotal, invoice.subtotal, 0));
  const discount = Number(first(snapshot.discount, invoice.discount, 0));
  const total = Number(first(snapshot.total, invoice.total, 0));
  const customerName = first(snapshot.customerName, snapshot.customer_name, invoice.customer_name);
  const customerPhone = first(
    snapshot.customerPhone,
    snapshot.customer_phone,
    invoice.customer_phone
  );
  const status = first(snapshot.status, invoice.status);
  const receiptNumber = first(
    receipt.receipt_number,
    snapshot.receiptNumber,
    invoice.receipt_number
  );
  const invoiceNumber = first(
    snapshot.invoiceNumber,
    snapshot.invoice_number,
    invoice.invoice_number
  );
  const cashier = first(snapshot.cashierName, snapshot.cashier_name, invoice.cashier_name);
  const createdAt = first(
    receipt.created_at,
    snapshot.createdAt,
    snapshot.created_at,
    invoice.created_at
  );
  const businessName = first(settings.receipt_printer_header, 'مكتبة A4 فرع السويس');
  const footer = first(settings.receipt_printer_footer, 'شكراً لتعاملكم معنا');

  const meta = [
    receiptRow('رقم الإيصال', receiptNumber, { ltr: true }),
    receiptRow('رقم الفاتورة', invoiceNumber, { ltr: true }),
    receiptRow('التاريخ', dateTime(createdAt)),
    cashier ? receiptRow('الكاشير', cashier) : '',
    showCustomer && customerName ? receiptRow('العميل', customerName) : '',
    showCustomer && customerPhone ? receiptRow('الهاتف', customerPhone, { ltr: true }) : '',
    status ? receiptRow('الحالة', statusLabels[status] || status) : '',
  ].join('');

  const itemRows = items
    .map(
      (item) => `<div class="thermal-receipt__item">
        <div class="thermal-receipt__item-heading"><strong>${escapeHtml(item.name)}</strong>${item.sku ? `<span dir="ltr">${escapeHtml(item.sku)}</span>` : ''}</div>
        ${showPriceTier && item.tier ? `<small>${escapeHtml(item.tier)}</small>` : ''}
        ${receiptRow(`${number(item.quantity)} × ${money(item.unitPrice)}`, money(item.total))}
        ${item.returnedQuantity > 0 ? `<small class="thermal-receipt__return">مرتجع: ${number(item.returnedQuantity)}</small>` : ''}
      </div>`
    )
    .join('');

  const totalPaid = payments.reduce((sum, payment) => sum + payment.amount, 0);
  const paymentRows = payments
    .map(
      (payment) => `<div class="thermal-receipt__payment">
        ${receiptRow(`${payment.method}${payment.stage ? ` · ${stageLabels[payment.stage] || payment.stage}` : ''}`, money(payment.amount))}
        ${payment.cashReceived !== undefined && payment.cashReceived !== null ? receiptRow('المستلم نقداً', money(payment.cashReceived)) : ''}
        ${payment.change !== undefined && payment.change !== null ? receiptRow('الباقي للعميل', money(payment.change)) : ''}
        ${payment.reference ? receiptRow('المرجع', payment.reference, { ltr: true }) : ''}
      </div>`
    )
    .join('');

  return `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>${escapeHtml(`فاتورة ${invoiceNumber}`)}</title>
  <style>
  @page{margin:0}*{box-sizing:border-box}html,body{width:${width}mm;margin:0;background:#fff;color:#000}body{font-family:Cairo,"Noto Kufi Arabic","Noto Sans Arabic",Arial,sans-serif;direction:rtl}.thermal-receipt{width:${width}mm;margin:0;padding:4mm;color:#000;background:#fff;text-align:right}.thermal-receipt__brand{padding-bottom:2.5mm;display:grid;justify-items:center;gap:1mm;border-bottom:1px dashed #000;text-align:center}.thermal-receipt__brand img{width:16mm;height:16mm;object-fit:contain}.thermal-receipt__brand strong{font-size:10pt}.thermal-receipt__brand b{font-size:9pt}.thermal-receipt__meta,.thermal-receipt__items,.thermal-receipt__totals,.thermal-receipt__payments{padding-block:2mm;border-bottom:1px dashed #000}.thermal-receipt__row{padding-block:.8mm;display:flex;justify-content:space-between;align-items:flex-start;gap:2mm;font-size:8pt;break-inside:avoid}.thermal-receipt__row>span{min-width:0;flex:1 1 35%;overflow-wrap:anywhere}.thermal-receipt__row>strong{min-width:0;max-width:65%;flex:1 1 auto;text-align:left;overflow-wrap:anywhere;word-break:break-word}.thermal-receipt__item,.thermal-receipt__payment{padding-block:1.5mm;border-bottom:1px dotted #777;break-inside:avoid}.thermal-receipt__item:last-child,.thermal-receipt__payment:last-of-type{border-bottom:0}.thermal-receipt__item-heading{display:flex;justify-content:space-between;align-items:flex-start;gap:2mm;font-size:8pt}.thermal-receipt__item-heading strong{min-width:0;overflow-wrap:anywhere}.thermal-receipt__item-heading span,.thermal-receipt__item small{color:#222;font-size:6.5pt}.thermal-receipt__return{display:block;font-weight:800}.thermal-receipt__grand-total{margin-top:1mm;padding-top:1.5mm;border-top:1px dashed #000;font-size:10pt}.thermal-receipt__payments>strong{display:block;margin-bottom:1mm;font-size:8pt}.thermal-receipt__qr{padding-top:3mm;display:grid;justify-items:center;gap:1mm;text-align:center;break-inside:avoid}.thermal-receipt__qr svg{width:29mm;height:29mm}.thermal-receipt__qr span,.thermal-receipt__qr code{max-width:100%;overflow-wrap:anywhere;font-size:6.5pt}.thermal-receipt__footer{margin-top:3mm;font-size:7pt;text-align:center;break-inside:avoid}.thermal-receipt__footer p{margin:0 0 1mm}
  </style></head><body><article class="thermal-receipt">
    <header class="thermal-receipt__brand">${logoDataUri ? `<img src="${logoDataUri}" alt="A4 Office Products">` : ''}<strong>${escapeHtml(businessName)}</strong><b>${escapeHtml(receiptLabel(receipt.reference_type, invoice.origin))}</b></header>
    <section class="thermal-receipt__meta">${meta}</section>
    <section class="thermal-receipt__items">${itemRows}</section>
    <section class="thermal-receipt__totals">${receiptRow('المجموع الفرعي', money(subtotal))}${discount > 0 ? receiptRow('الخصم', `- ${money(discount)}`) : ''}${receiptRow('الإجمالي', money(total), { className: 'thermal-receipt__grand-total' })}</section>
    ${payments.length ? `<section class="thermal-receipt__payments"><strong>المدفوعات</strong>${paymentRows}${receiptRow('إجمالي المسجل', money(totalPaid))}</section>` : ''}
    ${qrSvg ? `<section class="thermal-receipt__qr">${qrSvg}<span>امسح الرمز لفتح الفاتورة بأمان</span><code dir="ltr">${escapeHtml(qrToken)}</code></section>` : ''}
    <footer class="thermal-receipt__footer"><p>${escapeHtml(footer)}</p><span>عدد طلبات الطباعة: ${number(receipt.print_count)}</span></footer>
  </article></body></html>`;
}

export async function generateInvoicePdf(invoiceId, actor, options = {}) {
  const outputAuthorization = await authorizeInvoicePdfOutput(actor);
  const [invoice, settings] = await Promise.all([
    getInvoiceDetail(invoiceId, actor, options),
    getPrinterSettings(),
  ]);
  const html = await buildInvoicePdfDocument(invoice, settings);
  return {
    buffer: await renderPdf(html, {
      elementPage: { selector: '.thermal-receipt', widthMm: receiptWidth(settings) },
    }),
    invoice,
    outputAuthorization,
  };
}

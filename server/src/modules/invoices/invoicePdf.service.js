import { authorizeInvoicePdfOutput, getInvoiceDetail } from './invoices.service.js';
import { escapeHtml, printableDocument, renderPdf } from '../../utils/pdf.js';

const money = (value) => `${(Number(value || 0) / 100).toFixed(2)} EGP`;

export async function generateInvoicePdf(invoiceId, actor, options = {}) {
  const outputAuthorization = await authorizeInvoicePdfOutput(actor);
  const invoice = await getInvoiceDetail(invoiceId, actor, options);
  const rows = invoice.items
    .map(
      (item) =>
        `<tr><td>${escapeHtml(item.product_name || item.name)}</td><td>${escapeHtml(item.product_sku || item.sku || '-')}</td><td class="number">${escapeHtml(item.quantity)}</td><td class="number">${money(item.unit_price)}</td><td class="number">${money(item.total_price ?? Number(item.quantity) * Number(item.unit_price))}</td></tr>`
    )
    .join('');
  const body = `<section class="meta avoid-break"><div><strong>Invoice</strong>${escapeHtml(invoice.invoice_number)}</div><div><strong>Receipt</strong>${escapeHtml(invoice.receipt_number || '-')}</div><div><strong>Customer</strong>${escapeHtml(invoice.customer_name || '-')}</div><div><strong>Phone</strong>${escapeHtml(invoice.customer_phone || '-')}</div><div><strong>Cashier</strong>${escapeHtml(invoice.cashier_name || '-')}</div><div><strong>Date</strong>${escapeHtml(invoice.created_at)}</div></section><h2>Items</h2><table><thead><tr><th>Product</th><th>SKU</th><th>Qty</th><th>Unit price</th><th>Total</th></tr></thead><tbody>${rows}</tbody></table><table class="avoid-break"><tbody><tr><th>Subtotal</th><td class="number">${money(invoice.subtotal)}</td></tr><tr><th>Discount</th><td class="number">${money(invoice.discount)}</td></tr><tr><th class="total">Total</th><td class="number total">${money(invoice.total)}</td></tr></tbody></table>`;
  const html = printableDocument({
    title: `Invoice ${invoice.invoice_number}`,
    subtitle: invoice.status,
    body,
  });
  return { buffer: await renderPdf(html), invoice, outputAuthorization };
}

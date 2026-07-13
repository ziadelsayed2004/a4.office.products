import { Paper } from '@mui/material';
import { StatusChip } from './StatusChip.jsx';
import { dateTime, money, number, statusLabel } from '../utils/formatters.js';
import './InvoiceDetails.css';

function first(...values) {
  return values.find((value) => value !== undefined && value !== null && value !== '');
}

function rows(value) {
  return Array.isArray(value) ? value : [];
}

function originLabel(value) {
  return (
    {
      SALE: 'بيع مباشر',
      ORDER_SALE: 'بيع مباشر',
      PREORDER_PICKUP: 'استلام حجز',
    }[String(value || '').toUpperCase()] ||
    value ||
    '—'
  );
}

function paymentStageLabel(value) {
  return (
    {
      SALE: 'بيع',
      PREORDER_DEPOSIT: 'عربون',
      PREORDER_PICKUP: 'استلام',
      REFUND: 'مرتجع',
    }[String(value || '').toUpperCase()] ||
    value ||
    '—'
  );
}

function DetailRow({ label, value, ltr = false }) {
  return (
    <div className="invoice-detail-row">
      <span>{label}</span>
      <strong className={ltr ? 'a4-ltr' : ''}>{value ?? '—'}</strong>
    </div>
  );
}

export function InvoiceDetails({ invoice, isAdmin = false }) {
  if (!invoice) return null;

  const items = rows(invoice.items);
  const payments = rows(invoice.payments);
  const receipts = rows(invoice.receipts);
  const returns = rows(invoice.returns || invoice.corrections);
  const printRequests = rows(invoice.printRequests || invoice.print_requests);
  const auditTimeline = rows(invoice.auditTimeline || invoice.audit_timeline);
  const preorder = invoice.preorder;
  const customerName = first(
    invoice.customer_name_snapshot,
    invoice.customer_name,
    invoice.customer?.name
  );
  const customerPhone = first(
    invoice.customer_phone_snapshot,
    invoice.customer_phone,
    invoice.customer?.phone
  );

  return (
    <div className="invoice-details">
      <div className="invoice-details__metrics">
        <Paper variant="outlined" className="invoice-detail-card">
          <span>رقم الفاتورة</span>
          <strong className="a4-ltr">
            {first(invoice.invoice_number, invoice.invoiceNumber, `#${invoice.id}`)}
          </strong>
          <small>{originLabel(first(invoice.origin, invoice.reference_type))}</small>
        </Paper>
        <Paper variant="outlined" className="invoice-detail-card">
          <span>الحالة</span>
          <StatusChip status={invoice.status} label={statusLabel(invoice.status)} />
          <small>{dateTime(first(invoice.created_at, invoice.createdAt))}</small>
        </Paper>
        <Paper variant="outlined" className="invoice-detail-card">
          <span>الإجمالي</span>
          <strong>{money(first(invoice.total, invoice.total_amount, 0))}</strong>
          <small>الخصم {money(first(invoice.discount, 0))}</small>
        </Paper>
      </div>

      <section className="invoice-detail-section">
        <h3>بيانات الفاتورة</h3>
        <div className="invoice-detail-grid">
          <DetailRow
            label="الكاشير"
            value={first(
              invoice.cashier_name_snapshot,
              invoice.cashier_name,
              invoice.cashier?.name
            )}
          />
          <DetailRow
            label="الشيفت"
            value={
              first(invoice.shift_id, invoice.shift?.id)
                ? `#${first(invoice.shift_id, invoice.shift?.id)}`
                : '—'
            }
          />
          <DetailRow label="العميل" value={customerName || '—'} />
          <DetailRow label="الهاتف" value={customerPhone || '—'} ltr />
          <DetailRow label="قبل الخصم" value={money(first(invoice.subtotal, 0))} />
          <DetailRow
            label="رقم الحجز المرتبط"
            value={first(preorder?.preorder_number, invoice.preorder_number, '—')}
            ltr
          />
        </div>
      </section>

      <section className="invoice-detail-section">
        <h3>بنود الفاتورة</h3>
        <div className="invoice-detail-list">
          {items.length ? (
            items.map((item, index) => {
              const quantity = Number(first(item.quantity, item.qty, 0));
              const unitPrice = Number(
                first(item.unit_price_snapshot, item.unit_price, item.price, 0)
              );
              return (
                <article
                  className="invoice-detail-list__item"
                  key={first(item.id, `${item.product_id}-${index}`)}
                >
                  <div>
                    <strong>
                      {first(item.product_name_snapshot, item.product_name, item.name, '—')}
                    </strong>
                    <span className="a4-ltr">
                      {first(
                        item.product_sku_snapshot,
                        item.sku_snapshot,
                        item.product_sku,
                        item.sku,
                        '—'
                      )}
                    </span>
                    {first(
                      item.price_tier_name_snapshot,
                      item.tier_name_snapshot,
                      item.tier_name
                    ) && (
                      <small>
                        {first(
                          item.price_tier_name_snapshot,
                          item.tier_name_snapshot,
                          item.tier_name
                        )}
                      </small>
                    )}
                  </div>
                  <div className="invoice-detail-list__amount">
                    <span>
                      {number(quantity)} × {money(unitPrice)}
                    </span>
                    <strong>{money(first(item.line_total, quantity * unitPrice))}</strong>
                  </div>
                </article>
              );
            })
          ) : (
            <p className="invoice-detail-empty">لا توجد بنود محفوظة.</p>
          )}
        </div>
      </section>

      <section className="invoice-detail-section">
        <h3>المدفوعات</h3>
        <div className="invoice-detail-list">
          {payments.length ? (
            payments.map((payment, index) => (
              <article
                className="invoice-detail-list__item"
                key={first(payment.id, `${payment.payment_method}-${index}`)}
              >
                <div>
                  <strong>
                    {first(
                      payment.method_name_snapshot,
                      payment.method_name,
                      payment.payment_method,
                      payment.method,
                      '—'
                    )}
                  </strong>
                  <span>{paymentStageLabel(first(payment.stage, payment.payment_stage))}</span>
                  {first(payment.reference_number, payment.referenceNumber) && (
                    <small className="a4-ltr">
                      {first(payment.reference_number, payment.referenceNumber)}
                    </small>
                  )}
                </div>
                <div className="invoice-detail-list__amount">
                  <strong>{money(first(payment.applied_amount, payment.amount, 0))}</strong>
                  {first(payment.cash_received, payment.cashReceived) !== undefined && (
                    <span>المستلم {money(first(payment.cash_received, payment.cashReceived))}</span>
                  )}
                  {first(payment.change_amount, payment.change) !== undefined && (
                    <span>الباقي {money(first(payment.change_amount, payment.change))}</span>
                  )}
                </div>
              </article>
            ))
          ) : (
            <p className="invoice-detail-empty">لا توجد مدفوعات محفوظة.</p>
          )}
        </div>
      </section>

      {preorder && (
        <section className="invoice-detail-section">
          <h3>الحجز المرتبط</h3>
          <div className="invoice-detail-grid">
            <DetailRow
              label="رقم الحجز"
              value={first(preorder.preorder_number, preorder.preorderNumber)}
              ltr
            />
            <DetailRow label="الحالة" value={statusLabel(preorder.status)} />
            <DetailRow
              label="العربون"
              value={money(first(preorder.deposit_paid, preorder.depositPaid, 0))}
            />
            <DetailRow
              label="مبلغ الاستلام"
              value={money(first(preorder.pickup_amount, preorder.pickupAmount, 0))}
            />
          </div>
        </section>
      )}

      {returns.length > 0 && (
        <section className="invoice-detail-section">
          <h3>المرتجعات والتصحيحات</h3>
          <div className="invoice-detail-list">
            {returns.map((entry, index) => (
              <article className="invoice-detail-list__item" key={first(entry.id, index)}>
                <div>
                  <strong>
                    {first(
                      entry.return_number,
                      entry.correction_number,
                      `#${entry.id || index + 1}`
                    )}
                  </strong>
                  <span>{first(entry.reason, entry.notes, '—')}</span>
                </div>
                <div className="invoice-detail-list__amount">
                  <strong>{money(first(entry.amount, entry.refund_amount, 0))}</strong>
                  <span>{dateTime(first(entry.created_at, entry.createdAt))}</span>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

      <section className="invoice-detail-section">
        <h3>الإيصالات</h3>
        <div className="invoice-detail-list">
          {receipts.length ? (
            receipts.map((receipt, index) => (
              <article className="invoice-detail-list__item" key={first(receipt.id, index)}>
                <div>
                  <strong className="a4-ltr">
                    {first(receipt.receipt_number, receipt.receiptNumber, `#${receipt.id}`)}
                  </strong>
                  <span>{first(receipt.reference_type, receipt.type, 'إيصال')}</span>
                </div>
                <div className="invoice-detail-list__amount">
                  <strong>
                    {number(first(receipt.print_count, receipt.printCount, 0))} طلب طباعة
                  </strong>
                  <span>{dateTime(first(receipt.created_at, receipt.createdAt))}</span>
                </div>
              </article>
            ))
          ) : (
            <p className="invoice-detail-empty">لا يوجد إيصال مرتبط.</p>
          )}
        </div>
      </section>

      {printRequests.length > 0 && (
        <section className="invoice-detail-section">
          <h3>سجل طلبات الطباعة</h3>
          <div className="invoice-detail-timeline">
            {printRequests.map((request, index) => (
              <div key={first(request.id, index)}>
                <strong>{first(request.user_name, request.requested_by_name, '—')}</strong>
                <span>{dateTime(first(request.created_at, request.requested_at))}</span>
                <small>
                  {number(first(request.copies, 1))} نسخة
                  {request.is_reprint || request.isReprint ? ' · إعادة طباعة' : ''}
                </small>
                {request.reason && <p>{request.reason}</p>}
              </div>
            ))}
          </div>
        </section>
      )}

      {isAdmin && auditTimeline.length > 0 && (
        <section className="invoice-detail-section">
          <h3>الخط الزمني للمراجعة</h3>
          <div className="invoice-detail-timeline">
            {auditTimeline.map((entry, index) => (
              <div key={first(entry.id, index)}>
                <strong>{first(entry.action, entry.event_type, '—')}</strong>
                <span>{dateTime(first(entry.created_at, entry.timestamp))}</span>
                <small>{first(entry.user_name, entry.actor_name, '—')}</small>
                {first(entry.notes, entry.description) && (
                  <p>{first(entry.notes, entry.description)}</p>
                )}
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

export default InvoiceDetails;

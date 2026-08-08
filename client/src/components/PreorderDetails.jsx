import { Alert, Divider, Paper, Typography } from '@mui/material';
import { money, number } from '../utils/formatters.js';
import { StatusChip } from './StatusChip.jsx';
import './PreorderDetails.css';

function value(...values) {
  return values.find((item) => item !== undefined && item !== null && String(item).trim() !== '');
}

function DetailCard({ label, children, hint }) {
  return (
    <Paper variant="outlined" className="preorder-details__card">
      <span className="preorder-details__label">{label}</span>
      <strong>{children || '—'}</strong>
      {hint ? <span className="preorder-details__hint">{hint}</span> : null}
    </Paper>
  );
}

export function PreorderSummary({ preorder }) {
  if (!preorder) return null;
  return (
    <div className="preorder-details__summary">
      <DetailCard label="العميل" hint={<span className="a4-ltr">{preorder.customer_phone}</span>}>
        {preorder.customer_name}
      </DetailCard>
      <DetailCard label="الإجمالي" hint={`العربون ${money(preorder.deposit_paid)}`}>
        {money(preorder.total_amount)}
      </DetailCard>
      <DetailCard label="الحالة" hint={`المتبقي ${money(preorder.remaining_amount)}`}>
        <StatusChip status={preorder.status} />
      </DetailCard>
      {preorder.cashier_name ? (
        <DetailCard label="الكاشير">{preorder.cashier_name}</DetailCard>
      ) : null}
      {preorder.expected_pickup_date ? (
        <DetailCard label="موعد الاستلام">
          <span className="a4-ltr">{preorder.expected_pickup_date}</span>
        </DetailCard>
      ) : null}
      {preorder.invoice_number ? (
        <DetailCard label="فاتورة الاستلام">
          <span className="a4-ltr">{preorder.invoice_number}</span>
        </DetailCard>
      ) : null}
    </div>
  );
}

export function PreorderItems({ items = [], showStock = false }) {
  if (!items.length) {
    return <Alert severity="info">لا توجد منتجات مسجلة في هذا الحجز.</Alert>;
  }
  return (
    <div className="preorder-details__items">
      {items.map((item) => {
        const author = value(item.author, item.teacher);
        const bookMeta = [
          author && `المؤلف: ${author}`,
          item.publisher && `الناشر: ${item.publisher}`,
          item.school_grade && `الصف: ${item.school_grade}`,
          item.subject && `المادة: ${item.subject}`,
          item.term && `الترم: ${item.term === 'first' ? 'الأول' : 'الثاني'}`,
          item.release_year && `سنة الإصدار: ${item.release_year}`,
        ].filter(Boolean);
        const stock = Number(item.stock ?? item.stock_on_hand ?? 0);
        return (
          <Paper
            variant="outlined"
            className="preorder-details__item"
            key={item.id || `${item.product_id}-${item.product_name}`}
          >
            <div className="preorder-details__item-main">
              <Typography className="preorder-details__product-name">
                {item.product_name || 'منتج غير معروف'}
              </Typography>
              {bookMeta.length ? (
                <div className="preorder-details__book-meta">
                  {bookMeta.map((meta) => (
                    <span key={meta}>{meta}</span>
                  ))}
                </div>
              ) : null}
              <div className="preorder-details__technical">
                {item.product_sku ? <span className="a4-ltr">SKU: {item.product_sku}</span> : null}
                {item.category_name ? <span>التصنيف: {item.category_name}</span> : null}
                {item.price_tier_name ? <span>فئة السعر: {item.price_tier_name}</span> : null}
              </div>
            </div>
            <div className="preorder-details__item-values">
              <span>
                {number(item.quantity)} × {money(item.unit_price)}
              </span>
              <strong>{money(item.total_price)}</strong>
              {showStock ? (
                <span className={stock < Number(item.quantity) ? 'stock-error' : ''}>
                  متاح {number(stock)} / مطلوب {number(item.quantity)}
                </span>
              ) : null}
            </div>
          </Paper>
        );
      })}
    </div>
  );
}

export function PreorderDetails({ preorder, items, showStock = false }) {
  return (
    <div className="preorder-details">
      <PreorderSummary preorder={preorder} />
      <Divider />
      <section>
        <Typography variant="h6" className="preorder-details__title">
          المنتجات
        </Typography>
        <PreorderItems items={items} showStock={showStock} />
      </section>
      {preorder?.notes || preorder?.preorder_instructions_snapshot ? (
        <Alert severity="info">{preorder.notes || preorder.preorder_instructions_snapshot}</Alert>
      ) : null}
    </div>
  );
}

export default PreorderDetails;

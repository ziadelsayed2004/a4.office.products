import { useEffect, useMemo, useState } from 'react';
import { Alert, Button, Paper, TextField } from '@mui/material';
import {
  PrintRounded,
  QrCode2Rounded,
  ReceiptLongRounded,
  RefreshRounded,
  SearchRounded,
} from '@mui/icons-material';
import { useSearchParams } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { api } from '../api/client.js';
import { PageHeader } from '../components/navigation/PageHeader.jsx';
import { Field } from '../components/forms/Field.jsx';
import { LoadingState } from '../components/feedback/LoadingState.jsx';
import { EmptyState } from '../components/feedback/EmptyState.jsx';
import { AppSnackbar } from '../components/feedback/AppSnackbar.jsx';
import { dateTime, money, number, statusLabel } from '../utils/formatters.js';
import logo from '../assets/a4-logo.png';

const referenceLabels = {
  order_sale: 'إيصال بيع مباشر',
  preorder_deposit: 'إيصال حجز مسبق',
  preorder_pickup: 'إيصال استلام حجز',
};

export default function Receipts() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [code, setCode] = useState(searchParams.get('code') || '');
  const [receipt, setReceipt] = useState(null);
  const [loading, setLoading] = useState(false);
  const [reprinting, setReprinting] = useState(false);
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [toast, setToast] = useState(null);

  const loadReceipt = async (value = code) => {
    const normalized = value.trim();
    if (!normalized) {
      setError('اكتب رقم الإيصال أو امسح الرمز أولاً.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const response = await api.get(`/api/pos/receipts/${encodeURIComponent(normalized)}`);
      setReceipt(response.data || null);
      setCode(normalized);
      setSearchParams({ code: normalized }, { replace: true });
    } catch (err) {
      setReceipt(null);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const initial = searchParams.get('code');
    if (initial) loadReceipt(initial);
    // Query param is intentionally read once on mount.
  }, []);

  const totalPaid = useMemo(
    () => (receipt?.payments || []).reduce((sum, payment) => sum + Number(payment.amount || 0), 0),
    [receipt],
  );

  const doReprint = async () => {
    if (!receipt) return;
    setReprinting(true);
    try {
      const response = await api.post(`/api/pos/receipts/${receipt.id}/reprint`, { reason: reason.trim() });
      setReceipt((current) => ({ ...current, print_count: response.data.print_count, last_printed_at: new Date().toISOString() }));
      setReason('');
      setToast({ message: 'تم تسجيل إعادة الطباعة في سجل العمليات.' });
      requestAnimationFrame(() => window.print());
    } catch (err) {
      setToast({ severity: 'error', message: err.message });
    } finally {
      setReprinting(false);
    }
  };

  return (
    <div className="a4-page receipts-page">
      <PageHeader
        title="الإيصالات"
        description="ابحث برقم الإيصال، اعرض التفاصيل، ثم اطبع نسخة حرارية واضحة. كل إعادة طباعة تسجل باسم الحساب."
        actions={receipt ? <Button variant="outlined" startIcon={<RefreshRounded />} onClick={() => loadReceipt()} disabled={loading}>تحديث</Button> : null}
      />

      <section className="a4-page-section no-print">
        <div className="receipt-search-row">
          <Field label="رقم الإيصال">
            <TextField
              autoFocus
              value={code}
              onChange={(event) => setCode(event.target.value)}
              onKeyDown={(event) => event.key === 'Enter' && loadReceipt()}
              placeholder="اكتب رقم الإيصال أو امسح الرمز"
              inputProps={{ dir: 'ltr' }}
            />
          </Field>
          <Button variant="contained" startIcon={<SearchRounded />} onClick={() => loadReceipt()} disabled={loading}>بحث</Button>
        </div>
        <span className="field__hint" style={{ marginTop: 5, display: 'block' }}>مثال: REC-20260711-0001</span>
      </section>

      {error && <Alert severity="error" className="no-print">{error}</Alert>}
      {loading && <LoadingState label="جاري تحميل الإيصال..." />}

      {!loading && !receipt && !error && (
        <section className="a4-page-section">
          <EmptyState icon={<ReceiptLongRounded />} title="ابحث عن إيصال" description="أدخل رقم الإيصال لعرض بياناته وطباعته." />
        </section>
      )}

      {!loading && receipt && (
        <div className="receipt-workspace">
          <Paper variant="outlined" className="receipt-paper" id="printable-receipt">
            <header className="receipt-paper__brand">
              <img src={logo} alt="A4 Office Products" />
              <strong>مكتبة A4 للأدوات المكتبية</strong>
              <span>{referenceLabels[receipt.reference_type] || 'إيصال'}</span>
            </header>

            <div className="receipt-paper__meta">
              <div className="receipt-paper__row"><span>رقم الإيصال</span><strong className="a4-ltr">{receipt.receipt_number}</strong></div>
              {receipt.invoice_number && <div className="receipt-paper__row"><span>رقم الفاتورة</span><strong className="a4-ltr">{receipt.invoice_number}</strong></div>}
              {receipt.preorder_number && <div className="receipt-paper__row"><span>رقم الحجز</span><strong className="a4-ltr">{receipt.preorder_number}</strong></div>}
              <div className="receipt-paper__row"><span>التاريخ</span><strong>{dateTime(receipt.created_at)}</strong></div>
              <div className="receipt-paper__row"><span>الكاشير</span><strong>{receipt.printed_by_name}</strong></div>
              {receipt.customer_name && <div className="receipt-paper__row"><span>العميل</span><strong>{receipt.customer_name}</strong></div>}
              {receipt.customer_phone && <div className="receipt-paper__row"><span>الهاتف</span><strong className="a4-ltr">{receipt.customer_phone}</strong></div>}
              {receipt.status && <div className="receipt-paper__row"><span>الحالة</span><strong>{statusLabel(receipt.status)}</strong></div>}
            </div>

            <div className="receipt-items">
              {(receipt.items || []).map((item, index) => (
                <div className="receipt-item" key={item.id || `${item.product_id}-${index}`}>
                  <div className="receipt-item__title">
                    <strong>{item.product_name}</strong>
                    <span className="a4-ltr">{item.product_sku}</span>
                  </div>
                  <div className="receipt-paper__row">
                    <span>{number(item.quantity)} × {money(item.unit_price)}</span>
                    <strong>{money(Number(item.quantity || 0) * Number(item.unit_price || 0))}</strong>
                  </div>
                  {Number(item.returned_qty || 0) > 0 && <small>مرتجع: {number(item.returned_qty)}</small>}
                </div>
              ))}
            </div>

            <div className="receipt-totals">
              <div className="receipt-paper__row"><span>المجموع الفرعي</span><strong>{money(receipt.subtotal)}</strong></div>
              {Number(receipt.discount || 0) > 0 && <div className="receipt-paper__row"><span>الخصم</span><strong>- {money(receipt.discount)}</strong></div>}
              {receipt.deposit_paid !== undefined && <div className="receipt-paper__row"><span>العربون المدفوع</span><strong>{money(receipt.deposit_paid)}</strong></div>}
              {receipt.remaining_amount !== undefined && <div className="receipt-paper__row"><span>المتبقي</span><strong>{money(receipt.remaining_amount)}</strong></div>}
              <div className="receipt-paper__row receipt-paper__total"><span>الإجمالي</span><strong>{money(receipt.total)}</strong></div>
            </div>

            <div className="receipt-payments">
              <strong>طرق الدفع</strong>
              {(receipt.payments || []).map((payment, index) => (
                <div className="receipt-paper__row" key={`${payment.payment_method}-${index}`}>
                  <span>{payment.payment_method}</span><strong>{money(payment.amount)}</strong>
                </div>
              ))}
              <div className="receipt-paper__row"><span>إجمالي المسجل</span><strong>{money(totalPaid)}</strong></div>
            </div>

            {receipt.qr_token && (
              <div className="receipt-qr">
                <QRCodeSVG value={String(receipt.qr_token)} size={112} level="M" includeMargin />
                <span>امسح الرمز للاستعلام داخل النظام</span>
                <code dir="ltr">{receipt.qr_token}</code>
              </div>
            )}

            <footer className="receipt-paper__footer">
              <p>شكراً لتعاملكم مع مكتبة A4</p>
              <span>عدد مرات الطباعة: {number(receipt.print_count)}</span>
            </footer>
          </Paper>

          <aside className="receipt-actions no-print">
            <div className="receipt-actions__icon"><QrCode2Rounded /></div>
            <h2>خيارات الطباعة</h2>
            <p>استخدم الطباعة العادية لأول نسخة. عند إعادة الطباعة، اكتب سبباً مختصراً حتى يظهر في سجل العمليات.</p>
            <Button fullWidth variant="contained" startIcon={<PrintRounded />} onClick={() => window.print()}>طباعة الإيصال</Button>
            <Field label="سبب إعادة الطباعة" hint="اختياري، لكنه مفضل للمراجعة المالية.">
              <TextField multiline minRows={3} value={reason} onChange={(event) => setReason(event.target.value)} placeholder="مثال: العميل فقد النسخة الأولى" />
            </Field>
            <Button fullWidth variant="outlined" startIcon={<PrintRounded />} onClick={doReprint} disabled={reprinting}>
              {reprinting ? 'جاري التسجيل...' : 'تسجيل وإعادة الطباعة'}
            </Button>
          </aside>
        </div>
      )}

      <AppSnackbar state={toast} onClose={() => setToast(null)} />
    </div>
  );
}

import { useEffect, useState } from 'react';
import { Alert, Button, TextField } from '@mui/material';
import {
  PrintRounded,
  QrCode2Rounded,
  ReceiptLongRounded,
  RefreshRounded,
  SearchRounded,
} from '@mui/icons-material';
import { useSearchParams } from 'react-router-dom';
import { api } from '../services/apiClient.js';
import { printReceiptInFrame } from '../services/printService.js';
import { useAuth } from '../app/AuthContext.jsx';
import { PageHeader } from '../components/PageHeader.jsx';
import { Field } from '../components/forms/Field.jsx';
import { LoadingState } from '../components/LoadingState.jsx';
import { EmptyState } from '../components/EmptyState.jsx';
import { AppSnackbar } from '../components/AppSnackbar.jsx';
import { ThermalReceipt } from '../components/ThermalReceipt.jsx';
import {
  FAIL_CLOSED_BROWSER_PRINT_SETTINGS,
  normalizeBrowserPrintSettings,
  PRINTER_SETTINGS_UNAVAILABLE_MESSAGE,
} from '../utils/browserPrintSettings.js';
import '../styles/Receipts.css';

export default function Receipts() {
  const { currentShift } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [code, setCode] = useState(searchParams.get('code') || '');
  const [receipt, setReceipt] = useState(null);
  const [settings, setSettings] = useState(FAIL_CLOSED_BROWSER_PRINT_SETTINGS);
  const [loading, setLoading] = useState(false);
  const [reprinting, setReprinting] = useState(false);
  const [printing, setPrinting] = useState(false);
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
    api
      .get('/api/printer-settings')
      .then((response) => setSettings(normalizeBrowserPrintSettings(response.data)))
      .catch(() => {
        setSettings(FAIL_CLOSED_BROWSER_PRINT_SETTINGS);
        setToast({ severity: 'warning', message: PRINTER_SETTINGS_UNAVAILABLE_MESSAGE });
      });
    // Query param is intentionally read once on mount.
  }, []);

  const hasOpenShift = currentShift?.status === 'OPEN';
  const updatePrintCount = (result) => {
    const request = result?.printRequest || {};
    const nextCount =
      request.print_count ??
      request.printCount ??
      request.receipt?.print_count ??
      Number(receipt?.print_count || 0) + 1;
    setReceipt((current) =>
      current
        ? {
            ...current,
            print_count: nextCount,
            last_printed_at: new Date().toISOString(),
          }
        : current
    );
  };

  const doPrint = async () => {
    if (!receipt || !hasOpenShift) return;
    setPrinting(true);
    try {
      const result = await printReceiptInFrame({
        receiptId: receipt.receipt_number || receipt.id,
        isReprint: Number(receipt.print_count || 0) > 0,
      });
      updatePrintCount(result);
      setToast({ message: 'تم تسجيل طلب الطباعة وفتح مستند الإيصال.' });
    } catch (err) {
      setToast({ severity: 'error', message: err.message });
    } finally {
      setPrinting(false);
    }
  };

  const doReprint = async () => {
    if (!receipt || !hasOpenShift) return;
    setReprinting(true);
    try {
      const result = await printReceiptInFrame({
        receiptId: receipt.receipt_number || receipt.id,
        reason,
        isReprint: true,
      });
      updatePrintCount(result);
      setReason('');
      setToast({ message: 'تم تسجيل طلب إعادة الطباعة وفتح النسخة المعلّمة.' });
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
        actions={
          receipt ? (
            <Button
              variant="outlined"
              startIcon={<RefreshRounded />}
              onClick={() => loadReceipt()}
              disabled={loading}
            >
              تحديث
            </Button>
          ) : null
        }
      />

      <section className="a4-page-section no-print">
        <div className="receipt-search-row">
          <Field label="رقم الإيصال" hint="مثال: REC-20260711-0001">
            <TextField
              autoFocus
              value={code}
              onChange={(event) => setCode(event.target.value)}
              onKeyDown={(event) => event.key === 'Enter' && loadReceipt()}
              placeholder="اكتب رقم الإيصال أو امسح الرمز"
              slotProps={{ htmlInput: { dir: 'ltr' } }}
            />
          </Field>
          <Button
            variant="contained"
            startIcon={<SearchRounded />}
            onClick={() => loadReceipt()}
            disabled={loading}
          >
            بحث
          </Button>
        </div>
      </section>

      {error && (
        <Alert severity="error" className="no-print">
          {error}
        </Alert>
      )}
      {loading && <LoadingState label="جاري تحميل الإيصال..." />}

      {!loading && !receipt && !error && (
        <section className="a4-page-section">
          <EmptyState
            icon={<ReceiptLongRounded />}
            title="ابحث عن إيصال"
            description="أدخل رقم الإيصال لعرض بياناته وطباعته."
          />
        </section>
      )}

      {!loading && receipt && (
        <div className="receipt-workspace">
          <div className="receipt-preview" id="printable-receipt">
            <ThermalReceipt receipt={receipt} settings={settings} />
          </div>

          <aside className="receipt-actions no-print">
            <div className="receipt-actions__icon">
              <QrCode2Rounded />
            </div>
            <h2>خيارات الطباعة</h2>
            <p>
              يفتح النظام مستنداً معزولاً بنفس الموقع بعد جاهزية الخطوط والصور وQR. كل محاولة طباعة
              تسجل باسم الحساب.
            </p>
            {!hasOpenShift && (
              <Alert severity="warning">
                العرض متاح، لكن الطباعة تحتاج شيفتاً مفتوحاً خاصاً بك.
              </Alert>
            )}
            <Button
              fullWidth
              variant="contained"
              startIcon={<PrintRounded />}
              onClick={doPrint}
              disabled={printing || reprinting || !hasOpenShift}
            >
              {printing ? 'جاري تجهيز الطباعة...' : 'طباعة الإيصال'}
            </Button>
            <Field label="سبب إعادة الطباعة" hint="اختياري، لكنه مفضل للمراجعة المالية.">
              <TextField
                multiline
                minRows={3}
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                placeholder="مثال: العميل فقد النسخة الأولى"
              />
            </Field>
            <Button
              fullWidth
              variant="outlined"
              startIcon={<PrintRounded />}
              onClick={doReprint}
              disabled={reprinting || printing || !hasOpenShift}
            >
              {reprinting ? 'جاري التسجيل...' : 'تسجيل وإعادة الطباعة'}
            </Button>
          </aside>
        </div>
      )}

      <AppSnackbar state={toast} onClose={() => setToast(null)} />
    </div>
  );
}

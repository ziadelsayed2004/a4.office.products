import { useEffect, useState } from 'react';
import { Alert, Button, FormControlLabel, MenuItem, Switch, TextField } from '@mui/material';
import { SaveRounded } from '@mui/icons-material';
import { api } from '../services/apiClient.js';
import { PageHeader } from '../components/PageHeader.jsx';
import { Field } from '../components/forms/Field.jsx';
import { FieldGrid } from '../components/forms/FieldGrid.jsx';
import { FormSection } from '../components/forms/FormSection.jsx';
import { LoadingState } from '../components/LoadingState.jsx';
import { AppSnackbar } from '../components/AppSnackbar.jsx';
import {
  productLabelSizeFromDimensions,
  PRODUCT_LABEL_SIZES,
} from '../utils/productLabelPrintSizing.js';
import '../styles/PrinterSettings.css';

const BOOLEAN_KEYS = [
  'auto_print_sale',
  'auto_print_preorder_deposit',
  'auto_print_preorder_pickup',
  'print_show_customer',
  'print_show_price_tier',
  'print_show_qr',
];

const SUPPORTED_SETTING_KEYS = [
  'print_mode',
  'receipt_printer_width',
  'receipt_copies',
  'receipt_printer_header',
  'receipt_printer_footer',
  ...BOOLEAN_KEYS,
  'qr_printer_width',
  'qr_printer_height',
  'qr_label_count',
];

const defaults = Object.freeze({
  print_mode: 'browser',
  receipt_printer_width: '80mm',
  receipt_copies: '1',
  receipt_printer_header: 'مكتبة A4 فرع السويس',
  receipt_printer_footer: 'شكراً لتعاملكم معنا',
  auto_print_sale: 'true',
  auto_print_preorder_deposit: 'true',
  auto_print_preorder_pickup: 'true',
  print_show_customer: 'true',
  print_show_price_tier: 'true',
  print_show_qr: 'true',
  qr_printer_width: '50',
  qr_printer_height: '25',
  qr_label_count: '1',
});

function boundedInteger(value, minimum, maximum, fallback) {
  const parsed = Number.parseInt(value, 10);
  return String(Number.isInteger(parsed) ? Math.min(maximum, Math.max(minimum, parsed)) : fallback);
}

function normalizeSettings(settings = {}) {
  const merged = { ...defaults, ...settings };
  const normalized = {
    ...defaults,
    receipt_printer_width: String(merged.receipt_printer_width).startsWith('58') ? '58mm' : '80mm',
    receipt_copies: boundedInteger(merged.receipt_copies, 1, 20, 1),
    receipt_printer_header: String(
      merged.receipt_printer_header ?? defaults.receipt_printer_header
    ),
    receipt_printer_footer: String(
      merged.receipt_printer_footer ?? defaults.receipt_printer_footer
    ),
    qr_label_count: boundedInteger(merged.qr_label_count, 1, 500, 1),
  };

  const labelSize = productLabelSizeFromDimensions(
    merged.qr_printer_width,
    merged.qr_printer_height
  );
  normalized.qr_printer_width = String(PRODUCT_LABEL_SIZES[labelSize].widthMm);
  normalized.qr_printer_height = String(PRODUCT_LABEL_SIZES[labelSize].heightMm);
  for (const key of BOOLEAN_KEYS) {
    normalized[key] = String(merged[key]) === 'false' ? 'false' : 'true';
  }
  normalized.print_mode = 'browser';
  return normalized;
}

function supportedPayload(settings) {
  const normalized = normalizeSettings(settings);
  return Object.fromEntries(SUPPORTED_SETTING_KEYS.map((key) => [key, normalized[key]]));
}

export default function PrinterSettings() {
  const [form, setForm] = useState(defaults);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [toast, setToast] = useState(null);

  useEffect(() => {
    api
      .get('/api/admin/printer-settings')
      .then((response) => setForm(normalizeSettings(response.data)))
      .catch((loadError) => setError(loadError.message))
      .finally(() => setLoading(false));
  }, []);

  const toggle = (key) => (event) => {
    setForm((value) => ({ ...value, [key]: event.target.checked ? 'true' : 'false' }));
  };

  const changeLabelSize = (event) => {
    const dimensions = PRODUCT_LABEL_SIZES[event.target.value] || PRODUCT_LABEL_SIZES.medium;
    setForm((value) => ({
      ...value,
      qr_printer_width: String(dimensions.widthMm),
      qr_printer_height: String(dimensions.heightMm),
    }));
  };

  const save = async () => {
    setSaving(true);
    try {
      const payload = supportedPayload(form);
      await api.post('/api/admin/printer-settings', payload);
      setForm(payload);
      setToast({ message: 'تم حفظ إعدادات الطباعة.' });
    } catch (saveError) {
      setToast({ severity: 'error', message: saveError.message });
    } finally {
      setSaving(false);
    }
  };

  if (loading)
    return (
      <div className="a4-page">
        <LoadingState />
      </div>
    );

  const labelSize = productLabelSizeFromDimensions(form.qr_printer_width, form.qr_printer_height);

  return (
    <div className="a4-page printer-settings-page">
      <PageHeader
        title="إعدادات الطباعة"
        description="إعداد إيصالات وملصقات Browser Print بالمقاسات الفعلية."
        actions={
          <Button variant="contained" startIcon={<SaveRounded />} onClick={save} disabled={saving}>
            حفظ الإعدادات
          </Button>
        }
      />
      {error && <Alert severity="error">{error}</Alert>}
      <Alert severity="info">
        الطباعة الحالية تعمل من المتصفح فقط وتعرض مربع الطباعة الخاص بالنظام. إعدادات نوع الطابعة
        وعنوانها القديمة محفوظة في الخادم لكنها غير مستخدمة هنا.
      </Alert>
      <section className="a4-page-section printer-settings-page__content">
        <FormSection title="المستند الحراري">
          <FieldGrid>
            <Field label="عرض الإيصال">
              <TextField
                select
                value={form.receipt_printer_width}
                onChange={(event) =>
                  setForm((value) => ({ ...value, receipt_printer_width: event.target.value }))
                }
              >
                <MenuItem value="58mm">58 مم</MenuItem>
                <MenuItem value="80mm">80 مم</MenuItem>
              </TextField>
            </Field>
            <Field label="عدد النسخ">
              <TextField
                type="number"
                value={form.receipt_copies}
                onChange={(event) =>
                  setForm((value) => ({ ...value, receipt_copies: event.target.value }))
                }
                slotProps={{ htmlInput: { min: 1, max: 20, step: 1 } }}
              />
            </Field>
            <Field className="full" label="رأس الإيصال">
              <TextField
                value={form.receipt_printer_header}
                onChange={(event) =>
                  setForm((value) => ({ ...value, receipt_printer_header: event.target.value }))
                }
              />
            </Field>
            <Field className="full" label="تذييل الإيصال">
              <TextField
                value={form.receipt_printer_footer}
                onChange={(event) =>
                  setForm((value) => ({ ...value, receipt_printer_footer: event.target.value }))
                }
              />
            </Field>
          </FieldGrid>
        </FormSection>

        <FormSection
          title="الطباعة التلقائية"
          description="الافتراضي تفعيل البيع والعربون والاستلام."
        >
          <div className="a4-grid a4-grid--three">
            <FormControlLabel
              control={
                <Switch
                  checked={form.auto_print_sale === 'true'}
                  onChange={toggle('auto_print_sale')}
                />
              }
              label="بعد البيع"
            />
            <FormControlLabel
              control={
                <Switch
                  checked={form.auto_print_preorder_deposit === 'true'}
                  onChange={toggle('auto_print_preorder_deposit')}
                />
              }
              label="بعد العربون"
            />
            <FormControlLabel
              control={
                <Switch
                  checked={form.auto_print_preorder_pickup === 'true'}
                  onChange={toggle('auto_print_preorder_pickup')}
                />
              }
              label="بعد الاستلام"
            />
          </div>
        </FormSection>

        <FormSection title="محتوى الإيصال">
          <div className="a4-grid a4-grid--three">
            <FormControlLabel
              control={
                <Switch
                  checked={form.print_show_customer === 'true'}
                  onChange={toggle('print_show_customer')}
                />
              }
              label="بيانات العميل"
            />
            <FormControlLabel
              control={
                <Switch
                  checked={form.print_show_price_tier === 'true'}
                  onChange={toggle('print_show_price_tier')}
                />
              }
              label="فئة السعر"
            />
            <FormControlLabel
              control={
                <Switch
                  checked={form.print_show_qr === 'true'}
                  onChange={toggle('print_show_qr')}
                />
              }
              label="رمز QR الآمن"
            />
          </div>
        </FormSection>

        <FormSection
          title="ملصقات المنتجات"
          description="كل ملصق يطبع في صفحة مستقلة بمقاس الورق نفسه."
        >
          <FieldGrid>
            <Field label="المقاس الافتراضي">
              <TextField select value={labelSize} onChange={changeLabelSize}>
                <MenuItem value="small">38×25 مم</MenuItem>
                <MenuItem value="medium">50×25 مم</MenuItem>
                <MenuItem value="large">80×50 مم</MenuItem>
              </TextField>
            </Field>
            <Field label="العدد الافتراضي">
              <TextField
                type="number"
                value={form.qr_label_count}
                onChange={(event) =>
                  setForm((value) => ({ ...value, qr_label_count: event.target.value }))
                }
                slotProps={{ htmlInput: { min: 1, max: 500, step: 1 } }}
              />
            </Field>
          </FieldGrid>
        </FormSection>
      </section>
      <AppSnackbar state={toast} onClose={() => setToast(null)} />
    </div>
  );
}

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
import '../styles/PrinterSettings.css';

const defaults = {
  print_mode: 'browser', receipt_printer_width: '80mm', receipt_copies: '1',
  receipt_printer_header: 'مكتبة A4 للأدوات المكتبية', receipt_printer_footer: 'شكراً لتعاملكم معنا',
  auto_print_sale: 'true', auto_print_preorder_deposit: 'true', auto_print_preorder_pickup: 'true',
  print_show_customer: 'true', print_show_price_tier: 'true', print_show_qr: 'true',
  qr_printer_width: '50', qr_printer_height: '25', qr_label_count: '1',
  qr_label_margin: '2', qr_label_spacing: '2', receipt_printer_type: 'simulation',
  receipt_printer_address: '', qr_printer_type: 'simulation', qr_printer_address: ''
};

export default function PrinterSettings() {
  const [form, setForm] = useState(defaults);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [toast, setToast] = useState(null);

  useEffect(() => {
    api.get('/api/admin/printer-settings')
      .then((response) => setForm((value) => ({ ...value, ...response.data })))
      .catch((loadError) => setError(loadError.message))
      .finally(() => setLoading(false));
  }, []);

  const toggle = (key) => (event) => setForm((value) => ({ ...value, [key]: event.target.checked ? 'true' : 'false' }));
  const save = async () => {
    setSaving(true);
    try {
      await api.post('/api/admin/printer-settings', form);
      setToast({ message: 'تم حفظ إعدادات الطباعة.' });
    } catch (saveError) { setToast({ severity: 'error', message: saveError.message }); }
    finally { setSaving(false); }
  };

  if (loading) return <div className="a4-page"><LoadingState /></div>;
  return (
    <div className="a4-page printer-settings-page">
      <PageHeader title="إعدادات الطباعة" description="إعداد مستندات 58/80 مم والطباعة التلقائية في المتصفح أو وضع kiosk." actions={<Button variant="contained" startIcon={<SaveRounded />} onClick={save} disabled={saving}>حفظ الإعدادات</Button>} />
      {error && <Alert severity="error">{error}</Alert>}
      <Alert severity="info">المتصفح العادي يعرض مربع الطباعة ولا يستطيع الطباعة الصامتة. وضع kiosk يتطلب تشغيل Chrome أو Edge بالمعامل --kiosk-printing وضبط طابعة النظام الافتراضية.</Alert>
      <section className="a4-page-section printer-settings-page__content">
        <FormSection title="المستند الحراري"><FieldGrid>
          <Field label="وضع الطباعة"><TextField select value={form.print_mode} onChange={(event) => setForm((value) => ({ ...value, print_mode: event.target.value }))}><MenuItem value="browser">متصفح عادي</MenuItem><MenuItem value="kiosk">Kiosk printing</MenuItem></TextField></Field>
          <Field label="عرض الإيصال"><TextField select value={form.receipt_printer_width} onChange={(event) => setForm((value) => ({ ...value, receipt_printer_width: event.target.value }))}><MenuItem value="58mm">58 مم</MenuItem><MenuItem value="80mm">80 مم</MenuItem></TextField></Field>
          <Field label="عدد النسخ"><TextField type="number" value={form.receipt_copies} onChange={(event) => setForm((value) => ({ ...value, receipt_copies: event.target.value }))} slotProps={{ htmlInput: { min: 1, max: 20, step: 1 } }} /></Field>
          <Field className="full" label="رأس الإيصال"><TextField value={form.receipt_printer_header} onChange={(event) => setForm((value) => ({ ...value, receipt_printer_header: event.target.value }))} /></Field>
          <Field className="full" label="تذييل الإيصال"><TextField value={form.receipt_printer_footer} onChange={(event) => setForm((value) => ({ ...value, receipt_printer_footer: event.target.value }))} /></Field>
        </FieldGrid></FormSection>

        <FormSection title="الطباعة التلقائية" description="الافتراضي تفعيل البيع والعربون والاستلام."><div className="a4-grid a4-grid--three">
          <FormControlLabel control={<Switch checked={form.auto_print_sale === 'true'} onChange={toggle('auto_print_sale')} />} label="بعد البيع" />
          <FormControlLabel control={<Switch checked={form.auto_print_preorder_deposit === 'true'} onChange={toggle('auto_print_preorder_deposit')} />} label="بعد العربون" />
          <FormControlLabel control={<Switch checked={form.auto_print_preorder_pickup === 'true'} onChange={toggle('auto_print_preorder_pickup')} />} label="بعد الاستلام" />
        </div></FormSection>

        <FormSection title="محتوى الإيصال"><div className="a4-grid a4-grid--three">
          <FormControlLabel control={<Switch checked={form.print_show_customer === 'true'} onChange={toggle('print_show_customer')} />} label="بيانات العميل" />
          <FormControlLabel control={<Switch checked={form.print_show_price_tier === 'true'} onChange={toggle('print_show_price_tier')} />} label="فئة السعر" />
          <FormControlLabel control={<Switch checked={form.print_show_qr === 'true'} onChange={toggle('print_show_qr')} />} label="رمز QR الآمن" />
        </div></FormSection>
      </section>
      <AppSnackbar state={toast} onClose={() => setToast(null)} />
    </div>
  );
}

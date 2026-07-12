import { useEffect, useState } from 'react';
import { Alert, Button, Checkbox, FormControlLabel, IconButton, Switch, TextField, Tooltip } from '@mui/material';
import { AddRounded, EditRounded, PaymentsRounded, SaveRounded } from '@mui/icons-material';
import { api } from '../services/apiClient.js';
import { PageHeader } from '../components/PageHeader.jsx';
import { EntityDrawer } from '../components/EntityDrawer.jsx';
import { Field } from '../components/forms/Field.jsx';
import { FieldGrid } from '../components/forms/FieldGrid.jsx';
import { LoadingState } from '../components/LoadingState.jsx';
import { AppSnackbar } from '../components/AppSnackbar.jsx';
import '../styles/Payments.css';

const emptyForm = { code: '', name_ar: '', is_active: true, accepts_cash_received: false, sort_order: 100 };

export default function Payments() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [toast, setToast] = useState(null);
  const [drawer, setDrawer] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);

  const load = async () => {
    setLoading(true);
    try { setRows((await api.get('/api/payment-methods')).data || []); setError(''); }
    catch (loadError) { setError(loadError.message); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const saveActive = async () => {
    setSaving(true);
    try {
      await api.post('/api/payment-methods/admin', { active_ids: rows.filter((row) => row.is_active).map((row) => row.code) });
      setToast({ message: 'تم تحديث طرق الدفع النشطة.' });
      await load();
    } catch (saveError) { setToast({ severity: 'error', message: saveError.message }); }
    finally { setSaving(false); }
  };

  const edit = (row) => {
    setEditing(row);
    setForm({
      code: row.code, name_ar: row.name_ar, is_active: Boolean(row.is_active),
      accepts_cash_received: Boolean(row.accepts_cash_received), sort_order: row.sort_order
    });
    setDrawer(true);
  };

  const saveMethod = async () => {
    setSaving(true);
    try {
      if (editing) await api.patch(`/api/payment-methods/admin/methods/${editing.id}`, form);
      else await api.post('/api/payment-methods/admin/methods', form);
      setToast({ message: editing ? 'تم تحديث طريقة الدفع.' : 'تم إنشاء طريقة الدفع.' });
      setDrawer(false);
      await load();
    } catch (saveError) { setToast({ severity: 'error', message: saveError.message }); }
    finally { setSaving(false); }
  };

  return (
    <div className="a4-page">
      <PageHeader title="طرق الدفع" description="إدارة الطرق النشطة وتحديد الطرق التي تقبل قيمة النقد المستلم وحساب الباقي." actions={<><Button variant="outlined" startIcon={<AddRounded />} onClick={() => { setEditing(null); setForm(emptyForm); setDrawer(true); }}>طريقة جديدة</Button><Button variant="contained" startIcon={<SaveRounded />} onClick={saveActive} disabled={saving}>حفظ التفعيل</Button></>} />
      {error && <Alert severity="error">{error}</Alert>}
      <section className="a4-page-section">{loading ? <LoadingState /> : <div className="a4-grid a4-grid--three">{rows.map((row, index) => <div className="metric-card" key={row.id}><div className="metric-card__icon"><PaymentsRounded /></div><div className="metric-card__copy metric-card__copy--fill"><strong>{row.name_ar}</strong><span className="metric-card__hint">{row.code} · {row.accepts_cash_received ? 'يحسب النقد والباقي' : 'مرجع اختياري'}</span></div><Checkbox checked={Boolean(row.is_active)} onChange={(event) => setRows((list) => list.map((item, itemIndex) => itemIndex === index ? { ...item, is_active: event.target.checked ? 1 : 0 } : item))} /><Tooltip title="تعديل"><IconButton size="small" onClick={() => edit(row)}><EditRounded fontSize="small" /></IconButton></Tooltip></div>)}</div>}</section>

      <EntityDrawer open={drawer} title={editing ? 'تعديل طريقة الدفع' : 'طريقة دفع جديدة'} onClose={() => setDrawer(false)} onSubmit={saveMethod} loading={saving}><FieldGrid>
        <Field label="الكود" required ltr><TextField value={form.code} disabled={Boolean(editing)} onChange={(event) => setForm((value) => ({ ...value, code: event.target.value }))} /></Field>
        <Field label="الاسم العربي" required><TextField value={form.name_ar} onChange={(event) => setForm((value) => ({ ...value, name_ar: event.target.value }))} /></Field>
        <Field label="ترتيب العرض"><TextField type="number" value={form.sort_order} onChange={(event) => setForm((value) => ({ ...value, sort_order: Number(event.target.value) }))} /></Field>
        <Field className="full" label="الخصائص"><div className="a4-actions"><FormControlLabel control={<Switch checked={form.is_active} onChange={(event) => setForm((value) => ({ ...value, is_active: event.target.checked }))} />} label="نشطة" /><FormControlLabel control={<Switch checked={form.accepts_cash_received} onChange={(event) => setForm((value) => ({ ...value, accepts_cash_received: event.target.checked }))} />} label="تقبل النقد المستلم وتحسب الباقي" /></div></Field>
      </FieldGrid></EntityDrawer>
      <AppSnackbar state={toast} onClose={() => setToast(null)} />
    </div>
  );
}

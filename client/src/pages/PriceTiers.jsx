import { useEffect, useState } from 'react';
import { Alert, Button, IconButton, Switch, TextField } from '@mui/material';
import { AddRounded, EditRounded, RefreshRounded } from '@mui/icons-material';
import { api } from '../services/apiClient.js';
import { PageHeader } from '../components/PageHeader.jsx';
import { DataTable } from '../components/DataTable.jsx';
import { EntityDrawer } from '../components/EntityDrawer.jsx';
import { Field } from '../components/forms/Field.jsx';
import { FieldGrid } from '../components/forms/FieldGrid.jsx';
import { LoadingState } from '../components/LoadingState.jsx';
import { AppSnackbar } from '../components/AppSnackbar.jsx';
import { StatusChip } from '../components/StatusChip.jsx';
import '../styles/PriceTiers.css';

export default function PriceTiers() {
  const [rows, setRows] = useState([]); const [loading, setLoading] = useState(true); const [error, setError] = useState(''); const [drawer, setDrawer] = useState(false); const [editing, setEditing] = useState(null); const [form, setForm] = useState({ name: '', description: '', is_active: 1 }); const [saving, setSaving] = useState(false); const [toast, setToast] = useState(null);
  const load = async () => { setLoading(true); try { setRows((await api.get('/api/admin/price-tiers?activeOnly=false')).data || []); setError(''); } catch (e) { setError(e.message); } finally { setLoading(false); } };
  useEffect(() => { load(); }, []);
  const open = (row = null) => { setEditing(row); setForm(row ? { name: row.name, description: row.description || '', is_active: row.is_active } : { name: '', description: '', is_active: 1 }); setDrawer(true); };
  const save = async () => { if (!form.name.trim()) return setToast({ severity: 'error', message: 'اسم فئة السعر مطلوب.' }); setSaving(true); try { if (editing) await api.patch(`/api/admin/price-tiers/${editing.id}`, form); else await api.post('/api/admin/price-tiers', form); setToast({ message: 'تم حفظ فئة السعر بنجاح.' }); setDrawer(false); await load(); } catch (e) { setToast({ severity: 'error', message: e.message }); } finally { setSaving(false); } };
  const columns = [{ key: 'name', label: 'اسم الفئة' }, { key: 'description', label: 'الوصف', render: r => r.description || '—' }, { key: 'status', label: 'الحالة', render: r => <StatusChip status={r.is_active ? 'active' : 'inactive'} label={r.is_active ? 'نشط' : 'غير نشط'}/> }, { key: 'actions', label: 'الإجراءات', render: r => <IconButton size="small" onClick={() => open(r)}><EditRounded fontSize="small"/></IconButton> }];
  return <div className="a4-page"><PageHeader title="فئات الأسعار" description="أضف فئات مثل القطاعي والجملة والمدرسين ثم اربط سعر كل فئة بالمنتج." actions={<><Button variant="outlined" startIcon={<RefreshRounded/>} onClick={load}>تحديث</Button><Button variant="contained" startIcon={<AddRounded/>} onClick={() => open()}>فئة جديدة</Button></>}/>{error && <Alert severity="error">{error}</Alert>}<section className="a4-page-section">{loading ? <LoadingState/> : <DataTable columns={columns} rows={rows} mobilePrimary={r => r.name}/>}</section><EntityDrawer open={drawer} title={editing ? 'تعديل فئة السعر' : 'إضافة فئة سعر'} onClose={() => setDrawer(false)} onSubmit={save} loading={saving}><FieldGrid columns={1}><Field label="اسم الفئة" required><TextField value={form.name} onChange={e => setForm(v => ({ ...v, name: e.target.value }))} placeholder="مثال: سعر الجملة"/></Field><Field label="الوصف"><TextField multiline minRows={3} value={form.description} onChange={e => setForm(v => ({ ...v, description: e.target.value }))}/></Field><Field label="حالة الفئة"><div className="a4-toolbar"><span className="a4-muted">إتاحتها عند تسعير المنتجات</span><Switch checked={Boolean(form.is_active)} onChange={e => setForm(v => ({ ...v, is_active: e.target.checked ? 1 : 0 }))}/></div></Field></FieldGrid></EntityDrawer><AppSnackbar state={toast} onClose={() => setToast(null)}/></div>;
}

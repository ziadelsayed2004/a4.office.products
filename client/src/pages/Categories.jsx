import { useEffect, useState } from 'react';
import { Alert, Button, IconButton, Switch, TextField, Tooltip } from '@mui/material';
import { AddRounded, EditRounded, RefreshRounded } from '@mui/icons-material';
import { api } from '../api/client.js';
import { PageHeader } from '../components/navigation/PageHeader.jsx';
import { DataTable } from '../components/data/DataTable.jsx';
import { EntityDrawer } from '../components/forms/EntityDrawer.jsx';
import { Field } from '../components/forms/Field.jsx';
import { LoadingState } from '../components/feedback/LoadingState.jsx';
import { AppSnackbar } from '../components/feedback/AppSnackbar.jsx';
import { StatusChip } from '../components/data/StatusChip.jsx';

export default function Categories() {
  const [rows, setRows] = useState([]); const [loading, setLoading] = useState(true); const [error, setError] = useState(''); const [drawer, setDrawer] = useState(false); const [editing, setEditing] = useState(null); const [form, setForm] = useState({ name: '', is_active: 1 }); const [saving, setSaving] = useState(false); const [toast, setToast] = useState(null);
  const load = async () => { setLoading(true); setError(''); try { setRows((await api.get('/api/categories?activeOnly=false')).data || []); } catch (e) { setError(e.message); } finally { setLoading(false); } };
  useEffect(() => { load(); }, []);
  const open = (row = null) => { setEditing(row); setForm(row ? { name: row.name, is_active: row.is_active } : { name: '', is_active: 1 }); setDrawer(true); };
  const save = async () => { if (!form.name.trim()) return setToast({ severity: 'error', message: 'اسم التصنيف مطلوب.' }); setSaving(true); try { if (editing) await api.patch(`/api/admin/categories/${editing.id}`, form); else await api.post('/api/admin/categories', form); setToast({ message: editing ? 'تم تحديث التصنيف.' : 'تم إنشاء التصنيف.' }); setDrawer(false); await load(); } catch (e) { setToast({ severity: 'error', message: e.message }); } finally { setSaving(false); } };
  const columns = [{ key: 'name', label: 'اسم التصنيف' }, { key: 'status', label: 'الحالة', render: r => <StatusChip status={r.is_active ? 'active' : 'inactive'} label={r.is_active ? 'نشط' : 'غير نشط'}/> }, { key: 'actions', label: 'الإجراءات', width: 90, render: r => <div className="table-actions"><Tooltip title="تعديل"><IconButton size="small" onClick={() => open(r)}><EditRounded fontSize="small"/></IconButton></Tooltip></div> }];
  return <div className="a4-page"><PageHeader title="التصنيفات" description="أنشئ تصنيفات واضحة لتسهيل البحث والتقارير وإدارة المنتجات." actions={<><Button variant="outlined" startIcon={<RefreshRounded/>} onClick={load}>تحديث</Button><Button variant="contained" startIcon={<AddRounded/>} onClick={() => open()}>تصنيف جديد</Button></>}/>{error && <Alert severity="error">{error}</Alert>}<section className="a4-page-section">{loading ? <LoadingState/> : <DataTable columns={columns} rows={rows} mobilePrimary={r => r.name}/>}</section><EntityDrawer open={drawer} title={editing ? 'تعديل التصنيف' : 'إضافة تصنيف'} subtitle="اكتب اسماً واضحاً يظهر في المنتجات والفلاتر." onClose={() => setDrawer(false)} onSubmit={save} loading={saving}><div className="a4-form-grid"><Field className="full" label="اسم التصنيف" required><TextField value={form.name} onChange={e => setForm(v => ({ ...v, name: e.target.value }))} placeholder="مثال: كتب خارجية"/></Field><Field className="full" label="حالة التصنيف"><div className="a4-toolbar"><span className="a4-muted">إظهار التصنيف داخل النظام</span><Switch checked={Boolean(form.is_active)} onChange={e => setForm(v => ({ ...v, is_active: e.target.checked ? 1 : 0 }))}/></div></Field></div></EntityDrawer><AppSnackbar state={toast} onClose={() => setToast(null)}/></div>;
}

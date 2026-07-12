import { useEffect, useState } from 'react';
import { Alert, Button, TextField } from '@mui/material';
import { AddRounded, SearchRounded } from '@mui/icons-material';
import { api } from '../api/client.js';
import { PageHeader } from '../components/navigation/PageHeader.jsx';
import { DataTable } from '../components/data/DataTable.jsx';
import { EntityDrawer } from '../components/forms/EntityDrawer.jsx';
import { Field } from '../components/forms/Field.jsx';
import { LoadingState } from '../components/feedback/LoadingState.jsx';
import { AppSnackbar } from '../components/feedback/AppSnackbar.jsx';
import { dateTime } from '../utils/formatters.js';

export default function Customers() {
  const [rows, setRows] = useState([]); const [q, setQ] = useState(''); const [loading, setLoading] = useState(true); const [error, setError] = useState(''); const [drawer, setDrawer] = useState(false); const [form, setForm] = useState({ name: '', phone: '' }); const [saving, setSaving] = useState(false); const [toast, setToast] = useState(null);
  const load = async (query = q) => { setLoading(true); try { setRows((await api.get(`/api/customers?q=${encodeURIComponent(query || '')}`)).data || []); setError(''); } catch (e) { setError(e.message); } finally { setLoading(false); } };
  useEffect(() => { load(''); }, []);
  const save = async () => { if (!form.name.trim() || !form.phone.trim()) return setToast({ severity: 'error', message: 'الاسم ورقم الهاتف مطلوبان.' }); setSaving(true); try { await api.post('/api/customers', form); setToast({ message: 'تم تسجيل العميل.' }); setDrawer(false); setForm({ name: '', phone: '' }); await load(''); } catch (e) { setToast({ severity: 'error', message: e.message }); } finally { setSaving(false); } };
  const columns = [{ key: 'name', label: 'اسم العميل' }, { key: 'phone', label: 'رقم الهاتف', render: r => <span className="a4-ltr">{r.phone}</span> }, { key: 'created_at', label: 'تاريخ التسجيل', render: r => dateTime(r.created_at) }];
  return <div className="a4-page"><PageHeader title="العملاء" description="سجل عملاء الحجوزات وابحث عنهم بالاسم أو رقم الهاتف." actions={<Button variant="contained" startIcon={<AddRounded/>} onClick={() => setDrawer(true)}>عميل جديد</Button>}/><section className="a4-page-section"><div className="a4-toolbar a4-toolbar--section"><TextField label="البحث عن عميل" size="small" value={q} onChange={e => setQ(e.target.value)} onKeyDown={e => e.key === 'Enter' && load()} placeholder="ابحث بالاسم أو رقم الهاتف" sx={{ width: { xs: '100%', sm: 360 } }}/><Button variant="outlined" startIcon={<SearchRounded/>} onClick={() => load()}>بحث</Button></div>{error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}{loading ? <LoadingState/> : <DataTable columns={columns} rows={rows} mobilePrimary={r => r.name}/>}</section><EntityDrawer open={drawer} title="إضافة عميل" subtitle="تستخدم هذه البيانات في الحجز المسبق والاستلام." onClose={() => setDrawer(false)} onSubmit={save} loading={saving}><div className="a4-form-grid"><Field className="full" label="اسم العميل" required><TextField value={form.name} onChange={e => setForm(v => ({ ...v, name: e.target.value }))}/></Field><Field className="full" label="رقم الهاتف" required><TextField className="a4-ltr" value={form.phone} onChange={e => setForm(v => ({ ...v, phone: e.target.value }))} slotProps={{ htmlInput: { dir: 'ltr' } }}/></Field></div></EntityDrawer><AppSnackbar state={toast} onClose={() => setToast(null)}/></div>;
}

import { useEffect, useMemo, useState } from 'react';
import { Alert, Button, MenuItem, TextField } from '@mui/material';
import { AddBoxRounded, RefreshRounded } from '@mui/icons-material';
import { api } from '../services/apiClient.js';
import { PageHeader } from '../components/PageHeader.jsx';
import { DataTable } from '../components/DataTable.jsx';
import { FilterPanel } from '../components/FilterPanel.jsx';
import { EntityDrawer } from '../components/EntityDrawer.jsx';
import { Field } from '../components/forms/Field.jsx';
import { FieldGrid } from '../components/forms/FieldGrid.jsx';
import { LoadingState } from '../components/LoadingState.jsx';
import { AppSnackbar } from '../components/AppSnackbar.jsx';
import { dateTime, number } from '../utils/formatters.js';
import '../styles/Inventory.css';

const txLabels = { INITIAL: 'رصيد افتتاحي', ADD: 'إضافة', REMOVE: 'خصم', SALE: 'بيع', PREORDER_PICKUP: 'استلام حجز', RETURN: 'مرتجع', DAMAGE: 'تالف', ADJUSTMENT: 'تسوية' };
export default function Inventory() {
  const [rows, setRows] = useState([]); const [products, setProducts] = useState([]); const [loading, setLoading] = useState(true); const [error, setError] = useState(''); const [filters, setFilters] = useState({ productId: '', transactionType: '', startDate: '', endDate: '' }); const [drawer, setDrawer] = useState(false); const [form, setForm] = useState({ product_id: '', adjustment_type: 'ADD', quantity: 1, notes: '' }); const [saving, setSaving] = useState(false); const [toast, setToast] = useState(null);
  const loadProducts = async () => { try { setProducts((await api.get('/api/products?activeOnly=false')).data || []); } catch { /* page error covers ledger */ } };
  const load = async () => { setLoading(true); try { const q = new URLSearchParams(Object.entries(filters).filter(([,v]) => v)); const response = await api.get(`/api/admin/inventory?${q}`); setRows(Array.isArray(response.data) ? response.data : response.data?.rows || response.data?.ledger || []); setError(''); } catch (e) { setError(e.message); } finally { setLoading(false); } };
  useEffect(() => { loadProducts(); load(); }, []);
  const reset = () => { setFilters({ productId: '', transactionType: '', startDate: '', endDate: '' }); setTimeout(load, 0); };
  const save = async () => { if (!form.product_id || !Number(form.quantity)) return setToast({ severity: 'error', message: 'اختر المنتج وأدخل كمية صحيحة.' }); setSaving(true); try { await api.post('/api/admin/inventory/adjust', { ...form, product_id: Number(form.product_id), quantity: Number(form.quantity) }); setToast({ message: 'تمت تسوية المخزون بنجاح.' }); setDrawer(false); setForm({ product_id: '', adjustment_type: 'ADD', quantity: 1, notes: '' }); await Promise.all([load(), loadProducts()]); } catch (e) { setToast({ severity: 'error', message: e.message }); } finally { setSaving(false); } };
  const columns = useMemo(() => [
    { key: 'created_at', label: 'التاريخ', render: r => dateTime(r.created_at) },
    { key: 'product_name', label: 'المنتج', render: r => r.product_name || products.find(p => p.id === r.product_id)?.name || `#${r.product_id}` },
    { key: 'transaction_type', label: 'نوع الحركة', render: r => txLabels[r.transaction_type] || r.transaction_type },
    { key: 'quantity', label: 'الكمية', render: r => <strong>{r.quantity > 0 ? '+' : ''}{number(r.quantity)}</strong> },
    { key: 'before_quantity', label: 'قبل', render: r => number(r.before_quantity) },
    { key: 'after_quantity', label: 'بعد', render: r => number(r.after_quantity) },
    { key: 'user_name', label: 'المستخدم', render: r => r.user_name || r.username || '—' },
    { key: 'notes', label: 'ملاحظات', render: r => r.notes || '—' }
  ], [products]);
  return <div className="a4-page"><PageHeader title="المخزون" description="دفتر كامل لكل حركة مخزون مع منع الرصيد السالب وربط الحركة بالمستخدم." actions={<><Button variant="outlined" startIcon={<RefreshRounded/>} onClick={load}>تحديث</Button><Button variant="contained" startIcon={<AddBoxRounded/>} onClick={() => setDrawer(true)}>تسوية مخزون</Button></>}/><FilterPanel resultCount={rows.length} onApply={load} onReset={reset}><Field label="المنتج"><TextField select value={filters.productId} onChange={e => setFilters(v => ({ ...v, productId: e.target.value }))}><MenuItem value="">الكل</MenuItem>{products.map(p => <MenuItem key={p.id} value={p.id}>{p.name}</MenuItem>)}</TextField></Field><Field label="نوع الحركة"><TextField select value={filters.transactionType} onChange={e => setFilters(v => ({ ...v, transactionType: e.target.value }))}><MenuItem value="">الكل</MenuItem>{Object.entries(txLabels).map(([k,v]) => <MenuItem key={k} value={k}>{v}</MenuItem>)}</TextField></Field><Field label="من تاريخ"><TextField type="date" value={filters.startDate} onChange={e => setFilters(v => ({ ...v, startDate: e.target.value }))}/></Field><Field label="إلى تاريخ"><TextField type="date" value={filters.endDate} onChange={e => setFilters(v => ({ ...v, endDate: e.target.value }))}/></Field></FilterPanel>{error && <Alert severity="error">{error}</Alert>}<section className="a4-page-section">{loading ? <LoadingState/> : <DataTable columns={columns} rows={rows} mobilePrimary={r => r.product_name || `منتج #${r.product_id}`}/>}</section><EntityDrawer open={drawer} title="تسوية المخزون" subtitle="تسجل كل تسوية في دفتر المخزون وسجل العمليات." onClose={() => setDrawer(false)} onSubmit={save} loading={saving}><FieldGrid><Field className="form-grid__span-full" label="المنتج" required><TextField select value={form.product_id} onChange={e => setForm(v => ({ ...v, product_id: e.target.value }))}><MenuItem value="">اختر المنتج</MenuItem>{products.map(p => <MenuItem key={p.id} value={p.id}>{p.name} — المتاح {number(p.stock)}</MenuItem>)}</TextField></Field><Field label="نوع التسوية" required><TextField select value={form.adjustment_type} onChange={e => setForm(v => ({ ...v, adjustment_type: e.target.value }))}><MenuItem value="ADD">إضافة كمية</MenuItem><MenuItem value="REMOVE">خصم كمية</MenuItem><MenuItem value="DAMAGE">تسجيل تالف</MenuItem></TextField></Field><Field label="الكمية" required><TextField type="number" slotProps={{ htmlInput: { min: 1 } }} value={form.quantity} onChange={e => setForm(v => ({ ...v, quantity: e.target.value }))}/></Field><Field className="form-grid__span-full" label="سبب التسوية" required><TextField multiline minRows={3} value={form.notes} onChange={e => setForm(v => ({ ...v, notes: e.target.value }))} placeholder="اكتب سبباً واضحاً للتسوية"/></Field></FieldGrid></EntityDrawer><AppSnackbar state={toast} onClose={() => setToast(null)}/></div>;
}

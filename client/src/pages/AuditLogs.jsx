import { useEffect, useState } from 'react';
import { Alert, Button, TextField } from '@mui/material';
import { RefreshRounded } from '@mui/icons-material';
import { api } from '../api/client.js';
import { PageHeader } from '../components/navigation/PageHeader.jsx';
import { DataTable } from '../components/data/DataTable.jsx';
import { FilterPanel } from '../components/forms/FilterPanel.jsx';
import { Field } from '../components/forms/Field.jsx';
import { LoadingState } from '../components/feedback/LoadingState.jsx';
import { dateTime } from '../utils/formatters.js';

export default function AuditLogs() {
  const [rows, setRows] = useState([]); const [total, setTotal] = useState(0); const [loading, setLoading] = useState(true); const [error, setError] = useState(''); const [filters, setFilters] = useState({ actionType: '', entityType: '', startDate: '', endDate: '' });
  const load = async () => { setLoading(true); try { const q = new URLSearchParams(Object.entries(filters).filter(([,v]) => v)); const data = (await api.get(`/api/admin/audit-logs?${q}`)).data; setRows(data.logs || []); setTotal(data.pagination?.total || 0); setError(''); } catch (e) { setError(e.message); } finally { setLoading(false); } };
  useEffect(() => { load(); }, []);
  const reset = () => { setFilters({ actionType: '', entityType: '', startDate: '', endDate: '' }); setTimeout(load, 0); };
  const columns = [{ key: 'created_at', label: 'التاريخ والوقت', render: r => dateTime(r.created_at) }, { key: 'user_name', label: 'المستخدم', render: r => r.user_name || r.username || `#${r.user_id}` }, { key: 'action_type', label: 'نوع العملية' }, { key: 'entity_type', label: 'الكيان' }, { key: 'entity_id', label: 'رقم السجل' }, { key: 'notes', label: 'التفاصيل', render: r => <span className="a4-wrap-cell">{r.notes || '—'}</span> }];
  return <div className="a4-page"><PageHeader title="سجل العمليات" description="سجل غير قابل للحذف لكل العمليات الحساسة المالية والإدارية." actions={<Button variant="outlined" startIcon={<RefreshRounded/>} onClick={load}>تحديث</Button>}/><FilterPanel resultCount={total} onApply={load} onReset={reset}><Field label="نوع العملية"><TextField value={filters.actionType} onChange={e => setFilters(v => ({ ...v, actionType: e.target.value }))} placeholder="مثال: PRODUCT_UPDATE"/></Field><Field label="نوع الكيان"><TextField value={filters.entityType} onChange={e => setFilters(v => ({ ...v, entityType: e.target.value }))} placeholder="مثال: products"/></Field><Field label="من تاريخ"><TextField type="date" value={filters.startDate} onChange={e => setFilters(v => ({ ...v, startDate: e.target.value }))}/></Field><Field label="إلى تاريخ"><TextField type="date" value={filters.endDate} onChange={e => setFilters(v => ({ ...v, endDate: e.target.value }))}/></Field></FilterPanel>{error && <Alert severity="error">{error}</Alert>}<section className="a4-page-section">{loading ? <LoadingState/> : <DataTable columns={columns} rows={rows} mobilePrimary={r => r.action_type}/>}</section></div>;
}

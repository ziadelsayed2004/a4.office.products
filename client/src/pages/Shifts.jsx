import { useEffect, useState } from 'react';
import {
  Alert, Button, Dialog, DialogActions, DialogContent, DialogTitle,
  IconButton, MenuItem, TextField, Tooltip
} from '@mui/material';
import { CheckRounded, CloseRounded, RefreshRounded, VisibilityRounded } from '@mui/icons-material';
import { api } from '../services/apiClient.js';
import { PageHeader } from '../components/PageHeader.jsx';
import { DataTable } from '../components/DataTable.jsx';
import { FilterPanel } from '../components/FilterPanel.jsx';
import { StatusChip } from '../components/StatusChip.jsx';
import { Field } from '../components/forms/Field.jsx';
import { LoadingState } from '../components/LoadingState.jsx';
import { AppSnackbar } from '../components/AppSnackbar.jsx';
import { dateTime, money, number } from '../utils/formatters.js';
import '../styles/Shifts.css';

export default function Shifts() {
  const [rows, setRows] = useState([]);
  const [filters, setFilters] = useState({ status: '', cashierId: '' });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState(null);
  const [detail, setDetail] = useState(null);
  const [action, setAction] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const query = new URLSearchParams();
      if (filters.status) query.set('status', filters.status);
      if (filters.cashierId) query.set('cashierId', filters.cashierId);
      setRows((await api.get(`/api/shifts/all?${query}`)).data || []);
      setError('');
    } catch (loadError) { setError(loadError.message); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const openDetail = async (row) => {
    setSaving(true);
    try { setDetail((await api.get(`/api/shifts/${row.id}`)).data); }
    catch (loadError) { setToast({ severity: 'error', message: loadError.message }); }
    finally { setSaving(false); }
  };

  const review = (row, nextAction) => {
    setSelected(row);
    setAction(nextAction);
    setNotes('');
  };

  const submit = async () => {
    setSaving(true);
    try {
      await api.post(`/api/shifts/${selected.id}/${action}`, { adminNotes: notes.trim() || null });
      setToast({ message: action === 'approve' ? 'تم اعتماد لقطة الإغلاق.' : 'تم رفض المراجعة وعاد نفس الشيفت إلى مفتوح.' });
      setSelected(null);
      setAction('');
      await load();
    } catch (saveError) { setToast({ severity: 'error', message: saveError.message }); }
    finally { setSaving(false); }
  };

  const columns = [
    { key: 'id', label: 'رقم الشيفت', render: (row) => `#${row.id}` },
    { key: 'cashier_name', label: 'الكاشير' },
    { key: 'opened_at', label: 'وقت الفتح', render: (row) => dateTime(row.opened_at) },
    { key: 'closed_at', label: 'طلب الإغلاق', render: (row) => dateTime(row.closed_at) },
    { key: 'opening_cash', label: 'عهدة البداية', render: (row) => money(row.opening_cash) },
    { key: 'system_total_cash', label: 'الكاش المتوقع', render: (row) => money(row.system_total_cash) },
    { key: 'cashier_declared_cash', label: 'الكاش الفعلي', render: (row) => money(row.cashier_declared_cash) },
    { key: 'status', label: 'الحالة', render: (row) => <StatusChip status={row.status} /> },
    { key: 'actions', label: 'الإجراءات', render: (row) => <div className="table-actions"><Tooltip title="التفاصيل والمراجعات"><IconButton size="small" onClick={() => openDetail(row)}><VisibilityRounded fontSize="small" /></IconButton></Tooltip>{row.status === 'PENDING_ADMIN_REVIEW' && <><Tooltip title="اعتماد"><IconButton color="success" size="small" onClick={() => review(row, 'approve')}><CheckRounded fontSize="small" /></IconButton></Tooltip><Tooltip title="رفض وإعادة الفتح"><IconButton color="error" size="small" onClick={() => review(row, 'reject')}><CloseRounded fontSize="small" /></IconButton></Tooltip></>}</div> }
  ];

  return (
    <div className="a4-page">
      <PageHeader title="مراجعة الشيفتات" description="كل طلب تقفيل مراجعة مستقلة؛ الرفض يعيد نفس الشيفت إلى مفتوح." actions={<Button variant="outlined" startIcon={<RefreshRounded />} onClick={load}>تحديث</Button>} />
      <FilterPanel resultCount={rows.length} onApply={load} onReset={() => { setFilters({ status: '', cashierId: '' }); setTimeout(load, 0); }}>
        <Field label="الحالة"><TextField select value={filters.status} onChange={(event) => setFilters((value) => ({ ...value, status: event.target.value }))}><MenuItem value="">الكل</MenuItem><MenuItem value="OPEN">مفتوح</MenuItem><MenuItem value="PENDING_ADMIN_REVIEW">قيد المراجعة</MenuItem><MenuItem value="CLOSED">مغلق</MenuItem></TextField></Field>
        <Field label="رقم الكاشير"><TextField type="number" value={filters.cashierId} onChange={(event) => setFilters((value) => ({ ...value, cashierId: event.target.value }))} /></Field>
      </FilterPanel>
      {error && <Alert severity="error">{error}</Alert>}
      <section className="a4-page-section">{loading ? <LoadingState /> : <DataTable columns={columns} rows={rows} mobilePrimary={(row) => `شيفت #${row.id}`} />}</section>

      <Dialog open={Boolean(selected)} onClose={() => !saving && setSelected(null)} fullWidth maxWidth="sm"><DialogTitle>{action === 'approve' ? 'اعتماد تقفيل الشيفت' : 'رفض التقفيل وإعادة الشيفت'} #{selected?.id}</DialogTitle><DialogContent dividers>{selected && <><div className="a4-grid a4-grid--two a4-grid--section-gap"><div className="metric-card"><div className="metric-card__copy"><span className="metric-card__label">المتوقع</span><strong>{money(selected.system_total_cash)}</strong></div></div><div className="metric-card"><div className="metric-card__copy"><span className="metric-card__label">الفعلي</span><strong>{money(selected.cashier_declared_cash)}</strong></div></div></div><Field label="ملاحظات الإدارة" required={action === 'reject'}><TextField multiline minRows={4} value={notes} onChange={(event) => setNotes(event.target.value)} /></Field></>}</DialogContent><DialogActions><Button onClick={() => setSelected(null)}>إلغاء</Button><Button variant="contained" color={action === 'reject' ? 'error' : 'success'} onClick={submit} disabled={saving || action === 'reject' && !notes.trim()}>{action === 'approve' ? 'اعتماد' : 'رفض وإعادة الفتح'}</Button></DialogActions></Dialog>

      <Dialog open={Boolean(detail)} onClose={() => setDetail(null)} fullWidth maxWidth="md"><DialogTitle>تفاصيل الشيفت #{detail?.shift?.id}</DialogTitle><DialogContent dividers>{detail && <><div className="a4-grid a4-grid--three">{Object.entries(detail.systemTotals.methods || {}).map(([code, amount]) => <div className="metric-card" key={code}><div className="metric-card__copy"><span className="metric-card__label">{code}</span><strong>{money(amount)}</strong></div></div>)}</div><h3>مراجعات التقفيل</h3>{detail.closeRevisions.length ? detail.closeRevisions.map((revision) => <section className="a4-page-section" key={revision.id}><div className="a4-actions"><strong>المراجعة #{number(revision.revision_number)}</strong><StatusChip status={revision.status} /></div><p>{dateTime(revision.submitted_at)} · {revision.cashier_note || 'بدون ملاحظة'}</p><div className="a4-grid a4-grid--three">{Object.keys(revision.systemTotals.methods || {}).map((code) => <div key={code}><strong>{code}</strong><p>النظام {money(revision.systemTotals.methods[code])}</p><p>الفعلي {money(revision.declaredTotals[code])}</p><p>الفرق {money(revision.variances[code])}</p></div>)}</div>{revision.admin_reason && <Alert severity={revision.status === 'REJECTED' ? 'warning' : 'info'}>{revision.admin_reason}</Alert>}</section>) : <Alert severity="info">لا توجد مراجعات تقفيل.</Alert>}</>}</DialogContent><DialogActions><Button onClick={() => setDetail(null)}>إغلاق</Button></Dialog>
      <AppSnackbar state={toast} onClose={() => setToast(null)} />
    </div>
  );
}

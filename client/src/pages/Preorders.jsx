import { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  MenuItem,
  Pagination,
  TextField,
  Tooltip,
} from '@mui/material';
import { EditRounded, RefreshRounded, VisibilityRounded } from '@mui/icons-material';
import { useAuth } from '../app/AuthContext.jsx';
import { api } from '../services/apiClient.js';
import { PageHeader } from '../components/PageHeader.jsx';
import { DataTable } from '../components/DataTable.jsx';
import { FilterPanel } from '../components/FilterPanel.jsx';
import { Field } from '../components/forms/Field.jsx';
import { StatusChip } from '../components/StatusChip.jsx';
import { LoadingState } from '../components/LoadingState.jsx';
import { AppSnackbar } from '../components/AppSnackbar.jsx';
import { PreorderDetails } from '../components/PreorderDetails.jsx';
import { dateTime, money, statusLabel } from '../utils/formatters.js';
import { normalizeCustomerPhone } from '../utils/customerPhone.js';
import '../styles/Preorders.css';

const statuses = [
  'DEPOSIT_PAID_WAITING_STOCK',
  'READY_FOR_PICKUP',
  'PICKED_UP',
  'CANCELLED',
  'EXPIRED',
];
const allowedTransitions = {
  DEPOSIT_PAID_WAITING_STOCK: ['READY_FOR_PICKUP', 'CANCELLED', 'EXPIRED'],
  READY_FOR_PICKUP: ['CANCELLED', 'EXPIRED'],
};
const INITIAL_FILTERS = Object.freeze({ q: '', status: '' });
const PAGE_SIZE = 25;
export default function Preorders() {
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filters, setFilters] = useState(INITIAL_FILTERS);
  const [selected, setSelected] = useState(null);
  const [statusOpen, setStatusOpen] = useState(false);
  const [nextStatus, setNextStatus] = useState('');
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);
  const { isAdmin } = useAuth();
  const loadSequence = useRef(0);
  const load = async (nextFilters = filters, nextPage = 1) => {
    const requestId = ++loadSequence.current;
    setLoading(true);
    const lookupValue = String(nextFilters.q || '').trim();
    const normalizedPhone = normalizeCustomerPhone(lookupValue);
    if (/^\d+$/.test(normalizedPhone) && normalizedPhone.length > 0 && normalizedPhone.length < 6) {
      setRows([]);
      setTotal(0);
      setError('اكتب 6 أرقام على الأقل من رقم الهاتف.');
      setLoading(false);
      return;
    }
    try {
      const q = new URLSearchParams(
        Object.entries({
          ...nextFilters,
          limit: PAGE_SIZE,
          offset: (nextPage - 1) * PAGE_SIZE,
        }).filter(([, v]) => v !== '' && v !== null && v !== undefined)
      );
      const endpoint = isAdmin ? `/api/admin/preorders?${q}` : `/api/pos/preorders/search?${q}`;
      const payload = (await api.get(endpoint)).data || [];
      const nextRows = Array.isArray(payload) ? payload : payload.rows || [];
      if (requestId !== loadSequence.current) return;
      setRows(nextRows);
      setTotal(Array.isArray(payload) ? nextRows.length : Number(payload.total || nextRows.length));
      setPage(nextPage);
      setError('');
    } catch (e) {
      if (requestId === loadSequence.current) setError(e.message);
    } finally {
      if (requestId === loadSequence.current) setLoading(false);
    }
  };
  useEffect(() => {
    load(INITIAL_FILTERS, 1);
    return () => {
      loadSequence.current += 1;
    };
  }, []);
  const reset = () => {
    setFilters(INITIAL_FILTERS);
    load(INITIAL_FILTERS, 1);
  };
  const saveStatus = async () => {
    setSaving(true);
    try {
      await api.patch(`/api/admin/preorders/${selected.id}/status`, { status: nextStatus });
      setToast({ message: 'تم تحديث حالة الحجز.' });
      setStatusOpen(false);
      await load();
    } catch (e) {
      setToast({ severity: 'error', message: e.message });
    } finally {
      setSaving(false);
    }
  };
  const columns = [
    {
      key: 'preorder_number',
      label: 'رقم الحجز',
      render: (r) => <span className="a4-ltr">{r.preorder_number}</span>,
    },
    { key: 'customer_name', label: 'العميل' },
    {
      key: 'customer_phone',
      label: 'الهاتف',
      render: (r) => <span className="a4-ltr">{r.customer_phone}</span>,
    },
    { key: 'status', label: 'الحالة', render: (r) => <StatusChip status={r.status} /> },
    { key: 'deposit_paid', label: 'العربون', render: (r) => money(r.deposit_paid) },
    { key: 'remaining_amount', label: 'المتبقي', render: (r) => money(r.remaining_amount) },
    { key: 'created_at', label: 'تاريخ الحجز', render: (r) => dateTime(r.created_at) },
    {
      key: 'actions',
      label: 'الإجراءات',
      render: (r) => (
        <div className="table-actions">
          <Tooltip title="عرض التفاصيل">
            <IconButton size="small" onClick={() => setSelected(r)}>
              <VisibilityRounded fontSize="small" />
            </IconButton>
          </Tooltip>
          {isAdmin && allowedTransitions[r.status]?.length ? (
            <Tooltip title="تغيير الحالة">
              <IconButton
                size="small"
                onClick={() => {
                  setSelected(r);
                  setNextStatus(allowedTransitions[r.status][0]);
                  setStatusOpen(true);
                }}
              >
                <EditRounded fontSize="small" />
              </IconButton>
            </Tooltip>
          ) : null}
        </div>
      ),
    },
  ];
  return (
    <div className="a4-page">
      <PageHeader
        title="الحجوزات المسبقة"
        description="متابعة الحجوزات من دفع العربون حتى جاهزية المخزون والاستلام النهائي."
        actions={
          <Button variant="outlined" startIcon={<RefreshRounded />} onClick={() => load(filters)}>
            تحديث
          </Button>
        }
      />
      <FilterPanel resultCount={rows.length} onApply={() => load(filters)} onReset={reset}>
        <Field label="البحث">
          <TextField
            value={filters.q}
            onChange={(e) => setFilters((v) => ({ ...v, q: e.target.value }))}
            onKeyDown={(e) => e.key === 'Enter' && load(filters)}
            placeholder="رقم الحجز أو العميل أو الهاتف"
          />
        </Field>
        {isAdmin && (
          <Field label="الحالة">
            <TextField
              select
              value={filters.status}
              onChange={(e) => setFilters((v) => ({ ...v, status: e.target.value }))}
            >
              <MenuItem value="">الكل</MenuItem>
              {statuses.map((s) => (
                <MenuItem key={s} value={s}>
                  {statusLabel(s)}
                </MenuItem>
              ))}
            </TextField>
          </Field>
        )}
      </FilterPanel>
      {error && <Alert severity="error">{error}</Alert>}
      <section className="a4-page-section">
        {loading ? (
          <LoadingState />
        ) : (
          <DataTable columns={columns} rows={rows} mobilePrimary={(r) => r.preorder_number} />
        )}
        {!loading && total > PAGE_SIZE ? (
          <Pagination
            count={Math.ceil(total / PAGE_SIZE)}
            page={page}
            onChange={(_, nextPage) => load(filters, nextPage)}
            color="primary"
            sx={{ mt: 2, display: 'flex', justifyContent: 'center' }}
          />
        ) : null}
      </section>
      <Dialog
        open={Boolean(selected) && !statusOpen}
        onClose={() => setSelected(null)}
        fullWidth
        maxWidth="md"
      >
        <DialogTitle>تفاصيل الحجز {selected?.preorder_number}</DialogTitle>
        <DialogContent dividers>
          {selected && (
            <div className="a4-grid">
              <PreorderDetails preorder={selected} items={selected.items} />
            </div>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSelected(null)}>إغلاق</Button>
        </DialogActions>
      </Dialog>
      <Dialog open={statusOpen} onClose={() => setStatusOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>تغيير حالة الحجز</DialogTitle>
        <DialogContent>
          <Alert severity="info">
            حالة تم الاستلام لا يمكن اختيارها يدوياً؛ تُسجل فقط من مسار الاستلام والتحصيل.
          </Alert>
          <Field label="الحالة الجديدة">
            <TextField
              select
              fullWidth
              value={nextStatus}
              onChange={(e) => setNextStatus(e.target.value)}
            >
              {(allowedTransitions[selected?.status] || []).map((s) => (
                <MenuItem key={s} value={s}>
                  {statusLabel(s)}
                </MenuItem>
              ))}
            </TextField>
          </Field>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setStatusOpen(false)}>إلغاء</Button>
          <Button variant="contained" onClick={saveStatus} disabled={saving || !nextStatus}>
            {saving ? 'جاري الحفظ...' : 'حفظ الحالة'}
          </Button>
        </DialogActions>
      </Dialog>
      <AppSnackbar state={toast} onClose={() => setToast(null)} />
    </div>
  );
}

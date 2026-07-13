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
  TextField,
  Tooltip,
} from '@mui/material';
import { EditRounded, RefreshRounded, VisibilityRounded } from '@mui/icons-material';
import { api } from '../services/apiClient.js';
import { PageHeader } from '../components/PageHeader.jsx';
import { DataTable } from '../components/DataTable.jsx';
import { FilterPanel } from '../components/FilterPanel.jsx';
import { Field } from '../components/forms/Field.jsx';
import { StatusChip } from '../components/StatusChip.jsx';
import { LoadingState } from '../components/LoadingState.jsx';
import { AppSnackbar } from '../components/AppSnackbar.jsx';
import { dateTime, money, number, statusLabel } from '../utils/formatters.js';
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
export default function Preorders() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filters, setFilters] = useState(INITIAL_FILTERS);
  const [selected, setSelected] = useState(null);
  const [statusOpen, setStatusOpen] = useState(false);
  const [nextStatus, setNextStatus] = useState('');
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);
  const loadSequence = useRef(0);
  const load = async (nextFilters = filters) => {
    const requestId = ++loadSequence.current;
    setLoading(true);
    try {
      const q = new URLSearchParams(Object.entries(nextFilters).filter(([, v]) => v));
      const nextRows = (await api.get(`/api/admin/preorders?${q}`)).data || [];
      if (requestId !== loadSequence.current) return;
      setRows(nextRows);
      setError('');
    } catch (e) {
      if (requestId === loadSequence.current) setError(e.message);
    } finally {
      if (requestId === loadSequence.current) setLoading(false);
    }
  };
  useEffect(() => {
    load(INITIAL_FILTERS);
    return () => {
      loadSequence.current += 1;
    };
  }, []);
  const reset = () => {
    setFilters(INITIAL_FILTERS);
    load(INITIAL_FILTERS);
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
          {allowedTransitions[r.status]?.length ? (
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
            placeholder="رقم الحجز أو العميل أو الهاتف"
          />
        </Field>
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
      </FilterPanel>
      {error && <Alert severity="error">{error}</Alert>}
      <section className="a4-page-section">
        {loading ? (
          <LoadingState />
        ) : (
          <DataTable columns={columns} rows={rows} mobilePrimary={(r) => r.preorder_number} />
        )}
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
              <div className="a4-grid a4-grid--three">
                <div className="metric-card">
                  <div className="metric-card__copy">
                    <span className="metric-card__label">العميل</span>
                    <strong>{selected.customer_name}</strong>
                    <span className="metric-card__hint a4-ltr">{selected.customer_phone}</span>
                  </div>
                </div>
                <div className="metric-card">
                  <div className="metric-card__copy">
                    <span className="metric-card__label">الإجمالي</span>
                    <strong>{money(selected.total_amount)}</strong>
                    <span className="metric-card__hint">
                      العربون {money(selected.deposit_paid)}
                    </span>
                  </div>
                </div>
                <div className="metric-card">
                  <div className="metric-card__copy">
                    <span className="metric-card__label">الحالة</span>
                    <StatusChip status={selected.status} />
                    <span className="metric-card__hint">
                      المتبقي {money(selected.remaining_amount)}
                    </span>
                  </div>
                </div>
              </div>
              <section className="a4-page-section">
                <h3 className="a4-section-title">المنتجات</h3>
                {selected.items?.map((i) => (
                  <div className="a4-toolbar a4-list-row" key={i.id}>
                    <span>{i.product_name}</span>
                    <strong>
                      {number(i.quantity)} × {money(i.unit_price)}
                    </strong>
                  </div>
                ))}
              </section>
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

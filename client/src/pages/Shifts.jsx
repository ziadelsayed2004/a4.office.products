import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
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
import {
  CheckRounded,
  CloseRounded,
  LockRounded,
  RefreshRounded,
  VisibilityRounded,
} from '@mui/icons-material';
import { api } from '../services/apiClient.js';
import { PageHeader } from '../components/PageHeader.jsx';
import { DataTable } from '../components/DataTable.jsx';
import { FilterPanel } from '../components/FilterPanel.jsx';
import { StatusChip } from '../components/StatusChip.jsx';
import { Field } from '../components/forms/Field.jsx';
import { LoadingState } from '../components/LoadingState.jsx';
import { AppSnackbar } from '../components/AppSnackbar.jsx';
import { dateTime, money, number } from '../utils/formatters.js';
import { parsePiasters, piastersToInput } from '../utils/money.js';
import '../styles/Shifts.css';

const INITIAL_FILTERS = Object.freeze({ status: '', cashierId: '' });

export default function Shifts() {
  const [searchParams] = useSearchParams();
  const initialRequest = useRef({
    filters: {
      status: searchParams.get('status') || '',
      cashierId: searchParams.get('cashierId') || '',
    },
    shiftId: searchParams.get('shiftId') || '',
  });
  const [rows, setRows] = useState([]);
  const [filters, setFilters] = useState(initialRequest.current.filters);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState(null);
  const [detail, setDetail] = useState(null);
  const [action, setAction] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [emergency, setEmergency] = useState(null);
  const [emergencyActuals, setEmergencyActuals] = useState({});
  const [emergencyReason, setEmergencyReason] = useState('');
  const [toast, setToast] = useState(null);
  const loadSequence = useRef(0);

  const load = async (nextFilters = filters) => {
    const requestId = ++loadSequence.current;
    setLoading(true);
    try {
      const query = new URLSearchParams();
      if (nextFilters.status) query.set('status', nextFilters.status);
      if (nextFilters.cashierId) query.set('cashierId', nextFilters.cashierId);
      const nextRows = (await api.get(`/api/shifts/all?${query}`)).data || [];
      if (requestId !== loadSequence.current) return;
      setRows(nextRows);
      setError('');
    } catch (loadError) {
      if (requestId === loadSequence.current) setError(loadError.message);
    } finally {
      if (requestId === loadSequence.current) setLoading(false);
    }
  };
  useEffect(() => {
    load(initialRequest.current.filters);
    if (initialRequest.current.shiftId) {
      api
        .get(`/api/shifts/${initialRequest.current.shiftId}`)
        .then((response) => setDetail(response.data))
        .catch((loadError) => setToast({ severity: 'error', message: loadError.message }));
    }
    return () => {
      loadSequence.current += 1;
    };
  }, []);

  useEffect(() => {
    if (!detail?.shift?.id) return undefined;
    const detailId = detail.shift.id;
    const timer = window.setInterval(async () => {
      if (document.visibilityState === 'hidden') return;
      try {
        const response = await api.get(`/api/shifts/${detailId}`);
        setDetail((current) => (current?.shift?.id === detailId ? response.data : current));
      } catch {
        // The last successful snapshot stays visible during a transient polling failure.
      }
    }, 15_000);
    return () => window.clearInterval(timer);
  }, [detail?.shift?.id]);

  const openDetail = async (row) => {
    setSaving(true);
    try {
      setDetail((await api.get(`/api/shifts/${row.id}`)).data);
    } catch (loadError) {
      setToast({ severity: 'error', message: loadError.message });
    } finally {
      setSaving(false);
    }
  };

  const review = (row, nextAction) => {
    setSelected(row);
    setAction(nextAction);
    setNotes('');
  };

  const beginEmergencyClose = async (row) => {
    setSaving(true);
    try {
      const shiftDetail = (await api.get(`/api/shifts/${row.id}`)).data;
      const methods = shiftDetail.systemTotals?.methods || {};
      setEmergency(shiftDetail);
      setEmergencyActuals(
        Object.fromEntries(
          Object.entries(methods).map(([code, amount]) => [code, piastersToInput(amount)])
        )
      );
      setEmergencyReason('');
    } catch (loadError) {
      setToast({ severity: 'error', message: loadError.message });
    } finally {
      setSaving(false);
    }
  };

  const emergencyClose = async () => {
    setSaving(true);
    try {
      const methods = emergency?.systemTotals?.methods || {};
      const actuals = Object.fromEntries(
        Object.keys(methods).map((code) => [code, parsePiasters(emergencyActuals[code])])
      );
      await api.post(`/api/shifts/${emergency.shift.id}/admin-close`, {
        actuals,
        reason: emergencyReason.trim(),
      });
      setToast({ message: `تم الإغلاق الإداري للشيفت #${emergency.shift.id} وتسجيل السبب.` });
      setEmergency(null);
      setDetail(null);
      await load(filters);
    } catch (saveError) {
      setToast({ severity: 'error', message: saveError.message });
    } finally {
      setSaving(false);
    }
  };

  const submit = async () => {
    setSaving(true);
    try {
      await api.post(`/api/shifts/${selected.id}/${action}`, { adminNotes: notes.trim() || null });
      setToast({
        message:
          action === 'approve'
            ? 'تم اعتماد لقطة الإغلاق.'
            : 'تم رفض المراجعة وعاد نفس الشيفت إلى مفتوح.',
      });
      setSelected(null);
      setAction('');
      await load();
    } catch (saveError) {
      setToast({ severity: 'error', message: saveError.message });
    } finally {
      setSaving(false);
    }
  };

  const columns = [
    { key: 'id', label: 'رقم الشيفت', render: (row) => `#${row.id}` },
    { key: 'cashier_name', label: 'الكاشير' },
    { key: 'opened_at', label: 'وقت الفتح', render: (row) => dateTime(row.opened_at) },
    { key: 'closed_at', label: 'طلب الإغلاق', render: (row) => dateTime(row.closed_at) },
    { key: 'opening_cash', label: 'عهدة البداية', render: (row) => money(row.opening_cash) },
    {
      key: 'system_total_cash',
      label: 'الكاش المتوقع',
      render: (row) => money(row.system_total_cash),
    },
    {
      key: 'cashier_declared_cash',
      label: 'الكاش الفعلي',
      render: (row) => money(row.cashier_declared_cash),
    },
    { key: 'status', label: 'الحالة', render: (row) => <StatusChip status={row.status} /> },
    {
      key: 'actions',
      label: 'الإجراءات',
      render: (row) => (
        <div className="table-actions">
          <Tooltip title="التفاصيل والمراجعات">
            <IconButton size="small" onClick={() => openDetail(row)}>
              <VisibilityRounded fontSize="small" />
            </IconButton>
          </Tooltip>
          {row.status === 'PENDING_ADMIN_REVIEW' && (
            <>
              <Tooltip title="اعتماد">
                <IconButton color="success" size="small" onClick={() => review(row, 'approve')}>
                  <CheckRounded fontSize="small" />
                </IconButton>
              </Tooltip>
              <Tooltip title="رفض وإعادة الفتح">
                <IconButton color="error" size="small" onClick={() => review(row, 'reject')}>
                  <CloseRounded fontSize="small" />
                </IconButton>
              </Tooltip>
            </>
          )}
          {['OPEN', 'PENDING_ADMIN_REVIEW'].includes(row.status) && (
            <Tooltip title="إغلاق إداري طارئ">
              <IconButton color="warning" size="small" onClick={() => beginEmergencyClose(row)}>
                <LockRounded fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="a4-page">
      <PageHeader
        title="مراجعة الشيفتات"
        description="كل طلب تقفيل مراجعة مستقلة؛ الرفض يعيد نفس الشيفت إلى مفتوح."
        actions={
          <Button variant="outlined" startIcon={<RefreshRounded />} onClick={() => load(filters)}>
            تحديث
          </Button>
        }
      />
      <FilterPanel
        resultCount={rows.length}
        onApply={() => load(filters)}
        onReset={() => {
          setFilters(INITIAL_FILTERS);
          load(INITIAL_FILTERS);
        }}
      >
        <Field label="الحالة">
          <TextField
            select
            value={filters.status}
            onChange={(event) => setFilters((value) => ({ ...value, status: event.target.value }))}
          >
            <MenuItem value="">الكل</MenuItem>
            <MenuItem value="OPEN">مفتوح</MenuItem>
            <MenuItem value="PENDING_ADMIN_REVIEW">قيد المراجعة</MenuItem>
            <MenuItem value="CLOSED">مغلق</MenuItem>
          </TextField>
        </Field>
        <Field label="رقم الكاشير">
          <TextField
            type="number"
            value={filters.cashierId}
            onChange={(event) =>
              setFilters((value) => ({ ...value, cashierId: event.target.value }))
            }
          />
        </Field>
      </FilterPanel>
      {error && <Alert severity="error">{error}</Alert>}
      <section className="a4-page-section">
        {loading ? (
          <LoadingState />
        ) : (
          <DataTable columns={columns} rows={rows} mobilePrimary={(row) => `شيفت #${row.id}`} />
        )}
      </section>

      <Dialog
        open={Boolean(selected)}
        onClose={() => !saving && setSelected(null)}
        maxWidth={false}
        slotProps={{ paper: { className: 'content-sized-dialog' } }}
      >
        <DialogTitle>
          {action === 'approve' ? 'اعتماد تقفيل الشيفت' : 'رفض التقفيل وإعادة الشيفت'} #
          {selected?.id}
        </DialogTitle>
        <DialogContent dividers>
          {selected && (
            <>
              <div className="a4-grid a4-grid--two a4-grid--section-gap">
                <div className="metric-card">
                  <div className="metric-card__copy">
                    <span className="metric-card__label">المتوقع</span>
                    <strong>{money(selected.system_total_cash)}</strong>
                  </div>
                </div>
                <div className="metric-card">
                  <div className="metric-card__copy">
                    <span className="metric-card__label">الفعلي</span>
                    <strong>{money(selected.cashier_declared_cash)}</strong>
                  </div>
                </div>
              </div>
              <Field label="ملاحظات الإدارة" required={action === 'reject'}>
                <TextField
                  multiline
                  minRows={4}
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                />
              </Field>
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSelected(null)}>إلغاء</Button>
          <Button
            variant="contained"
            color={action === 'reject' ? 'error' : 'success'}
            onClick={submit}
            disabled={saving || (action === 'reject' && !notes.trim())}
          >
            {action === 'approve' ? 'اعتماد' : 'رفض وإعادة الفتح'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={Boolean(emergency)}
        onClose={() => !saving && setEmergency(null)}
        maxWidth={false}
        slotProps={{ paper: { className: 'content-sized-dialog' } }}
      >
        <DialogTitle>إغلاق إداري طارئ للشيفت #{emergency?.shift?.id}</DialogTitle>
        <DialogContent dividers>
          <Alert severity="warning" className="a4-grid--section-gap">
            هذا الإجراء ينهي الشيفت فوراً. أدخل الإجماليات الفعلية لكل وسيلة دفع وسبباً واضحاً؛
            سيُحفظ القرار والفروقات في سجل المراجعة والـAudit.
          </Alert>
          <div className="a4-grid a4-grid--two a4-grid--section-gap">
            {Object.entries(emergency?.systemTotals?.methods || {}).map(([code, expected]) => (
              <Field key={code} label={`${code} — المتوقع ${money(expected)}`} required>
                <TextField
                  type="number"
                  value={emergencyActuals[code] || ''}
                  onChange={(event) =>
                    setEmergencyActuals((current) => ({
                      ...current,
                      [code]: event.target.value,
                    }))
                  }
                  slotProps={{ htmlInput: { min: 0, step: '0.01' } }}
                />
              </Field>
            ))}
          </div>
          <Field label="سبب الإغلاق الطارئ" required>
            <TextField
              multiline
              minRows={4}
              value={emergencyReason}
              onChange={(event) => setEmergencyReason(event.target.value)}
              slotProps={{ htmlInput: { maxLength: 500 } }}
              helperText={`${emergencyReason.trim().length}/500`}
            />
          </Field>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEmergency(null)} disabled={saving}>
            إلغاء
          </Button>
          <Button
            variant="contained"
            color="warning"
            onClick={emergencyClose}
            disabled={
              saving ||
              !emergencyReason.trim() ||
              Object.keys(emergency?.systemTotals?.methods || {}).some(
                (code) => emergencyActuals[code] === '' || emergencyActuals[code] === undefined
              )
            }
          >
            إغلاق الشيفت وتسجيل المراجعة
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={Boolean(detail)} onClose={() => setDetail(null)} fullWidth maxWidth="lg">
        <DialogTitle>تفاصيل الشيفت #{detail?.shift?.id}</DialogTitle>
        <DialogContent dividers>
          {detail && (
            <>
              <div className="a4-grid a4-grid--three">
                {Object.entries(detail.systemTotals.methods || {}).map(([code, amount]) => (
                  <div className="metric-card" key={code}>
                    <div className="metric-card__copy">
                      <span className="metric-card__label">{code}</span>
                      <strong>{money(amount)}</strong>
                    </div>
                  </div>
                ))}
              </div>
              <h3>الفواتير</h3>
              <DataTable
                rows={detail.invoices || []}
                mobilePrimary={(row) => row.invoice_number || `فاتورة #${row.id}`}
                columns={[
                  { key: 'invoice_number', label: 'رقم الفاتورة' },
                  { key: 'receipt_number', label: 'رقم الإيصال' },
                  { key: 'total', label: 'الإجمالي', render: (row) => money(row.total) },
                  {
                    key: 'total_refunded',
                    label: 'المرتجع',
                    render: (row) => money(row.total_refunded),
                  },
                  {
                    key: 'created_at',
                    label: 'الوقت',
                    render: (row) => dateTime(row.created_at),
                  },
                  {
                    key: 'status',
                    label: 'الحالة',
                    render: (row) => <StatusChip status={row.status} />,
                  },
                ]}
              />
              <h3>المرتجعات المنفذة داخل الشيفت</h3>
              <DataTable
                rows={detail.returns || []}
                mobilePrimary={(row) => row.return_number || `مرتجع #${row.id}`}
                columns={[
                  { key: 'return_number', label: 'رقم المرتجع' },
                  { key: 'invoice_number', label: 'الفاتورة' },
                  {
                    key: 'total_refunded',
                    label: 'المبلغ',
                    render: (row) => money(row.total_refunded),
                  },
                  { key: 'cashier_name', label: 'الكاشير' },
                  {
                    key: 'created_at',
                    label: 'الوقت',
                    render: (row) => dateTime(row.created_at),
                  },
                ]}
              />
              <h3>الحركات النقدية</h3>
              <DataTable
                rows={detail.cashMovements || []}
                mobilePrimary={(row) => `${row.type} · ${money(row.amount)}`}
                columns={[
                  { key: 'type', label: 'الحركة' },
                  { key: 'amount', label: 'المبلغ', render: (row) => money(row.amount) },
                  { key: 'notes', label: 'السبب/الملاحظة' },
                  {
                    key: 'created_at',
                    label: 'الوقت',
                    render: (row) => dateTime(row.created_at),
                  },
                ]}
              />
              <h3>مراجعات التقفيل</h3>
              {detail.closeRevisions.length ? (
                detail.closeRevisions.map((revision) => (
                  <section className="a4-page-section" key={revision.id}>
                    <div className="a4-actions">
                      <strong>المراجعة #{number(revision.revision_number)}</strong>
                      <StatusChip status={revision.status} />
                    </div>
                    <p>
                      {dateTime(revision.submitted_at)} · {revision.cashier_note || 'بدون ملاحظة'}
                    </p>
                    <div className="a4-grid a4-grid--three">
                      {Object.keys(revision.systemTotals.methods || {}).map((code) => (
                        <div key={code}>
                          <strong>{code}</strong>
                          <p>النظام {money(revision.systemTotals.methods[code])}</p>
                          <p>الفعلي {money(revision.declaredTotals[code])}</p>
                          <p>الفرق {money(revision.variances[code])}</p>
                        </div>
                      ))}
                    </div>
                    {revision.admin_reason && (
                      <Alert severity={revision.status === 'REJECTED' ? 'warning' : 'info'}>
                        {revision.admin_reason}
                      </Alert>
                    )}
                  </section>
                ))
              ) : (
                <Alert severity="info">لا توجد مراجعات تقفيل.</Alert>
              )}
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDetail(null)}>إغلاق</Button>
        </DialogActions>
      </Dialog>
      <AppSnackbar state={toast} onClose={() => setToast(null)} />
    </div>
  );
}

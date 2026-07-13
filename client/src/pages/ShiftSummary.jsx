import { useEffect, useMemo, useState } from 'react';
import { Alert, Button, MenuItem, TextField } from '@mui/material';
import {
  AddCircleRounded,
  CloseRounded,
  PaymentsRounded,
  RefreshRounded,
  RemoveCircleRounded,
  ShoppingCartRounded,
} from '@mui/icons-material';
import { api } from '../services/apiClient.js';
import { useAuth } from '../app/AuthContext.jsx';
import { PageHeader } from '../components/PageHeader.jsx';
import { MetricCard } from '../components/MetricCard.jsx';
import { DataTable } from '../components/DataTable.jsx';
import { StatusChip } from '../components/StatusChip.jsx';
import { EntityDrawer } from '../components/EntityDrawer.jsx';
import { Field } from '../components/forms/Field.jsx';
import { FieldGrid } from '../components/forms/FieldGrid.jsx';
import { ConfirmDialog } from '../components/ConfirmDialog.jsx';
import { LoadingState } from '../components/LoadingState.jsx';
import { AppSnackbar } from '../components/AppSnackbar.jsx';
import { dateTime, money, number } from '../utils/formatters.js';
import { createIdempotencyKey, parsePiasters, piastersToInput } from '../utils/money.js';
import '../styles/ShiftSummary.css';

const stageLabels = {
  SALE: 'مبيعات',
  PREORDER_DEPOSIT: 'عربون حجز',
  PREORDER_PICKUP: 'تحصيل استلام',
  REFUND: 'مرتجعات',
};

export default function ShiftSummary() {
  const { loadShift } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [drawer, setDrawer] = useState(false);
  const [movement, setMovement] = useState({ type: 'PAY_IN', amount: '', notes: '' });
  const [movementKey, setMovementKey] = useState(() => createIdempotencyKey('cash-movement'));
  const [closing, setClosing] = useState(false);
  const [actuals, setActuals] = useState({});
  const [cashierNote, setCashierNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      setData((await api.get('/api/shifts/current/summary')).data);
      setError('');
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    load();
  }, []);

  const systemMethods = data?.systemTotals?.methods || {};
  const methodCodes = Object.keys(systemMethods);
  const variances = useMemo(
    () =>
      Object.fromEntries(
        methodCodes.map((code) => {
          try {
            return [code, parsePiasters(actuals[code] || '0') - Number(systemMethods[code] || 0)];
          } catch {
            return [code, 0];
          }
        })
      ),
    [actuals, data]
  );

  const addMovement = async () => {
    setSaving(true);
    try {
      await api.post(
        '/api/shifts/current/cash-movement',
        {
          type: movement.type,
          amount: parsePiasters(movement.amount),
          notes: movement.notes.trim(),
        },
        { headers: { 'Idempotency-Key': movementKey } }
      );
      setToast({ message: 'تم تسجيل الحركة النقدية.' });
      setDrawer(false);
      setMovement({ type: 'PAY_IN', amount: '', notes: '' });
      await load();
    } catch (saveError) {
      setToast({ severity: 'error', message: saveError.message });
    } finally {
      setSaving(false);
    }
  };

  const openMovement = () => {
    setMovement({ type: 'PAY_IN', amount: '', notes: '' });
    setMovementKey(createIdempotencyKey('cash-movement'));
    setDrawer(true);
  };

  const showClose = () => {
    setActuals(
      Object.fromEntries(
        methodCodes.map((code) => [code, piastersToInput(systemMethods[code] || 0)])
      )
    );
    setCashierNote('');
    setClosing(true);
  };

  const closeShift = async () => {
    setSaving(true);
    try {
      const payload = Object.fromEntries(
        methodCodes.map((code) => [code, parsePiasters(actuals[code])])
      );
      await api.post('/api/shifts/current/close-request', {
        actuals: payload,
        cashierNote: cashierNote.trim() || null,
      });
      setToast({ message: 'تم حفظ مراجعة التقفيل وإرسالها للإدارة.' });
      setClosing(false);
      await load();
      await loadShift();
    } catch (saveError) {
      setToast({ severity: 'error', message: saveError.message });
    } finally {
      setSaving(false);
    }
  };

  if (loading)
    return (
      <div className="a4-page">
        <LoadingState />
      </div>
    );
  if (!data)
    return (
      <div className="a4-page">
        <PageHeader title="شيفتي الحالية" description="لا يوجد شيفت مفتوح أو قيد المراجعة." />
        <Alert severity="info">افتح شيفت من شاشة نقطة البيع.</Alert>
      </div>
    );

  const movementColumns = [
    { key: 'created_at', label: 'التاريخ', render: (row) => dateTime(row.created_at) },
    {
      key: 'type',
      label: 'النوع',
      render: (row) =>
        ({
          OPENING: 'عهدة افتتاحية',
          PAY_IN: 'إضافة نقدية',
          PAY_OUT: 'صرف نقدي',
          CLOSING: 'تقفيل معتمد',
        })[row.type] || row.type,
    },
    { key: 'amount', label: 'المبلغ', render: (row) => money(row.amount) },
    { key: 'notes', label: 'الملاحظات' },
  ];

  return (
    <div className="a4-page">
      <PageHeader
        title="شيفتي الحالية"
        description={`الشيفت #${data.shift.id} — بدأ ${dateTime(data.shift.opened_at)}`}
        actions={
          <>
            <Button variant="outlined" startIcon={<RefreshRounded />} onClick={load}>
              تحديث
            </Button>
            {data.shift.status === 'OPEN' && (
              <Button variant="outlined" startIcon={<AddCircleRounded />} onClick={openMovement}>
                حركة نقدية
              </Button>
            )}
            {data.shift.status === 'OPEN' && (
              <Button
                color="error"
                variant="contained"
                startIcon={<CloseRounded />}
                onClick={showClose}
              >
                طلب تقفيل الشيفت
              </Button>
            )}
          </>
        }
      />
      {error && <Alert severity="error">{error}</Alert>}
      <div className="a4-grid a4-grid--metrics">
        <MetricCard
          icon={<ShoppingCartRounded />}
          label="عدد الفواتير"
          value={number(data.sales.count)}
          hint={`إجمالي ${money(data.sales.total_amount)}`}
        />
        <MetricCard
          icon={<PaymentsRounded />}
          label="الكاش المتوقع"
          value={money(data.expectedClosingCash)}
          hint={`عهدة البداية ${money(data.shift.opening_cash)}`}
        />
        <MetricCard
          icon={<AddCircleRounded />}
          label="إضافات نقدية"
          value={money(data.cashMovements.find((row) => row.type === 'PAY_IN')?.total_amount || 0)}
        />
        <MetricCard
          icon={<RemoveCircleRounded />}
          label="مصروفات نقدية"
          value={money(data.cashMovements.find((row) => row.type === 'PAY_OUT')?.total_amount || 0)}
          hint={<StatusChip status={data.shift.status} />}
        />
      </div>

      <section className="a4-page-section">
        <h2 className="a4-section-title a4-section-title--spaced">المبالغ النظامية حسب الطريقة</h2>
        <div className="a4-grid a4-grid--three">
          {methodCodes.map((code) => (
            <div className="metric-card" key={code}>
              <div className="metric-card__copy">
                <span className="metric-card__label">{code}</span>
                <strong>{money(systemMethods[code])}</strong>
              </div>
            </div>
          ))}
        </div>
      </section>
      <section className="a4-page-section">
        <h2 className="a4-section-title a4-section-title--spaced">تفصيل العمليات</h2>
        <div className="a4-grid a4-grid--three">
          {(data.operations || []).map((operation) => (
            <div className="metric-card" key={`${operation.stage}-${operation.direction}`}>
              <div className="metric-card__copy">
                <span className="metric-card__label">
                  {stageLabels[operation.stage] || operation.stage} ·{' '}
                  {operation.direction === 'OUT' ? 'صادر' : 'وارد'}
                </span>
                <strong>{money(operation.amount)}</strong>
                <span className="metric-card__hint">
                  {number(operation.row_count)} دفعة · مستلم {money(operation.cash_received)} · باقي{' '}
                  {money(operation.change_amount)}
                </span>
              </div>
            </div>
          ))}
        </div>
      </section>
      <section className="a4-page-section">
        <h2 className="a4-section-title a4-section-title--spaced">حركات الدرج</h2>
        <DataTable
          columns={movementColumns}
          rows={data.cashMovementsList || []}
          mobilePrimary={(row) => row.type}
        />
      </section>

      <EntityDrawer
        open={drawer}
        title="تسجيل حركة نقدية"
        onClose={() => setDrawer(false)}
        onSubmit={addMovement}
        loading={saving}
      >
        <FieldGrid>
          <Field label="نوع الحركة">
            <TextField
              select
              value={movement.type}
              onChange={(event) => setMovement((value) => ({ ...value, type: event.target.value }))}
            >
              <MenuItem value="PAY_IN">إضافة نقدية</MenuItem>
              <MenuItem value="PAY_OUT">صرف نقدي</MenuItem>
            </TextField>
          </Field>
          <Field label="المبلغ بالجنيه" required>
            <TextField
              value={movement.amount}
              onChange={(event) =>
                setMovement((value) => ({ ...value, amount: event.target.value }))
              }
              inputMode="decimal"
            />
          </Field>
          <Field className="full" label="السبب" required>
            <TextField
              multiline
              minRows={3}
              value={movement.notes}
              onChange={(event) =>
                setMovement((value) => ({ ...value, notes: event.target.value }))
              }
            />
          </Field>
        </FieldGrid>
      </EntityDrawer>

      <ConfirmDialog
        open={closing}
        title="مراجعة تقفيل الشيفت"
        description={
          <div className="shift-close-summary">
            <p>أدخل العد الفعلي لكل طريقة. كل إرسال يحفظ مراجعة غير قابلة للتعديل.</p>
            <FieldGrid>
              {methodCodes.map((code) => (
                <Field
                  key={code}
                  label={`${code} — المتوقع ${money(systemMethods[code])}`}
                  required
                >
                  <TextField
                    value={actuals[code] || ''}
                    onChange={(event) =>
                      setActuals((value) => ({ ...value, [code]: event.target.value }))
                    }
                    inputMode="decimal"
                    helperText={`الفرق ${money(variances[code] || 0)}`}
                  />
                </Field>
              ))}
              <Field className="full" label="ملاحظة الكاشير">
                <TextField
                  multiline
                  minRows={2}
                  value={cashierNote}
                  onChange={(event) => setCashierNote(event.target.value)}
                />
              </Field>
            </FieldGrid>
          </div>
        }
        confirmLabel="إرسال للمراجعة"
        loading={saving}
        onClose={() => setClosing(false)}
        onConfirm={closeShift}
      />
      <AppSnackbar state={toast} onClose={() => setToast(null)} />
    </div>
  );
}

import { useEffect, useState } from 'react';
import {
  Alert,
  Button,
  Checkbox,
  FormControlLabel,
  IconButton,
  MenuItem,
  Switch,
  TextField,
  Tooltip,
} from '@mui/material';
import {
  AddRounded,
  DeleteRounded,
  EditRounded,
  PaymentsRounded,
  SaveRounded,
} from '@mui/icons-material';
import { api } from '../services/apiClient.js';
import { PageHeader } from '../components/PageHeader.jsx';
import { EntityDrawer } from '../components/EntityDrawer.jsx';
import { Field } from '../components/forms/Field.jsx';
import { FieldGrid } from '../components/forms/FieldGrid.jsx';
import { LoadingState } from '../components/LoadingState.jsx';
import { AppSnackbar } from '../components/AppSnackbar.jsx';
import { ConfirmDialog } from '../components/ConfirmDialog.jsx';
import '../styles/Payments.css';

const emptyForm = {
  code: '',
  name_ar: '',
  is_active: true,
  accepts_cash_received: false,
  sort_order: 100,
  refund_mode: 'EXTERNAL_REFERENCE',
};

export default function Payments() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [toast, setToast] = useState(null);
  const [drawer, setDrawer] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      setRows((await api.get('/api/payment-methods')).data || []);
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

  const saveActive = async () => {
    setSaving(true);
    try {
      await api.post('/api/payment-methods/admin', {
        active_ids: rows.filter((row) => row.is_active).map((row) => row.code),
      });
      setToast({ message: 'تم تحديث طرق الدفع النشطة.' });
      await load();
    } catch (saveError) {
      setToast({ severity: 'error', message: saveError.message });
    } finally {
      setSaving(false);
    }
  };

  const edit = (row) => {
    setEditing(row);
    setForm({
      code: row.code,
      name_ar: row.name_ar,
      is_active: Boolean(row.is_active),
      accepts_cash_received: Boolean(row.accepts_cash_received),
      sort_order: row.sort_order,
      refund_mode:
        row.refund_mode || (row.accepts_cash_received ? 'CASH_DRAWER' : 'EXTERNAL_REFERENCE'),
    });
    setDrawer(true);
  };

  const removeMethod = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.delete(`/api/payment-methods/admin/methods/${deleteTarget.id}`);
      setToast({ message: 'تم حذف طريقة الدفع المخصصة.' });
      setDeleteTarget(null);
      await load();
    } catch (deleteError) {
      setToast({
        severity: 'error',
        message:
          deleteError.code === 'PAYMENT_METHOD_IN_USE'
            ? 'طريقة الدفع مستخدمة في سجل مالي؛ يمكن تعطيلها فقط.'
            : deleteError.code === 'SYSTEM_PAYMENT_METHOD'
              ? 'طريقة الدفع الأساسية لا تُحذف؛ يمكن تعطيلها فقط.'
              : deleteError.message,
      });
    } finally {
      setDeleting(false);
    }
  };

  const saveMethod = async () => {
    setSaving(true);
    try {
      if (editing) await api.patch(`/api/payment-methods/admin/methods/${editing.id}`, form);
      else await api.post('/api/payment-methods/admin/methods', form);
      setToast({ message: editing ? 'تم تحديث طريقة الدفع.' : 'تم إنشاء طريقة الدفع.' });
      setDrawer(false);
      await load();
    } catch (saveError) {
      setToast({ severity: 'error', message: saveError.message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="a4-page">
      <PageHeader
        title="طرق الدفع"
        description="إدارة الطرق النشطة وتحديد الطرق التي تقبل قيمة النقد المستلم وحساب الباقي."
        actions={
          <>
            <Button
              variant="outlined"
              startIcon={<AddRounded />}
              onClick={() => {
                setEditing(null);
                setForm(emptyForm);
                setDrawer(true);
              }}
            >
              طريقة جديدة
            </Button>
            <Button
              variant="contained"
              startIcon={<SaveRounded />}
              onClick={saveActive}
              disabled={saving}
            >
              حفظ التفعيل
            </Button>
          </>
        }
      />
      {error && <Alert severity="error">{error}</Alert>}
      <section className="a4-page-section">
        {loading ? (
          <LoadingState />
        ) : (
          <div className="a4-grid a4-grid--three">
            {rows.map((row, index) => (
              <div className="metric-card" key={row.id}>
                <div className="metric-card__icon">
                  <PaymentsRounded />
                </div>
                <div className="metric-card__copy metric-card__copy--fill">
                  <strong>{row.name_ar}</strong>
                  <span className="metric-card__hint">
                    {row.code} · {row.accepts_cash_received ? 'يحسب النقد والباقي' : 'مرجع اختياري'}
                  </span>
                  <span className="metric-card__hint">
                    {row.is_system ? 'طريقة أساسية' : 'طريقة مخصصة'} · استخدامات{' '}
                    {row.dependency_counts?.payments ?? row.payment_count ?? 0}
                  </span>
                </div>
                <Checkbox
                  checked={Boolean(row.is_active)}
                  onChange={(event) =>
                    setRows((list) =>
                      list.map((item, itemIndex) =>
                        itemIndex === index
                          ? { ...item, is_active: event.target.checked ? 1 : 0 }
                          : item
                      )
                    )
                  }
                />
                <Tooltip title="تعديل">
                  <IconButton size="small" onClick={() => edit(row)}>
                    <EditRounded fontSize="small" />
                  </IconButton>
                </Tooltip>
                <Tooltip
                  title={
                    row.can_delete === false
                      ? 'يلزم أن تكون مخصصة ومعطلة وغير مستخدمة'
                      : 'حذف نهائي'
                  }
                >
                  <span>
                    <IconButton
                      size="small"
                      color="error"
                      disabled={row.can_delete === false}
                      onClick={() => setDeleteTarget(row)}
                    >
                      <DeleteRounded fontSize="small" />
                    </IconButton>
                  </span>
                </Tooltip>
              </div>
            ))}
          </div>
        )}
      </section>

      <EntityDrawer
        open={drawer}
        title={editing ? 'تعديل طريقة الدفع' : 'طريقة دفع جديدة'}
        onClose={() => setDrawer(false)}
        onSubmit={saveMethod}
        loading={saving}
      >
        <FieldGrid>
          <Field label="الكود" required ltr>
            <TextField
              value={form.code}
              disabled={Boolean(editing)}
              onChange={(event) => setForm((value) => ({ ...value, code: event.target.value }))}
            />
          </Field>
          <Field label="الاسم العربي" required>
            <TextField
              value={form.name_ar}
              onChange={(event) => setForm((value) => ({ ...value, name_ar: event.target.value }))}
            />
          </Field>
          <Field label="ترتيب العرض">
            <TextField
              type="number"
              value={form.sort_order}
              onChange={(event) =>
                setForm((value) => ({ ...value, sort_order: Number(event.target.value) }))
              }
            />
          </Field>
          <Field label="سياسة رد المبلغ">
            <TextField
              select
              value={form.refund_mode}
              onChange={(event) =>
                setForm((value) => ({ ...value, refund_mode: event.target.value }))
              }
            >
              <MenuItem value="CASH_DRAWER">من عهدة درج النقد</MenuItem>
              <MenuItem value="EXTERNAL_REFERENCE">رد خارجي بمرجع</MenuItem>
              <MenuItem value="DISABLED">غير مسموح للمرتجعات</MenuItem>
            </TextField>
          </Field>
          <Field className="full" label="الخصائص">
            <div className="a4-actions">
              <FormControlLabel
                control={
                  <Switch
                    checked={form.is_active}
                    onChange={(event) =>
                      setForm((value) => ({ ...value, is_active: event.target.checked }))
                    }
                  />
                }
                label="نشطة"
              />
              <FormControlLabel
                control={
                  <Switch
                    checked={form.accepts_cash_received}
                    onChange={(event) =>
                      setForm((value) => ({
                        ...value,
                        accepts_cash_received: event.target.checked,
                      }))
                    }
                  />
                }
                label="تقبل النقد المستلم وتحسب الباقي"
              />
            </div>
          </Field>
        </FieldGrid>
      </EntityDrawer>
      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="حذف طريقة الدفع"
        description={`سيُحذف «${deleteTarget?.name_ar || ''}» نهائيًا فقط إذا كانت مخصصة ومعطلة ولم تُستخدم في أي دفعة.`}
        confirmLabel="حذف طريقة الدفع"
        danger
        loading={deleting}
        onClose={() => setDeleteTarget(null)}
        onConfirm={removeMethod}
      />
      <AppSnackbar state={toast} onClose={() => setToast(null)} />
    </div>
  );
}

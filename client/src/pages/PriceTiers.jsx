import { useEffect, useState } from 'react';
import { Alert, Button, IconButton, Switch, TextField } from '@mui/material';
import { AddRounded, DeleteRounded, EditRounded, RefreshRounded } from '@mui/icons-material';
import { api } from '../services/apiClient.js';
import { PageHeader } from '../components/PageHeader.jsx';
import { DataTable } from '../components/DataTable.jsx';
import { EntityDrawer } from '../components/EntityDrawer.jsx';
import { Field } from '../components/forms/Field.jsx';
import { FieldGrid } from '../components/forms/FieldGrid.jsx';
import { LoadingState } from '../components/LoadingState.jsx';
import { AppSnackbar } from '../components/AppSnackbar.jsx';
import { StatusChip } from '../components/StatusChip.jsx';
import { ConfirmDialog } from '../components/ConfirmDialog.jsx';
import '../styles/PriceTiers.css';

export default function PriceTiers() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [drawer, setDrawer] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name: '', description: '', is_active: 1 });
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const load = async () => {
    setLoading(true);
    try {
      setRows((await api.get('/api/admin/price-tiers?activeOnly=false')).data || []);
      setError('');
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    load();
  }, []);
  const open = (row = null) => {
    setEditing(row);
    setForm(
      row
        ? { name: row.name, description: row.description || '', is_active: row.is_active }
        : { name: '', description: '', is_active: 1 }
    );
    setDrawer(true);
  };
  const save = async () => {
    if (!form.name.trim()) return setToast({ severity: 'error', message: 'اسم فئة السعر مطلوب.' });
    setSaving(true);
    try {
      if (editing) await api.patch(`/api/admin/price-tiers/${editing.id}`, form);
      else await api.post('/api/admin/price-tiers', form);
      setToast({ message: 'تم حفظ فئة السعر بنجاح.' });
      setDrawer(false);
      await load();
    } catch (e) {
      setToast({ severity: 'error', message: e.message });
    } finally {
      setSaving(false);
    }
  };
  const remove = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.delete(`/api/admin/price-tiers/${deleteTarget.id}`);
      setToast({ message: 'تم حذف فئة السعر نهائيًا.' });
      setDeleteTarget(null);
      await load();
    } catch (e) {
      setToast({
        severity: 'error',
        message:
          e.code === 'PRICE_TIER_IN_USE'
            ? 'فئة السعر مرتبطة بأسعار منتجات أو بتاريخ بيع/حجز؛ عطّلها أو فك الروابط أولًا.'
            : e.message,
      });
    } finally {
      setDeleting(false);
    }
  };
  const columns = [
    { key: 'name', label: 'اسم الفئة' },
    { key: 'description', label: 'الوصف', render: (r) => r.description || '—' },
    {
      key: 'status',
      label: 'الحالة',
      render: (r) => (
        <StatusChip
          status={r.is_active ? 'active' : 'inactive'}
          label={r.is_active ? 'نشط' : 'غير نشط'}
        />
      ),
    },
    {
      key: 'dependencies',
      label: 'الروابط',
      render: (r) => {
        const counts = r.dependency_counts || {};
        const total =
          Number(counts.productPrices ?? counts.product_prices ?? r.product_price_count ?? 0) +
          Number(counts.orders ?? counts.order_items ?? r.order_item_count ?? 0) +
          Number(counts.preorders ?? counts.preorder_items ?? r.preorder_item_count ?? 0);
        return total;
      },
    },
    {
      key: 'actions',
      label: 'الإجراءات',
      render: (r) => (
        <div className="table-actions">
          <IconButton size="small" onClick={() => open(r)} aria-label={`تعديل ${r.name}`}>
            <EditRounded fontSize="small" />
          </IconButton>
          <IconButton
            size="small"
            color="error"
            disabled={r.can_delete === false}
            onClick={() => setDeleteTarget(r)}
            aria-label={`حذف ${r.name}`}
          >
            <DeleteRounded fontSize="small" />
          </IconButton>
        </div>
      ),
    },
  ];
  return (
    <div className="a4-page">
      <PageHeader
        title="فئات الأسعار"
        description="أضف فئات مثل القطاعي والجملة والمدرسين ثم اربط سعر كل فئة بالمنتج."
        actions={
          <>
            <Button variant="outlined" startIcon={<RefreshRounded />} onClick={load}>
              تحديث
            </Button>
            <Button variant="contained" startIcon={<AddRounded />} onClick={() => open()}>
              فئة جديدة
            </Button>
          </>
        }
      />
      {error && <Alert severity="error">{error}</Alert>}
      <section className="a4-page-section">
        {loading ? (
          <LoadingState />
        ) : (
          <DataTable columns={columns} rows={rows} mobilePrimary={(r) => r.name} />
        )}
      </section>
      <EntityDrawer
        open={drawer}
        title={editing ? 'تعديل فئة السعر' : 'إضافة فئة سعر'}
        onClose={() => setDrawer(false)}
        onSubmit={save}
        loading={saving}
      >
        <FieldGrid columns={1}>
          <Field label="اسم الفئة" required>
            <TextField
              value={form.name}
              onChange={(e) => setForm((v) => ({ ...v, name: e.target.value }))}
              placeholder="مثال: سعر الجملة"
            />
          </Field>
          <Field label="الوصف">
            <TextField
              multiline
              minRows={3}
              value={form.description}
              onChange={(e) => setForm((v) => ({ ...v, description: e.target.value }))}
            />
          </Field>
          <Field label="حالة الفئة">
            <div className="a4-toolbar">
              <span className="a4-muted">إتاحتها عند تسعير المنتجات</span>
              <Switch
                checked={Boolean(form.is_active)}
                onChange={(e) => setForm((v) => ({ ...v, is_active: e.target.checked ? 1 : 0 }))}
              />
            </div>
          </Field>
        </FieldGrid>
      </EntityDrawer>
      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="حذف فئة السعر نهائيًا"
        description={`سيُحذف «${deleteTarget?.name || ''}» فقط إذا لم يرتبط بسعر منتج أو بتاريخ بيع أو حجز. هذا الإجراء غير قابل للاسترجاع.`}
        confirmLabel="حذف فئة السعر"
        danger
        loading={deleting}
        onClose={() => setDeleteTarget(null)}
        onConfirm={remove}
      />
      <AppSnackbar state={toast} onClose={() => setToast(null)} />
    </div>
  );
}

import { useEffect, useState } from 'react';
import { Alert, Button, IconButton, Switch, TextField, Tooltip } from '@mui/material';
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
import '../styles/Categories.css';

export default function Categories() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [drawer, setDrawer] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name: '', is_active: 1 });
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const load = async () => {
    setLoading(true);
    setError('');
    try {
      setRows((await api.get('/api/categories?activeOnly=false')).data || []);
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
    setForm(row ? { name: row.name, is_active: row.is_active } : { name: '', is_active: 1 });
    setDrawer(true);
  };
  const save = async () => {
    if (!form.name.trim()) return setToast({ severity: 'error', message: 'اسم التصنيف مطلوب.' });
    setSaving(true);
    try {
      if (editing) await api.patch(`/api/admin/categories/${editing.id}`, form);
      else await api.post('/api/admin/categories', form);
      setToast({ message: editing ? 'تم تحديث التصنيف.' : 'تم إنشاء التصنيف.' });
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
      await api.delete(`/api/admin/categories/${deleteTarget.id}`);
      setToast({ message: 'تم حذف التصنيف نهائيًا.' });
      setDeleteTarget(null);
      await load();
    } catch (e) {
      const count = e.details?.productCount ?? e.details?.product_count;
      setToast({
        severity: 'error',
        message:
          count !== undefined
            ? `لا يمكن حذف التصنيف لأنه مرتبط بـ${count} منتج. انقل المنتجات أولًا.`
            : e.message,
      });
    } finally {
      setDeleting(false);
    }
  };
  const columns = [
    { key: 'name', label: 'اسم التصنيف' },
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
      label: 'المنتجات المرتبطة',
      render: (r) => r.dependency_counts?.products ?? r.product_count ?? r.products_count ?? '—',
    },
    {
      key: 'actions',
      label: 'الإجراءات',
      render: (r) => (
        <div className="table-actions">
          <Tooltip title="تعديل">
            <IconButton size="small" onClick={() => open(r)}>
              <EditRounded fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip
            title={r.can_delete === false ? 'انقل المنتجات المرتبطة قبل الحذف' : 'حذف نهائي'}
          >
            <span>
              <IconButton
                size="small"
                color="error"
                disabled={r.can_delete === false}
                aria-label={
                  r.can_delete === false ? 'انقل المنتجات المرتبطة قبل الحذف' : 'حذف نهائي'
                }
                onClick={() => setDeleteTarget(r)}
              >
                <DeleteRounded fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>
        </div>
      ),
    },
  ];
  return (
    <div className="a4-page">
      <PageHeader
        title="التصنيفات"
        description="أنشئ تصنيفات واضحة لتسهيل البحث والتقارير وإدارة المنتجات."
        actions={
          <>
            <Button variant="outlined" startIcon={<RefreshRounded />} onClick={load}>
              تحديث
            </Button>
            <Button variant="contained" startIcon={<AddRounded />} onClick={() => open()}>
              تصنيف جديد
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
        title={editing ? 'تعديل التصنيف' : 'إضافة تصنيف'}
        subtitle="اكتب اسماً واضحاً يظهر في المنتجات والفلاتر."
        onClose={() => setDrawer(false)}
        onSubmit={save}
        loading={saving}
      >
        <FieldGrid columns={1}>
          <Field label="اسم التصنيف" required>
            <TextField
              value={form.name}
              onChange={(e) => setForm((v) => ({ ...v, name: e.target.value }))}
              placeholder="مثال: كتب خارجية"
            />
          </Field>
          <Field label="حالة التصنيف">
            <div className="a4-toolbar">
              <span className="a4-muted">إظهار التصنيف داخل النظام</span>
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
        title="حذف التصنيف نهائيًا"
        description={`سيُحذف التصنيف «${deleteTarget?.name || ''}» دون إمكانية استرجاعه. لا يتم الحذف إذا كان أي منتج مرتبطًا به.`}
        confirmLabel="حذف التصنيف"
        danger
        loading={deleting}
        onClose={() => setDeleteTarget(null)}
        onConfirm={remove}
      />
      <AppSnackbar state={toast} onClose={() => setToast(null)} />
    </div>
  );
}

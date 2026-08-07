import { useEffect, useState } from 'react';
import { Alert, Button, IconButton, TextField, Tooltip, Select, MenuItem, InputLabel, FormControl } from '@mui/material';
import { AddRounded, DeleteRounded, EditRounded, SearchRounded, DownloadRounded } from '@mui/icons-material';
import { api } from '../services/apiClient.js';
import { PageHeader } from '../components/PageHeader.jsx';
import { DataTable } from '../components/DataTable.jsx';
import { EntityDrawer } from '../components/EntityDrawer.jsx';
import { Field } from '../components/forms/Field.jsx';
import { FieldGrid } from '../components/forms/FieldGrid.jsx';
import { LoadingState } from '../components/LoadingState.jsx';
import { AppSnackbar } from '../components/AppSnackbar.jsx';
import { dateTime } from '../utils/formatters.js';
import { ConfirmDialog } from '../components/ConfirmDialog.jsx';
import '../styles/Customers.css';

export default function Customers() {
  const [rows, setRows] = useState([]);
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [drawer, setDrawer] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name: '', phone: '' });
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [tiers, setTiers] = useState([]);
  const [tierId, setTierId] = useState('');
  
  const load = async (query = q, selectedTier = tierId) => {
    setLoading(true);
    try {
      const qs = new URLSearchParams();
      if (query) qs.append('q', query);
      if (selectedTier) qs.append('tierId', selectedTier);
      
      setRows((await api.get(`/api/customers?${qs.toString()}`)).data || []);
      setError('');
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    load('', '');
    api.get('/api/price-tiers?activeOnly=true').then(res => setTiers(res.data || [])).catch(() => {});
  }, []);
  const open = (row = null) => {
    setEditing(row);
    setForm(row ? { name: row.name, phone: row.phone } : { name: '', phone: '' });
    setDrawer(true);
  };
  const save = async () => {
    if (!form.name.trim() || !form.phone.trim())
      return setToast({ severity: 'error', message: 'الاسم ورقم الهاتف مطلوبان.' });
    setSaving(true);
    try {
      if (editing) await api.patch(`/api/admin/customers/${editing.id}`, form);
      else await api.post('/api/customers', form);
      setToast({ message: editing ? 'تم تحديث العميل.' : 'تم تسجيل العميل.' });
      setDrawer(false);
      setEditing(null);
      setForm({ name: '', phone: '' });
      await load('');
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
      await api.delete(`/api/admin/customers/${deleteTarget.id}`);
      setToast({ message: 'تم حذف العميل غير المستخدم.' });
      setDeleteTarget(null);
      await load('');
    } catch (e) {
      setToast({
        severity: 'error',
        message:
          e.code === 'CUSTOMER_IN_USE'
            ? 'لا يمكن حذف العميل لأن له فاتورة أو حجزًا محفوظًا.'
            : e.message,
      });
    } finally {
      setDeleting(false);
    }
  };

  const exportCsv = () => {
    if (!rows.length) return setToast({ severity: 'warning', message: 'لا توجد بيانات لاستخراجها.' });
    
    const headers = ['اسم العميل', 'رقم الهاتف', 'تاريخ التسجيل', 'إجمالي الفواتير', 'إجمالي الحجوزات', 'إحصائيات الفئات'];
    const csvRows = [headers.join(',')];
    
    for (const r of rows) {
      const counts = r.dependency_counts || {};
      const orders = counts.orders ?? r.order_count ?? 0;
      const preorders = counts.preorders ?? r.preorder_count ?? 0;
      const tierStatsStr = (r.tier_statistics || [])
        .map((ts) => `${ts.tier_name}: ${ts.order_count} فاتورة / ${ts.preorder_count} حجز`)
        .join(' | ');
        
      const rowData = [
        `"${(r.name || '').replace(/"/g, '""')}"`,
        `"${r.phone || ''}"`,
        `"${dateTime(r.created_at)}"`,
        orders,
        preorders,
        `"${tierStatsStr}"`
      ];
      csvRows.push(rowData.join(','));
    }
    
    const blob = new Blob(['\ufeff' + csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `customers_export_${new Date().getTime()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const columns = [
    { key: 'name', label: 'اسم العميل' },
    { key: 'phone', label: 'رقم الهاتف', render: (r) => <span className="a4-ltr">{r.phone}</span> },
    { key: 'created_at', label: 'تاريخ التسجيل', render: (r) => dateTime(r.created_at) },
    {
      key: 'dependencies',
      label: 'السجل المرتبط',
      render: (r) => {
        const counts = r.dependency_counts || {};
        const orders = counts.orders ?? r.order_count ?? 0;
        const preorders = counts.preorders ?? r.preorder_count ?? 0;
        const tierStats = r.tier_statistics || [];
        
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <span>{orders} فاتورة · {preorders} حجز</span>
            {tierStats.length > 0 && (
              <div style={{ fontSize: '0.85em', color: 'var(--a4-c-text-secondary)' }}>
                {tierStats.map(ts => (
                  <span key={ts.tier_id} style={{ display: 'block' }}>
                    {ts.tier_name}: {ts.order_count} ف · {ts.preorder_count} ح
                  </span>
                ))}
              </div>
            )}
          </div>
        );
      },
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
          <Tooltip title={r.can_delete === false ? 'للعميل سجل مالي محفوظ' : 'حذف نهائي'}>
            <span>
              <IconButton
                size="small"
                color="error"
                disabled={r.can_delete === false}
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
    <div className="a4-page customers-page">
      <PageHeader
        title="العملاء"
        description="سجل عملاء الحجوزات وابحث عنهم بالاسم أو رقم الهاتف."
        actions={
          <div style={{ display: 'flex', gap: '8px' }}>
            <Button variant="outlined" startIcon={<DownloadRounded />} onClick={exportCsv}>
              استخراج
            </Button>
            <Button variant="contained" startIcon={<AddRounded />} onClick={() => open()}>
              عميل جديد
            </Button>
          </div>
        }
      />
      <section className="a4-page-section customers-page__workspace">
        <div className="a4-toolbar a4-toolbar--section customers-search">
          <Field className="customers-search__field" label="البحث عن عميل" density="compact">
            <TextField
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && load()}
              placeholder="ابحث بالاسم أو رقم الهاتف"
            />
          </Field>
          <Field className="customers-search__tier" label="فئة السعر" density="compact">
            <Select
              value={tierId}
              onChange={(e) => {
                setTierId(e.target.value);
                load(q, e.target.value);
              }}
              displayEmpty
            >
              <MenuItem value="">الكل</MenuItem>
              {tiers.map((t) => (
                <MenuItem key={t.id} value={t.id}>{t.name}</MenuItem>
              ))}
            </Select>
          </Field>
          <Button style={{ alignSelf: 'flex-end', height: '40px' }} variant="outlined" startIcon={<SearchRounded />} onClick={() => load()}>
            بحث
          </Button>
        </div>
        {error && (
          <Alert severity="error" className="customers-page__alert">
            {error}
          </Alert>
        )}
        {loading ? (
          <LoadingState />
        ) : (
          <DataTable columns={columns} rows={rows} mobilePrimary={(r) => r.name} />
        )}
      </section>
      <EntityDrawer
        open={drawer}
        title={editing ? 'تعديل العميل' : 'إضافة عميل'}
        subtitle="تستخدم هذه البيانات في الحجز المسبق والاستلام."
        onClose={() => setDrawer(false)}
        onSubmit={save}
        loading={saving}
      >
        <FieldGrid columns={1}>
          <Field label="اسم العميل" required>
            <TextField
              value={form.name}
              onChange={(e) => setForm((v) => ({ ...v, name: e.target.value }))}
            />
          </Field>
          <Field label="رقم الهاتف" required>
            <TextField
              value={form.phone}
              onChange={(e) => setForm((v) => ({ ...v, phone: e.target.value }))}
            />
          </Field>
        </FieldGrid>
      </EntityDrawer>
      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="حذف العميل نهائيًا"
        description={`سيُحذف «${deleteTarget?.name || ''}» فقط إذا لم توجد له فاتورة أو حجز. السجلات المالية لا تُحذف مطلقًا.`}
        confirmLabel="حذف العميل"
        danger
        loading={deleting}
        onClose={() => setDeleteTarget(null)}
        onConfirm={remove}
      />
      <AppSnackbar state={toast} onClose={() => setToast(null)} />
    </div>
  );
}

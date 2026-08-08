import { useEffect, useState } from 'react';
import ExcelJS from 'exceljs';
import {
  Alert,
  Button,
  IconButton,
  TextField,
  Tooltip,
  Select,
  MenuItem,
  InputLabel,
  FormControl,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormGroup,
  FormControlLabel,
  Checkbox,
} from '@mui/material';
import {
  AddRounded,
  DeleteRounded,
  EditRounded,
  SearchRounded,
  DownloadRounded,
} from '@mui/icons-material';
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
  const [products, setProducts] = useState([]);
  const [productId, setProductId] = useState('');
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [exportTierId, setExportTierId] = useState('');
  const [exportColumns, setExportColumns] = useState({
    name: true,
    phone: true,
    created_at: true,
    orders: true,
    preorders: true,
    tiers: true,
  });

  const load = async (query = q, selectedTier = tierId, selectedProduct = productId) => {
    setLoading(true);
    try {
      const qs = new URLSearchParams();
      if (query) qs.append('q', query);
      if (selectedTier) qs.append('tierId', selectedTier);
      if (selectedProduct) qs.append('productId', selectedProduct);

      setRows((await api.get(`/api/customers?${qs.toString()}`)).data || []);
      setError('');
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    load('', '', '');
    api
      .get('/api/admin/price-tiers?activeOnly=true')
      .then((res) => setTiers(res.data || []))
      .catch(() => {});
    api
      .get('/api/products?limit=1000')
      .then((res) => setProducts(res.data?.data || res.data || []))
      .catch(() => {});
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

  const executeExport = async () => {
    let exportRows = rows;
    if (exportTierId) {
      exportRows = rows.filter((r) =>
        r.tier_statistics?.some((ts) => String(ts.tier_id) === String(exportTierId))
      );
    }

    if (!exportRows.length) {
      setToast({ severity: 'warning', message: 'لا توجد بيانات لاستخراجها.' });
      setExportDialogOpen(false);
      return;
    }

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('العملاء', { views: [{ rightToLeft: true }] });

    const columns = [];
    if (exportColumns.name) columns.push({ header: 'اسم العميل', key: 'name', width: 30 });
    if (exportColumns.phone) columns.push({ header: 'رقم الهاتف', key: 'phone', width: 20 });
    if (exportColumns.created_at)
      columns.push({ header: 'تاريخ التسجيل', key: 'created_at', width: 20 });
    if (exportColumns.orders) columns.push({ header: 'إجمالي الفواتير', key: 'orders', width: 15 });
    if (exportColumns.preorders)
      columns.push({ header: 'إجمالي الحجوزات', key: 'preorders', width: 15 });
    if (exportColumns.tiers) columns.push({ header: 'إحصائيات الفئات', key: 'tiers', width: 40 });

    sheet.columns = columns;
    sheet.getRow(1).font = { bold: true };
    sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };

    for (const r of exportRows) {
      const counts = r.dependency_counts || {};
      const orders = counts.orders ?? r.order_count ?? 0;
      const preorders = counts.preorders ?? r.preorder_count ?? 0;
      const tierStatsStr = (r.tier_statistics || [])
        .map((ts) => `${ts.tier_name}: ${ts.order_count} فاتورة / ${ts.preorder_count} حجز`)
        .join(' | ');

      const rowData = {};
      if (exportColumns.name) rowData.name = r.name || '';
      if (exportColumns.phone) rowData.phone = r.phone || '';
      if (exportColumns.created_at) rowData.created_at = dateTime(r.created_at);
      if (exportColumns.orders) rowData.orders = orders;
      if (exportColumns.preorders) rowData.preorders = preorders;
      if (exportColumns.tiers) rowData.tiers = tierStatsStr;

      const addedRow = sheet.addRow(rowData);
      if (exportColumns.phone) {
        addedRow.getCell('phone').numFmt = '@';
      }
    }

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `customers_export_${new Date().getTime()}.xlsx`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setExportDialogOpen(false);
  };

  const columns = [
    { key: 'name', label: 'اسم العميل' },
    { key: 'phone', label: 'رقم الهاتف', render: (r) => <span className="a4-ltr">{r.phone}</span> },
    { key: 'created_at', label: 'تاريخ التسجيل', render: (r) => dateTime(r.created_at) },
    {
      key: 'orders',
      label: 'إجمالي الفواتير',
      render: (r) => r.dependency_counts?.orders ?? r.order_count ?? 0,
    },
    {
      key: 'preorders',
      label: 'إجمالي الحجوزات',
      render: (r) => r.dependency_counts?.preorders ?? r.preorder_count ?? 0,
    },
    {
      key: 'tiers',
      label: 'فئات السعر المستخدمة',
      render: (r) => {
        const tierStats = r.tier_statistics || [];
        if (!tierStats.length)
          return <span style={{ color: 'var(--a4-c-text-secondary)' }}>الأساسي فقط</span>;
        return <span>{tierStats.map((ts) => ts.tier_name).join('، ')}</span>;
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
            <Button
              variant="outlined"
              startIcon={<DownloadRounded />}
              onClick={() => setExportDialogOpen(true)}
            >
              استخراج
            </Button>
            <Button variant="contained" startIcon={<AddRounded />} onClick={() => open()}>
              عميل جديد
            </Button>
          </div>
        }
      />
      <section className="a4-page-section customers-page__workspace">
        <div
          className="a4-toolbar a4-toolbar--section customers-search"
          style={{ flexDirection: 'column', alignItems: 'stretch' }}
        >
          <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end' }}>
            <Field
              className="customers-search__field"
              label="البحث عن عميل"
              density="compact"
              style={{ flexGrow: 1 }}
            >
              <TextField
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && load()}
                placeholder="ابحث بالاسم أو رقم الهاتف"
              />
            </Field>
            <Button
              style={{ height: '40px' }}
              variant="outlined"
              startIcon={<SearchRounded />}
              onClick={() => load()}
            >
              بحث
            </Button>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <FormControl className="customers-search__tier" size="small" style={{ flex: 1 }}>
              <InputLabel id="tier-filter-label">فئة السعر</InputLabel>
              <Select
                labelId="tier-filter-label"
                value={tierId}
                label="فئة السعر"
                onChange={(e) => {
                  setTierId(e.target.value);
                  load(q, e.target.value, productId);
                }}
              >
                <MenuItem value="">الكل</MenuItem>
                {tiers.map((t) => (
                  <MenuItem key={t.id} value={t.id}>
                    {t.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl className="customers-search__product" size="small" style={{ flex: 1 }}>
              <InputLabel id="product-filter-label">المنتج</InputLabel>
              <Select
                labelId="product-filter-label"
                value={productId}
                label="المنتج"
                onChange={(e) => {
                  setProductId(e.target.value);
                  load(q, tierId, e.target.value);
                }}
              >
                <MenuItem value="">الكل</MenuItem>
                {products.map((p) => (
                  <MenuItem key={p.id} value={p.id}>
                    {p.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </div>
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
      <Dialog
        open={exportDialogOpen}
        onClose={() => setExportDialogOpen(false)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>تحديد أعمدة الاستخراج</DialogTitle>
        <DialogContent dividers>
          <div style={{ marginBottom: '16px' }}>
            <Field label="استخراج لفئة سعرية معينة">
              <Select
                value={exportTierId}
                onChange={(e) => setExportTierId(e.target.value)}
                displayEmpty
                size="small"
              >
                <MenuItem value="">الكل (بدون تحديد)</MenuItem>
                {tiers.map((t) => (
                  <MenuItem key={t.id} value={t.id}>
                    {t.name}
                  </MenuItem>
                ))}
              </Select>
            </Field>
          </div>
          <FormGroup>
            <FormControlLabel
              control={
                <Checkbox
                  checked={exportColumns.name}
                  onChange={(e) => setExportColumns((c) => ({ ...c, name: e.target.checked }))}
                />
              }
              label="اسم العميل"
            />
            <FormControlLabel
              control={
                <Checkbox
                  checked={exportColumns.phone}
                  onChange={(e) => setExportColumns((c) => ({ ...c, phone: e.target.checked }))}
                />
              }
              label="رقم الهاتف"
            />
            <FormControlLabel
              control={
                <Checkbox
                  checked={exportColumns.created_at}
                  onChange={(e) =>
                    setExportColumns((c) => ({ ...c, created_at: e.target.checked }))
                  }
                />
              }
              label="تاريخ التسجيل"
            />
            <FormControlLabel
              control={
                <Checkbox
                  checked={exportColumns.orders}
                  onChange={(e) => setExportColumns((c) => ({ ...c, orders: e.target.checked }))}
                />
              }
              label="إجمالي الفواتير"
            />
            <FormControlLabel
              control={
                <Checkbox
                  checked={exportColumns.preorders}
                  onChange={(e) => setExportColumns((c) => ({ ...c, preorders: e.target.checked }))}
                />
              }
              label="إجمالي الحجوزات"
            />
            <FormControlLabel
              control={
                <Checkbox
                  checked={exportColumns.tiers}
                  onChange={(e) => setExportColumns((c) => ({ ...c, tiers: e.target.checked }))}
                />
              }
              label="إحصائيات الفئات"
            />
          </FormGroup>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setExportDialogOpen(false)} color="inherit">
            إلغاء
          </Button>
          <Button
            onClick={executeExport}
            variant="contained"
            disabled={!Object.values(exportColumns).some(Boolean)}
          >
            استخراج البيانات
          </Button>
        </DialogActions>
      </Dialog>
      <AppSnackbar state={toast} onClose={() => setToast(null)} />
    </div>
  );
}

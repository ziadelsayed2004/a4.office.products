import { useEffect, useState } from 'react';
import { Alert, Button, IconButton, MenuItem, TextField, Tooltip } from '@mui/material';
import {
  AddRounded,
  EditRounded,
  KeyRounded,
  PersonOffRounded,
  PersonRounded,
  RefreshRounded,
} from '@mui/icons-material';
import { api } from '../services/apiClient.js';
import { PageHeader } from '../components/PageHeader.jsx';
import { DataTable } from '../components/DataTable.jsx';
import { StatusChip } from '../components/StatusChip.jsx';
import { EntityDrawer } from '../components/EntityDrawer.jsx';
import { Field } from '../components/forms/Field.jsx';
import { FieldGrid } from '../components/forms/FieldGrid.jsx';
import { FormSection } from '../components/forms/FormSection.jsx';
import { ConfirmDialog } from '../components/ConfirmDialog.jsx';
import { LoadingState } from '../components/LoadingState.jsx';
import { AppSnackbar } from '../components/AppSnackbar.jsx';
import { dateTime } from '../utils/formatters.js';
import '../styles/Users.css';

const emptyForm = { username: '', password: '', role: 'Cashier', name: '', phone: '' };
export default function Users() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [drawer, setDrawer] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);
  const [passwordUser, setPasswordUser] = useState(null);
  const [newPassword, setNewPassword] = useState('');
  const [toggleUser, setToggleUser] = useState(null);
  const load = async () => {
    setLoading(true);
    try {
      setRows((await api.get('/api/admin/users')).data || []);
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
        ? {
            username: row.username,
            password: '',
            role: row.role,
            name: row.name || '',
            phone: row.phone || '',
          }
        : emptyForm
    );
    setDrawer(true);
  };
  const save = async () => {
    if (!form.name.trim() || !form.username.trim() || (!editing && !form.password))
      return setToast({ severity: 'error', message: 'أكمل البيانات المطلوبة.' });
    setSaving(true);
    try {
      if (editing)
        await api.patch(`/api/admin/users/${editing.id}`, {
          role: form.role,
          name: form.name,
          phone: form.phone,
        });
      else await api.post('/api/admin/users', form);
      setToast({ message: 'تم حفظ حساب المستخدم.' });
      setDrawer(false);
      await load();
    } catch (e) {
      setToast({ severity: 'error', message: e.message });
    } finally {
      setSaving(false);
    }
  };
  const changePassword = async () => {
    if (newPassword.length < 6)
      return setToast({ severity: 'error', message: 'كلمة المرور يجب ألا تقل عن 6 أحرف.' });
    setSaving(true);
    try {
      await api.patch(`/api/admin/users/${passwordUser.id}/password`, { password: newPassword });
      setPasswordUser(null);
      setNewPassword('');
      setToast({ message: 'تم تغيير كلمة المرور.' });
    } catch (e) {
      setToast({ severity: 'error', message: e.message });
    } finally {
      setSaving(false);
    }
  };
  const toggle = async () => {
    setSaving(true);
    try {
      await api.patch(
        `/api/admin/users/${toggleUser.id}/${toggleUser.is_active ? 'disable' : 'enable'}`,
        {}
      );
      setToast({ message: toggleUser.is_active ? 'تم تعطيل الحساب.' : 'تم تفعيل الحساب.' });
      setToggleUser(null);
      await load();
    } catch (e) {
      setToast({ severity: 'error', message: e.message });
    } finally {
      setSaving(false);
    }
  };
  const columns = [
    { key: 'name', label: 'الاسم' },
    {
      key: 'username',
      label: 'اسم المستخدم',
      render: (r) => <span className="a4-ltr">{r.username}</span>,
    },
    { key: 'role', label: 'الدور', render: (r) => (r.role === 'Admin' ? 'مدير' : 'كاشير') },
    {
      key: 'phone',
      label: 'الهاتف',
      render: (r) => <span className="a4-ltr">{r.phone || '—'}</span>,
    },
    {
      key: 'is_active',
      label: 'الحالة',
      render: (r) => (
        <StatusChip
          status={r.is_active ? 'active' : 'inactive'}
          label={r.is_active ? 'نشط' : 'معطل'}
        />
      ),
    },
    { key: 'created_at', label: 'تاريخ الإنشاء', render: (r) => dateTime(r.created_at) },
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
          <Tooltip title="تغيير كلمة المرور">
            <IconButton size="small" onClick={() => setPasswordUser(r)}>
              <KeyRounded fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title={r.is_active ? 'تعطيل' : 'تفعيل'}>
            <IconButton
              size="small"
              color={r.is_active ? 'error' : 'success'}
              onClick={() => setToggleUser(r)}
            >
              {r.is_active ? (
                <PersonOffRounded fontSize="small" />
              ) : (
                <PersonRounded fontSize="small" />
              )}
            </IconButton>
          </Tooltip>
        </div>
      ),
    },
  ];
  return (
    <div className="a4-page">
      <PageHeader
        title="المستخدمون"
        description="إدارة حسابات الأدمن والكاشير. لا يمكن للكاشير تعديل بيانات حسابه بنفسه."
        actions={
          <>
            <Button variant="outlined" startIcon={<RefreshRounded />} onClick={load}>
              تحديث
            </Button>
            <Button variant="contained" startIcon={<AddRounded />} onClick={() => open()}>
              مستخدم جديد
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
        title={editing ? 'تعديل المستخدم' : 'إضافة مستخدم'}
        onClose={() => setDrawer(false)}
        onSubmit={save}
        loading={saving}
      >
        <FormSection title="بيانات الحساب">
          <FieldGrid>
            <Field label="الاسم" required>
              <TextField
                value={form.name}
                onChange={(e) => setForm((v) => ({ ...v, name: e.target.value }))}
              />
            </Field>
            <Field label="رقم الهاتف">
              <TextField
                slotProps={{ htmlInput: { dir: 'ltr' } }}
                value={form.phone}
                onChange={(e) => setForm((v) => ({ ...v, phone: e.target.value }))}
              />
            </Field>
            <Field label="اسم المستخدم" required>
              <TextField
                disabled={Boolean(editing)}
                slotProps={{ htmlInput: { dir: 'ltr' } }}
                value={form.username}
                onChange={(e) => setForm((v) => ({ ...v, username: e.target.value }))}
              />
            </Field>
            {!editing && (
              <Field label="كلمة المرور" required>
                <TextField
                  type="password"
                  slotProps={{ htmlInput: { dir: 'ltr' } }}
                  value={form.password}
                  onChange={(e) => setForm((v) => ({ ...v, password: e.target.value }))}
                />
              </Field>
            )}
            <Field label="نوع الحساب" required>
              <TextField
                select
                value={form.role}
                onChange={(e) => setForm((v) => ({ ...v, role: e.target.value }))}
              >
                <MenuItem value="Cashier">كاشير</MenuItem>
                <MenuItem value="Admin">مدير</MenuItem>
              </TextField>
            </Field>
          </FieldGrid>
        </FormSection>
      </EntityDrawer>
      <EntityDrawer
        open={Boolean(passwordUser)}
        title={`تغيير كلمة مرور ${passwordUser?.name || ''}`}
        onClose={() => setPasswordUser(null)}
        onSubmit={changePassword}
        loading={saving}
        submitLabel="تغيير كلمة المرور"
      >
        <Field label="كلمة المرور الجديدة" required>
          <TextField
            type="password"
            slotProps={{ htmlInput: { dir: 'ltr' } }}
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
          />
        </Field>
      </EntityDrawer>
      <ConfirmDialog
        open={Boolean(toggleUser)}
        title={toggleUser?.is_active ? 'تعطيل الحساب' : 'تفعيل الحساب'}
        description={`هل تريد ${toggleUser?.is_active ? 'تعطيل' : 'تفعيل'} حساب ${toggleUser?.name}؟`}
        danger={Boolean(toggleUser?.is_active)}
        loading={saving}
        onClose={() => setToggleUser(null)}
        onConfirm={toggle}
      />
      <AppSnackbar state={toast} onClose={() => setToast(null)} />
    </div>
  );
}

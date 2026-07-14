import { useEffect, useState } from 'react';
import { Button, TextField } from '@mui/material';
import { AddRounded, PrintRounded, RefreshRounded, SyncRounded } from '@mui/icons-material';
import { api } from '../services/apiClient.js';
import { PageHeader } from '../components/PageHeader.jsx';
import { DataTable } from '../components/DataTable.jsx';
import { EntityDrawer } from '../components/EntityDrawer.jsx';
import { Field } from '../components/forms/Field.jsx';
import { StatusChip } from '../components/StatusChip.jsx';
import { AppSnackbar } from '../components/AppSnackbar.jsx';
import '../styles/ReturnAuthorizations.css';

export default function ReturnAuthorizations() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [label, setLabel] = useState('');
  const [toast, setToast] = useState(null);
  const load = async () => {
    setLoading(true);
    try {
      setRows((await api.get('/api/admin/return-approval-cards')).data || []);
    } catch (error) {
      setToast({ severity: 'error', message: error.message });
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    load();
  }, []);
  const action = async (row, type) => {
    try {
      await api.post(
        `/api/admin/return-approval-cards/${row.id}/${type}`,
        type === 'disable' ? { reason: 'Disabled by Admin' } : {}
      );
      await load();
    } catch (error) {
      setToast({ severity: 'error', message: error.message });
    }
  };
  const create = async () => {
    try {
      await api.post('/api/admin/return-approval-cards', { label });
      setCreating(false);
      setLabel('');
      await load();
    } catch (error) {
      setToast({ severity: 'error', message: error.message });
    }
  };
  const print = async (row) => {
    try {
      await api.post(`/api/admin/return-approval-cards/${row.id}/print-request`, {
        requestKey: crypto.randomUUID(),
        copies: 1,
      });
      window.open(`/return-approval-cards/${row.id}/print`, '_blank', 'noopener,noreferrer');
    } catch (error) {
      setToast({ severity: 'error', message: error.message });
    }
  };
  const columns = [
    { key: 'cardNumber', label: 'رقم البطاقة' },
    { key: 'label', label: 'الاسم' },
    { key: 'ownerAdminName', label: 'الأدمن' },
    { key: 'status', label: 'الحالة', render: (row) => <StatusChip status={row.status} /> },
    {
      key: 'actions',
      label: 'الإجراءات',
      render: (row) => (
        <div className="a4-actions">
          <Button
            onClick={() => print(row)}
            disabled={row.status !== 'ACTIVE'}
            startIcon={<PrintRounded />}
          >
            طباعة
          </Button>
          <Button onClick={() => action(row, 'rotate')} startIcon={<SyncRounded />}>
            تغيير QR
          </Button>
          <Button
            color={row.status === 'ACTIVE' ? 'error' : 'success'}
            onClick={() => action(row, row.status === 'ACTIVE' ? 'disable' : 'enable')}
          >
            {row.status === 'ACTIVE' ? 'إيقاف' : 'تفعيل'}
          </Button>
        </div>
      ),
    },
  ];
  return (
    <div className="a4-page">
      <PageHeader
        title="بطاقات اعتماد المرتجع"
        description="بطاقات إدارية مستمرة لتأكيد المرتجعات. تغيير QR يبطل النسخة القديمة فورًا."
        actions={
          <>
            <Button startIcon={<RefreshRounded />} onClick={load}>
              تحديث
            </Button>
            <Button
              variant="contained"
              startIcon={<AddRounded />}
              onClick={() => setCreating(true)}
            >
              بطاقة جديدة
            </Button>
          </>
        }
      />
      <DataTable columns={columns} rows={rows} loading={loading} emptyMessage="لا توجد بطاقات." />
      <EntityDrawer
        open={creating}
        onClose={() => setCreating(false)}
        title="بطاقة اعتماد جديدة"
        onSubmit={create}
        submitLabel="إنشاء"
      >
        <Field label="اسم البطاقة" required>
          <TextField value={label} onChange={(event) => setLabel(event.target.value)} />
        </Field>
      </EntityDrawer>
      <AppSnackbar state={toast} onClose={() => setToast(null)} />
    </div>
  );
}

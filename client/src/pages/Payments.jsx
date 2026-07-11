import React, { useState, useEffect } from 'react';
import { useAuth } from '../app/AuthContext.jsx';
import { useLanguage } from '../i18n/config.js';
import PageHeader from '../components/navigation/PageHeader.jsx';
import DataTable from '../components/data-display/DataTable.jsx';
import StatusChip from '../components/data-display/StatusChip.jsx';
import ConfirmDialog from '../components/feedback/ConfirmDialog.jsx';
import {
  Box,
  Typography,
  Button,
  Alert,
  Card,
  CardContent
} from '@mui/material';
import { Refresh as RefreshIcon, PowerSettingsNew as PowerIcon } from '@mui/icons-material';

export function Payments() {
  const { token } = useAuth();
  const { dir } = useLanguage();
  const [paymentMethodsList, setPaymentMethodsList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Status Toggle Confirmation States
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [selectedMethodForToggle, setSelectedMethodForToggle] = useState(null);

  const loadPaymentMethods = async () => {
    if (!token) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/payment-methods', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const payload = await res.json();
      if (res.status === 200) {
        setPaymentMethodsList(payload.data || []);
      } else {
        setError(payload.error || 'فشل تحميل طرق الدفع.');
      }
    } catch (err) {
      setError('خطأ في الاتصال بالخادم.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPaymentMethods();
  }, [token]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleToggleClick = (method) => {
    setSelectedMethodForToggle(method);
    setConfirmOpen(true);
  };

  const confirmToggleStatus = async () => {
    if (!selectedMethodForToggle || submitting) return;
    const methodId = selectedMethodForToggle.id;
    const currentActive = selectedMethodForToggle.is_active;

    setConfirmOpen(false);
    setSubmitting(true);
    setError('');
    try {
      const updatedActiveIds = paymentMethodsList
        .filter((m) => (m.id === methodId ? !currentActive : m.is_active))
        .map((m) => m.id);

      const res = await fetch('/api/payment-methods/admin', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ active_ids: updatedActiveIds })
      });

      const payload = await res.json();
      if (res.status === 200) {
        setPaymentMethodsList(payload.data || []);
      } else {
        setError(payload.error || 'فشلت عملية تحديث طرق الدفع.');
      }
    } catch (err) {
      setError('حدث خطأ أثناء الاتصال بالخادم.');
    } finally {
      setSubmitting(false);
    }
  };

  // Mobile layout card representation
  const renderMobileRecord = (m) => (
    <Card variant="outlined" sx={{ borderRadius: 1 }}>
      <CardContent sx={{ p: 2 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 'bold' }}>
            {m.name_ar}
          </Typography>
          <StatusChip status={m.is_active ? 1 : 0} />
        </Box>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            الرمز: <code>{m.id}</code>
          </Typography>
          <Button
            variant="outlined"
            size="small"
            color={m.is_active ? 'error' : 'success'}
            startIcon={<PowerIcon />}
            onClick={() => handleToggleClick(m)}
            disabled={submitting}
            sx={{ fontFamily: 'Cairo' }}
          >
            {m.is_active ? 'تعطيل' : 'تفعيل'}
          </Button>
        </Box>
      </CardContent>
    </Card>
  );

  return (
    <Box>
      {/* Content Header */}
      <PageHeader
        titleKey="nav.paymentMethods"
        actions={
          <Button
            variant="contained"
            startIcon={<RefreshIcon />}
            onClick={loadPaymentMethods}
            sx={{ fontFamily: 'Cairo' }}
          >
            تحديث القائمة
          </Button>
        }
      />

      <Typography variant="body2" sx={{ color: 'text.secondary', mb: 3, fontFamily: 'Cairo', textAlign: dir === 'rtl' ? 'right' : 'left' }}>
        تفعيل أو تعطيل طرق الدفع المتاحة للكاشير أثناء تسجيل عمليات البيع أو الحجز في نقطة البيع (POS).
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 3, fontFamily: 'Cairo', textAlign: dir === 'rtl' ? 'right' : 'left' }}>
          {error}
        </Alert>
      )}

      <DataTable
        loading={loading}
        columns={[
          { id: 'id', label: 'الرمز التعريفي', render: (m) => <code>{m.id}</code> },
          { id: 'name', label: 'طريقة الدفع (بالعربية)', render: (m) => <strong>{m.name_ar}</strong> },
          {
            id: 'is_active',
            label: 'الحالة',
            render: (m) => <StatusChip status={m.is_active ? 1 : 0} />
          },
          {
            id: 'actions',
            label: 'العمليات',
            render: (m) => (
              <Button
                variant="outlined"
                size="small"
                className="table-action-btn"
                color={m.is_active ? 'error' : 'success'}
                startIcon={<PowerIcon />}
                onClick={() => handleToggleClick(m)}
                disabled={submitting}
                sx={{ fontFamily: 'Cairo' }}
              >
                <span className="btn-text">{m.is_active ? 'تعطيل' : 'تفعيل'}</span>
              </Button>
            )
          }
        ]}
        rows={paymentMethodsList}
        mobileRenderer={renderMobileRecord}
        emptyTitle="لا توجد طرق دفع معرفة"
        emptyDescription="تحقق من إعدادات قاعدة البيانات أو الخادم الخاص بك."
      />

      {/* Confirmation dialog for payment status toggle */}
      <ConfirmDialog
        open={confirmOpen}
        title="تغيير حالة طريقة الدفع"
        description={
          selectedMethodForToggle?.is_active
            ? `هل أنت متأكد من رغبتك في تعطيل طريقة الدفع "${selectedMethodForToggle?.name_ar}"؟ لن يتمكن الكاشير من اختيارها لتسجيل المعاملات في نقطة البيع.`
            : `هل أنت متأكد من رغبتك في تفعيل طريقة الدفع "${selectedMethodForToggle?.name_ar}"؟`
        }
        type="warning"
        confirmText="تأكيد"
        cancelText="إلغاء"
        onConfirm={confirmToggleStatus}
        onCancel={() => setConfirmOpen(false)}
      />
    </Box>
  );
}

export default Payments;

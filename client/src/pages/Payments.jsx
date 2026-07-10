import React, { useState, useEffect } from 'react';
import { useAuth } from '../app/AuthContext.jsx';
import {
  Box,
  Typography,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  CircularProgress,
  Alert,
  Chip
} from '@mui/material';
import { Refresh as RefreshIcon, PowerSettingsNew as PowerIcon } from '@mui/icons-material';

export function Payments() {
  const { token } = useAuth();
  const [paymentMethodsList, setPaymentMethodsList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

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
  }, [token]);

  const handleTogglePaymentMethod = async (methodId, currentActive) => {
    if (submitting) return;
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

  return (
    <Box>
      {/* Content Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5" sx={{ fontWeight: 'bold', color: 'primary.main', fontFamily: 'Cairo' }}>
          إدارة طرق الدفع (Payment Methods)
        </Typography>
        <Button
          variant="contained"
          startIcon={<RefreshIcon />}
          onClick={loadPaymentMethods}
          sx={{ fontFamily: 'Cairo' }}
        >
          تحديث القائمة
        </Button>
      </Box>

      <Typography variant="body2" sx={{ color: 'text.secondary', mb: 3, fontFamily: 'Cairo', textAlign: 'right' }}>
        تفعيل أو تعطيل طرق الدفع المتاحة للكاشير أثناء تسجيل عمليات البيع أو الحجز في نقطة البيع (POS).
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 3, fontFamily: 'Cairo', textAlign: 'right' }}>
          {error}
        </Alert>
      )}

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 5 }}>
          <CircularProgress />
        </Box>
      ) : (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>الرمز التعريفي</TableCell>
                <TableCell>طريقة الدفع (بالعربية)</TableCell>
                <TableCell>الحالة</TableCell>
                <TableCell>العمليات</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {paymentMethodsList.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} align="center" sx={{ color: 'text.secondary', py: 4, fontFamily: 'Cairo' }}>
                    لا توجد طرق دفع معرفة.
                  </TableCell>
                </TableRow>
              ) : (
                paymentMethodsList.map((m) => (
                  <TableRow key={m.id} hover>
                    <TableCell>
                      <code>{m.id}</code>
                    </TableCell>
                    <TableCell sx={{ fontWeight: 'bold' }}>{m.name_ar}</TableCell>
                    <TableCell>
                      <Chip
                        label={m.is_active ? 'مفعلة' : 'معطلة'}
                        color={m.is_active ? 'success' : 'error'}
                        size="small"
                        sx={{ fontWeight: 'bold', fontFamily: 'Cairo' }}
                      />
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="outlined"
                        size="small"
                        color={m.is_active ? 'error' : 'success'}
                        startIcon={<PowerIcon />}
                        onClick={() => handleTogglePaymentMethod(m.id, m.is_active)}
                        disabled={submitting}
                        sx={{ fontFamily: 'Cairo' }}
                      >
                        {m.is_active ? 'تعطيل' : 'تفعيل'}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Box>
  );
}

export default Payments;

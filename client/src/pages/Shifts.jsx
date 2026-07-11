import React, { useState, useEffect } from 'react';
import { useAuth } from '../app/AuthContext.jsx';
import { useLanguage } from '../i18n/config.js';
import PageHeader from '../components/navigation/PageHeader.jsx';
import DataTable from '../components/data-display/DataTable.jsx';
import StatusChip from '../components/data-display/StatusChip.jsx';
import ConfirmDialog from '../components/feedback/ConfirmDialog.jsx';
import EntityDrawer from '../components/drawers/EntityDrawer.jsx';
import {
  Box,
  Typography,
  Button,
  Card,
  CardContent,
  TextField,
  Alert,
  CircularProgress,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow
} from '@mui/material';
import {
  Refresh as RefreshIcon,
  Check as CheckIcon,
  Close as CloseIcon,
  Visibility as ViewIcon
} from '@mui/icons-material';

export function Shifts() {
  const { token, loadCurrentShift } = useAuth();
  const { dir } = useLanguage();
  const [pendingShifts, setPendingShifts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Drawer state
  const [selectedShift, setSelectedShift] = useState(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [adminNotesText, setAdminNotesText] = useState('');
  
  // Confirm actions state
  const [confirmApproveOpen, setConfirmApproveOpen] = useState(false);
  const [confirmRejectOpen, setConfirmRejectOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  const loadPendingShifts = async () => {
    if (!token) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/shifts/pending-review', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const payload = await res.json();
      if (res.status === 200) {
        setPendingShifts(payload.data || []);
      } else {
        setError(payload.error || 'فشل تحميل الورديات المعلقة.');
      }
    } catch (err) {
      setError('حدث خطأ بالاتصال بالخادم.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPendingShifts();
  }, [token]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleOpenReview = (shift) => {
    setSelectedShift(shift);
    setAdminNotesText('');
    setDrawerOpen(true);
  };

  const handleApproveConfirm = () => {
    setConfirmApproveOpen(true);
  };

  const handleRejectConfirm = () => {
    setConfirmRejectOpen(true);
  };

  const handleApproveShift = async () => {
    if (!token || !selectedShift) return;
    setConfirmApproveOpen(false);
    setActionLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/shifts/${selectedShift.id}/approve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ adminNotes: adminNotesText })
      });
      const payload = await res.json();
      if (res.status === 200) {
        setDrawerOpen(false);
        setSelectedShift(null);
        loadPendingShifts();
        loadCurrentShift(token);
      } else {
        setError(payload.error || 'فشل اعتماد إغلاق الوردية.');
      }
    } catch (err) {
      setError('حدث خطأ بالاتصال بالخادم.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRejectShift = async () => {
    if (!token || !selectedShift) return;
    setConfirmRejectOpen(false);
    setActionLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/shifts/${selectedShift.id}/reject`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ adminNotes: adminNotesText })
      });
      const payload = await res.json();
      if (res.status === 200) {
        setDrawerOpen(false);
        setSelectedShift(null);
        loadPendingShifts();
        loadCurrentShift(token);
      } else {
        setError(payload.error || 'فشل رفض إغلاق الوردية.');
      }
    } catch (err) {
      setError('حدث خطأ بالاتصال بالخادم.');
    } finally {
      setActionLoading(false);
    }
  };

  // Mobile Render Card
  const renderMobileShiftCard = (shift) => {
    const diff = shift.cashier_declared_cash - shift.system_total_cash;
    return (
      <Card variant="outlined" sx={{ borderRadius: 1 }}>
        <CardContent sx={{ p: 2 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 'bold' }}>الوردية #{shift.id}</Typography>
            <StatusChip status={2} label="بانتظار المراجعة" />
          </Box>
          <Typography variant="body2" sx={{ color: 'text.secondary', mb: 0.5 }}>
            الكاشير: {shift.cashier_name} ({shift.cashier_username})
          </Typography>
          <Typography variant="body2" sx={{ mb: 1, fontSize: '0.8rem', color: 'text.secondary' }}>
            تاريخ الفتح: {new Date(shift.opened_at).toLocaleDateString('ar-EG')}
          </Typography>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 1 }}>
            <Box>
              <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>عجز / زيادة</Typography>
              <Typography variant="body2" sx={{ fontWeight: 'bold', color: diff === 0 ? 'success.main' : diff < 0 ? 'error.main' : 'warning.main' }}>
                {diff === 0 ? 'مطابق' : diff < 0 ? `${(diff / 100).toFixed(2)} ج.م` : `+${(diff / 100).toFixed(2)} ج.م`}
              </Typography>
            </Box>
            <Button
              variant="outlined"
              size="small"
              startIcon={<ViewIcon />}
              onClick={() => handleOpenReview(shift)}
              sx={{ fontFamily: 'Cairo' }}
            >
              مراجعة
            </Button>
          </Box>
        </CardContent>
      </Card>
    );
  };

  return (
    <Box sx={{ width: '100%' }}>
      {/* Page Header */}
      <PageHeader
        titleKey="nav.shifts"
        actions={
          <Button
            variant="contained"
            startIcon={<RefreshIcon />}
            onClick={loadPendingShifts}
            sx={{ fontFamily: 'Cairo' }}
          >
            تحديث البيانات
          </Button>
        }
      />

      {error && (
        <Alert severity="error" sx={{ mb: 3, fontFamily: 'Cairo', textAlign: dir === 'rtl' ? 'right' : 'left' }}>
          {error}
        </Alert>
      )}

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 5 }}>
          <CircularProgress />
        </Box>
      ) : (
        <Card variant="outlined" sx={{ borderRadius: 1 }}>
          <CardContent sx={{ p: 0 }}>
            <DataTable
              columns={[
                { id: 'id', label: 'معرف الوردية', render: (s) => `#${s.id}` },
                { id: 'cashier_name', label: 'اسم الكاشير', render: (s) => `${s.cashier_name} (${s.cashier_username})` },
                {
                  id: 'opened_at',
                  label: 'تاريخ الفتح',
                  render: (s) => (
                    <span style={{ direction: 'ltr', display: 'inline-block' }}>
                      {new Date(s.opened_at).toLocaleString('ar-EG', { timeZone: 'Africa/Cairo' })}
                    </span>
                  )
                },
                {
                  id: 'closed_at',
                  label: 'تاريخ الفتح للإغلاق',
                  render: (s) => (
                    <span style={{ direction: 'ltr', display: 'inline-block' }}>
                      {s.closed_at ? new Date(s.closed_at).toLocaleString('ar-EG', { timeZone: 'Africa/Cairo' }) : '—'}
                    </span>
                  )
                },
                {
                  id: 'difference',
                  label: 'العجز والزيادة (الدرج)',
                  render: (s) => {
                    const diff = s.cashier_declared_cash - s.system_total_cash;
                    return (
                      <Typography variant="body2" sx={{ fontWeight: 'bold', color: diff === 0 ? 'success.main' : diff < 0 ? 'error.main' : 'warning.main' }}>
                        {diff === 0 ? 'مطابق تماماً' : diff < 0 ? `عجز: ${(diff / 100).toFixed(2)} ج.م` : `زيادة: +${(diff / 100).toFixed(2)} ج.م`}
                      </Typography>
                    );
                  }
                },
                {
                  id: 'actions',
                  label: 'العمليات',
                  render: (s) => (
                    <Button
                      variant="outlined"
                      size="small"
                      startIcon={<ViewIcon />}
                      onClick={() => handleOpenReview(s)}
                      sx={{ fontFamily: 'Cairo' }}
                    >
                      مراجعة الوردية
                    </Button>
                  )
                }
              ]}
              rows={pendingShifts}
              mobileRenderer={renderMobileShiftCard}
              emptyTitle="لا توجد ورديات معلقة حالياً"
              emptyDescription="سوف تظهر أي وردية يقوم الكاشير بإغلاقها بانتظار الاعتماد والمراجعة هنا للتحقق."
            />
          </CardContent>
        </Card>
      )}

      {/* Review Drawer */}
      <EntityDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title={`مراجعة وتدقيق الوردية #${selectedShift?.id}`}
      >
        {selectedShift && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {/* Shift metadata details */}
            <Paper variant="outlined" sx={{ p: 2, bgcolor: 'action.hover', fontSize: '0.85rem', display: 'flex', flexDirection: 'column', gap: 1 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mb: 1, fontFamily: 'Cairo' }}>البيانات الأساسية للوردية:</Typography>
              <div>الكاشير المسؤول: <strong>{selectedShift.cashier_name}</strong></div>
              <div>اسم الحساب: <code>{selectedShift.cashier_username}</code></div>
              <div>تاريخ ووقت الفتح LTR: <strong style={{ direction: 'ltr', display: 'inline-block' }}>{new Date(selectedShift.opened_at).toLocaleString('ar-EG', { timeZone: 'Africa/Cairo' })}</strong></div>
              <div>تاريخ ووقت الإغلاق LTR: <strong style={{ direction: 'ltr', display: 'inline-block' }}>{selectedShift.closed_at ? new Date(selectedShift.closed_at).toLocaleString('ar-EG', { timeZone: 'Africa/Cairo' }) : '—'}</strong></div>
            </Paper>

            {/* Detailed comparison table by payment method */}
            <Box>
              <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mb: 1, fontFamily: 'Cairo' }}>مطابقة الإيرادات حسب طريقة الدفع:</Typography>
              <TableContainer component={Paper} variant="outlined">
                <Table size="small">
                  <TableHead>
                    <TableRow sx={{ bgcolor: 'action.hover' }}>
                      <TableCell sx={{ fontFamily: 'Cairo', fontWeight: 'bold' }}>طريقة الدفع</TableCell>
                      <TableCell sx={{ fontFamily: 'Cairo', fontWeight: 'bold' }}>المتوقع بالنظام</TableCell>
                      <TableCell sx={{ fontFamily: 'Cairo', fontWeight: 'bold' }}>الفعلي المدخل</TableCell>
                      <TableCell sx={{ fontFamily: 'Cairo', fontWeight: 'bold' }}>الفارق</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {[
                      { label: 'نقدي (Cash)', system: selectedShift.system_total_cash, declared: selectedShift.cashier_declared_cash },
                      { label: 'بطاقة (Card)', system: selectedShift.system_total_card, declared: selectedShift.cashier_declared_card },
                      { label: 'إنستا باي (InstaPay)', system: selectedShift.system_total_instapay, declared: selectedShift.cashier_declared_instapay },
                      { label: 'محفظة (Wallet)', system: selectedShift.system_total_wallet, declared: selectedShift.cashier_declared_wallet },
                      { label: 'تحويل (Transfer)', system: selectedShift.system_total_transfer, declared: selectedShift.cashier_declared_transfer }
                    ].map((row, idx) => {
                      const difference = row.declared - row.system;
                      return (
                        <TableRow key={idx}>
                          <TableCell sx={{ fontWeight: 'bold', fontFamily: 'Cairo', fontSize: '0.8rem' }}>{row.label}</TableCell>
                          <TableCell sx={{ fontSize: '0.8rem' }}>{(row.system / 100).toFixed(2)} ج.م</TableCell>
                          <TableCell sx={{ fontSize: '0.8rem' }}>{(row.declared / 100).toFixed(2)} ج.م</TableCell>
                          <TableCell
                            sx={{
                              fontSize: '0.8rem',
                              fontWeight: 'bold',
                              color: difference === 0 ? 'success.main' : difference < 0 ? 'error.main' : 'warning.main'
                            }}
                          >
                            {difference === 0 ? '0.00' : difference < 0 ? `${(difference / 100).toFixed(2)} ج.م` : `+${(difference / 100).toFixed(2)}` }
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </TableContainer>
            </Box>

            {/* Admin notes input fields */}
            <TextField
              fullWidth
              multiline
              rows={3}
              label="ملاحظات وتوجيهات المدير لهذه الوردية"
              placeholder="اكتب أي ملاحظات أو قرارات تسوية فروقات..."
              value={adminNotesText}
              onChange={(e) => setAdminNotesText(e.target.value)}
              sx={{
                '& .MuiInputLabel-root': {
                  fontFamily: 'Cairo',
                  left: dir === 'rtl' ? 'auto' : 0,
                  right: dir === 'rtl' ? 24 : 'auto',
                  transformOrigin: dir === 'rtl' ? 'right' : 'left'
                },
                '& .MuiOutlinedInput-input': { fontFamily: 'Cairo', textAlign: dir === 'rtl' ? 'right' : 'left' }
              }}
            />

            {/* Action Buttons */}
            <Box sx={{ display: 'flex', gap: 2, mt: 1 }}>
              <Button
                fullWidth
                variant="contained"
                color="success"
                startIcon={<CheckIcon />}
                disabled={actionLoading}
                onClick={handleApproveConfirm}
                sx={{ fontFamily: 'Cairo', fontWeight: 'bold' }}
              >
                اعتماد وإغلاق الوردية
              </Button>
              <Button
                fullWidth
                variant="contained"
                color="error"
                startIcon={<CloseIcon />}
                disabled={actionLoading}
                onClick={handleRejectConfirm}
                sx={{ fontFamily: 'Cairo', fontWeight: 'bold' }}
              >
                رفض طلب الإغلاق
              </Button>
            </Box>
          </Box>
        )}
      </EntityDrawer>

      {/* Approve Confirm Dialog */}
      <ConfirmDialog
        open={confirmApproveOpen}
        title="تأكيد اعتماد إغلاق الوردية"
        description={`هل أنت متأكد من رغبتك في اعتماد وإغلاق الوردية #${selectedShift?.id}؟ سيتم تسوية أي فروقات وتأكيد الحساب المالي نهائياً.`}
        type="success"
        confirmText="تأكيد الاعتماد"
        cancelText="إلغاء"
        onConfirm={handleApproveShift}
        onCancel={() => setConfirmApproveOpen(false)}
      />

      {/* Reject Confirm Dialog */}
      <ConfirmDialog
        open={confirmRejectOpen}
        title="تأكيد رفض طلب إغلاق الوردية"
        description={`هل أنت متأكد من رغبتك في رفض طلب إغلاق الوردية #${selectedShift?.id}؟ سيعود الوردية لحالة مفتوحة نشطة للكاشير لتعديل البيانات أو تسجيل الإدخالات المتبقية.`}
        type="error"
        confirmText="تأكيد الرفض"
        cancelText="إلغاء"
        onConfirm={handleRejectShift}
        onCancel={() => setConfirmRejectOpen(false)}
      />
    </Box>
  );
}

export default Shifts;

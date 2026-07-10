import React, { useState, useEffect } from 'react';
import { useAuth } from '../app/AuthContext.jsx';
import {
  Box,
  Typography,
  Button,
  Grid,
  Card,
  CardContent,
  TextField,
  Alert,
  CircularProgress,
  Divider
} from '@mui/material';
import { Refresh as RefreshIcon, Check as CheckIcon, Close as CloseIcon } from '@mui/icons-material';

export function Shifts() {
  const { token, loadCurrentShift } = useAuth();
  const [pendingShifts, setPendingShifts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  const [reviewNotes, setReviewNotes] = useState({});
  const [actionLoadingId, setActionLoadingId] = useState(null);

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
  }, [token]);

  const handleApproveShift = async (shiftId) => {
    if (!token) return;
    setActionLoadingId(shiftId);
    setError('');
    try {
      const res = await fetch(`/api/shifts/${shiftId}/approve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ adminNotes: reviewNotes[shiftId] || '' })
      });
      const payload = await res.json();
      if (res.status === 200) {
        loadPendingShifts();
        loadCurrentShift(token);
      } else {
        setError(payload.error || 'فشل اعتماد إغلاق الوردية.');
      }
    } catch (err) {
      setError('حدث خطأ بالاتصال بالخادم.');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleRejectShift = async (shiftId) => {
    if (!token) return;
    setActionLoadingId(shiftId);
    setError('');
    try {
      const res = await fetch(`/api/shifts/${shiftId}/reject`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ adminNotes: reviewNotes[shiftId] || '' })
      });
      const payload = await res.json();
      if (res.status === 200) {
        loadPendingShifts();
        loadCurrentShift(token);
      } else {
        setError(payload.error || 'فشل رفض إغلاق الوردية.');
      }
    } catch (err) {
      setError('حدث خطأ بالاتصال بالخادم.');
    } finally {
      setActionLoadingId(null);
    }
  };

  return (
    <Box sx={{ width: '100%' }}>
      {/* Content Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5" sx={{ fontWeight: 'bold', color: 'primary.main', fontFamily: 'Cairo' }}>
          مراجعة واعتماد الورديات المعلقة
        </Typography>
        <Button
          variant="contained"
          startIcon={<RefreshIcon />}
          onClick={loadPendingShifts}
          sx={{ fontFamily: 'Cairo' }}
        >
          تحديث البيانات
        </Button>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3, fontFamily: 'Cairo', textAlign: 'right' }}>
          {error}
        </Alert>
      )}

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 5 }}>
          <CircularProgress />
        </Box>
      ) : pendingShifts.length === 0 ? (
        <Paper variant="outlined" sx={{ p: 4, textAlign: 'center', color: 'text.secondary', fontFamily: 'Cairo' }}>
          لا توجد ورديات معلقة بانتظار المراجعة والاعتماد حالياً.
        </Paper>
      ) : (
        <Grid container spacing={3}>
          {pendingShifts.map((shift) => {
            const diff = shift.cashier_declared_cash - shift.system_total_cash;
            return (
              <Grid item xs={12} key={shift.id}>
                <Card variant="outlined">
                  <CardContent>
                    <Grid container spacing={3}>
                      {/* Left: Shift Details */}
                      <Grid item xs={12} md={6} sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                        <Typography variant="subtitle1" sx={{ fontWeight: 'bold', fontFamily: 'Cairo', mb: 1 }}>
                          الوردية #{shift.id} - الكاشير: {shift.cashier_name} ({shift.cashier_username})
                        </Typography>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                          <span>تاريخ البدء:</span>
                          <span>{new Date(shift.opened_at).toLocaleString('ar-EG', { timeZone: 'Africa/Cairo' })}</span>
                        </Box>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                          <span>تاريخ تقديم الطلب:</span>
                          <span>{shift.closed_at ? new Date(shift.closed_at).toLocaleString('ar-EG', { timeZone: 'Africa/Cairo' }) : '-'}</span>
                        </Box>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                          <span>عهدة الصندوق الابتدائية (مبلغ البداية):</span>
                          <strong>{(shift.opening_cash / 100).toFixed(2)} ج.م</strong>
                        </Box>
                        <Divider sx={{ my: 1 }} />
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                          <span>الرصيد النقدي المتوقع بالدرج:</span>
                          <span>{(shift.system_total_cash / 100).toFixed(2)} ج.م</span>
                        </Box>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                          <span>الرصيد النقدي الفعلي (المعلن من الكاشير):</span>
                          <Typography variant="body2" sx={{ fontWeight: 'bold', color: 'primary.main' }}>
                            {(shift.cashier_declared_cash / 100).toFixed(2)} ج.م
                          </Typography>
                        </Box>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', fontWeight: 'bold', borderTop: '1px dotted', borderColor: 'divider', pt: 1, mt: 1 }}>
                          <span>الفروقات (العجز / الزيادة):</span>
                          {diff === 0 ? (
                            <Typography variant="body2" sx={{ color: 'success.main', fontWeight: 'bold' }}>
                              متطابق (0.00 ج.م)
                            </Typography>
                          ) : diff > 0 ? (
                            <Typography variant="body2" sx={{ color: 'success.main', fontWeight: 'bold' }}>
                              +{ (diff / 100).toFixed(2) } ج.م (زيادة بالدرج)
                            </Typography>
                          ) : (
                            <Typography variant="body2" sx={{ color: 'error.main', fontWeight: 'bold' }}>
                              { (diff / 100).toFixed(2) } ج.م (عجز بالصندوق)
                            </Typography>
                          )}
                        </Box>
                      </Grid>

                      {/* Right: Notes & Actions */}
                      <Grid item xs={12} md={6} sx={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                        <TextField
                          fullWidth
                          multiline
                          rows={3}
                          label="ملاحظات واعتماد المدير لهذه الوردية *"
                          placeholder="أدخل ملاحظات المراجعة أو الفروقات..."
                          value={reviewNotes[shift.id] || ''}
                          onChange={(e) => setReviewNotes((prev) => ({ ...prev, [shift.id]: e.target.value }))}
                          sx={{ mb: 2, '& .MuiInputLabel-root': { fontFamily: 'Cairo' }, '& .MuiOutlinedInput-input': { fontFamily: 'Cairo' } }}
                        />

                        <Box sx={{ display: 'flex', gap: 2 }}>
                          <Button
                            fullWidth
                            variant="contained"
                            color="success"
                            startIcon={<CheckIcon />}
                            onClick={() => handleApproveShift(shift.id)}
                            disabled={actionLoadingId === shift.id}
                            sx={{ fontFamily: 'Cairo', fontWeight: 'bold' }}
                          >
                            {actionLoadingId === shift.id ? 'جاري الاعتماد...' : 'اعتماد الإغلاق'}
                          </Button>
                          <Button
                            fullWidth
                            variant="contained"
                            color="error"
                            startIcon={<CloseIcon />}
                            onClick={() => handleRejectShift(shift.id)}
                            disabled={actionLoadingId === shift.id}
                            sx={{ fontFamily: 'Cairo', fontWeight: 'bold' }}
                          >
                            {actionLoadingId === shift.id ? 'جاري الرفض...' : 'رفض طلب الإغلاق'}
                          </Button>
                        </Box>
                      </Grid>
                    </Grid>
                  </CardContent>
                </Card>
              </Grid>
            );
          })}
        </Grid>
      )}
    </Box>
  );
}

export default Shifts;

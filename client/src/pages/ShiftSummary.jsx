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
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  CircularProgress,
  Divider,
  Paper
} from '@mui/material';
import { Refresh as RefreshIcon, Save as SaveIcon, SwapHoriz as SwapIcon } from '@mui/icons-material';

export function ShiftSummary() {
  const { token, setCurrentShift, loadCurrentShift } = useAuth();
  
  const [shiftSummary, setShiftSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Close shift request state
  const [actualClosingCashInput, setActualClosingCashInput] = useState('');
  const [closeLoading, setCloseLoading] = useState(false);
  const [closeError, setCloseError] = useState('');

  // Cash movement state
  const [movementTypeInput, setMovementTypeInput] = useState('PAY_OUT');
  const [movementAmountInput, setMovementAmountInput] = useState('');
  const [movementNotesInput, setMovementNotesInput] = useState('');
  const [movementLoading, setMovementLoading] = useState(false);
  const [movementError, setMovementError] = useState('');
  const [movementSuccess, setMovementSuccess] = useState('');

  const loadShiftSummary = async () => {
    if (!token) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/shifts/current/summary', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const payload = await res.json();
      if (res.status === 200) {
        setShiftSummary(payload.data);
      } else {
        setError(payload.error || 'فشل تحميل ملخص الوردية.');
      }
    } catch (err) {
      setError('حدث خطأ بالاتصال بالخادم.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadShiftSummary();
  }, [token]);

  const handleRequestCloseShift = async (e) => {
    e.preventDefault();
    if (!token) return;
    if (!actualClosingCashInput.trim()) {
      setCloseError('يرجى إدخال مبلغ العهدة الفعلية في الصندوق أولاً.');
      return;
    }

    setCloseLoading(true);
    setCloseError('');
    try {
      const res = await fetch('/api/shifts/current/close-request', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ actualClosingCash: parseFloat(actualClosingCashInput) || 0 })
      });
      const payload = await res.json();
      if (res.status === 200) {
        setActualClosingCashInput('');
        setCurrentShift(payload.data);
        loadShiftSummary();
        loadCurrentShift(token);
      } else {
        setCloseError(payload.error || 'فشل تقديم طلب إغلاق الوردية.');
      }
    } catch (err) {
      setCloseError('حدث خطأ بالاتصال بالخادم.');
    } finally {
      setCloseLoading(false);
    }
  };

  const handleRegisterCashMovement = async (e) => {
    e.preventDefault();
    if (!token) return;
    if (!movementAmountInput.trim()) {
      setMovementError('يرجى إدخال مبلغ الحركة أولاً.');
      return;
    }

    setMovementLoading(true);
    setMovementError('');
    setMovementSuccess('');
    try {
      const res = await fetch('/api/shifts/current/cash-movement', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          type: movementTypeInput,
          amount: parseFloat(movementAmountInput) || 0,
          notes: movementNotesInput
        })
      });
      const payload = await res.json();
      if (res.status === 200) {
        setMovementAmountInput('');
        setMovementNotesInput('');
        setMovementSuccess('تم تسجيل الحركة النقدية بنجاح.');
        loadShiftSummary();
      } else {
        setMovementError(payload.error || 'فشل تسجيل الحركة النقدية.');
      }
    } catch (err) {
      setMovementError('حدث خطأ بالاتصال بالخادم.');
    } finally {
      setMovementLoading(false);
    }
  };

  return (
    <Box sx={{ width: '100%' }}>
      {/* Content Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5" sx={{ fontWeight: 'bold', color: 'primary.main', fontFamily: 'Cairo' }}>
          ملخص الوردية الحالية للكاشير
        </Typography>
        <Button
          variant="contained"
          startIcon={<RefreshIcon />}
          onClick={loadShiftSummary}
          sx={{ fontFamily: 'Cairo' }}
        >
          تحديث ملخص الوردية
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
      ) : !shiftSummary ? (
        <Paper variant="outlined" sx={{ p: 4, textAlign: 'center', color: 'text.secondary', fontFamily: 'Cairo' }}>
          لا توجد وردية نشطة مفتوحة حالياً للكاشير. يرجى الذهاب لنقطة البيع لفتح وردية جديدة.
        </Paper>
      ) : (
        <Grid container spacing={3}>
          {/* Shift KPI Headers */}
          <Grid item xs={12} sm={4}>
            <Card variant="outlined">
              <CardContent sx={{ p: 2 }}>
                <Typography variant="caption" sx={{ color: 'text.secondary', fontFamily: 'Cairo' }}>معرف الوردية</Typography>
                <Typography variant="h6" sx={{ fontWeight: 'bold', mt: 1 }}>
                  #{shiftSummary.shift.id}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={4}>
            <Card variant="outlined">
              <CardContent sx={{ p: 2 }}>
                <Typography variant="caption" sx={{ color: 'text.secondary', fontFamily: 'Cairo' }}>وقت بدء الوردية</Typography>
                <Typography variant="body2" sx={{ fontWeight: 'bold', mt: 1, fontFamily: 'Cairo' }}>
                  {new Date(shiftSummary.shift.opened_at).toLocaleString('ar-EG', { timeZone: 'Africa/Cairo' })}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={4}>
            <Card variant="outlined">
              <CardContent sx={{ p: 2 }}>
                <Typography variant="caption" sx={{ color: 'text.secondary', fontFamily: 'Cairo' }}>الحالة الحالية</Typography>
                <Typography
                  variant="h6"
                  sx={{
                    fontWeight: 'bold',
                    mt: 1,
                    fontFamily: 'Cairo',
                    color: shiftSummary.shift.status === 'OPEN' ? 'success.main' : 'warning.main'
                  }}
                >
                  {shiftSummary.shift.status === 'OPEN' ? 'نشطة / مفتوحة' : 'بانتظار موافقة الإغلاق'}
                </Typography>
              </CardContent>
            </Card>
          </Grid>

          {/* Left: Financial Drawer Details & Close Shift Request */}
          <Grid item xs={12} md={6}>
            <Card variant="outlined" sx={{ height: '100%' }}>
              <CardContent sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 'bold', borderBottom: '1px solid', borderColor: 'divider', pb: 1, mb: 1, fontFamily: 'Cairo' }}>
                  مطابقة نقدية الصندوق (Cash Drawer Summary)
                </Typography>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                  <span>عهدة الصندوق الابتدائية (مبلغ البداية):</span>
                  <strong>{(shiftSummary.shift.opening_cash / 100).toFixed(2)} ج.م</strong>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                  <span>إجمالي المدفوعات النقدية المحصلة:</span>
                  <Typography variant="body2" sx={{ color: 'success.main', fontWeight: 'bold' }}>
                    {((shiftSummary.payments.find(p => p.payment_method === 'Cash')?.total_amount || 0) / 100).toFixed(2)} ج.m
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                  <span>إجمالي حركات الاستلام النقدي الوارد (Pay-In):</span>
                  <span>
                    {((shiftSummary.cashMovements.find(m => m.type === 'PAY_IN')?.total_amount || 0) / 100).toFixed(2)} ج.م
                  </span>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                  <span>إجمالي حركات الصرف النقدي الخارج (Pay-Out):</span>
                  <Typography variant="body2" sx={{ color: 'error.main' }}>
                    -{((shiftSummary.cashMovements.find(m => m.type === 'PAY_OUT')?.total_amount || 0) / 100).toFixed(2)} ج.م
                  </Typography>
                </Box>
                <Divider sx={{ my: 1 }} />
                <Box sx={{ display: 'flex', justifyContent: 'space-between', fontSize: '1rem', fontWeight: 'bold', color: 'success.main' }}>
                  <span>الرصيد النقدي المتوقع بالدرج:</span>
                  <span>{(shiftSummary.expectedClosingCash / 100).toFixed(2)} ج.م</span>
                </Box>

                {shiftSummary.shift.status === 'OPEN' && (
                  <Box sx={{ mt: 3, pt: 2, borderTop: '1px solid', borderColor: 'divider' }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mb: 2, fontFamily: 'Cairo' }}>
                      تقديم طلب إغلاق الوردية
                    </Typography>
                    {closeError && (
                      <Alert severity="error" sx={{ mb: 2, fontFamily: 'Cairo', textAlign: 'right' }}>
                        {closeError}
                      </Alert>
                    )}
                    <form onSubmit={handleRequestCloseShift}>
                      <Grid container spacing={2} alignItems="flex-end">
                        <Grid item xs={12}>
                          <TextField
                            fullWidth
                            required
                            type="number"
                            inputProps={{ step: '0.01', min: '0' }}
                            label="مبلغ النقدية الفعلي الموجود في الدرج (ج.م) *"
                            placeholder="أدخل المبلغ الفعلي بالدرج..."
                            value={actualClosingCashInput}
                            onChange={(e) => setActualClosingCashInput(e.target.value)}
                            size="small"
                            sx={{ '& .MuiInputLabel-root': { fontFamily: 'Cairo' }, '& .MuiOutlinedInput-input': { fontFamily: 'Cairo' } }}
                          />
                        </Grid>
                        <Grid item xs={12}>
                          <Button
                            fullWidth
                            type="submit"
                            variant="contained"
                            color="warning"
                            disabled={closeLoading}
                            sx={{ fontFamily: 'Cairo', fontWeight: 'bold', color: '#000' }}
                          >
                            {closeLoading ? 'جاري تقديم الطلب...' : 'إرسال طلب إغلاق الوردية للمراجعة'}
                          </Button>
                        </Grid>
                      </Grid>
                    </form>
                  </Box>
                )}
              </CardContent>
            </Card>
          </Grid>

          {/* Right: Payment breakdowns & general stats */}
          <Grid item xs={12} md={6}>
            <Card variant="outlined" sx={{ height: '100%' }}>
              <CardContent sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                <Box>
                  <Typography variant="subtitle1" sx={{ fontWeight: 'bold', borderBottom: '1px solid', borderColor: 'divider', pb: 1, mb: 2, fontFamily: 'Cairo' }}>
                    إحصائيات المبيعات العامة
                  </Typography>
                  <Grid container spacing={2}>
                    <Grid item xs={6}>
                      <Box sx={{ bgcolor: 'action.hover', p: 2, borderRadius: 1, textAlign: 'center' }}>
                        <Typography variant="caption" sx={{ color: 'text.secondary', fontFamily: 'Cairo' }}>عدد فواتير البيع</Typography>
                        <Typography variant="h6" sx={{ fontWeight: 'bold', mt: 0.5 }}>
                          {shiftSummary.sales.count}
                        </Typography>
                      </Box>
                    </Grid>
                    <Grid item xs={6}>
                      <Box sx={{ bgcolor: 'action.hover', p: 2, borderRadius: 1, textAlign: 'center' }}>
                        <Typography variant="caption" sx={{ color: 'text.secondary', fontFamily: 'Cairo' }}>صافي قيمة الفواتير</Typography>
                        <Typography variant="h6" sx={{ color: 'primary.main', fontWeight: 'bold', mt: 0.5 }}>
                          {(shiftSummary.sales.total_amount / 100).toFixed(2)} ج.م
                        </Typography>
                      </Box>
                    </Grid>
                  </Grid>
                </Box>

                <Box>
                  <Typography variant="subtitle1" sx={{ fontWeight: 'bold', borderBottom: '1px solid', borderColor: 'divider', pb: 1, mb: 2, fontFamily: 'Cairo' }}>
                    تفصيل الإيرادات المحصلة حسب طريقة الدفع
                  </Typography>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                    {shiftSummary.payments.map((p, idx) => (
                      <Box key={idx} sx={{ display: 'flex', justifyContent: 'space-between', bgcolor: 'action.hover', px: 2, py: 1, borderRadius: 1 }}>
                        <Typography variant="body2" sx={{ fontWeight: 'bold', fontFamily: 'Cairo' }}>
                          {p.payment_method === 'Cash' ? 'نقدي (Cash)' :
                           p.payment_method === 'Card' ? 'بطاقة ائتمان (Card)' :
                           p.payment_method === 'InstaPay' ? 'إنستا باي (InstaPay)' :
                           p.payment_method === 'Wallet' ? 'محفظة إلكترونية (Wallet)' :
                           p.payment_method === 'Transfer' ? 'تحويل بنكي (Transfer)' : p.payment_method}
                        </Typography>
                        <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                          {(p.total_amount / 100).toFixed(2)} ج.م
                        </Typography>
                      </Box>
                    ))}
                    {shiftSummary.payments.length === 0 && (
                      <Typography variant="body2" sx={{ color: 'text.secondary', textAlign: 'center', py: 2, fontFamily: 'Cairo' }}>
                        لم يتم تحصيل أي مدفوعات خلال هذه الوردية بعد.
                      </Typography>
                    )}
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>

          {/* Bottom: Cash movements registration section */}
          {shiftSummary.shift.status === 'OPEN' && (
            <Grid item xs={12}>
              <Card variant="outlined">
                <CardContent>
                  <Typography variant="subtitle1" sx={{ fontWeight: 'bold', borderBottom: '1px solid', borderColor: 'divider', pb: 1, mb: 2, fontFamily: 'Cairo' }}>
                    تسجيل حركة نقدية بالدرج (إيداع وارد / مصروفات منصرفة)
                  </Typography>

                  {movementError && (
                    <Alert severity="error" sx={{ mb: 2, fontFamily: 'Cairo', textAlign: 'right' }}>
                      {movementError}
                    </Alert>
                  )}
                  {movementSuccess && (
                    <Alert severity="success" sx={{ mb: 2, fontFamily: 'Cairo', textAlign: 'right' }}>
                      {movementSuccess}
                    </Alert>
                  )}

                  <form onSubmit={handleRegisterCashMovement}>
                    <Grid container spacing={2} alignItems="flex-end">
                      <Grid item xs={12} sm={3}>
                        <FormControl fullWidth size="small">
                          <InputLabel>نوع الحركة</InputLabel>
                          <Select
                            value={movementTypeInput}
                            label="نوع الحركة"
                            onChange={(e) => setMovementTypeInput(e.target.value)}
                          >
                            <MenuItem value="PAY_OUT">صرف نقدي (منصرف/مصروفات)</MenuItem>
                            <MenuItem value="PAY_IN">إيداع نقدي (وارد/فكة)</MenuItem>
                          </Select>
                        </FormControl>
                      </Grid>
                      <Grid item xs={12} sm={3}>
                        <TextField
                          fullWidth
                          required
                          type="number"
                          inputProps={{ step: '0.01', min: '0.01' }}
                          label="المبلغ (بالجنيه المصري) *"
                          placeholder="المبلغ..."
                          value={movementAmountInput}
                          onChange={(e) => setMovementAmountInput(e.target.value)}
                          size="small"
                          sx={{ '& .MuiInputLabel-root': { fontFamily: 'Cairo' }, '& .MuiOutlinedInput-input': { fontFamily: 'Cairo' } }}
                        />
                      </Grid>
                      <Grid item xs={12} sm={4}>
                        <TextField
                          fullWidth
                          label="البيان / سبب الحركة"
                          placeholder="مثال: شراء لوازم مكتبية، فكة الدرج، إلخ..."
                          value={movementNotesInput}
                          onChange={(e) => setMovementNotesInput(e.target.value)}
                          size="small"
                          sx={{ '& .MuiInputLabel-root': { fontFamily: 'Cairo' }, '& .MuiOutlinedInput-input': { fontFamily: 'Cairo' } }}
                        />
                      </Grid>
                      <Grid item xs={12} sm={2}>
                        <Button
                          fullWidth
                          type="submit"
                          variant="contained"
                          startIcon={<SwapIcon />}
                          disabled={movementLoading}
                          sx={{ height: 40, fontFamily: 'Cairo', fontWeight: 'bold' }}
                        >
                          {movementLoading ? 'جاري التسجيل...' : 'تسجيل الحركة'}
                        </Button>
                      </Grid>
                    </Grid>
                  </form>
                </CardContent>
              </Card>
            </Grid>
          )}
        </Grid>
      )}
    </Box>
  );
}

export default ShiftSummary;

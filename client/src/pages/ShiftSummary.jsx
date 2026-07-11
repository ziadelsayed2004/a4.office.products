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
  Grid,
  Card,
  CardContent,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  Divider,
  Paper,
  Chip,
  CircularProgress
} from '@mui/material';
import { Refresh as RefreshIcon, SwapHoriz as SwapIcon } from '@mui/icons-material';

export function ShiftSummary() {
  const { token, setCurrentShift, loadCurrentShift } = useAuth();
  const { dir } = useLanguage();
  
  const [shiftSummary, setShiftSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Close shift request state
  const [actualClosingCashInput, setActualClosingCashInput] = useState('');
  const [closeLoading, setCloseLoading] = useState(false);
  const [closeError, setCloseError] = useState('');
  const [confirmCloseOpen, setConfirmCloseOpen] = useState(false);

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
  }, [token]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleOpenCloseConfirm = (e) => {
    e.preventDefault();
    if (!actualClosingCashInput.trim() || isNaN(parseFloat(actualClosingCashInput))) {
      setCloseError('يرجى إدخال مبلغ العهدة الفعلية في الصندوق أولاً بشكل صحيح.');
      return;
    }
    setCloseError('');
    setConfirmCloseOpen(true);
  };

  const handleRequestCloseShift = async () => {
    if (!token) return;
    setConfirmCloseOpen(false);
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
    if (!movementAmountInput.trim() || isNaN(parseFloat(movementAmountInput)) || parseFloat(movementAmountInput) <= 0) {
      setMovementError('يرجى إدخال مبلغ الحركة بشكل صحيح (أكبر من الصفر).');
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

  // Difference Calculations
  const expectedCashAmount = shiftSummary ? shiftSummary.expectedClosingCash / 100 : 0;
  const actualClosingCash = actualClosingCashInput ? parseFloat(actualClosingCashInput) : null;
  const cashDifference = actualClosingCash !== null ? actualClosingCash - expectedCashAmount : 0;

  // Recorded Cash Movements mapping for Mobile Cards
  const renderMobileMovementCard = (m) => (
    <Card variant="outlined" sx={{ borderRadius: 1 }}>
      <CardContent sx={{ p: 2 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
          <Chip
            label={m.type === 'PAY_IN' ? 'إيداع نقدي' : 'صرف نقدي'}
            color={m.type === 'PAY_IN' ? 'success' : 'error'}
            size="small"
            sx={{ fontFamily: 'Cairo', fontWeight: 'bold' }}
          />
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            {new Date(m.created_at).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}
          </Typography>
        </Box>
        <Typography variant="body2" sx={{ fontWeight: 'bold', mb: 0.5 }}>
          المبلغ: {m.type === 'PAY_OUT' ? '-' : '+'}{(m.amount / 100).toFixed(2)} ج.م
        </Typography>
        {m.notes && (
          <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', bgcolor: 'action.hover', p: 1, borderRadius: 0.5 }}>
            السبب: {m.notes}
          </Typography>
        )}
      </CardContent>
    </Card>
  );

  return (
    <Box sx={{ width: '100%' }}>
      {/* Content Header */}
      <PageHeader
        titleKey="nav.shiftSummary"
        actions={
          <Button
            variant="contained"
            startIcon={<RefreshIcon />}
            onClick={loadShiftSummary}
            sx={{ fontFamily: 'Cairo' }}
          >
            تحديث ملخص الوردية
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
      ) : !shiftSummary ? (
        <Paper variant="outlined" sx={{ p: 4, textAlign: 'center', color: 'text.secondary', fontFamily: 'Cairo' }}>
          لا توجد وردية نشطة مفتوحة حالياً للكاشير. يرجى الذهاب لنقطة البيع لفتح وردية جديدة للعمل.
        </Paper>
      ) : (
        <Box>
          {/* Shift KPI Headers */}
          <Grid container spacing={3} sx={{ mb: 3 }}>
            <Grid item xs={12} sm={6} md={3}>
              <Card variant="outlined" sx={{ borderRadius: 1 }}>
                <CardContent sx={{ p: 2 }}>
                  <Typography variant="caption" sx={{ color: 'text.secondary', fontFamily: 'Cairo' }}>رقم الوردية الحالية</Typography>
                  <Typography variant="h6" sx={{ fontWeight: 'bold', mt: 1 }}>
                    #{shiftSummary.shift.id}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Card variant="outlined" sx={{ borderRadius: 1 }}>
                <CardContent sx={{ p: 2 }}>
                  <Typography variant="caption" sx={{ color: 'text.secondary', fontFamily: 'Cairo' }}>تاريخ ووقت بدء العمل</Typography>
                  <Typography variant="body2" sx={{ fontWeight: 'bold', mt: 1, direction: 'ltr', textAlign: dir === 'rtl' ? 'right' : 'left' }}>
                    {new Date(shiftSummary.shift.opened_at).toLocaleString('ar-EG', { timeZone: 'Africa/Cairo' })}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Card variant="outlined" sx={{ borderRadius: 1 }}>
                <CardContent sx={{ p: 2 }}>
                  <Typography variant="caption" sx={{ color: 'text.secondary', fontFamily: 'Cairo' }}>رصيد الدرج المتوقع</Typography>
                  <Typography variant="h6" sx={{ color: 'primary.main', fontWeight: 'bold', mt: 1 }}>
                    {(shiftSummary.expectedClosingCash / 100).toFixed(2)} ج.م
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Card variant="outlined" sx={{ borderRadius: 1 }}>
                <CardContent sx={{ p: 2 }}>
                  <Typography variant="caption" sx={{ color: 'text.secondary', fontFamily: 'Cairo' }}>حالة الوردية</Typography>
                  <Box sx={{ mt: 1 }}>
                    <StatusChip status={shiftSummary.shift.status === 'OPEN' ? 1 : 2} label={shiftSummary.shift.status === 'OPEN' ? 'مفتوحة / نشطة' : 'بانتظار المراجعة'} />
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          </Grid>

          {/* Two Columns Section */}
          <Grid container spacing={3} sx={{ mb: 3 }}>
            {/* Left: Financial Drawer Details & Close Shift Request */}
            <Grid item xs={12} md={6}>
              <Card variant="outlined" sx={{ height: '100%', borderRadius: 1 }}>
                <CardContent sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <Typography variant="subtitle1" sx={{ fontWeight: 'bold', borderBottom: '1px solid', borderColor: 'divider', pb: 1, mb: 1, fontFamily: 'Cairo' }}>
                    مطابقة نقدية الصندوق (Cash Drawer Summary)
                  </Typography>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                    <span>العهدة الابتدائية عند الفتح:</span>
                    <strong>{(shiftSummary.shift.opening_cash / 100).toFixed(2)} ج.م</strong>
                  </Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                    <span>إجمالي المبيعات النقدية (المحصل نقدًا):</span>
                    <Typography variant="body2" sx={{ color: 'success.main', fontWeight: 'bold' }}>
                      +{((shiftSummary.payments.find(p => p.payment_method === 'Cash')?.total_amount || 0) / 100).toFixed(2)} ج.م
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                    <span>وارد حركة الإيداع النقدي (Pay-In):</span>
                    <span>
                      +{((shiftSummary.cashMovements.find(m => m.type === 'PAY_IN')?.total_amount || 0) / 100).toFixed(2)} ج.م
                    </span>
                  </Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                    <span>منصرف حركات الصرف والمصروفات (Pay-Out):</span>
                    <Typography variant="body2" sx={{ color: 'error.main' }}>
                      -{((shiftSummary.cashMovements.find(m => m.type === 'PAY_OUT')?.total_amount || 0) / 100).toFixed(2)} ج.م
                    </Typography>
                  </Box>
                  
                  <Divider sx={{ my: 0.5 }} />
                  
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', fontSize: '1rem', fontWeight: 'bold', color: 'success.main' }}>
                    <span>الرصيد النقدي المتوقع بالدرج:</span>
                    <span>{(shiftSummary.expectedClosingCash / 100).toFixed(2)} ج.م</span>
                  </Box>

                  {/* Closing Cash Difference Checker */}
                  {shiftSummary.shift.status === 'OPEN' && actualClosingCash !== null && (
                    <Paper variant="outlined" sx={{ p: 2, bgcolor: 'action.hover', border: '1px dotted', borderColor: 'divider' }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', mb: 1 }}>
                        <span>المبلغ الفعلي المدخل:</span>
                        <strong>{actualClosingCash.toFixed(2)} ج.م</strong>
                      </Box>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', fontWeight: 'bold' }}>
                        <span>الفارق (عجز / زيادة):</span>
                        <Typography
                          variant="body2"
                          sx={{
                            fontWeight: 'bold',
                            color: cashDifference === 0 ? 'success.main' : cashDifference < 0 ? 'error.main' : 'warning.main'
                          }}
                        >
                          {cashDifference === 0 ? 'مطابق تماماً (0)' : cashDifference < 0 ? `عجز: ${Math.abs(cashDifference).toFixed(2)} ج.م` : `زيادة: ${cashDifference.toFixed(2)} ج.م`}
                        </Typography>
                      </Box>
                    </Paper>
                  )}

                  {shiftSummary.shift.status === 'OPEN' ? (
                    <Box sx={{ mt: 2, pt: 2, borderTop: '1px solid', borderColor: 'divider' }}>
                      <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mb: 2, fontFamily: 'Cairo' }}>
                        تقديم طلب إغلاق الوردية للمراجعة
                      </Typography>
                      {closeError && (
                        <Alert severity="error" sx={{ mb: 2, fontFamily: 'Cairo', textAlign: dir === 'rtl' ? 'right' : 'left' }}>
                          {closeError}
                        </Alert>
                      )}
                      <form onSubmit={handleOpenCloseConfirm}>
                        <Grid container spacing={2} alignItems="flex-end">
                          <Grid item xs={12}>
                            <TextField
                              fullWidth
                              required
                              type="number"
                              inputProps={{ step: '0.01', min: '0' }}
                              label="مبلغ النقدية الفعلي الموجود في الدرج حالياً (ج.م) *"
                              placeholder="أدخل المبلغ الفعلي بدقة بالدرج للتسليم..."
                              value={actualClosingCashInput}
                              onChange={(e) => setActualClosingCashInput(e.target.value)}
                              disabled={closeLoading}
                              size="small"
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
                  ) : (
                    <Alert severity="warning" sx={{ mt: 2, fontFamily: 'Cairo', textAlign: dir === 'rtl' ? 'right' : 'left' }}>
                      لقد قمت بطلب إغلاق الوردية وتسليم العهدة الإجمالية البالغة ({(shiftSummary.shift.actual_cash / 100).toFixed(2)} ج.م). بانتظار موافقة الإدارة والمسؤول الإداري على الإغلاق النهائي.
                    </Alert>
                  )}
                </CardContent>
              </Card>
            </Grid>

            {/* Right: Payment breakdowns & general stats */}
            <Grid item xs={12} md={6}>
              <Card variant="outlined" sx={{ height: '100%', borderRadius: 1 }}>
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
          </Grid>

          {/* Cash Movements Section */}
          <Grid container spacing={3}>
            {shiftSummary.shift.status === 'OPEN' && (
              <Grid item xs={12} md={4}>
                <Card variant="outlined" sx={{ borderRadius: 1 }}>
                  <CardContent>
                    <Typography variant="subtitle1" sx={{ fontWeight: 'bold', borderBottom: '1px solid', borderColor: 'divider', pb: 1, mb: 2, fontFamily: 'Cairo' }}>
                      تسجيل حركة نقدية بالدرج
                    </Typography>

                    {movementError && (
                      <Alert severity="error" sx={{ mb: 2, fontFamily: 'Cairo', textAlign: dir === 'rtl' ? 'right' : 'left' }}>
                        {movementError}
                      </Alert>
                    )}
                    {movementSuccess && (
                      <Alert severity="success" sx={{ mb: 2, fontFamily: 'Cairo', textAlign: dir === 'rtl' ? 'right' : 'left' }}>
                        {movementSuccess}
                      </Alert>
                    )}

                    <form onSubmit={handleRegisterCashMovement}>
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        <FormControl fullWidth size="small">
                          <InputLabel sx={{ fontFamily: 'Cairo', transformOrigin: dir === 'rtl' ? 'right' : 'left', right: dir === 'rtl' ? 24 : 'auto' }}>نوع الحركة</InputLabel>
                          <Select
                            value={movementTypeInput}
                            label="نوع الحركة"
                            onChange={(e) => setMovementTypeInput(e.target.value)}
                          >
                            <MenuItem value="PAY_OUT">صرف نقدي (منصرف/مصروفات)</MenuItem>
                            <MenuItem value="PAY_IN">إيداع نقدي (وارد/فكة)</MenuItem>
                          </Select>
                        </FormControl>

                        <TextField
                          required
                          fullWidth
                          type="number"
                          inputProps={{ step: '0.01', min: '0.01' }}
                          label="المبلغ (بالجنيه المصري) *"
                          value={movementAmountInput}
                          onChange={(e) => setMovementAmountInput(e.target.value)}
                          size="small"
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

                        <TextField
                          fullWidth
                          label="البيان / سبب الحركة"
                          placeholder="مثال: شراء فكة، مصروف نثري..."
                          value={movementNotesInput}
                          onChange={(e) => setMovementNotesInput(e.target.value)}
                          size="small"
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
                      </Box>
                    </form>
                  </CardContent>
                </Card>
              </Grid>
            )}

            {/* List/Table of recorded movements */}
            <Grid item xs={12} md={shiftSummary.shift.status === 'OPEN' ? 8 : 12}>
              <Card variant="outlined" sx={{ borderRadius: 1 }}>
                <CardContent sx={{ p: 2 }}>
                  <Typography variant="subtitle1" sx={{ fontWeight: 'bold', borderBottom: '1px solid', borderColor: 'divider', pb: 1, mb: 2, fontFamily: 'Cairo' }}>
                    سجل حركات الصندوق في الوردية (Shift Ledger)
                  </Typography>

                  <DataTable
                    columns={[
                      {
                        id: 'type',
                        label: 'نوع الحركة',
                        render: (m) => (
                          <Chip
                            label={m.type === 'PAY_IN' ? 'إيداع نقدي (Pay-In)' : 'صرف نقدي (Pay-Out)'}
                            color={m.type === 'PAY_IN' ? 'success' : 'error'}
                            size="small"
                            sx={{ fontWeight: 'bold', fontFamily: 'Cairo' }}
                          />
                        )
                      },
                      {
                        id: 'amount',
                        label: 'المبلغ المالي',
                        render: (m) => (
                          <Typography variant="body2" sx={{ fontWeight: 'bold', color: m.type === 'PAY_IN' ? 'success.main' : 'error.main' }}>
                            {m.type === 'PAY_OUT' ? '-' : '+'}{(m.amount / 100).toFixed(2)} ج.م
                          </Typography>
                        )
                      },
                      { id: 'notes', label: 'البيان والسبب', render: (m) => m.notes || '—' },
                      {
                        id: 'created_at',
                        label: 'التوقيت',
                        render: (m) => new Date(m.created_at).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })
                      }
                    ]}
                    rows={shiftSummary.cashMovementsList || []}
                    mobileRenderer={renderMobileMovementCard}
                    emptyTitle="لا توجد حركات نقدية مسجلة بعد"
                    emptyDescription="سوف تظهر أي حركات إيداع أو صرف تسجلها بالصندوق هنا بالتفصيل."
                  />
                </CardContent>
              </Card>
            </Grid>
          </Grid>

          {/* Confirm Close Shift Dialog */}
          <ConfirmDialog
            open={confirmCloseOpen}
            title="تأكيد إرسال طلب إغلاق الوردية"
            description={`الرصيد النقدي المتوقع: ${expectedCashAmount.toFixed(2)} ج.م \n المبلغ الفعلي المدخل: ${(actualClosingCash || 0).toFixed(2)} ج.م \n الفارق: ${cashDifference.toFixed(2)} ج.م \n\n هل أنت متأكد من رغبتك في إرسال طلب إغلاق الوردية للتسليم والمراجعة الإدارية؟`}
            type="warning"
            confirmText="تأكيد وإرسال"
            cancelText="تراجع"
            onConfirm={handleRequestCloseShift}
            onCancel={() => setConfirmCloseOpen(false)}
          />
        </Box>
      )}
    </Box>
  );
}

export default ShiftSummary;

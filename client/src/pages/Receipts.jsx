import React, { useState } from 'react';
import { useAuth } from '../app/AuthContext.jsx';
import { useLanguage } from '../i18n/config.js';
import PageHeader from '../components/navigation/PageHeader.jsx';
import ReceiptDetails from '../components/ReceiptDetails.jsx';
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
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip
} from '@mui/material';
import { Search as SearchIcon, Print as PrintIcon, AssignmentReturn as ReturnIcon } from '@mui/icons-material';

export function Receipts() {
  const { token } = useAuth();
  const { dir } = useLanguage();
  
  // Search state
  const [receiptSearchCode, setReceiptSearchCode] = useState('');
  const [receiptDetails, setReceiptDetails] = useState(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState('');

  // Return state
  const [returnQuantities, setReturnQuantities] = useState({});
  const [returnNotes, setReturnNotes] = useState('');
  const [returnRefundMethod, setReturnRefundMethod] = useState('Cash');
  const [returnLoading, setReturnLoading] = useState(false);
  const [returnError, setReturnError] = useState('');
  const [returnSuccess, setReturnSuccess] = useState('');

  // Reprint state
  const [reprintReason, setReprintReason] = useState('');
  const [reprintLoading, setReprintLoading] = useState(false);
  const [reprintError, setReprintError] = useState('');

  const handleSearchReceipt = async (e) => {
    if (e) e.preventDefault();
    setSearchError('');
    setReturnSuccess('');
    setReturnError('');
    setReprintError('');
    setReceiptDetails(null);
    if (!receiptSearchCode.trim()) return;

    setSearchLoading(true);
    try {
      const res = await fetch(`/api/pos/receipts/${encodeURIComponent(receiptSearchCode.trim())}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const payload = await res.json();
      if (res.status === 200) {
        setReceiptDetails(payload.data);
      } else {
        setSearchError(payload.error || 'لم يتم العثور على الإيصال المطلوب.');
      }
    } catch (err) {
      setSearchError('حدث خطأ أثناء الاتصال بالخادم.');
    } finally {
      setSearchLoading(false);
    }
  };

  const handleProcessReturn = async (e) => {
    e.preventDefault();
    if (!token || !receiptDetails) return;

    const items = Object.entries(returnQuantities)
      .map(([productId, qty]) => ({
        productId: parseInt(productId),
        quantity: parseInt(qty) || 0
      }))
      .filter((item) => item.quantity > 0);

    if (items.length === 0) {
      setReturnError('يرجى تحديد كمية إرجاع أكبر من الصفر لأحد المنتجات على الأقل.');
      return;
    }

    setReturnLoading(true);
    setReturnError('');
    setReturnSuccess('');

    try {
      const res = await fetch(`/api/pos/orders/${receiptDetails.reference_id}/return`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          items,
          notes: returnNotes,
          refundMethod: returnRefundMethod
        })
      });
      const payload = await res.json();
      if (res.status === 200) {
        setReturnQuantities({});
        setReturnNotes('');
        setReturnSuccess('تم تسجيل المرتجع واسترداد المبلغ بنجاح وتحديث المخزون.');
        
        // Refresh details
        const receiptCode = receiptDetails.receipt_number;
        const detailsRes = await fetch(`/api/pos/receipts/${receiptCode}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const detailsPayload = await detailsRes.json();
        if (detailsRes.status === 200) {
          setReceiptDetails(detailsPayload.data);
        }
      } else {
        setReturnError(payload.error || 'فشل تسجيل المرتجع.');
      }
    } catch (err) {
      setReturnError('حدث خطأ بالاتصال بالخادم.');
    } finally {
      setReturnLoading(false);
    }
  };

  const handleReprintReceipt = async (e) => {
    if (e) e.preventDefault();
    setReprintError('');
    setReprintLoading(true);

    try {
      const res = await fetch(`/api/pos/receipts/${receiptDetails.id}/reprint`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ reason: reprintReason.trim() })
      });
      const payload = await res.json();
      if (res.status === 200) {
        // Refresh details
        const detailsRes = await fetch(`/api/pos/receipts/${receiptDetails.id}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const detailsPayload = await detailsRes.json();
        if (detailsRes.status === 200) {
          setReceiptDetails(detailsPayload.data);
          setReprintReason('');
          setTimeout(() => {
            window.print();
          }, 300);
        }
      } else {
        setReprintError(payload.error || 'فشلت عملية إعادة الطباعة.');
      }
    } catch (err) {
      setReprintError('حدث خطأ بالاتصال بالخادم.');
    } finally {
      setReprintLoading(false);
    }
  };

  return (
    <Box sx={{ width: '100%' }}>
      {/* Page Header */}
      <PageHeader titleKey="nav.receipts" />

      <Grid container spacing={3}>
        {/* Left Side: Search & Actions */}
        <Grid item xs={12} md={7}>
          <Card variant="outlined" sx={{ height: '100%', display: 'flex', flexDirection: 'column', borderRadius: 1 }}>
            <CardContent sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, flex: 1 }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 'bold', fontFamily: 'Cairo', borderBottom: '1px solid', borderColor: 'divider', pb: 1 }}>
                البحث عن إيصال واستعراضه
              </Typography>

              <form onSubmit={handleSearchReceipt}>
                <Box sx={{ display: 'flex', gap: 1 }}>
                  <TextField
                    fullWidth
                    size="small"
                    placeholder="أدخل رقم الإيصال (مثال: REC-20260710-0001)..."
                    value={receiptSearchCode}
                    onChange={(e) => setReceiptSearchCode(e.target.value)}
                    sx={{
                      '& .MuiOutlinedInput-input': {
                        fontFamily: 'Cairo',
                        textAlign: dir === 'rtl' ? 'right' : 'left'
                      }
                    }}
                  />
                  <Button
                    type="submit"
                    variant="contained"
                    startIcon={<SearchIcon />}
                    disabled={searchLoading}
                    sx={{ fontFamily: 'Cairo' }}
                  >
                    بحث
                  </Button>
                </Box>
              </form>

              {searchError && (
                <Alert severity="error" sx={{ fontFamily: 'Cairo', textAlign: dir === 'rtl' ? 'right' : 'left' }}>
                  {searchError}
                </Alert>
              )}

              {searchLoading ? (
                <Box sx={{ display: 'flex', flex: 1, justifyContent: 'center', alignItems: 'center', p: 4 }}>
                  <CircularProgress />
                </Box>
              ) : receiptDetails ? (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                  {/* General Info */}
                  <Paper sx={{ p: 2, bgcolor: 'action.hover', borderRadius: 1 }} variant="outlined">
                    <Grid container spacing={2} sx={{ fontSize: '0.85rem' }}>
                      <Grid item xs={12} sm={6}>
                        رقم الإيصال: <strong><bdi>{receiptDetails.receipt_number}</bdi></strong>
                      </Grid>
                      <Grid item xs={12} sm={6}>
                        نوع الحركة:{' '}
                        <strong>
                          {receiptDetails.reference_type === 'order_sale'
                            ? 'بيع مباشر'
                            : receiptDetails.reference_type === 'preorder_deposit'
                            ? 'عربون حجز مسبق'
                            : 'استلام حجز نهائي'}
                        </strong>
                      </Grid>
                      <Grid item xs={12} sm={6}>
                        طبع بواسطة:{' '}
                        <strong>
                          {receiptDetails.printed_by_name} ({receiptDetails.printed_by_username})
                        </strong>
                      </Grid>
                      <Grid item xs={12} sm={6} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        مرات الطباعة:{' '}
                        <Chip label={`${receiptDetails.print_count} مرات`} size="small" color="info" sx={{ fontWeight: 'bold', fontFamily: 'Cairo' }} />
                      </Grid>
                      <Grid item xs={12} sm={6}>
                        تاريخ الإنشاء:{' '}
                        <strong>
                          <bdi>{new Date(receiptDetails.created_at).toLocaleString('ar-EG', { timeZone: 'Africa/Cairo' })}</bdi>
                        </strong>
                      </Grid>
                      <Grid item xs={12} sm={6}>
                        آخر طباعة:{' '}
                        <strong>
                          <bdi>{new Date(receiptDetails.last_printed_at).toLocaleString('ar-EG', { timeZone: 'Africa/Cairo' })}</bdi>
                        </strong>
                      </Grid>
                    </Grid>
                  </Paper>

                  {/* Items List */}
                  <Box>
                    <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mb: 1, fontFamily: 'Cairo' }}>
                      تفاصيل الأصناف المباعة
                    </Typography>
                    <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 1 }}>
                      <Table size="small">
                        <TableHead>
                          <TableRow>
                            <TableCell sx={{ fontFamily: 'Cairo' }}>اسم الصنف</TableCell>
                            <TableCell sx={{ fontFamily: 'Cairo' }}>رمز SKU</TableCell>
                            <TableCell sx={{ fontFamily: 'Cairo' }}>سعر الوحدة</TableCell>
                            <TableCell sx={{ fontFamily: 'Cairo' }}>الكمية</TableCell>
                            <TableCell sx={{ fontFamily: 'Cairo' }}>المرتجع</TableCell>
                            <TableCell sx={{ fontFamily: 'Cairo' }}>الإجمالي</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {receiptDetails.items.map((item, idx) => (
                            <TableRow key={idx}>
                              <TableCell sx={{ fontWeight: 'bold', fontFamily: 'Cairo' }}>
                                {item.product_name}
                                {item.is_book === 1 && (
                                  <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', fontFamily: 'Cairo' }}>
                                    ({item.school_grade} / {item.subject})
                                  </Typography>
                                )}
                              </TableCell>
                              <TableCell><code>{item.product_sku}</code></TableCell>
                              <TableCell><bdi>{(item.unit_price / 100).toFixed(2)} ج.م</bdi></TableCell>
                              <TableCell>{item.quantity}</TableCell>
                              <TableCell sx={{ color: item.returned_qty > 0 ? 'warning.main' : 'inherit', fontWeight: item.returned_qty > 0 ? 'bold' : 'normal' }}>
                                {item.returned_qty || 0}
                              </TableCell>
                              <TableCell><bdi>{(item.total_price / 100).toFixed(2)} ج.م</bdi></TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  </Box>

                  {/* Payments List */}
                  <Box>
                    <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mb: 1, fontFamily: 'Cairo' }}>
                      تفاصيل المدفوعات
                    </Typography>
                    <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 1 }}>
                      <Table size="small">
                        <TableHead>
                          <TableRow>
                            <TableCell sx={{ fontFamily: 'Cairo' }}>طريقة الدفع</TableCell>
                            <TableCell sx={{ fontFamily: 'Cairo' }}>المبلغ المدفوع</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {receiptDetails.payments.map((p, idx) => (
                            <TableRow key={idx}>
                              <TableCell sx={{ fontFamily: 'Cairo' }}>
                                {p.payment_method === 'Cash'
                                  ? 'نقدي'
                                  : p.payment_method === 'Card'
                                  ? 'بطاقة ائتمانية'
                                  : p.payment_method === 'InstaPay'
                                  ? 'إنستا باي'
                                  : p.payment_method === 'Wallet'
                                  ? 'محفظة'
                                  : 'تحويل بنكي'}
                              </TableCell>
                              <TableCell><bdi>{(p.amount / 100).toFixed(2)} ج.م</bdi></TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  </Box>

                  {/* Return Section */}
                  {receiptDetails.reference_type === 'order_sale' && (
                    <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1, p: 2.5, bgcolor: 'action.hover' }}>
                      <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mb: 2, color: 'warning.main', fontFamily: 'Cairo' }}>
                        تسجيل مرتجع لهذه الفاتورة
                      </Typography>

                      {returnError && (
                        <Alert severity="error" sx={{ mb: 2, fontFamily: 'Cairo', textAlign: dir === 'rtl' ? 'right' : 'left' }}>
                          {returnError}
                        </Alert>
                      )}
                      {returnSuccess && (
                        <Alert severity="success" sx={{ mb: 2, fontFamily: 'Cairo', textAlign: dir === 'rtl' ? 'right' : 'left' }}>
                          {returnSuccess}
                        </Alert>
                      )}

                      <form onSubmit={handleProcessReturn}>
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                          {receiptDetails.items.map((item) => {
                            const maxReturn = item.quantity - (item.returned_qty || 0);
                            return (
                              <Box
                                key={item.product_id}
                                sx={{
                                  display: 'flex',
                                  justifyContent: 'space-between',
                                  alignItems: 'center',
                                  bgcolor: 'background.paper',
                                  p: 1.5,
                                  borderRadius: 1,
                                  border: '1px solid',
                                  borderColor: 'divider',
                                  fontSize: '0.85rem'
                                }}
                              >
                                <span style={{ flex: 1, fontFamily: 'Cairo', fontWeight: 'bold' }}>{item.product_name}</span>
                                <span style={{ width: '160px', color: 'text.secondary', fontFamily: 'Cairo', fontSize: '0.8rem' }}>
                                  الكل: {item.quantity} | المسترجع: {item.returned_qty || 0}
                                </span>
                                <TextField
                                  type="number"
                                  inputProps={{ min: 0, max: maxReturn }}
                                  disabled={maxReturn <= 0}
                                  placeholder="0"
                                  value={returnQuantities[item.product_id] || ''}
                                  onChange={(e) => {
                                    const val = Math.min(maxReturn, Math.max(0, parseInt(e.target.value) || 0));
                                    setReturnQuantities((prev) => ({ ...prev, [item.product_id]: val }));
                                  }}
                                  size="small"
                                  sx={{ width: 80 }}
                                />
                              </Box>
                            );
                          })}

                          <Grid container spacing={2} sx={{ mt: 0.5 }}>
                            <Grid item xs={12} sm={8}>
                              <TextField
                                fullWidth
                                label="سبب الإرجاع / البيان"
                                placeholder="سبب المرتجع..."
                                value={returnNotes}
                                onChange={(e) => setReturnNotes(e.target.value)}
                                size="small"
                                sx={{
                                  '& .MuiInputLabel-root': {
                                    fontFamily: 'Cairo',
                                    left: dir === 'rtl' ? 'auto' : 0,
                                    right: dir === 'rtl' ? 24 : 'auto',
                                    transformOrigin: dir === 'rtl' ? 'right' : 'left'
                                  },
                                  '& .MuiOutlinedInput-input': {
                                    fontFamily: 'Cairo',
                                    textAlign: dir === 'rtl' ? 'right' : 'left'
                                  }
                                }}
                              />
                            </Grid>
                            <Grid item xs={12} sm={4}>
                              <FormControl fullWidth size="small">
                                <InputLabel sx={{ fontFamily: 'Cairo', transformOrigin: dir === 'rtl' ? 'right' : 'left', right: dir === 'rtl' ? 24 : 'auto' }}>طريقة الاسترداد</InputLabel>
                                <Select
                                  value={returnRefundMethod}
                                  label="طريقة الاسترداد"
                                  onChange={(e) => setReturnRefundMethod(e.target.value)}
                                >
                                  <MenuItem value="Cash">نقدي (من الصندوق)</MenuItem>
                                  <MenuItem value="Card">بطاقة ائتمانية</MenuItem>
                                  <MenuItem value="InstaPay">إنستا باي</MenuItem>
                                  <MenuItem value="Wallet">محفظة إلكترونية</MenuItem>
                                  <MenuItem value="Transfer">تحويل بنكي</MenuItem>
                                </Select>
                              </FormControl>
                            </Grid>
                          </Grid>

                          <Button
                            fullWidth
                            type="submit"
                            variant="contained"
                            color="warning"
                            startIcon={<ReturnIcon />}
                            disabled={returnLoading}
                            sx={{ fontFamily: 'Cairo', fontWeight: 'bold', mt: 1, color: '#000' }}
                          >
                            {returnLoading ? 'جاري تنفيذ المرتجع...' : 'تأكيد تسجيل المرتجع وتحديث المخزن'}
                          </Button>
                        </Box>
                      </form>
                    </Box>
                  )}
                </Box>
              ) : (
                <Box sx={{ display: 'flex', flex: 1, alignItems: 'center', justifyContent: 'center', color: 'text.secondary', p: 4, fontFamily: 'Cairo' }}>
                  أدخل رقم إيصال مبيعات نشط في الحقل أعلاه لعرض التفاصيل وإعادة طباعته.
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Right Side: Thermal Print Preview */}
        <Grid item xs={12} md={5}>
          <Card variant="outlined" sx={{ height: '100%', display: 'flex', flexDirection: 'column', borderRadius: 1 }}>
            <CardContent sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, flex: 1 }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 'bold', fontFamily: 'Cairo', borderBottom: '1px solid', borderColor: 'divider', pb: 1 }}>
                معاينة الإيصال الحراري
              </Typography>

              {receiptDetails ? (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 1 }}>
                  <Box
                    className="print-area"
                    sx={{
                      bgcolor: '#fff',
                      color: '#000',
                      p: 2,
                      borderRadius: 1,
                      border: '1px solid',
                      borderColor: 'divider',
                      maxHeight: 400,
                      overflowY: 'auto'
                    }}
                  >
                    <ReceiptDetails receipt={receiptDetails} />
                  </Box>

                  <form onSubmit={handleReprintReceipt} style={{ marginTop: 'auto' }}>
                    {reprintError && (
                      <Alert severity="error" sx={{ mb: 2, fontFamily: 'Cairo', textAlign: dir === 'rtl' ? 'right' : 'left' }}>
                        {reprintError}
                      </Alert>
                    )}

                    <TextField
                      fullWidth
                      required
                      label="سبب إعادة الطباعة (إلزامي للـ Audit)"
                      placeholder="أدخل سبب إعادة طباعة الإيصال..."
                      value={reprintReason}
                      onChange={(e) => setReprintReason(e.target.value)}
                      size="small"
                      sx={{
                        mb: 2,
                        '& .MuiInputLabel-root': {
                          fontFamily: 'Cairo',
                          left: dir === 'rtl' ? 'auto' : 0,
                          right: dir === 'rtl' ? 24 : 'auto',
                          transformOrigin: dir === 'rtl' ? 'right' : 'left'
                        },
                        '& .MuiOutlinedInput-input': {
                          fontFamily: 'Cairo',
                          textAlign: dir === 'rtl' ? 'right' : 'left'
                        }
                      }}
                    />

                    <Button
                      fullWidth
                      type="submit"
                      variant="contained"
                      color="secondary"
                      startIcon={<PrintIcon />}
                      disabled={reprintLoading}
                      sx={{ fontFamily: 'Cairo', fontWeight: 'bold' }}
                    >
                      {reprintLoading ? 'جاري تحضير الطباعة...' : 'إعادة طباعة الإيصال'}
                    </Button>
                  </form>
                </Box>
              ) : (
                <Box sx={{ display: 'flex', flex: 1, alignItems: 'center', justifyContent: 'center', color: 'text.secondary', p: 4, fontFamily: 'Cairo' }}>
                  ابحث عن إيصال لعرض معاينة الطباعة الحرارية.
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}

export default Receipts;

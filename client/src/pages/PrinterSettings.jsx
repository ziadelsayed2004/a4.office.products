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
  CircularProgress
} from '@mui/material';
import { Save as SaveIcon, Refresh as RefreshIcon } from '@mui/icons-material';

export function PrinterSettings() {
  const { token } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Form states
  const [rcpPrinterType, setRcpPrinterType] = useState('simulation');
  const [rcpPrinterAddress, setRcpPrinterAddress] = useState('');
  const [rcpPrinterWidth, setRcpPrinterWidth] = useState('80mm');
  const [rcpPrinterHeader, setRcpPrinterHeader] = useState('');
  const [rcpPrinterFooter, setRcpPrinterFooter] = useState('');

  const [qrPrinterType, setQrPrinterType] = useState('simulation');
  const [qrPrinterAddress, setQrPrinterAddress] = useState('');
  const [qrPrinterWidth, setQrPrinterWidth] = useState('50');
  const [qrPrinterHeight, setQrPrinterHeight] = useState('25');

  const [printShowCustomer, setPrintShowCustomer] = useState('true');
  const [printShowPriceTier, setPrintShowPriceTier] = useState('true');
  const [printShowQr, setPrintShowQr] = useState('true');

  const loadPrinterSettings = async () => {
    if (!token) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/admin/printer-settings', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const payload = await res.json();
      if (res.status === 200) {
        const settings = payload.data || {};
        setRcpPrinterType(settings.receipt_printer_type || 'simulation');
        setRcpPrinterAddress(settings.receipt_printer_address || '');
        setRcpPrinterWidth(settings.receipt_printer_width || '80mm');
        setRcpPrinterHeader(settings.receipt_printer_header || '');
        setRcpPrinterFooter(settings.receipt_printer_footer || '');

        setQrPrinterType(settings.qr_printer_type || 'simulation');
        setQrPrinterAddress(settings.qr_printer_address || '');
        setQrPrinterWidth(settings.qr_printer_width || '50');
        setQrPrinterHeight(settings.qr_printer_height || '25');

        setPrintShowCustomer(settings.print_show_customer || 'true');
        setPrintShowPriceTier(settings.print_show_price_tier || 'true');
        setPrintShowQr(settings.print_show_qr || 'true');
      } else {
        setError(payload.error || 'فشل تحميل إعدادات الطباعة.');
      }
    } catch (err) {
      setError('حدث خطأ بالاتصال بالخادم.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPrinterSettings();
  }, [token]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!token || submitting) return;
    setSubmitting(true);
    setError('');
    try {
      const res = await fetch('/api/admin/printer-settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          receipt_printer_type: rcpPrinterType,
          receipt_printer_address: rcpPrinterAddress,
          receipt_printer_width: rcpPrinterWidth,
          receipt_printer_header: rcpPrinterHeader,
          receipt_printer_footer: rcpPrinterFooter,
          qr_printer_type: qrPrinterType,
          qr_printer_address: qrPrinterAddress,
          qr_printer_width: qrPrinterWidth,
          qr_printer_height: qrPrinterHeight,
          print_show_customer: printShowCustomer,
          print_show_price_tier: printShowPriceTier,
          print_show_qr: printShowQr
        })
      });
      const payload = await res.json();
      if (res.status !== 200) {
        setError(payload.error || 'فشلت عملية حفظ الإعدادات.');
      }
    } catch (err) {
      setError('حدث خطأ بالخادم.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 5 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      {/* Content Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5" sx={{ fontWeight: 'bold', color: 'primary.main', fontFamily: 'Cairo' }}>
          إعدادات وقوالب الطباعة
        </Typography>
        <Button
          variant="outlined"
          startIcon={<RefreshIcon />}
          onClick={loadPrinterSettings}
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

      <form onSubmit={handleSubmit}>
        <Grid container spacing={3}>
          {/* Receipt Printer Section */}
          <Grid item xs={12} md={6}>
            <Card variant="outlined" sx={{ height: '100%' }}>
              <CardContent sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <Typography variant="h6" sx={{ fontWeight: 'bold', borderBottom: '1px solid', borderColor: 'divider', pb: 1, mb: 1, fontFamily: 'Cairo' }}>
                  🖨️ طابعة الفواتير والإيصالات
                </Typography>

                <FormControl fullWidth size="small">
                  <InputLabel>نوع الاتصال</InputLabel>
                  <Select
                    value={rcpPrinterType}
                    label="نوع الاتصال"
                    onChange={(e) => setRcpPrinterType(e.target.value)}
                  >
                    <MenuItem value="simulation">محاكاة الطباعة (معاينة على الشاشة)</MenuItem>
                    <MenuItem value="browser">طباعة النظام / المتصفح الافتراضية (A4/Thermal)</MenuItem>
                    <MenuItem value="network">طابعة شبكية (IP Address / TCP)</MenuItem>
                  </Select>
                </FormControl>

                <TextField
                  fullWidth
                  size="small"
                  label="عنوان الطابعة / رقم المنفذ"
                  placeholder="مثال: 192.168.1.100 أو COM1"
                  value={rcpPrinterAddress}
                  onChange={(e) => setRcpPrinterAddress(e.target.value)}
                  sx={{ '& .MuiInputLabel-root': { fontFamily: 'Cairo' }, '& .MuiOutlinedInput-input': { fontFamily: 'Cairo' } }}
                />

                <FormControl fullWidth size="small">
                  <InputLabel>عرض ورق الطباعة</InputLabel>
                  <Select
                    value={rcpPrinterWidth}
                    label="عرض ورق الطباعة"
                    onChange={(e) => setRcpPrinterWidth(e.target.value)}
                  >
                    <MenuItem value="80mm">80 ملليمتر (الافتراضي)</MenuItem>
                    <MenuItem value="58mm">58 ملليمتر</MenuItem>
                  </Select>
                </FormControl>

                <TextField
                  fullWidth
                  size="small"
                  multiline
                  rows={2}
                  label="نص رأس الفاتورة (Header)"
                  placeholder="تظهر في الجزء العلوي من الفاتورة"
                  value={rcpPrinterHeader}
                  onChange={(e) => setRcpPrinterHeader(e.target.value)}
                  sx={{ '& .MuiInputLabel-root': { fontFamily: 'Cairo' }, '& .MuiOutlinedInput-input': { fontFamily: 'Cairo' } }}
                />

                <TextField
                  fullWidth
                  size="small"
                  multiline
                  rows={2}
                  label="نص تذييل الفاتورة (Footer)"
                  placeholder="تظهر في نهاية الفاتورة"
                  value={rcpPrinterFooter}
                  onChange={(e) => setRcpPrinterFooter(e.target.value)}
                  sx={{ '& .MuiInputLabel-root': { fontFamily: 'Cairo' }, '& .MuiOutlinedInput-input': { fontFamily: 'Cairo' } }}
                />
              </CardContent>
            </Card>
          </Grid>

          {/* QR Label Printer & Settings Section */}
          <Grid item xs={12} md={6}>
            <Card variant="outlined" sx={{ height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <CardContent sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <Typography variant="h6" sx={{ fontWeight: 'bold', borderBottom: '1px solid', borderColor: 'divider', pb: 1, mb: 1, fontFamily: 'Cairo' }}>
                  🏷️ طابعة ملصقات رموز المنتج (QR Codes)
                </Typography>

                <FormControl fullWidth size="small">
                  <InputLabel>نوع الاتصال</InputLabel>
                  <Select
                    value={qrPrinterType}
                    label="نوع الاتصال"
                    onChange={(e) => setQrPrinterType(e.target.value)}
                  >
                    <MenuItem value="simulation">محاكاة الطباعة (معاينة على الشاشة)</MenuItem>
                    <MenuItem value="browser">طباعة النظام / المتصفح الافتراضية</MenuItem>
                    <MenuItem value="network">طابعة شبكية (IP Address / TCP)</MenuItem>
                  </Select>
                </FormControl>

                <TextField
                  fullWidth
                  size="small"
                  label="عنوان الطابعة / منفذ الاتصال"
                  placeholder="مثال: 192.168.1.101 أو COM2"
                  value={qrPrinterAddress}
                  onChange={(e) => setQrPrinterAddress(e.target.value)}
                  sx={{ '& .MuiInputLabel-root': { fontFamily: 'Cairo' }, '& .MuiOutlinedInput-input': { fontFamily: 'Cairo' } }}
                />

                <Grid container spacing={2}>
                  <Grid item xs={6}>
                    <TextField
                      fullWidth
                      size="small"
                      type="number"
                      label="عرض الملصق (مم)"
                      placeholder="مثال: 50"
                      value={qrPrinterWidth}
                      onChange={(e) => setQrPrinterWidth(e.target.value)}
                      sx={{ '& .MuiInputLabel-root': { fontFamily: 'Cairo' }, '& .MuiOutlinedInput-input': { fontFamily: 'Cairo' } }}
                    />
                  </Grid>
                  <Grid item xs={6}>
                    <TextField
                      fullWidth
                      size="small"
                      type="number"
                      label="ارتفاع الملصق (مم)"
                      placeholder="مثال: 25"
                      value={qrPrinterHeight}
                      onChange={(e) => setQrPrinterHeight(e.target.value)}
                      sx={{ '& .MuiInputLabel-root': { fontFamily: 'Cairo' }, '& .MuiOutlinedInput-input': { fontFamily: 'Cairo' } }}
                    />
                  </Grid>
                </Grid>

                <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mt: 2, borderTop: '1px solid', borderColor: 'divider', pt: 2, fontFamily: 'Cairo' }}>
                  ⚙️ خيارات قالب الطباعة
                </Typography>

                <Grid container spacing={2} alignItems="center">
                  <Grid item xs={8}>
                    <Typography variant="body2" sx={{ fontFamily: 'Cairo' }}>إظهار معلومات العميل في الفاتورة</Typography>
                  </Grid>
                  <Grid item xs={4}>
                    <FormControl fullWidth size="small">
                      <Select
                        value={printShowCustomer}
                        onChange={(e) => setPrintShowCustomer(e.target.value)}
                      >
                        <MenuItem value="true">نعم</MenuItem>
                        <MenuItem value="false">لا</MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>

                  <Grid item xs={8}>
                    <Typography variant="body2" sx={{ fontFamily: 'Cairo' }}>إظهار فئة السعر للمنتج</Typography>
                  </Grid>
                  <Grid item xs={4}>
                    <FormControl fullWidth size="small">
                      <Select
                        value={printShowPriceTier}
                        onChange={(e) => setPrintShowPriceTier(e.target.value)}
                      >
                        <MenuItem value="true">نعم</MenuItem>
                        <MenuItem value="false">لا</MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>

                  <Grid item xs={8}>
                    <Typography variant="body2" sx={{ fontFamily: 'Cairo' }}>إظهار رمز الـ QR للتحقق</Typography>
                  </Grid>
                  <Grid item xs={4}>
                    <FormControl fullWidth size="small">
                      <Select
                        value={printShowQr}
                        onChange={(e) => setPrintShowQr(e.target.value)}
                      >
                        <MenuItem value="true">نعم</MenuItem>
                        <MenuItem value="false">لا</MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>
                </Grid>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        {/* Save Button */}
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 3 }}>
          <Button
            type="submit"
            variant="contained"
            color="success"
            startIcon={<SaveIcon />}
            disabled={submitting}
            sx={{ minWidth: 150, fontFamily: 'Cairo', fontWeight: 'bold' }}
          >
            {submitting ? 'جاري الحفظ...' : 'حفظ الإعدادات'}
          </Button>
        </Box>
      </form>
    </Box>
  );
}

export default PrinterSettings;

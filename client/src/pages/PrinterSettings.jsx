import React, { useState, useEffect } from 'react';
import { useAuth } from '../app/AuthContext.jsx';
import { useLanguage } from '../i18n/config.js';
import PageHeader from '../components/navigation/PageHeader.jsx';
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
  Tabs,
  Tab
} from '@mui/material';
import {
  Save as SaveIcon,
  Refresh as RefreshIcon,
  Print as PrintIcon
} from '@mui/icons-material';

export function PrinterSettings() {
  const { token } = useAuth();
  const { dir } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
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

  // New QR dimensions spacing settings
  const [qrLabelCount, setQrLabelCount] = useState('1');
  const [qrLabelMargin, setQrLabelMargin] = useState('2');
  const [qrLabelSpacing, setQrLabelSpacing] = useState('2');

  const [printShowCustomer, setPrintShowCustomer] = useState('true');
  const [printShowPriceTier, setPrintShowPriceTier] = useState('true');
  const [printShowQr, setPrintShowQr] = useState('true');

  // Preview / Test print states
  const [activePreviewTab, setActivePreviewTab] = useState('receipt');
  const [testPrintType, setTestPrintType] = useState(null);

  const loadPrinterSettings = async () => {
    if (!token) return;
    setLoading(true);
    setError('');
    setSuccessMsg('');
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
        setRcpPrinterHeader(settings.receipt_printer_header || 'مكتبة A4 للأدوات المكتبية');
        setRcpPrinterFooter(settings.receipt_printer_footer || 'شكراً لتعاملكم معنا!');

        setQrPrinterType(settings.qr_printer_type || 'simulation');
        setQrPrinterAddress(settings.qr_printer_address || '');
        setQrPrinterWidth(settings.qr_printer_width || '50');
        setQrPrinterHeight(settings.qr_printer_height || '25');

        setQrLabelCount(settings.qr_label_count || '1');
        setQrLabelMargin(settings.qr_label_margin || '2');
        setQrLabelSpacing(settings.qr_label_spacing || '2');

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
  }, [token]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    if (!token || submitting) return;
    setSubmitting(true);
    setError('');
    setSuccessMsg('');
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
          qr_label_count: qrLabelCount,
          qr_label_margin: qrLabelMargin,
          qr_label_spacing: qrLabelSpacing,
          print_show_customer: printShowCustomer,
          print_show_price_tier: printShowPriceTier,
          print_show_qr: printShowQr
        })
      });
      const payload = await res.json();
      if (res.status === 200) {
        setSuccessMsg('تم حفظ إعدادات الطباعة والقوالب بنجاح.');
        loadPrinterSettings();
      } else {
        setError(payload.error || 'فشلت عملية حفظ الإعدادات.');
      }
    } catch (err) {
      setError('حدث خطأ بالخادم.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleTestPrint = (type) => {
    setTestPrintType(type);
    setTimeout(() => {
      window.print();
    }, 200);
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 5 }}>
        <CircularProgress />
      </Box>
    );
  }

  // Print container helper
  const renderTestPrintContainer = () => {
    if (testPrintType === 'receipt') {
      return (
        <Box className="print-area" sx={{ display: 'none', '@media print': { display: 'block' } }}>
          <Box sx={{ width: rcpPrinterWidth === '58mm' ? '58mm' : '80mm', p: 1, textAlign: 'center', fontFamily: 'monospace', fontSize: '11px', color: '#000', bgcolor: '#fff', direction: 'rtl' }}>
            <div style={{ fontSize: '14px', fontWeight: 'bold' }}>{rcpPrinterHeader}</div>
            <div style={{ margin: '8px 0', borderBottom: '1px dashed #000' }} />
            <div style={{ textAlign: 'right', fontSize: '10px' }}>
              <div>رقم الفاتورة: INV-TEST-0001</div>
              <div>تاريخ الطباعة: {new Date().toLocaleString('ar-EG', { timeZone: 'Africa/Cairo' })}</div>
            </div>
            <div style={{ margin: '8px 0', borderBottom: '1px dashed #000' }} />
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '10px', textAlign: 'right' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #000', fontWeight: 'bold' }}>
                  <th>الصنف</th>
                  <th style={{ textAlign: 'center' }}>الكمية</th>
                  <th style={{ textAlign: 'left' }}>الإجمالي</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>كشكول سلك مسطر A4</td>
                  <td style={{ textAlign: 'center' }}>2</td>
                  <td style={{ textAlign: 'left' }}>90.00 ج.م</td>
                </tr>
              </tbody>
            </table>
            <div style={{ margin: '8px 0', borderBottom: '1px dashed #000' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: '12px' }}>
              <span>إجمالي القيمة:</span>
              <span>90.00 ج.م</span>
            </div>
            <div style={{ margin: '8px 0', borderBottom: '1px dashed #000' }} />
            <div style={{ fontSize: '9px', fontStyle: 'italic' }}>{rcpPrinterFooter}</div>
          </Box>
        </Box>
      );
    } else if (testPrintType === 'qr') {
      return (
        <Box className="print-area" sx={{ display: 'none', '@media print': { display: 'block' } }}>
          <Box sx={{
            display: 'grid',
            gridTemplateColumns: `repeat(${qrLabelCount || 1}, 1fr)`,
            gap: `${qrLabelSpacing || 2}mm`,
            p: `${qrLabelMargin || 2}mm`,
            bgcolor: '#fff',
            color: '#000',
            direction: 'rtl'
          }}>
            {Array.from({ length: qrLabelCount || 1 }).map((_, i) => (
              <Box key={i} sx={{
                width: `${qrPrinterWidth || 50}mm`,
                height: `${qrPrinterHeight || 25}mm`,
                border: '1px solid #000',
                p: 0.5,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                alignItems: 'center',
                textAlign: 'center',
                fontSize: '8px',
                overflow: 'hidden'
              }}>
                <div style={{ fontWeight: 'bold' }}>مكتبة A4 للأدوات المكتبية</div>
                <div>كشكول سلك مسطر A4</div>
                <img
                  src="https://api.qrserver.com/v1/create-qr-code/?size=50x50&data=PROD-TEST-TOKEN"
                  alt="Test QR"
                  style={{ width: '25px', height: '25px', margin: '2px 0' }}
                />
                <code style={{ fontSize: '7px' }}>SKU-KASHK-A4-WIRE</code>
              </Box>
            ))}
          </Box>
        </Box>
      );
    }
    return null;
  };

  return (
    <Box sx={{ width: '100%' }}>
      {/* Page Header */}
      <PageHeader
        titleKey="nav.printer_settings"
        actions={
          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={loadPrinterSettings}
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
      {successMsg && (
        <Alert severity="success" sx={{ mb: 3, fontFamily: 'Cairo', textAlign: dir === 'rtl' ? 'right' : 'left' }}>
          {successMsg}
        </Alert>
      )}

      {/* Render Print-Only Hidden Component */}
      {renderTestPrintContainer()}

      <Grid container spacing={3}>
        {/* Left Side: Parameters Forms */}
        <Grid item xs={12} md={7}>
          <form onSubmit={handleSubmit}>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              {/* Receipt Settings Card */}
              <Card variant="outlined" sx={{ borderRadius: 1 }}>
                <CardContent sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <Typography variant="subtitle1" sx={{ fontWeight: 'bold', borderBottom: '1px solid', borderColor: 'divider', pb: 1, mb: 1, fontFamily: 'Cairo' }}>
                    🖨️ طابعة الفواتير والإيصالات
                  </Typography>

                  <FormControl fullWidth size="small">
                    <InputLabel sx={{ fontFamily: 'Cairo', transformOrigin: dir === 'rtl' ? 'right' : 'left', right: dir === 'rtl' ? 24 : 'auto' }}>نوع الاتصال</InputLabel>
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

                  <FormControl fullWidth size="small">
                    <InputLabel sx={{ fontFamily: 'Cairo', transformOrigin: dir === 'rtl' ? 'right' : 'left', right: dir === 'rtl' ? 24 : 'auto' }}>عرض ورق الطباعة</InputLabel>
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
                    size="small"
                    multiline
                    rows={2}
                    label="نص تذييل الفاتورة (Footer)"
                    placeholder="تظهر في نهاية الفاتورة"
                    value={rcpPrinterFooter}
                    onChange={(e) => setRcpPrinterFooter(e.target.value)}
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
                </CardContent>
              </Card>

              {/* QR Label Settings Card */}
              <Card variant="outlined" sx={{ borderRadius: 1 }}>
                <CardContent sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <Typography variant="subtitle1" sx={{ fontWeight: 'bold', borderBottom: '1px solid', borderColor: 'divider', pb: 1, mb: 1, fontFamily: 'Cairo' }}>
                    🏷️ طابعة ملصقات رموز المنتج (QR Codes)
                  </Typography>

                  <FormControl fullWidth size="small">
                    <InputLabel sx={{ fontFamily: 'Cairo', transformOrigin: dir === 'rtl' ? 'right' : 'left', right: dir === 'rtl' ? 24 : 'auto' }}>نوع الاتصال</InputLabel>
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

                  <Grid container spacing={2}>
                    <Grid item xs={12} sm={6}>
                      <TextField
                        fullWidth
                        size="small"
                        type="number"
                        label="عرض الملصق (مم)"
                        value={qrPrinterWidth}
                        onChange={(e) => setQrPrinterWidth(e.target.value)}
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
                    <Grid item xs={12} sm={6}>
                      <TextField
                        fullWidth
                        size="small"
                        type="number"
                        label="ارتفاع الملصق (مم)"
                        value={qrPrinterHeight}
                        onChange={(e) => setQrPrinterHeight(e.target.value)}
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
                    <Grid item xs={12} sm={4}>
                      <TextField
                        fullWidth
                        size="small"
                        type="number"
                        label="عدد الملصقات (الطباعة التجريبية)"
                        value={qrLabelCount}
                        onChange={(e) => setQrLabelCount(e.target.value)}
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
                    <Grid item xs={12} sm={4}>
                      <TextField
                        fullWidth
                        size="small"
                        type="number"
                        label="الهامش الخارجي للملصق (مم)"
                        value={qrLabelMargin}
                        onChange={(e) => setQrLabelMargin(e.target.value)}
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
                    <Grid item xs={12} sm={4}>
                      <TextField
                        fullWidth
                        size="small"
                        type="number"
                        label="المسافة الفاصلة بين الملصقات (مم)"
                        value={qrLabelSpacing}
                        onChange={(e) => setQrLabelSpacing(e.target.value)}
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
                  </Grid>
                </CardContent>
              </Card>

              {/* Template Parameters Settings Card */}
              <Card variant="outlined" sx={{ borderRadius: 1 }}>
                <CardContent sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <Typography variant="subtitle1" sx={{ fontWeight: 'bold', borderBottom: '1px solid', borderColor: 'divider', pb: 1, mb: 1, fontFamily: 'Cairo' }}>
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

              {/* Save Settings */}
              <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
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
            </Box>
          </form>
        </Grid>

        {/* Right Side: Live Printer Layout Preview Panel */}
        <Grid item xs={12} md={5}>
          <Card variant="outlined" sx={{ height: '100%', display: 'flex', flexDirection: 'column', borderRadius: 1 }}>
            <CardContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 1 }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 'bold', borderBottom: '1px solid', borderColor: 'divider', pb: 1, fontFamily: 'Cairo' }}>
                معاينة الطباعة الفورية (Live Preview)
              </Typography>

              <Tabs value={activePreviewTab} onChange={(e, val) => setActivePreviewTab(val)} variant="fullWidth">
                <Tab label="معاينة الإيصال" value="receipt" sx={{ fontFamily: 'Cairo' }} />
                <Tab label="معاينة الملصق (QR)" value="qr" sx={{ fontFamily: 'Cairo' }} />
              </Tabs>

              {/* Theme-safe white preview wrapper */}
              <Box sx={{
                flex: 1,
                bgcolor: '#f5f5f5',
                p: 2,
                borderRadius: 1,
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                overflow: 'auto',
                minHeight: 350
              }}>
                {activePreviewTab === 'receipt' ? (
                  <Box sx={{
                    width: rcpPrinterWidth === '58mm' ? '180px' : '260px',
                    p: 1.5,
                    bgcolor: '#ffffff',
                    color: '#000000',
                    boxShadow: 2,
                    fontFamily: 'monospace',
                    fontSize: '11px',
                    direction: 'rtl',
                    textAlign: 'center'
                  }}>
                    <div style={{ fontSize: '13px', fontWeight: 'bold' }}>{rcpPrinterHeader}</div>
                    <div style={{ margin: '6px 0', borderBottom: '1px dashed #000' }} />
                    <div style={{ textAlign: 'right', fontSize: '9px' }}>
                      <div>رقم الفاتورة: INV-TEST-0001</div>
                      <div>التاريخ: {new Date().toLocaleDateString('ar-EG')}</div>
                      {printShowCustomer === 'true' && <div>العميل: عميل تجريبي</div>}
                    </div>
                    <div style={{ margin: '6px 0', borderBottom: '1px dashed #000' }} />
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '10px', textAlign: 'right' }}>
                      <thead>
                        <tr style={{ borderBottom: '1px solid #000' }}>
                          <th>الصنف</th>
                          <th style={{ textAlign: 'center' }}>الكمية</th>
                          <th style={{ textAlign: 'left' }}>الإجمالي</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td>كشكول سلك مسطر A4</td>
                          <td style={{ textAlign: 'center' }}>2</td>
                          <td style={{ textAlign: 'left' }}>90.00</td>
                        </tr>
                      </tbody>
                    </table>
                    <div style={{ margin: '6px 0', borderBottom: '1px dashed #000' }} />
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold' }}>
                      <span>إجمالي القيمة:</span>
                      <span>90.00 ج.م</span>
                    </div>
                    {printShowQr === 'true' && (
                      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', my: 1 }}>
                        <img
                          src="https://api.qrserver.com/v1/create-qr-code/?size=50x50&data=PROD-TEST-TOKEN"
                          alt="Mock QR"
                          style={{ width: '40px', height: '40px' }}
                        />
                        <span style={{ fontSize: '8px', color: '#666', marginTop: '2px' }}>رمز التحقق</span>
                      </Box>
                    )}
                    <div style={{ margin: '6px 0', borderBottom: '1px dashed #000' }} />
                    <div style={{ fontSize: '9px', fontStyle: 'italic' }}>{rcpPrinterFooter}</div>
                  </Box>
                ) : (
                  <Box sx={{
                    display: 'grid',
                    gridTemplateColumns: `repeat(${parseInt(qrLabelCount, 10) || 1}, 1fr)`,
                    gap: `${qrLabelSpacing}px`,
                    p: `${qrLabelMargin}px`,
                    bgcolor: '#ffffff',
                    color: '#000000',
                    boxShadow: 2,
                    direction: 'rtl'
                  }}>
                    {Array.from({ length: parseInt(qrLabelCount, 10) || 1 }).map((_, i) => (
                      <Box key={i} sx={{
                        width: `${parseInt(qrPrinterWidth, 10) * 2.5}px`,
                        height: `${parseInt(qrPrinterHeight, 10) * 2.5}px`,
                        border: '1px solid #000',
                        p: 0.5,
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'center',
                        alignItems: 'center',
                        textAlign: 'center',
                        fontSize: '7px',
                        overflow: 'hidden'
                      }}>
                        <div style={{ fontWeight: 'bold' }}>مكتبة A4 للطباعة</div>
                        <div style={{ whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden', width: '100%' }}>كشكول سلك مسطر A4</div>
                        <img
                          src="https://api.qrserver.com/v1/create-qr-code/?size=50x50&data=PROD-TEST-TOKEN"
                          alt="Mock QR"
                          style={{ width: '20px', height: '20px', margin: '1px 0' }}
                        />
                        <code>SKU-KASHK-A4-WIRE</code>
                      </Box>
                    ))}
                  </Box>
                )}
              </Box>

              <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
                <Button
                  fullWidth
                  variant="outlined"
                  startIcon={<PrintIcon />}
                  onClick={() => handleTestPrint('receipt')}
                  sx={{ fontFamily: 'Cairo' }}
                >
                  طباعة إيصال تجريبي
                </Button>
                <Button
                  fullWidth
                  variant="outlined"
                  startIcon={<PrintIcon />}
                  onClick={() => handleTestPrint('qr')}
                  sx={{ fontFamily: 'Cairo' }}
                >
                  طباعة ملصق تجريبي
                </Button>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}

export default PrinterSettings;

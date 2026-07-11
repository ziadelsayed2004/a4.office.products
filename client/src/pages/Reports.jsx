import React, { useState, useEffect } from 'react';
import { useAuth } from '../app/AuthContext.jsx';
import { useLanguage } from '../i18n/config.js';
import PageHeader from '../components/navigation/PageHeader.jsx';
import DataTable from '../components/data-display/DataTable.jsx';
import {
  Box,
  Typography,
  Button,
  Grid,
  Card,
  CardContent,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  Paper,
  CircularProgress,
  Alert,
  Tabs,
  Tab,
  Chip
} from '@mui/material';
import { Download as DownloadIcon, FilterList as FilterIcon, Clear as ClearIcon } from '@mui/icons-material';

export function Reports() {
  const { token } = useAuth();
  const { dir } = useLanguage();
  
  const [usersList, setUsersList] = useState([]);
  const [categoriesList, setCategoriesList] = useState([]);
  const [reportSubTab, setReportSubTab] = useState('sales');
  
  const [reportFilters, setReportFilters] = useState({
    startDate: '',
    endDate: '',
    cashierId: '',
    shiftId: '',
    categoryId: '',
    status: '',
    stockStatus: '',
    search: ''
  });
  
  const [reportData, setReportData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const loadUsers = async () => {
    try {
      const res = await fetch('/api/admin/users', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const payload = await res.json();
      if (res.status === 200) setUsersList(payload.data || []);
    } catch (err) {
      console.error(err);
    }
  };

  const loadCategories = async () => {
    try {
      const res = await fetch('/api/categories?activeOnly=false', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const payload = await res.json();
      if (res.status === 200) setCategoriesList(payload.data || []);
    } catch (err) {
      console.error(err);
    }
  };

  const loadReport = async () => {
    if (!token) return;
    setLoading(true);
    setError('');
    try {
      let url = `/api/admin/reports/${reportSubTab}?`;
      const queryParams = new URLSearchParams();
      if (reportFilters.startDate) queryParams.append('startDate', reportFilters.startDate);
      if (reportFilters.endDate) queryParams.append('endDate', reportFilters.endDate);
      if (reportFilters.cashierId) queryParams.append('cashierId', reportFilters.cashierId);
      if (reportFilters.shiftId) queryParams.append('shiftId', reportFilters.shiftId);
      if (reportFilters.categoryId) queryParams.append('categoryId', reportFilters.categoryId);
      if (reportFilters.status) queryParams.append('status', reportFilters.status);
      if (reportFilters.stockStatus) queryParams.append('stockStatus', reportFilters.stockStatus);
      if (reportFilters.search) queryParams.append('search', reportFilters.search);

      const res = await fetch(url + queryParams.toString(), {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const payload = await res.json();
      if (res.status === 200) {
        setReportData(payload.data);
      } else {
        setError(payload.error || 'فشل تحميل التقرير.');
      }
    } catch (err) {
      setError('حدث خطأ بالاتصال بالخادم.');
    } finally {
      setLoading(false);
    }
  };

  const handleExportReport = async () => {
    if (!token) return;
    try {
      let url = `/api/admin/reports/export?type=${reportSubTab}&`;
      const queryParams = new URLSearchParams();
      if (reportFilters.startDate) queryParams.append('startDate', reportFilters.startDate);
      if (reportFilters.endDate) queryParams.append('endDate', reportFilters.endDate);
      if (reportFilters.cashierId) queryParams.append('cashierId', reportFilters.cashierId);
      if (reportFilters.shiftId) queryParams.append('shiftId', reportFilters.shiftId);
      if (reportFilters.categoryId) queryParams.append('categoryId', reportFilters.categoryId);
      if (reportFilters.status) queryParams.append('status', reportFilters.status);
      if (reportFilters.stockStatus) queryParams.append('stockStatus', reportFilters.stockStatus);
      if (reportFilters.search) queryParams.append('search', reportFilters.search);

      const res = await fetch(url + queryParams.toString(), {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.status === 200) {
        const blob = await res.blob();
        const downloadUrl = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = downloadUrl;
        a.download = `report_${reportSubTab}_${Date.now()}.csv`;
        document.body.appendChild(a);
        a.click();
        a.remove();
      } else {
        const payload = await res.json();
        alert(payload.error || 'فشلت عملية التصدير.');
      }
    } catch (err) {
      alert('حدث خطأ أثناء تصدير التقرير.');
    }
  };

  useEffect(() => {
    if (token) {
      loadUsers();
      loadCategories();
    }
  }, [token]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    setReportData(null);
    loadReport();
  }, [reportSubTab]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleTabChange = (e, val) => {
    setReportSubTab(val);
  };

  const handleClearFilters = () => {
    setReportFilters({
      startDate: '',
      endDate: '',
      cashierId: '',
      shiftId: '',
      categoryId: '',
      status: '',
      stockStatus: '',
      search: ''
    });
  };

  // Mobile Card Renderers
  const renderMobileOrderCard = (o) => (
    <Card variant="outlined" sx={{ borderRadius: 1 }}>
      <CardContent sx={{ p: 2 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 'bold' }}>{o.invoice_number}</Typography>
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>{o.created_at}</Typography>
        </Box>
        <Typography variant="body2" sx={{ mb: 1, fontSize: '0.85rem' }}>
          الكاشير: {o.cashier_name}
        </Typography>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="body2" sx={{ fontWeight: 'bold', color: 'success.main' }}>
            الصافي: {(o.total / 100).toFixed(2)} ج.م
          </Typography>
          <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
            {o.payments.map((p, idx) => (
              <Chip key={idx} label={p.method} size="small" variant="outlined" sx={{ height: 18, fontSize: '0.65rem' }} />
            ))}
          </Box>
        </Box>
      </CardContent>
    </Card>
  );

  const renderMobilePreorderCard = (pr) => (
    <Card variant="outlined" sx={{ borderRadius: 1 }}>
      <CardContent sx={{ p: 2 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 'bold' }}>{pr.preorder_number}</Typography>
          <Chip
            label={
              pr.status === 'DEPOSIT_PAID_WAITING_STOCK' ? 'بانتظار المخزون' :
              pr.status === 'READY_FOR_PICKUP' ? 'جاهز للاستلام' :
              pr.status === 'PICKED_UP' ? 'تم التسليم' : 'ملغي'
            }
            color={
              pr.status === 'DEPOSIT_PAID_WAITING_STOCK' ? 'warning' :
              pr.status === 'READY_FOR_PICKUP' ? 'info' :
              pr.status === 'PICKED_UP' ? 'success' : 'error'
            }
            size="small"
            sx={{ height: 18, fontSize: '0.65rem', fontWeight: 'bold', fontFamily: 'Cairo' }}
          />
        </Box>
        <Typography variant="body2" sx={{ mb: 0.5, fontSize: '0.85rem' }}>
          العميل: {pr.customer_name} | {pr.customer_phone}
        </Typography>
        <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 1 }}>
          التاريخ: {pr.created_at}
        </Typography>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' }}>
          <span>العربون: {(pr.deposit_paid / 100).toFixed(2)} ج.م</span>
          <strong style={{ color: '#ff9500' }}>المتبقي: {(pr.remaining_amount / 100).toFixed(2)} ج.م</strong>
        </Box>
      </CardContent>
    </Card>
  );

  const renderMobileProductCard = (p) => {
    const available = p.current_stock - p.reserved_stock;
    return (
      <Card variant="outlined" sx={{ borderRadius: 1 }}>
        <CardContent sx={{ p: 2 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mb: 0.5 }}>{p.name}</Typography>
          <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 1 }}>
            SKU: {p.sku} | التصنيف: {p.category_name}
          </Typography>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' }}>
            <span>المخزون الفعلي: {p.current_stock}</span>
            <span>المحجوز: {p.reserved_stock}</span>
            <strong style={{ color: available <= 0 ? '#ff3b30' : '#34c759' }}>المتاح: {available}</strong>
          </Box>
        </CardContent>
      </Card>
    );
  };

  const renderMobileShiftCard = (s) => {
    const actual = s.actual_closing_cash !== null ? (s.actual_closing_cash / 100).toFixed(2) : '—';
    const varianceVal =
      s.actual_closing_cash !== null && s.expected_closing_cash !== null
        ? (s.actual_closing_cash - s.expected_closing_cash) / 100
        : null;
    return (
      <Card variant="outlined" sx={{ borderRadius: 1 }}>
        <CardContent sx={{ p: 2 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 'bold' }}>الوردية #{s.id}</Typography>
            <Chip
              label={
                s.status === 'OPEN' ? 'مفتوحة' :
                s.status === 'CLOSE_REQUESTED' ? 'بانتظار المراجعة' : 'مغلقة'
              }
              color={
                s.status === 'OPEN' ? 'success' :
                s.status === 'CLOSE_REQUESTED' ? 'warning' : 'info'
              }
              size="small"
              sx={{ height: 18, fontSize: '0.65rem', fontWeight: 'bold', fontFamily: 'Cairo' }}
            />
          </Box>
          <Typography variant="body2" sx={{ mb: 1, fontSize: '0.85rem' }}>
            الكاشير: {s.cashier_name}
          </Typography>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' }}>
            <span>الفعلي: {actual !== '—' ? `${actual} ج.م` : '—'}</span>
            <strong style={{ color: varianceVal === null ? 'inherit' : varianceVal < 0 ? '#ff3b30' : '#34c759' }}>
              الفارق: {varianceVal !== null ? `${varianceVal.toFixed(2)} ج.م` : '—'}
            </strong>
          </Box>
        </CardContent>
      </Card>
    );
  };

  // Custom Chart Renderers
  const renderSalesChart = () => {
    if (!reportData || !reportData.orders || reportData.orders.length === 0) return null;
    const paymentTotals = {};
    reportData.orders.forEach(o => {
      o.payments.forEach(p => {
        paymentTotals[p.method] = (paymentTotals[p.method] || 0) + p.amount;
      });
    });
    const maxPaymentVal = Math.max(...Object.values(paymentTotals), 0) || 1;

    return (
      <Card variant="outlined" sx={{ mb: 3, borderRadius: 1 }}>
        <CardContent>
          <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mb: 2, fontFamily: 'Cairo' }}>
            توزيع الإيرادات المحصلة حسب طريقة الدفع
          </Typography>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {Object.entries(paymentTotals).map(([method, val]) => {
              const pct = (val / maxPaymentVal) * 100;
              return (
                <Box key={method} sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' }}>
                    <span style={{ fontWeight: 'bold' }}>
                      {method === 'Cash' ? 'نقدي (Cash)' :
                       method === 'Card' ? 'بطاقة ائتمان (Card)' :
                       method === 'InstaPay' ? 'إنستا باي (InstaPay)' :
                       method === 'Wallet' ? 'محفظة إلكترونية (Wallet)' :
                       method === 'Transfer' ? 'تحويل بنكي (Transfer)' : method}
                    </span>
                    <strong>{(val / 100).toFixed(2)} ج.م</strong>
                  </Box>
                  <Box sx={{ height: 10, width: '100%', bgcolor: 'action.hover', borderRadius: 5, overflow: 'hidden' }}>
                    <Box sx={{ height: '100%', width: `${pct}%`, bgcolor: 'primary.main', borderRadius: 5 }} />
                  </Box>
                </Box>
              );
            })}
          </Box>
        </CardContent>
      </Card>
    );
  };

  const renderPreordersChart = () => {
    if (!reportData || !reportData.preorders || reportData.preorders.length === 0) return null;
    const statusCounts = {
      DEPOSIT_PAID_WAITING_STOCK: 0,
      READY_FOR_PICKUP: 0,
      PICKED_UP: 0,
      CANCELLED: 0
    };
    reportData.preorders.forEach(pr => {
      if (statusCounts[pr.status] !== undefined) statusCounts[pr.status]++;
    });
    const totalPreorders = reportData.preorders.length || 1;

    return (
      <Card variant="outlined" sx={{ mb: 3, borderRadius: 1 }}>
        <CardContent>
          <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mb: 2, fontFamily: 'Cairo' }}>
            نسب توزيع حالات الحجوزات النشطة
          </Typography>
          <Box sx={{ height: 24, width: '100%', display: 'flex', borderRadius: 1.5, overflow: 'hidden', my: 2 }}>
            {Object.entries(statusCounts).map(([status, count]) => {
              const pct = (count / totalPreorders) * 100;
              if (count === 0) return null;
              const color = 
                status === 'DEPOSIT_PAID_WAITING_STOCK' ? 'warning.main' :
                status === 'READY_FOR_PICKUP' ? 'info.main' :
                status === 'PICKED_UP' ? 'success.main' : 'error.main';
              return (
                <Box key={status} sx={{ height: '100%', width: `${pct}%`, bgcolor: color }} />
              );
            })}
          </Box>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            {[
              { label: 'بانتظار المخزون', color: 'warning.main', count: statusCounts.DEPOSIT_PAID_WAITING_STOCK },
              { label: 'جاهز للاستلام', color: 'info.main', count: statusCounts.READY_FOR_PICKUP },
              { label: 'تم الاستلام', color: 'success.main', count: statusCounts.PICKED_UP },
              { label: 'ملغي ومسترد', color: 'error.main', count: statusCounts.CANCELLED }
            ].map((item, idx) => (
              <Grid item xs={6} sm={3} key={idx} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Box sx={{ width: 12, height: 12, borderRadius: '50%', bgcolor: item.color }} />
                <Typography variant="caption" sx={{ fontFamily: 'Cairo' }}>
                  {item.label} ({item.count})
                </Typography>
              </Grid>
            ))}
          </Grid>
        </CardContent>
      </Card>
    );
  };

  const renderInventoryChart = () => {
    if (!reportData || !reportData.products || reportData.products.length === 0) return null;
    const lowestProducts = [...reportData.products]
      .sort((a, b) => a.current_stock - b.current_stock)
      .slice(0, 5);
    const maxStock = Math.max(...lowestProducts.map(p => p.current_stock), 0) || 1;

    return (
      <Card variant="outlined" sx={{ mb: 3, borderRadius: 1 }}>
        <CardContent>
          <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mb: 2, fontFamily: 'Cairo' }}>
            الـ 5 أصناف الأكثر حرجاً بالمخازن (الأقل كمية)
          </Typography>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {lowestProducts.map((p) => {
              const pct = (p.current_stock / maxStock) * 100;
              return (
                <Box key={p.id} sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' }}>
                    <span style={{ fontWeight: 'bold' }}>{p.name}</span>
                    <strong>{p.current_stock} قطعة</strong>
                  </Box>
                  <Box sx={{ height: 10, width: '100%', bgcolor: 'action.hover', borderRadius: 5, overflow: 'hidden' }}>
                    <Box sx={{ height: '100%', width: `${pct}%`, bgcolor: p.current_stock <= p.low_stock_threshold ? 'error.main' : 'warning.main', borderRadius: 5 }} />
                  </Box>
                </Box>
              );
            })}
          </Box>
        </CardContent>
      </Card>
    );
  };

  return (
    <Box>
      {/* Page Header */}
      <PageHeader
        titleKey="nav.reports"
        actions={
          <Button
            variant="contained"
            color="secondary"
            startIcon={<DownloadIcon />}
            onClick={handleExportReport}
            sx={{ fontFamily: 'Cairo' }}
          >
            تصدير التقرير الحالي (CSV)
          </Button>
        }
      />

      {/* Sub Tabs Selection */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
        <Tabs value={reportSubTab} onChange={handleTabChange}>
          <Tab label="تقرير المبيعات" value="sales" sx={{ fontFamily: 'Cairo' }} />
          <Tab label="تقرير الحجوزات" value="preorders" sx={{ fontFamily: 'Cairo' }} />
          <Tab label="تقرير المخزون" value="inventory" sx={{ fontFamily: 'Cairo' }} />
          <Tab label="تقرير الورديات" value="shifts" sx={{ fontFamily: 'Cairo' }} />
        </Tabs>
      </Box>

      {/* Filters Form */}
      <Paper variant="outlined" sx={{ p: 3, mb: 3, borderRadius: 1 }}>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            loadReport();
          }}
        >
          <Grid container spacing={2} alignItems="flex-end">
            {/* Date range filters */}
            {['sales', 'preorders', 'shifts'].includes(reportSubTab) && (
              <>
                <Grid item xs={12} sm={3}>
                  <TextField
                    fullWidth
                    size="small"
                    label="تاريخ البداية"
                    type="date"
                    InputLabelProps={{ shrink: true }}
                    value={reportFilters.startDate}
                    onChange={(e) => setReportFilters((prev) => ({ ...prev, startDate: e.target.value }))}
                    sx={{
                      '& .MuiInputLabel-root': {
                        fontFamily: 'Cairo',
                        left: dir === 'rtl' ? 'auto' : 0,
                        right: dir === 'rtl' ? 24 : 'auto',
                        transformOrigin: dir === 'rtl' ? 'right' : 'left'
                      }
                    }}
                  />
                </Grid>
                <Grid item xs={12} sm={3}>
                  <TextField
                    fullWidth
                    size="small"
                    label="تاريخ النهاية"
                    type="date"
                    InputLabelProps={{ shrink: true }}
                    value={reportFilters.endDate}
                    onChange={(e) => setReportFilters((prev) => ({ ...prev, endDate: e.target.value }))}
                    sx={{
                      '& .MuiInputLabel-root': {
                        fontFamily: 'Cairo',
                        left: dir === 'rtl' ? 'auto' : 0,
                        right: dir === 'rtl' ? 24 : 'auto',
                        transformOrigin: dir === 'rtl' ? 'right' : 'left'
                      }
                    }}
                  />
                </Grid>
              </>
            )}

            {/* Cashier filter */}
            {['sales', 'preorders', 'shifts'].includes(reportSubTab) && (
              <Grid item xs={12} sm={3}>
                <FormControl fullWidth size="small">
                  <InputLabel sx={{ fontFamily: 'Cairo', transformOrigin: dir === 'rtl' ? 'right' : 'left', right: dir === 'rtl' ? 24 : 'auto' }}>الكاشير / المستخدم</InputLabel>
                  <Select
                    value={reportFilters.cashierId}
                    label="الكاشير / المستخدم"
                    onChange={(e) => setReportFilters((prev) => ({ ...prev, cashierId: e.target.value }))}
                  >
                    <MenuItem value="">كل الكاشيرات</MenuItem>
                    {usersList.map((u) => (
                      <MenuItem key={u.id} value={u.id.toString()}>
                        {u.name} ({u.username})
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
            )}

            {/* Category filter */}
            {['sales', 'inventory'].includes(reportSubTab) && (
              <Grid item xs={12} sm={3}>
                <FormControl fullWidth size="small">
                  <InputLabel sx={{ fontFamily: 'Cairo', transformOrigin: dir === 'rtl' ? 'right' : 'left', right: dir === 'rtl' ? 24 : 'auto' }}>التصنيف</InputLabel>
                  <Select
                    value={reportFilters.categoryId}
                    label="التصنيف"
                    onChange={(e) => setReportFilters((prev) => ({ ...prev, categoryId: e.target.value }))}
                  >
                    <MenuItem value="">كل التصنيفات</MenuItem>
                    {categoriesList.map((c) => (
                      <MenuItem key={c.id} value={c.id.toString()}>
                        {c.name}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
            )}

            {/* Shift ID filter */}
            {reportSubTab === 'sales' && (
              <Grid item xs={12} sm={3}>
                <TextField
                  fullWidth
                  size="small"
                  type="number"
                  label="رقم الوردية"
                  placeholder="رقم الوردية..."
                  value={reportFilters.shiftId}
                  onChange={(e) => setReportFilters((prev) => ({ ...prev, shiftId: e.target.value }))}
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
            )}

            {/* Preorder status filter */}
            {reportSubTab === 'preorders' && (
              <Grid item xs={12} sm={3}>
                <FormControl fullWidth size="small">
                  <InputLabel sx={{ fontFamily: 'Cairo', transformOrigin: dir === 'rtl' ? 'right' : 'left', right: dir === 'rtl' ? 24 : 'auto' }}>حالة الحجز</InputLabel>
                  <Select
                    value={reportFilters.status}
                    label="حالة الحجز"
                    onChange={(e) => setReportFilters((prev) => ({ ...prev, status: e.target.value }))}
                  >
                    <MenuItem value="">كل الحالات</MenuItem>
                    <MenuItem value="DEPOSIT_PAID_WAITING_STOCK">بانتظار توفر المخزون</MenuItem>
                    <MenuItem value="READY_FOR_PICKUP">جاهز للاستلام</MenuItem>
                    <MenuItem value="PICKED_UP">تم الاستلام</MenuItem>
                    <MenuItem value="CANCELLED">ملغي ومسترد</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
            )}

            {/* Inventory stock status filter */}
            {reportSubTab === 'inventory' && (
              <Grid item xs={12} sm={3}>
                <FormControl fullWidth size="small">
                  <InputLabel sx={{ fontFamily: 'Cairo', transformOrigin: dir === 'rtl' ? 'right' : 'left', right: dir === 'rtl' ? 24 : 'auto' }}>حالة المخزون</InputLabel>
                  <Select
                    value={reportFilters.stockStatus}
                    label="حالة المخزون"
                    onChange={(e) => setReportFilters((prev) => ({ ...prev, stockStatus: e.target.value }))}
                  >
                    <MenuItem value="">الكل</MenuItem>
                    <MenuItem value="LOW_STOCK">مخزون منخفض</MenuItem>
                    <MenuItem value="OUT_OF_STOCK">نفذت الكمية</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
            )}

            {/* Search query input */}
            {['preorders', 'inventory'].includes(reportSubTab) && (
              <Grid item xs={12} sm={3}>
                <TextField
                  fullWidth
                  size="small"
                  label="بحث نصي"
                  placeholder="بحث بالاسم أو الكود..."
                  value={reportFilters.search}
                  onChange={(e) => setReportFilters((prev) => ({ ...prev, search: e.target.value }))}
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
            )}

            {/* Action buttons */}
            <Grid item xs={12} sm={3} sx={{ display: 'flex', gap: 1 }}>
              <Button
                fullWidth
                variant="contained"
                startIcon={<FilterIcon />}
                type="submit"
                sx={{ fontFamily: 'Cairo', fontWeight: 'bold' }}
              >
                تصفية
              </Button>
              <Button
                fullWidth
                variant="outlined"
                startIcon={<ClearIcon />}
                onClick={handleClearFilters}
                sx={{ fontFamily: 'Cairo' }}
              >
                تصفير
              </Button>
            </Grid>
          </Grid>
        </form>
      </Paper>

      {error && (
        <Alert severity="error" sx={{ mb: 3, fontFamily: 'Cairo', textAlign: dir === 'rtl' ? 'right' : 'left' }}>
          {error}
        </Alert>
      )}

      {loading || !reportData ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 5 }}>
          <CircularProgress />
        </Box>
      ) : (
        <Box>
          {/* Summary Cards */}
          <Grid container spacing={3} sx={{ mb: 3 }}>
            {reportSubTab === 'sales' && (
              <>
                <Grid item xs={12} sm={6} md={3}>
                  <Card variant="outlined" sx={{ borderRadius: 1 }}>
                    <CardContent sx={{ p: 2 }}>
                      <Typography variant="caption" sx={{ color: 'text.secondary', fontFamily: 'Cairo' }}>إجمالي المبيعات (قبل الخصم)</Typography>
                      <Typography variant="h6" sx={{ color: 'primary.main', fontWeight: 'bold', mt: 1 }}>
                        {(reportData.summary.total_sales / 100).toFixed(2)} ج.م
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <Card variant="outlined" sx={{ borderRadius: 1 }}>
                    <CardContent sx={{ p: 2 }}>
                      <Typography variant="caption" sx={{ color: 'text.secondary', fontFamily: 'Cairo' }}>إجمالي الخصومات</Typography>
                      <Typography variant="h6" sx={{ color: 'error.main', fontWeight: 'bold', mt: 1 }}>
                        {(reportData.summary.total_discount / 100).toFixed(2)} ج.م
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <Card variant="outlined" sx={{ borderRadius: 1 }}>
                    <CardContent sx={{ p: 2 }}>
                      <Typography variant="caption" sx={{ color: 'text.secondary', fontFamily: 'Cairo' }}>صافي المبيعات المحصلة</Typography>
                      <Typography variant="h6" sx={{ color: 'success.main', fontWeight: 'bold', mt: 1 }}>
                        {(reportData.summary.total_net / 100).toFixed(2)} ج.م
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <Card variant="outlined" sx={{ borderRadius: 1 }}>
                    <CardContent sx={{ p: 2 }}>
                      <Typography variant="caption" sx={{ color: 'text.secondary', fontFamily: 'Cairo' }}>عدد الفواتير</Typography>
                      <Typography variant="h6" sx={{ fontWeight: 'bold', mt: 1 }}>
                        {reportData.summary.invoices_count} فاتورة
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
              </>
            )}

            {reportSubTab === 'preorders' && (
              <>
                <Grid item xs={12} sm={6} md={3}>
                  <Card variant="outlined" sx={{ borderRadius: 1 }}>
                    <CardContent sx={{ p: 2 }}>
                      <Typography variant="caption" sx={{ color: 'text.secondary', fontFamily: 'Cairo' }}>إجمالي مبالغ الحجوزات</Typography>
                      <Typography variant="h6" sx={{ color: 'primary.main', fontWeight: 'bold', mt: 1 }}>
                        {(reportData.summary.total_amount / 100).toFixed(2)} ج.م
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <Card variant="outlined" sx={{ borderRadius: 1 }}>
                    <CardContent sx={{ p: 2 }}>
                      <Typography variant="caption" sx={{ color: 'text.secondary', fontFamily: 'Cairo' }}>إجمالي العربين المستلمة</Typography>
                      <Typography variant="h6" sx={{ color: 'success.main', fontWeight: 'bold', mt: 1 }}>
                        {(reportData.summary.total_deposit_paid / 100).toFixed(2)} ج.م
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <Card variant="outlined" sx={{ borderRadius: 1 }}>
                    <CardContent sx={{ p: 2 }}>
                      <Typography variant="caption" sx={{ color: 'text.secondary', fontFamily: 'Cairo' }}>إجمالي المتبقي للتحصيل</Typography>
                      <Typography variant="h6" sx={{ color: 'warning.main', fontWeight: 'bold', mt: 1 }}>
                        {(reportData.summary.total_remaining_amount / 100).toFixed(2)} ج.م
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <Card variant="outlined" sx={{ borderRadius: 1 }}>
                    <CardContent sx={{ p: 2 }}>
                      <Typography variant="caption" sx={{ color: 'text.secondary', fontFamily: 'Cairo' }}>عدد الحجوزات الكلي</Typography>
                      <Typography variant="h6" sx={{ fontWeight: 'bold', mt: 1 }}>
                        {reportData.summary.total_count} حجز
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
              </>
            )}

            {reportSubTab === 'inventory' && (
              <>
                <Grid item xs={12} sm={6} md={4}>
                  <Card variant="outlined" sx={{ borderRadius: 1 }}>
                    <CardContent sx={{ p: 2 }}>
                      <Typography variant="caption" sx={{ color: 'text.secondary', fontFamily: 'Cairo' }}>إجمالي عدد المنتجات النشطة</Typography>
                      <Typography variant="h6" sx={{ color: 'primary.main', fontWeight: 'bold', mt: 1 }}>
                        {reportData.summary.total_products} منتج
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
                <Grid item xs={12} sm={6} md={4}>
                  <Card variant="outlined" sx={{ borderRadius: 1 }}>
                    <CardContent sx={{ p: 2 }}>
                      <Typography variant="caption" sx={{ color: 'text.secondary', fontFamily: 'Cairo' }}>عدد الأصناف منخفضة المخزون</Typography>
                      <Typography variant="h6" sx={{ color: 'error.main', fontWeight: 'bold', mt: 1 }}>
                        {reportData.summary.low_stock_count} صنف
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
                <Grid item xs={12} sm={6} md={4}>
                  <Card variant="outlined" sx={{ borderRadius: 1 }}>
                    <CardContent sx={{ p: 2 }}>
                      <Typography variant="caption" sx={{ color: 'text.secondary', fontFamily: 'Cairo' }}>منتجات نفذ مخزونها</Typography>
                      <Typography variant="h6" sx={{ color: 'warning.main', fontWeight: 'bold', mt: 1 }}>
                        {reportData.summary.out_of_stock_count} صنف
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
              </>
            )}

            {reportSubTab === 'shifts' && (
              <>
                <Grid item xs={12} sm={6} md={3}>
                  <Card variant="outlined" sx={{ borderRadius: 1 }}>
                    <CardContent sx={{ p: 2 }}>
                      <Typography variant="caption" sx={{ color: 'text.secondary', fontFamily: 'Cairo' }}>إجمالي عدد الورديات</Typography>
                      <Typography variant="h6" sx={{ color: 'primary.main', fontWeight: 'bold', mt: 1 }}>
                        {reportData.summary.total_shifts} وردية
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <Card variant="outlined" sx={{ borderRadius: 1 }}>
                    <CardContent sx={{ p: 2 }}>
                      <Typography variant="caption" sx={{ color: 'text.secondary', fontFamily: 'Cairo' }}>الورديات المفتوحة حالياً</Typography>
                      <Typography variant="h6" sx={{ color: 'success.main', fontWeight: 'bold', mt: 1 }}>
                        {reportData.summary.open_shifts} وردية
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <Card variant="outlined" sx={{ borderRadius: 1 }}>
                    <CardContent sx={{ p: 2 }}>
                      <Typography variant="caption" sx={{ color: 'text.secondary', fontFamily: 'Cairo' }}>ورديات بانتظار المراجعة</Typography>
                      <Typography variant="h6" sx={{ color: 'warning.main', fontWeight: 'bold', mt: 1 }}>
                        {reportData.summary.pending_review_shifts} وردية
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <Card variant="outlined" sx={{ borderRadius: 1 }}>
                    <CardContent sx={{ p: 2 }}>
                      <Typography variant="caption" sx={{ color: 'text.secondary', fontFamily: 'Cairo' }}>الورديات المغلقة والمراجعة</Typography>
                      <Typography variant="h6" sx={{ fontWeight: 'bold', mt: 1 }}>
                        {reportData.summary.closed_shifts} وردية
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
              </>
            )}
          </Grid>

          {/* Visual Progress/Comparison Charts */}
          {reportSubTab === 'sales' && renderSalesChart()}
          {reportSubTab === 'preorders' && renderPreordersChart()}
          {reportSubTab === 'inventory' && renderInventoryChart()}

          {/* Data Tables */}
          <Card variant="outlined" sx={{ borderRadius: 1 }}>
            <CardContent sx={{ p: 0 }}>
              {reportSubTab === 'sales' && (
                <DataTable
                  columns={[
                    { id: 'invoice_number', label: 'رقم الفاتورة', render: (o) => <strong>{o.invoice_number}</strong> },
                    { id: 'created_at', label: 'تاريخ العملية' },
                    { id: 'cashier_name', label: 'الكاشير' },
                    { id: 'subtotal', label: 'الإجمالي', render: (o) => `${(o.subtotal / 100).toFixed(2)} ج.م` },
                    { id: 'discount', label: 'الخصم', render: (o) => <span style={{ color: '#ff3b30' }}>-{(o.discount / 100).toFixed(2)} ج.م</span> },
                    { id: 'total', label: 'الصافي', render: (o) => <strong style={{ color: '#34c759' }}>{(o.total / 100).toFixed(2)} ج.م</strong> },
                    {
                      id: 'payments',
                      label: 'طرق الدفع والتفاصيل',
                      render: (o) => (
                        <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                          {o.payments.map((p, idx) => (
                            <Chip
                              key={idx}
                              label={`${p.method === 'Cash' ? 'نقدي' : p.method === 'Card' ? 'بطاقة' : p.method}: ${(p.amount / 100).toFixed(2)} ج.م`}
                              size="small"
                              variant="outlined"
                              sx={{ fontSize: '0.7rem' }}
                            />
                          ))}
                        </Box>
                      )
                    }
                  ]}
                  rows={reportData.orders || []}
                  mobileRenderer={renderMobileOrderCard}
                  emptyTitle="لا توجد مبيعات مطابقة"
                  emptyDescription="سوف تظهر فواتير البيع المستوفية لشروط التصفية هنا."
                />
              )}

              {reportSubTab === 'preorders' && (
                <DataTable
                  columns={[
                    { id: 'preorder_number', label: 'رقم الحجز', render: (pr) => <strong>{pr.preorder_number}</strong> },
                    { id: 'customer_name', label: 'العميل' },
                    { id: 'customer_phone', label: 'الهاتف', render: (pr) => <code style={{ direction: 'ltr', display: 'inline-block' }}>{pr.customer_phone}</code> },
                    {
                      id: 'status',
                      label: 'الحالة',
                      render: (pr) => (
                        <Chip
                          label={
                            pr.status === 'DEPOSIT_PAID_WAITING_STOCK' ? 'بانتظار المخزون' :
                            pr.status === 'READY_FOR_PICKUP' ? 'جاهز للاستلام' :
                            pr.status === 'PICKED_UP' ? 'تم التسليم' : 'ملغي'
                          }
                          color={
                            pr.status === 'DEPOSIT_PAID_WAITING_STOCK' ? 'warning' :
                            pr.status === 'READY_FOR_PICKUP' ? 'info' :
                            pr.status === 'PICKED_UP' ? 'success' : 'error'
                          }
                          size="small"
                          sx={{ fontWeight: 'bold', fontFamily: 'Cairo' }}
                        />
                      )
                    },
                    { id: 'total_amount', label: 'الإجمالي', render: (pr) => `${(pr.total_amount / 100).toFixed(2)} ج.م` },
                    { id: 'deposit_paid', label: 'المدفوع مقدم', render: (pr) => <span style={{ color: '#34c759' }}>{(pr.deposit_paid / 100).toFixed(2)} ج.م</span> },
                    { id: 'remaining_amount', label: 'المتبقي للتحصيل', render: (pr) => <strong style={{ color: '#ff9500' }}>{(pr.remaining_amount / 100).toFixed(2)} ج.م</strong> },
                    { id: 'created_at', label: 'تاريخ الحجز' }
                  ]}
                  rows={reportData.preorders || []}
                  mobileRenderer={renderMobilePreorderCard}
                  emptyTitle="لا توجد حجوزات مطابقة"
                  emptyDescription="سوف تظهر ملفات الحجز المستوفية لشروط التصفية هنا."
                />
              )}

              {reportSubTab === 'inventory' && (
                <DataTable
                  columns={[
                    { id: 'name', label: 'اسم الصنف', render: (p) => <strong>{p.name}</strong> },
                    { id: 'sku', label: 'رمز SKU', render: (p) => <code>{p.sku}</code> },
                    { id: 'barcode', label: 'الباركود', render: (p) => p.barcode || '—' },
                    { id: 'category_name', label: 'التصنيف' },
                    {
                      id: 'current_stock',
                      label: 'المخزون الفعلي',
                      render: (p) => (
                        <span style={{ fontWeight: 'bold', color: p.current_stock === 0 ? '#ff3b30' : p.current_stock <= p.low_stock_threshold ? '#ff9500' : 'inherit' }}>
                          {p.current_stock} قطعة
                        </span>
                      )
                    },
                    { id: 'reserved_stock', label: 'المحجوز', render: (p) => `${p.reserved_stock} قطعة` },
                    {
                      id: 'available',
                      label: 'المتاح للبيع',
                      render: (p) => {
                        const available = p.current_stock - p.reserved_stock;
                        return (
                          <strong style={{ color: available <= 0 ? '#ff3b30' : '#34c759' }}>
                            {available} قطعة
                          </strong>
                        );
                      }
                    }
                  ]}
                  rows={reportData.products || []}
                  mobileRenderer={renderMobileProductCard}
                  emptyTitle="لا توجد أصناف مطابقة"
                  emptyDescription="سوف تظهر مستويات مخازن الأصناف هنا بالتفصيل."
                />
              )}

              {reportSubTab === 'shifts' && (
                <DataTable
                  columns={[
                    { id: 'id', label: 'رقم الوردية', render: (s) => <strong>#{s.id}</strong> },
                    { id: 'cashier_name', label: 'الكاشير' },
                    {
                      id: 'status',
                      label: 'الحالة',
                      render: (s) => (
                        <Chip
                          label={
                            s.status === 'OPEN' ? 'مفتوحة' :
                            s.status === 'CLOSE_REQUESTED' ? 'بانتظار المراجعة' : 'مغلقة'
                          }
                          color={
                            s.status === 'OPEN' ? 'success' :
                            s.status === 'CLOSE_REQUESTED' ? 'warning' : 'info'
                          }
                          size="small"
                          sx={{ fontWeight: 'bold', fontFamily: 'Cairo' }}
                        />
                      )
                    },
                    { id: 'opening_cash', label: 'العهدة الافتتاحية', render: (s) => `${(s.opening_cash / 100).toFixed(2)} ج.م` },
                    { id: 'actual_closing_cash', label: 'العهدة الفعلية', render: (s) => s.actual_closing_cash !== null ? `${(s.actual_closing_cash / 100).toFixed(2)} ج.م` : '—' },
                    {
                      id: 'difference',
                      label: 'العجز والزيادة',
                      render: (s) => {
                        const varianceVal =
                          s.actual_closing_cash !== null && s.expected_closing_cash !== null
                            ? (s.actual_closing_cash - s.expected_closing_cash) / 100
                            : null;
                        return (
                          <span style={{ fontWeight: 'bold', color: varianceVal === null ? 'inherit' : varianceVal < 0 ? '#ff3b30' : varianceVal > 0 ? '#34c759' : 'inherit' }}>
                            {varianceVal !== null ? `${varianceVal.toFixed(2)} ج.م` : '—'}
                          </span>
                        );
                      }
                    },
                    { id: 'opened_at', label: 'تاريخ الفتح' },
                    { id: 'closed_at', label: 'تاريخ الإغلاق', render: (s) => s.closed_at || '—' }
                  ]}
                  rows={reportData.shifts || []}
                  mobileRenderer={renderMobileShiftCard}
                  emptyTitle="لا توجد ورديات مطابقة"
                  emptyDescription="سوف تظهر سجلات الورديات المطلوبة هنا."
                />
              )}
            </CardContent>
          </Card>
        </Box>
      )}
    </Box>
  );
}

export default Reports;

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../app/AuthContext.jsx';
import { useLanguage } from '../i18n/config.js';
import PageHeader from '../components/navigation/PageHeader.jsx';
import KpiCard from '../components/data-display/KpiCard.jsx';
import DataTable from '../components/data-display/DataTable.jsx';
import LoadingState from '../components/feedback/LoadingState.jsx';
import apiClient from '../api/client.js';
import {
  Box,
  Typography,
  Grid,
  Paper,
  Button,
  Divider,
  Alert,
  Card,
  CardContent,
  Chip
} from '@mui/material';
import {
  Refresh as RefreshIcon,
  TrendingUp as TrendingUpIcon,
  MonetizationOn as MonetizationOnIcon,
  Bookmark as BookmarkIcon,
  Warning as WarningIcon,
  AccessTime as AccessTimeIcon,
  Calculate as CalculateIcon,
  Payment as PaymentIcon,
  ShoppingCart as ShoppingCartIcon,
  PersonAdd as PersonAddIcon,
  AddBox as AddBoxIcon,
  Inventory as InventoryIcon
} from '@mui/icons-material';

export function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { t, locale, dir } = useLanguage();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [cairoTime, setCairoTime] = useState('');

  // Core Data States
  const [kpis, setKpis] = useState(null);
  const [preorderSummary, setPreorderSummary] = useState(null);
  const [salesSummary, setSalesSummary] = useState(null);
  const [pendingShifts, setPendingShifts] = useState([]);

  // Localized Cairo Dynamic Clock
  useEffect(() => {
    const updateTime = () => {
      setCairoTime(new Intl.DateTimeFormat('ar-EG', {
        timeZone: 'Africa/Cairo',
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true,
        numberingSystem: 'latn'
      }).format(new Date()));
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const fetchDashboardData = async () => {
    setLoading(true);
    setError('');
    try {
      // Parallel fetch to populate all segments
      const [kpiRes, preorderRes, salesRes, shiftsRes] = await Promise.all([
        apiClient.get('/api/admin/kpis'),
        apiClient.get('/api/admin/reports/preorders'),
        apiClient.get('/api/admin/reports/sales'),
        apiClient.get('/api/shifts/pending-review')
      ]);

      setKpis(kpiRes.data);
      setPreorderSummary(preorderRes.data?.summary || null);
      setSalesSummary(salesRes.data?.summary || null);
      setPendingShifts(shiftsRes.data || []);
    } catch (err) {
      setError(err.message || 'فشلت عملية تحميل مؤشرات الأداء.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  if (loading) {
    return <LoadingState type="table" rows={6} cols={4} message="جاري تحميل إحصائيات لوحة التحكم..." />;
  }

  // Formatting helpers
  const formatMoney = (valMinor) => {
    const amount = (valMinor || 0) / 100;
    return amount.toLocaleString(locale === 'ar' ? 'ar-EG' : 'en-US', {
      style: 'currency',
      currency: 'EGP',
      minimumFractionDigits: 2
    });
  };

  const getPaymentMethodLabel = (method) => {
    const labels = {
      'CASH': 'نقدي',
      'CARD': 'بطاقة ائتمانية',
      'INSTAPAY': 'إنستاباي (InstaPay)',
      'WALLET': 'محفظة إلكترونية',
      'TRANSFER': 'تحويل بنكي'
    };
    return labels[method.toUpperCase()] || method;
  };

  // Convert breakdown object to table rows
  const paymentRows = salesSummary?.payments_breakdown
    ? Object.entries(salesSummary.payments_breakdown).map(([method, amount]) => ({
        method,
        amount
      }))
    : [];

  return (
    <Box sx={{ width: '100%' }}>
      {/* Header section with Dynamic Egyptian Clock */}
      <Box
        sx={{
          display: 'flex',
          flexDirection: { xs: 'column', md: 'row' },
          justifyContent: 'space-between',
          alignItems: { xs: 'flex-start', md: 'center' },
          mb: 3,
          gap: 2
        }}
      >
        <Box sx={{ textAlign: dir === 'rtl' ? 'right' : 'left' }}>
          <Typography variant="h5" sx={{ fontWeight: 700, fontFamily: 'Cairo', color: 'text.primary' }}>
            {t('dashboard.title')}
          </Typography>
          <Typography variant="caption" sx={{ color: 'text.secondary', fontFamily: 'Cairo', mt: 0.5, display: 'block' }}>
            {t('dashboard.subtitle')}
          </Typography>
        </Box>
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: { xs: 'flex-start', md: 'flex-end' },
            gap: 1
          }}
        >
          <Typography
            variant="caption"
            sx={{
              backgroundColor: 'action.hover',
              border: '1px solid',
              borderColor: 'divider',
              borderRadius: '4px',
              px: 2,
              py: 0.75,
              fontWeight: 600,
              fontFamily: 'Cairo',
              color: 'text.secondary',
              display: 'inline-block'
            }}
          >
            {cairoTime}
          </Typography>
          <Button
            variant="outlined"
            size="small"
            startIcon={<RefreshIcon />}
            onClick={fetchDashboardData}
            sx={{ fontFamily: 'Cairo', fontSize: '0.8rem' }}
          >
            تحديث البيانات
          </Button>
        </Box>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3, fontFamily: 'Cairo', textAlign: dir === 'rtl' ? 'right' : 'left' }}>
          {error}
        </Alert>
      )}

      {/* KPI Cards Grid */}
      <Grid container spacing={2.5} sx={{ mb: 4 }}>
        {/* KPI 1: Direct Sales */}
        <Grid item xs={12} sm={6} md={4} lg={2}>
          <KpiCard
            title="إجمالي المبيعات المباشرة"
            value={formatMoney(kpis?.totalSales)}
            secondaryText={`عدد الفواتير: ${kpis?.salesCount || 0}`}
            icon={<TrendingUpIcon />}
            iconBgColor="primary.main"
          />
        </Grid>

        {/* KPI 2: Deposits Paid */}
        <Grid item xs={12} sm={6} md={4} lg={2}>
          <KpiCard
            title="إجمالي العربون المستلم"
            value={formatMoney(kpis?.totalDeposits)}
            secondaryText="مبالغ الحجوزات المقدمة"
            icon={<MonetizationOnIcon />}
            iconBgColor="success.main"
          />
        </Grid>

        {/* KPI 3: Remaining Payments */}
        <Grid item xs={12} sm={6} md={4} lg={2}>
          <KpiCard
            title="إجمالي المبالغ المتبقية للتحصيل"
            value={formatMoney(preorderSummary?.total_remaining_amount)}
            secondaryText="حسابات عملاء الحجوزات"
            icon={<PaymentIcon />}
            iconBgColor="warning.main"
          />
        </Grid>

        {/* KPI 4: Open Preorders */}
        <Grid item xs={12} sm={6} md={4} lg={2}>
          <KpiCard
            title="الحجوزات النشطة"
            value={`${kpis?.activePreordersCount || 0} حجز`}
            secondaryText="بانتظار توفر الكتب والتسليم"
            icon={<BookmarkIcon />}
            iconBgColor="info.main"
          />
        </Grid>

        {/* KPI 5: Low Stock */}
        <Grid item xs={12} sm={6} md={4} lg={2}>
          <KpiCard
            title="منتجات منخفضة المخزون"
            value={`${kpis?.lowStockCount || 0} صنف`}
            secondaryText="تجاوزت الحد الأدنى للأمان"
            icon={<WarningIcon />}
            iconBgColor={kpis?.lowStockCount > 0 ? 'error.main' : 'text.disabled'}
          />
        </Grid>

        {/* KPI 6: Pending Shifts */}
        <Grid item xs={12} sm={6} md={4} lg={2}>
          <KpiCard
            title="ورديات بانتظار المراجعة"
            value={`${kpis?.pendingShiftsCount || 0} وردية`}
            secondaryText="تتطلب تدقيق وموافقة الأدمن"
            icon={<AccessTimeIcon />}
            iconBgColor={kpis?.pendingShiftsCount > 0 ? 'warning.main' : 'text.disabled'}
          />
        </Grid>
      </Grid>

      {/* Main Sections Grid */}
      <Grid container spacing={3}>
        {/* Column 1: Financial & Products data */}
        <Grid item xs={12} md={7}>
          {/* Payment Methods Breakdown */}
          <Paper variant="outlined" sx={{ p: 2.5, mb: 3, borderRadius: 1 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 2, fontFamily: 'Cairo', color: 'text.primary' }}>
              مبيعات طرق الدفع المتوفرة بالخزينة
            </Typography>
            <DataTable
              columns={[
                {
                  id: 'method',
                  label: 'طريقة الدفع',
                  render: (row) => getPaymentMethodLabel(row.method)
                },
                {
                  id: 'amount',
                  label: 'القيمة المالية المحصلة',
                  align: dir === 'rtl' ? 'left' : 'right',
                  render: (row) => formatMoney(row.amount)
                }
              ]}
              rows={paymentRows}
              emptyTitle="لا توجد عمليات مبيعات مسجلة"
              emptyDescription="لم يتم العثور على أي حركة دفع في الفترة الحالية."
            />
          </Paper>

          {/* Top Selling Products */}
          <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 1 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 2, fontFamily: 'Cairo', color: 'text.primary' }}>
              الأصناف الخمسة الأكثر مبيعاً (Best Sellers)
            </Typography>
            <DataTable
              columns={[
                { id: 'sku', label: 'رمز SKU' },
                { id: 'name', label: 'اسم المنتج' },
                {
                  id: 'total_qty',
                  label: 'إجمالي الوحدات المباعة',
                  align: 'center',
                  render: (row) => `${row.total_qty} قطعة`
                }
              ]}
              rows={kpis?.topProducts || []}
              emptyTitle="لا توجد إحصائيات بيع حالية"
              emptyDescription="سيتم عرض الأصناف الأكثر مبيعاً فور تسجيل فواتير جديدة."
            />
          </Paper>
        </Grid>

        {/* Column 2: Activity & Operations */}
        <Grid item xs={12} md={5}>
          {/* Quick Actions Panel */}
          <Paper variant="outlined" sx={{ p: 2.5, mb: 3, borderRadius: 1 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 2, fontFamily: 'Cairo', color: 'text.primary' }}>
              العمليات والمهام السريعة
            </Typography>
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 1.5 }}>
              <Button
                variant="outlined"
                startIcon={<ShoppingCartIcon />}
                onClick={() => navigate('/pos')}
                sx={{ fontFamily: 'Cairo', fontSize: '0.8rem', justifyContent: 'flex-start', py: 1 }}
              >
                شاشة البيع (POS)
              </Button>
              <Button
                variant="outlined"
                startIcon={<InventoryIcon />}
                onClick={() => navigate('/inventory')}
                sx={{ fontFamily: 'Cairo', fontSize: '0.8rem', justifyContent: 'flex-start', py: 1 }}
              >
                دفتر المخزون
              </Button>
              <Button
                variant="outlined"
                startIcon={<PersonAddIcon />}
                onClick={() => navigate('/customers')}
                sx={{ fontFamily: 'Cairo', fontSize: '0.8rem', justifyContent: 'flex-start', py: 1 }}
              >
                إضافة عميل جديد
              </Button>
              <Button
                variant="outlined"
                startIcon={<AddBoxIcon />}
                onClick={() => navigate('/products')}
                sx={{ fontFamily: 'Cairo', fontSize: '0.8rem', justifyContent: 'flex-start', py: 1 }}
              >
                إضافة صنف جديد
              </Button>
            </Box>
          </Paper>

          {/* Pending Reviews Queue */}
          <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 1 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 2, fontFamily: 'Cairo', color: 'text.primary' }}>
              أحدث ورديات بانتظار المراجعة والاعتماد
            </Typography>
            {pendingShifts.length === 0 ? (
              <Typography variant="body2" sx={{ color: 'text.secondary', py: 3, textAlign: 'center', fontFamily: 'Cairo' }}>
                لا توجد ورديات معلقة حالياً بانتظار المراجعة.
              </Typography>
            ) : (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                {pendingShifts.slice(0, 3).map((shift) => (
                  <Card key={shift.id} variant="outlined" sx={{ borderRadius: 1 }}>
                    <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                        <Typography variant="subtitle2" sx={{ fontWeight: 700, fontFamily: 'Cairo', fontSize: '0.8rem' }}>
                          وردية #{shift.id} - {shift.cashier_name}
                        </Typography>
                        <Chip label="بانتظار المراجعة" color="warning" size="small" sx={{ fontSize: '0.7rem', height: 20, fontFamily: 'Cairo' }} />
                      </Box>
                      <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', fontFamily: 'Cairo' }}>
                        الرصيد الافتتاحي: {formatMoney(shift.opening_balance)}
                      </Typography>
                      <Button
                        size="small"
                        onClick={() => navigate('/shifts')}
                        startIcon={<CalculateIcon fontSize="small" />}
                        sx={{ mt: 1, fontFamily: 'Cairo', fontSize: '0.75rem', py: 0 }}
                      >
                        مراجعة وإغلاق الوردية
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </Box>
            )}
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
}

export default Dashboard;

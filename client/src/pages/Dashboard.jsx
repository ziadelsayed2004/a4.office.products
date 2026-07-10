import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Button,
  Grid,
  Card,
  CardContent,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  CircularProgress,
  Alert
} from '@mui/material';
import {
  Refresh as RefreshIcon,
  TrendingUp as TrendingUpIcon,
  MonetizationOn as MonetizationOnIcon,
  Bookmark as BookmarkIcon,
  Warning as WarningIcon,
  AccessTime as AccessTimeIcon
} from '@mui/icons-material';
import apiClient from '../api/client.js';

export function Dashboard() {
  const [adminKPIs, setAdminKPIs] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadAdminKPIs = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await apiClient.get('/api/admin/kpis');
      setAdminKPIs(res.data);
    } catch (err) {
      setError(err.message || 'فشلت عملية تحميل مؤشرات الأداء.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAdminKPIs();
  }, []);

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5" sx={{ fontWeight: 'bold', color: 'primary.main', fontFamily: 'Cairo' }}>
          لوحة الإحصائيات ومؤشرات الأداء
        </Typography>
        <Button
          variant="contained"
          startIcon={<RefreshIcon />}
          onClick={loadAdminKPIs}
          sx={{ fontFamily: 'Cairo' }}
        >
          تحديث المؤشرات
        </Button>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3, fontFamily: 'Cairo', textAlign: 'right' }}>
          {error}
        </Alert>
      )}

      {loading || !adminKPIs ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 5 }}>
          <CircularProgress />
        </Box>
      ) : (
        <Grid container spacing={3}>
          {/* Card 1: Sales */}
          <Grid item xs={12} sm={6} md={2.4}>
            <Card variant="outlined">
              <CardContent sx={{ p: 2 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600, fontFamily: 'Cairo' }}>
                    إجمالي المبيعات المباشرة
                  </Typography>
                  <TrendingUpIcon color="primary" />
                </Box>
                <Typography variant="h6" sx={{ fontWeight: 'bold', mt: 2, color: 'primary.main' }}>
                  {(adminKPIs.totalSales / 100).toFixed(2)} ج.م
                </Typography>
                <Typography variant="caption" sx={{ color: 'text.secondary', mt: 0.5, display: 'block', fontFamily: 'Cairo' }}>
                  عدد الفواتير: {adminKPIs.salesCount}
                </Typography>
              </CardContent>
            </Card>
          </Grid>

          {/* Card 2: Deposits */}
          <Grid item xs={12} sm={6} md={2.4}>
            <Card variant="outlined">
              <CardContent sx={{ p: 2 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600, fontFamily: 'Cairo' }}>
                    إجمالي عربين الحجوزات
                  </Typography>
                  <MonetizationOnIcon color="success" />
                </Box>
                <Typography variant="h6" sx={{ fontWeight: 'bold', mt: 2, color: 'success.main' }}>
                  {(adminKPIs.totalDeposits / 100).toFixed(2)} ج.m
                </Typography>
                <Typography variant="caption" sx={{ color: 'text.secondary', mt: 0.5, display: 'block', fontFamily: 'Cairo' }}>
                  مبالغ مقدمة محصلة
                </Typography>
              </CardContent>
            </Card>
          </Grid>

          {/* Card 3: Preorders */}
          <Grid item xs={12} sm={6} md={2.4}>
            <Card variant="outlined">
              <CardContent sx={{ p: 2 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600, fontFamily: 'Cairo' }}>
                    الحجوزات النشطة
                  </Typography>
                  <BookmarkIcon color="info" />
                </Box>
                <Typography variant="h6" sx={{ fontWeight: 'bold', mt: 2 }}>
                  {adminKPIs.activePreordersCount} حجز
                </Typography>
                <Typography variant="caption" sx={{ color: 'text.secondary', mt: 0.5, display: 'block', fontFamily: 'Cairo' }}>
                  بانتظار التوفر أو التسليم
                </Typography>
              </CardContent>
            </Card>
          </Grid>

          {/* Card 4: Low Stock */}
          <Grid item xs={12} sm={6} md={2.4}>
            <Card
              variant="outlined"
              sx={{
                borderColor: adminKPIs.lowStockCount > 0 ? 'error.main' : 'divider'
              }}
            >
              <CardContent sx={{ p: 2 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600, fontFamily: 'Cairo' }}>
                    منتجات منخفضة المخزون
                  </Typography>
                  <WarningIcon color={adminKPIs.lowStockCount > 0 ? 'error' : 'disabled'} />
                </Box>
                <Typography
                  variant="h6"
                  sx={{
                    fontWeight: 'bold',
                    mt: 2,
                    color: adminKPIs.lowStockCount > 0 ? 'error.main' : 'text.primary'
                  }}
                >
                  {adminKPIs.lowStockCount} منتج
                </Typography>
                <Typography variant="caption" sx={{ color: 'text.secondary', mt: 0.5, display: 'block', fontFamily: 'Cairo' }}>
                  تجاوزت حد الأمان للمخزون
                </Typography>
              </CardContent>
            </Card>
          </Grid>

          {/* Card 5: Pending Shifts */}
          <Grid item xs={12} sm={6} md={2.4}>
            <Card
              variant="outlined"
              sx={{
                borderColor: adminKPIs.pendingShiftsCount > 0 ? 'warning.main' : 'divider'
              }}
            >
              <CardContent sx={{ p: 2 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600, fontFamily: 'Cairo' }}>
                    ورديات بانتظار المراجعة
                  </Typography>
                  <AccessTimeIcon color={adminKPIs.pendingShiftsCount > 0 ? 'warning' : 'disabled'} />
                </Box>
                <Typography
                  variant="h6"
                  sx={{
                    fontWeight: 'bold',
                    mt: 2,
                    color: adminKPIs.pendingShiftsCount > 0 ? 'warning.main' : 'text.primary'
                  }}
                >
                  {adminKPIs.pendingShiftsCount} وردية
                </Typography>
                <Typography variant="caption" sx={{ color: 'text.secondary', mt: 0.5, display: 'block', fontFamily: 'Cairo' }}>
                  تحتاج إلى موافقة الأدمن
                </Typography>
              </CardContent>
            </Card>
          </Grid>

          {/* Top Selling Products */}
          <Grid item xs={12}>
            <Paper variant="outlined" sx={{ p: 3 }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 'bold', mb: 2, fontFamily: 'Cairo' }}>
                الأصناف الأكثر مبيعاً (Top 5 Best Sellers)
              </Typography>

              {adminKPIs.topProducts.length === 0 ? (
                <Typography variant="body2" sx={{ color: 'text.secondary', py: 4, textAlign: 'center', fontFamily: 'Cairo' }}>
                  لا توجد بيانات مبيعات متوفرة حالياً لتحديد المنتجات الأكثر طلباً.
                </Typography>
              ) : (
                <TableContainer>
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableCell>الترتيب</TableCell>
                        <TableCell>اسم الصنف</TableCell>
                        <TableCell>رمز SKU</TableCell>
                        <TableCell>إجمالي الكميات المباعة</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {adminKPIs.topProducts.map((prod, idx) => (
                        <TableRow key={prod.id} hover>
                          <TableCell sx={{ fontWeight: 'bold' }}>#{idx + 1}</TableCell>
                          <TableCell>{prod.name}</TableCell>
                          <TableCell>
                            <code>{prod.sku}</code>
                          </TableCell>
                          <TableCell sx={{ fontWeight: 'bold', color: 'primary.main' }}>
                            {prod.total_qty} قطعة
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </Paper>
          </Grid>
        </Grid>
      )}
    </Box>
  );
}

export default Dashboard;

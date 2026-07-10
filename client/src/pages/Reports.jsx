import React, { useState, useEffect } from 'react';
import { useAuth } from '../app/AuthContext.jsx';
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
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
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
  }, [token]);

  useEffect(() => {
    setReportData(null);
    loadReport();
  }, [reportSubTab]);

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

  return (
    <Box>
      {/* Content Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5" sx={{ fontWeight: 'bold', color: 'primary.main', fontFamily: 'Cairo' }}>
          التقارير التفصيلية والتصدير
        </Typography>
        <Button
          variant="contained"
          color="secondary"
          startIcon={<DownloadIcon />}
          onClick={handleExportReport}
          sx={{ fontFamily: 'Cairo' }}
        >
          تصدير التقرير الحالي (CSV)
        </Button>
      </Box>

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
      <Paper variant="outlined" sx={{ p: 3, mb: 3 }}>
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
                  />
                </Grid>
              </>
            )}

            {/* Cashier filter */}
            {['sales', 'preorders', 'shifts'].includes(reportSubTab) && (
              <Grid item xs={12} sm={3}>
                <FormControl fullWidth size="small">
                  <InputLabel>الكاشير / المستخدم</InputLabel>
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
                  <InputLabel>التصنيف</InputLabel>
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
                />
              </Grid>
            )}

            {/* Preorder status filter */}
            {reportSubTab === 'preorders' && (
              <Grid item xs={12} sm={3}>
                <FormControl fullWidth size="small">
                  <InputLabel>حالة الحجز</InputLabel>
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
                  <InputLabel>حالة المخزون</InputLabel>
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
        <Alert severity="error" sx={{ mb: 3, fontFamily: 'Cairo', textAlign: 'right' }}>
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
                  <Card variant="outlined">
                    <CardContent sx={{ p: 2 }}>
                      <Typography variant="caption" sx={{ color: 'text.secondary', fontFamily: 'Cairo' }}>إجمالي المبيعات (قبل الخصم)</Typography>
                      <Typography variant="h6" sx={{ color: 'primary.main', fontWeight: 'bold', mt: 1 }}>
                        {(reportData.summary.total_sales / 100).toFixed(2)} ج.م
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <Card variant="outlined">
                    <CardContent sx={{ p: 2 }}>
                      <Typography variant="caption" sx={{ color: 'text.secondary', fontFamily: 'Cairo' }}>إجمالي الخصومات</Typography>
                      <Typography variant="h6" sx={{ color: 'error.main', fontWeight: 'bold', mt: 1 }}>
                        {(reportData.summary.total_discount / 100).toFixed(2)} ج.م
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <Card variant="outlined">
                    <CardContent sx={{ p: 2 }}>
                      <Typography variant="caption" sx={{ color: 'text.secondary', fontFamily: 'Cairo' }}>صافي المبيعات المحصلة</Typography>
                      <Typography variant="h6" sx={{ color: 'success.main', fontWeight: 'bold', mt: 1 }}>
                        {(reportData.summary.total_net / 100).toFixed(2)} ج.م
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <Card variant="outlined">
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
                  <Card variant="outlined">
                    <CardContent sx={{ p: 2 }}>
                      <Typography variant="caption" sx={{ color: 'text.secondary', fontFamily: 'Cairo' }}>إجمالي مبالغ الحجوزات</Typography>
                      <Typography variant="h6" sx={{ color: 'primary.main', fontWeight: 'bold', mt: 1 }}>
                        {(reportData.summary.total_amount / 100).toFixed(2)} ج.م
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <Card variant="outlined">
                    <CardContent sx={{ p: 2 }}>
                      <Typography variant="caption" sx={{ color: 'text.secondary', fontFamily: 'Cairo' }}>إجمالي العربين المستلمة</Typography>
                      <Typography variant="h6" sx={{ color: 'success.main', fontWeight: 'bold', mt: 1 }}>
                        {(reportData.summary.total_deposit_paid / 100).toFixed(2)} ج.م
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <Card variant="outlined">
                    <CardContent sx={{ p: 2 }}>
                      <Typography variant="caption" sx={{ color: 'text.secondary', fontFamily: 'Cairo' }}>إجمالي المتبقي للتحصيل</Typography>
                      <Typography variant="h6" sx={{ color: 'warning.main', fontWeight: 'bold', mt: 1 }}>
                        {(reportData.summary.total_remaining_amount / 100).toFixed(2)} ج.م
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <Card variant="outlined">
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
                  <Card variant="outlined">
                    <CardContent sx={{ p: 2 }}>
                      <Typography variant="caption" sx={{ color: 'text.secondary', fontFamily: 'Cairo' }}>إجمالي عدد المنتجات النشطة</Typography>
                      <Typography variant="h6" sx={{ color: 'primary.main', fontWeight: 'bold', mt: 1 }}>
                        {reportData.summary.total_products} منتج
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
                <Grid item xs={12} sm={6} md={4}>
                  <Card variant="outlined">
                    <CardContent sx={{ p: 2 }}>
                      <Typography variant="caption" sx={{ color: 'text.secondary', fontFamily: 'Cairo' }}>عدد الأصناف منخفضة المخزون</Typography>
                      <Typography variant="h6" sx={{ color: 'error.main', fontWeight: 'bold', mt: 1 }}>
                        {reportData.summary.low_stock_count} صنف
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
                <Grid item xs={12} sm={6} md={4}>
                  <Card variant="outlined">
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
                  <Card variant="outlined">
                    <CardContent sx={{ p: 2 }}>
                      <Typography variant="caption" sx={{ color: 'text.secondary', fontFamily: 'Cairo' }}>إجمالي عدد الورديات</Typography>
                      <Typography variant="h6" sx={{ color: 'primary.main', fontWeight: 'bold', mt: 1 }}>
                        {reportData.summary.total_shifts} وردية
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <Card variant="outlined">
                    <CardContent sx={{ p: 2 }}>
                      <Typography variant="caption" sx={{ color: 'text.secondary', fontFamily: 'Cairo' }}>الورديات المفتوحة حالياً</Typography>
                      <Typography variant="h6" sx={{ color: 'success.main', fontWeight: 'bold', mt: 1 }}>
                        {reportData.summary.open_shifts} وردية
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <Card variant="outlined">
                    <CardContent sx={{ p: 2 }}>
                      <Typography variant="caption" sx={{ color: 'text.secondary', fontFamily: 'Cairo' }}>ورديات بانتظار المراجعة</Typography>
                      <Typography variant="h6" sx={{ color: 'warning.main', fontWeight: 'bold', mt: 1 }}>
                        {reportData.summary.pending_review_shifts} وردية
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <Card variant="outlined">
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

          {/* Data Tables */}
          <TableContainer component={Paper}>
            {reportSubTab === 'sales' && (
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>رقم الفاتورة</TableCell>
                    <TableCell>تاريخ العملية</TableCell>
                    <TableCell>الكاشير</TableCell>
                    <TableCell>الإجمالي</TableCell>
                    <TableCell>الخصم</TableCell>
                    <TableCell>الصافي</TableCell>
                    <TableCell>طرق الدفع والتفاصيل</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {reportData.orders.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} align="center" sx={{ color: 'text.secondary', py: 4, fontFamily: 'Cairo' }}>
                        لا توجد عمليات بيع مطابقة للفلاتر المحددة.
                      </TableCell>
                    </TableRow>
                  ) : (
                    reportData.orders.map((o) => (
                      <TableRow key={o.id} hover>
                        <TableCell sx={{ fontWeight: 'bold' }}>{o.invoice_number}</TableCell>
                        <TableCell>{o.created_at}</TableCell>
                        <TableCell>{o.cashier_name}</TableCell>
                        <TableCell>{(o.subtotal / 100).toFixed(2)} ج.م</TableCell>
                        <TableCell sx={{ color: 'error.main' }}>{(o.discount / 100).toFixed(2)} - ج.م</TableCell>
                        <TableCell sx={{ fontWeight: 'bold', color: 'success.main' }}>
                          {(o.total / 100).toFixed(2)} ج.م
                        </TableCell>
                        <TableCell>
                          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                            {o.payments.map((p, idx) => (
                              <Chip
                                key={idx}
                                label={`${p.method}: ${(p.amount / 100).toFixed(2)} ج.م`}
                                size="small"
                                variant="outlined"
                              />
                            ))}
                          </Box>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            )}

            {reportSubTab === 'preorders' && (
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>رقم الحجز</TableCell>
                    <TableCell>العميل</TableCell>
                    <TableCell>الهاتف</TableCell>
                    <TableCell>الحالة</TableCell>
                    <TableCell>الإجمالي</TableCell>
                    <TableCell>المدفوع مقدم</TableCell>
                    <TableCell>المتبقي</TableCell>
                    <TableCell>تاريخ الحجز</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {reportData.preorders.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} align="center" sx={{ color: 'text.secondary', py: 4, fontFamily: 'Cairo' }}>
                        لا توجد حجوزات مطابقة للفلاتر المحددة.
                      </TableCell>
                    </TableRow>
                  ) : (
                    reportData.preorders.map((pr) => (
                      <TableRow key={pr.id} hover>
                        <TableCell sx={{ fontWeight: 'bold' }}>{pr.preorder_number}</TableCell>
                        <TableCell>{pr.customer_name}</TableCell>
                        <TableCell><code>{pr.customer_phone}</code></TableCell>
                        <TableCell>
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
                        </TableCell>
                        <TableCell>{(pr.total_amount / 100).toFixed(2)} ج.م</TableCell>
                        <TableCell sx={{ color: 'success.main' }}>{(pr.deposit_paid / 100).toFixed(2)} ج.م</TableCell>
                        <TableCell sx={{ color: 'warning.main', fontWeight: 'bold' }}>
                          {(pr.remaining_amount / 100).toFixed(2)} ج.م
                        </TableCell>
                        <TableCell>{pr.created_at}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            )}

            {reportSubTab === 'inventory' && (
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>اسم الصنف</TableCell>
                    <TableCell>رمز SKU</TableCell>
                    <TableCell>الباركود</TableCell>
                    <TableCell>التصنيف</TableCell>
                    <TableCell>المخزون الفعلي</TableCell>
                    <TableCell>المحجوز للحجوزات</TableCell>
                    <TableCell>المخزون المتاح للبيع</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {reportData.products.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} align="center" sx={{ color: 'text.secondary', py: 4, fontFamily: 'Cairo' }}>
                        لا توجد أصناف مطابقة للفلاتر المحددة.
                      </TableCell>
                    </TableRow>
                  ) : (
                    reportData.products.map((p) => {
                      const available = p.current_stock - p.reserved_stock;
                      return (
                        <TableRow key={p.id} hover>
                          <TableCell sx={{ fontWeight: 'bold' }}>{p.name}</TableCell>
                          <TableCell><code>{p.sku}</code></TableCell>
                          <TableCell>{p.barcode || '—'}</TableCell>
                          <TableCell>{p.category_name}</TableCell>
                          <TableCell
                            sx={{
                              fontWeight: 'bold',
                              color: p.current_stock === 0 ? 'error.main' : p.current_stock <= p.low_stock_threshold ? 'warning.main' : 'text.primary'
                            }}
                          >
                            {p.current_stock} قطعة
                          </TableCell>
                          <TableCell sx={{ color: 'info.main' }}>{p.reserved_stock} قطعة</TableCell>
                          <TableCell
                            sx={{
                              fontWeight: 'bold',
                              color: available <= 0 ? 'error.main' : 'success.main'
                            }}
                          >
                            {available} قطعة
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            )}

            {reportSubTab === 'shifts' && (
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>رقم الوردية</TableCell>
                    <TableCell>الكاشير</TableCell>
                    <TableCell>الحالة</TableCell>
                    <TableCell>العهدة الافتتاحية</TableCell>
                    <TableCell>العهدة الفعلية</TableCell>
                    <TableCell>العجز والزيادة</TableCell>
                    <TableCell>تاريخ الفتح</TableCell>
                    <TableCell>تاريخ الإغلاق</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {reportData.shifts.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} align="center" sx={{ color: 'text.secondary', py: 4, fontFamily: 'Cairo' }}>
                        لا توجد ورديات مطابقة للفلاتر المحددة.
                      </TableCell>
                    </TableRow>
                  ) : (
                    reportData.shifts.map((s) => {
                      const actual = s.actual_closing_cash !== null ? (s.actual_closing_cash / 100).toFixed(2) : '-';
                      const varianceVal =
                        s.actual_closing_cash !== null && s.expected_closing_cash !== null
                          ? (s.actual_closing_cash - s.expected_closing_cash) / 100
                          : null;

                      return (
                        <TableRow key={s.id} hover>
                          <TableCell sx={{ fontWeight: 'bold' }}>#{s.id}</TableCell>
                          <TableCell>{s.cashier_name}</TableCell>
                          <TableCell>
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
                          </TableCell>
                          <TableCell>{(s.opening_cash / 100).toFixed(2)} ج.م</TableCell>
                          <TableCell>{actual !== '-' ? `${actual} ج.م` : '-'}</TableCell>
                          <TableCell
                            sx={{
                              fontWeight: 'bold',
                              color: varianceVal === null ? 'text.primary' : varianceVal < 0 ? 'error.main' : varianceVal > 0 ? 'success.main' : 'text.primary'
                            }}
                          >
                            {varianceVal !== null ? `${varianceVal.toFixed(2)} ج.م` : '-'}
                          </TableCell>
                          <TableCell>{s.opened_at}</TableCell>
                          <TableCell>{s.closed_at || '-'}</TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            )}
          </TableContainer>
        </Box>
      )}
    </Box>
  );
}

export default Reports;

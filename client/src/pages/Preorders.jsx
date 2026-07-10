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
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  CircularProgress,
  Alert,
  Chip
} from '@mui/material';
import { Refresh as RefreshIcon, Search as SearchIcon } from '@mui/icons-material';

export function Preorders() {
  const { token } = useAuth();
  
  const [adminPreordersList, setAdminPreordersList] = useState([]);
  const [adminPreordersStats, setAdminPreordersStats] = useState(null);
  
  const [loading, setLoading] = useState(true);
  const [preordersLoading, setPreordersLoading] = useState(false);
  const [error, setError] = useState('');

  // Filters state
  const [searchPreorderQuery, setSearchPreorderQuery] = useState('');
  const [filterPreorderStatus, setFilterPreorderStatus] = useState('');

  const loadAdminPreorders = async () => {
    if (!token) return;
    setPreordersLoading(true);
    setError('');
    try {
      let url = '/api/admin/preorders';
      const queryParams = [];
      if (filterPreorderStatus) queryParams.push(`status=${filterPreorderStatus}`);
      if (searchPreorderQuery) queryParams.push(`q=${encodeURIComponent(searchPreorderQuery)}`);
      if (queryParams.length > 0) url += `?${queryParams.join('&')}`;

      const res = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const payload = await res.json();
      if (res.status === 200) {
        setAdminPreordersList(payload.data || []);
      } else {
        setError(payload.error || 'فشل تحميل قائمة الحجوزات.');
      }

      // Load Preorder Stats
      const statsRes = await fetch('/api/admin/reports/preorders', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const statsPayload = await statsRes.json();
      if (statsRes.status === 200) {
        setAdminPreordersStats(statsPayload.data?.summary || null);
      }
    } catch (err) {
      setError('حدث خطأ بالاتصال بالخادم.');
    } finally {
      setPreordersLoading(false);
    }
  };

  const initData = async () => {
    setLoading(true);
    await loadAdminPreorders();
    setLoading(false);
  };

  useEffect(() => {
    initData();
  }, [token]);

  const handleUpdatePreorderStatus = async (preorderId, nextStatus) => {
    try {
      const res = await fetch(`/api/admin/preorders/${preorderId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ status: nextStatus })
      });
      const payload = await res.json();
      if (res.status === 200) {
        loadAdminPreorders();
      } else {
        alert(payload.error || 'فشلت عملية تحديث حالة الحجز.');
      }
    } catch (err) {
      alert('حدث خطأ بالاتصال بالخادم.');
    }
  };

  return (
    <Box sx={{ width: '100%' }}>
      {/* Content Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5" sx={{ fontWeight: 'bold', color: 'primary.main', fontFamily: 'Cairo' }}>
          إدارة وتتبع الحجوزات (Preorders)
        </Typography>
        <Button
          variant="contained"
          startIcon={<RefreshIcon />}
          onClick={loadAdminPreorders}
          sx={{ fontFamily: 'Cairo' }}
        >
          تحديث البيانات
        </Button>
      </Box>

      {/* KPI Aggregate cards */}
      {adminPreordersStats && (
        <Grid container spacing={3} sx={{ mb: 3 }}>
          <Grid item xs={12} sm={6} md={3}>
            <Card variant="outlined">
              <CardContent sx={{ p: 2 }}>
                <Typography variant="caption" sx={{ color: 'text.secondary', fontFamily: 'Cairo' }}>إجمالي الحجوزات</Typography>
                <Typography variant="h6" sx={{ fontWeight: 'bold', mt: 1 }}>
                  {adminPreordersStats.total_count} حجز
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card variant="outlined">
              <CardContent sx={{ p: 2 }}>
                <Typography variant="caption" sx={{ color: 'text.secondary', fontFamily: 'Cairo' }}>القيمة الإجمالية للحجوزات</Typography>
                <Typography variant="h6" sx={{ color: 'primary.main', fontWeight: 'bold', mt: 1 }}>
                  {(adminPreordersStats.total_amount / 100).toFixed(2)} ج.م
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card variant="outlined">
              <CardContent sx={{ p: 2 }}>
                <Typography variant="caption" sx={{ color: 'text.secondary', fontFamily: 'Cairo' }}>إجمالي العربون المحصل</Typography>
                <Typography variant="h6" sx={{ color: 'success.main', fontWeight: 'bold', mt: 1 }}>
                  {(adminPreordersStats.total_deposit_paid / 100).toFixed(2)} ج.م
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card variant="outlined">
              <CardContent sx={{ p: 2 }}>
                <Typography variant="caption" sx={{ color: 'text.secondary', fontFamily: 'Cairo' }}>إجمالي المتبقي للتحصيل</Typography>
                <Typography variant="h6" sx={{ color: 'warning.main', fontWeight: 'bold', mt: 1 }}>
                  {(adminPreordersStats.total_remaining_amount / 100).toFixed(2)} ج.م
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {/* Filters */}
      <Paper variant="outlined" sx={{ p: 2, mb: 3 }}>
        <Grid container spacing={2} alignItems="flex-end">
          <Grid item xs={12} sm={7}>
            <TextField
              fullWidth
              size="small"
              label="بحث برقم الحجز أو اسم العميل أو الهاتف"
              placeholder="ابحث..."
              value={searchPreorderQuery}
              onChange={(e) => setSearchPreorderQuery(e.target.value)}
              InputProps={{
                startAdornment: <SearchIcon sx={{ color: 'text.secondary', mr: 1 }} />
              }}
              sx={{ '& .MuiInputLabel-root': { fontFamily: 'Cairo' }, '& .MuiOutlinedInput-input': { fontFamily: 'Cairo' } }}
            />
          </Grid>

          <Grid item xs={12} sm={3}>
            <FormControl fullWidth size="small">
              <InputLabel>حالة الحجز</InputLabel>
              <Select
                value={filterPreorderStatus}
                label="حالة الحجز"
                onChange={(e) => setFilterPreorderStatus(e.target.value)}
              >
                <MenuItem value="">كل الحالات</MenuItem>
                <MenuItem value="DEPOSIT_PAID_WAITING_STOCK">بانتظار توفر المخزون</MenuItem>
                <MenuItem value="READY_FOR_PICKUP">جاهز للاستلام</MenuItem>
                <MenuItem value="PICKED_UP">تم التسليم النهائي</MenuItem>
                <MenuItem value="CANCELLED">ملغي</MenuItem>
                <MenuItem value="EXPIRED">منتهي</MenuItem>
              </Select>
            </FormControl>
          </Grid>

          <Grid item xs={12} sm={2}>
            <Button
              fullWidth
              variant="outlined"
              onClick={loadAdminPreorders}
              sx={{ fontFamily: 'Cairo', height: 40 }}
            >
              تصفية
            </Button>
          </Grid>
        </Grid>
      </Paper>

      {error && (
        <Alert severity="error" sx={{ mb: 3, fontFamily: 'Cairo', textAlign: 'right' }}>
          {error}
        </Alert>
      )}

      {loading || preordersLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 5 }}>
          <CircularProgress />
        </Box>
      ) : (
        <TableContainer component={Paper}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>رقم الحجز</TableCell>
                <TableCell>تاريخ الحجز</TableCell>
                <TableCell>العميل</TableCell>
                <TableCell>الإجمالي الصافي</TableCell>
                <TableCell>العربون المدفوع</TableCell>
                <TableCell>المتبقي للتحصيل</TableCell>
                <TableCell>طريقة التسليم</TableCell>
                <TableCell>الحالة</TableCell>
                <TableCell>تعديل الحالة (الأدمن)</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {adminPreordersList.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} align="center" sx={{ color: 'text.secondary', py: 4, fontFamily: 'Cairo' }}>
                    لا توجد حجوزات مطابقة للفلاتر المحددة.
                  </TableCell>
                </TableRow>
              ) : (
                adminPreordersList.map((preorder) => (
                  <TableRow key={preorder.id} hover>
                    <TableCell><code>{preorder.preorder_number}</code></TableCell>
                    <TableCell>
                      {new Date(preorder.created_at).toLocaleString('ar-EG', { timeZone: 'Africa/Cairo' })}
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                        {preorder.customer_name}
                      </Typography>
                      <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                        هاتف: {preorder.customer_phone}
                      </Typography>
                    </TableCell>
                    <TableCell>{(preorder.total_amount / 100).toFixed(2)} ج.م</TableCell>
                    <TableCell>{(preorder.deposit_paid / 100).toFixed(2)} ج.م</TableCell>
                    <TableCell sx={{ fontWeight: 'bold' }}>
                      {(preorder.remaining_amount / 100).toFixed(2)} ج.م
                    </TableCell>
                    <TableCell sx={{ fontFamily: 'Cairo' }}>
                      {preorder.pickup_method === 'walk_in' ? 'استلام من المعرض' : 'توصيل منزلي'}
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={
                          preorder.status === 'DEPOSIT_PAID_WAITING_STOCK' ? 'بانتظار المخزون' :
                          preorder.status === 'READY_FOR_PICKUP' ? 'جاهز للاستلام' :
                          preorder.status === 'PICKED_UP' ? 'تم التسليم' :
                          preorder.status === 'CANCELLED' ? 'ملغي' : 'منتهي'
                        }
                        color={
                          preorder.status === 'DEPOSIT_PAID_WAITING_STOCK' ? 'info' :
                          preorder.status === 'READY_FOR_PICKUP' ? 'warning' :
                          preorder.status === 'PICKED_UP' ? 'success' : 'error'
                        }
                        size="small"
                        sx={{ fontWeight: 'bold', fontFamily: 'Cairo' }}
                      />
                    </TableCell>
                    <TableCell>
                      <FormControl size="small" sx={{ width: 140 }}>
                        <Select
                          value={preorder.status}
                          onChange={(e) => handleUpdatePreorderStatus(preorder.id, e.target.value)}
                          sx={{ fontSize: '0.8rem', fontFamily: 'Cairo' }}
                        >
                          <MenuItem value="DEPOSIT_PAID_WAITING_STOCK">بانتظار المخزون</MenuItem>
                          <MenuItem value="READY_FOR_PICKUP">جاهز للاستلام</MenuItem>
                          <MenuItem value="PICKED_UP">تم التسليم</MenuItem>
                          <MenuItem value="CANCELLED">ملغي</MenuItem>
                          <MenuItem value="EXPIRED">منتهي</MenuItem>
                        </Select>
                      </FormControl>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Box>
  );
}

export default Preorders;

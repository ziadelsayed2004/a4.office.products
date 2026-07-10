import React, { useState, useEffect } from 'react';
import { useAuth } from '../app/AuthContext.jsx';
import {
  Box,
  Typography,
  Button,
  Grid,
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
  Chip
} from '@mui/material';
import { Refresh as RefreshIcon, FilterList as FilterListIcon } from '@mui/icons-material';

export function Inventory() {
  const { token } = useAuth();
  
  const [productsList, setProductsList] = useState([]);
  const [inventoryLedgerList, setInventoryLedgerList] = useState([]);
  
  const [loading, setLoading] = useState(true);
  const [ledgerLoading, setLedgerLoading] = useState(false);
  const [error, setError] = useState('');

  // Filters state
  const [filterInvProduct, setFilterInvProduct] = useState('');
  const [filterInvType, setFilterInvType] = useState('');
  const [filterInvStartDate, setFilterInvStartDate] = useState('');
  const [filterInvEndDate, setFilterInvEndDate] = useState('');

  const loadProducts = async () => {
    if (!token) return;
    try {
      const res = await fetch('/api/products?activeOnly=false', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const payload = await res.json();
      if (res.status === 200) {
        setProductsList(payload.data || []);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const loadInventoryLedger = async () => {
    if (!token) return;
    setLedgerLoading(true);
    setError('');
    try {
      let url = '/api/admin/inventory?limit=100';
      if (filterInvProduct) url += `&productId=${filterInvProduct}`;
      if (filterInvType) url += `&transactionType=${filterInvType}`;
      if (filterInvStartDate) url += `&startDate=${filterInvStartDate}`;
      if (filterInvEndDate) url += `&endDate=${filterInvEndDate}`;

      const res = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const payload = await res.json();
      if (res.status === 200) {
        setInventoryLedgerList(payload.data?.ledger || []);
      } else {
        setError(payload.error || 'فشل تحميل دفتر المخزون.');
      }
    } catch (err) {
      setError('حدث خطأ أثناء الاتصال بالخادم.');
    } finally {
      setLedgerLoading(false);
    }
  };

  const initData = async () => {
    setLoading(true);
    await Promise.all([loadProducts(), loadInventoryLedger()]);
    setLoading(false);
  };

  useEffect(() => {
    initData();
  }, [token]);

  return (
    <Box sx={{ width: '100%' }}>
      {/* Content Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5" sx={{ fontWeight: 'bold', color: 'primary.main', fontFamily: 'Cairo' }}>
          دفتر حركة المخزون (Inventory Ledger)
        </Typography>
        <Button
          variant="contained"
          startIcon={<RefreshIcon />}
          onClick={loadInventoryLedger}
          sx={{ fontFamily: 'Cairo' }}
        >
          تحديث السجل
        </Button>
      </Box>

      {/* Filter Card */}
      <Paper variant="outlined" sx={{ p: 3, mb: 3 }}>
        <Grid container spacing={2} alignItems="flex-end">
          <Grid item xs={12} sm={3}>
            <FormControl fullWidth size="small">
              <InputLabel>المنتج</InputLabel>
              <Select
                value={filterInvProduct}
                label="المنتج"
                onChange={(e) => setFilterInvProduct(e.target.value)}
              >
                <MenuItem value="">كل المنتجات</MenuItem>
                {productsList.map((p) => (
                  <MenuItem key={p.id} value={p.id.toString()}>
                    {p.name} ({p.sku})
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>

          <Grid item xs={12} sm={3}>
            <FormControl fullWidth size="small">
              <InputLabel>نوع الحركة</InputLabel>
              <Select
                value={filterInvType}
                label="نوع الحركة"
                onChange={(e) => setFilterInvType(e.target.value)}
              >
                <MenuItem value="">كل الحركات</MenuItem>
                <MenuItem value="STOCK_IN">شراء بضاعة (STOCK_IN)</MenuItem>
                <MenuItem value="SALE">مبيعات (SALE)</MenuItem>
                <MenuItem value="PREORDER_PICKUP">تسليم حجز (PREORDER_PICKUP)</MenuItem>
                <MenuItem value="ADJUSTMENT_ADD">تسوية بالزيادة (ADJUSTMENT_ADD)</MenuItem>
                <MenuItem value="ADJUSTMENT_SUB">تسوية بالخصم (ADJUSTMENT_SUB)</MenuItem>
              </Select>
            </FormControl>
          </Grid>

          <Grid item xs={12} sm={2}>
            <TextField
              fullWidth
              size="small"
              label="تاريخ البداية"
              type="date"
              InputLabelProps={{ shrink: true }}
              value={filterInvStartDate}
              onChange={(e) => setFilterInvStartDate(e.target.value)}
            />
          </Grid>

          <Grid item xs={12} sm={2}>
            <TextField
              fullWidth
              size="small"
              label="تاريخ النهاية"
              type="date"
              InputLabelProps={{ shrink: true }}
              value={filterInvEndDate}
              onChange={(e) => setFilterInvEndDate(e.target.value)}
            />
          </Grid>

          <Grid item xs={12} sm={2}>
            <Button
              fullWidth
              variant="outlined"
              startIcon={<FilterListIcon />}
              onClick={loadInventoryLedger}
              sx={{ fontFamily: 'Cairo' }}
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

      {loading || ledgerLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 5 }}>
          <CircularProgress />
        </Box>
      ) : (
        <TableContainer component={Paper}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>الرقم</TableCell>
                <TableCell>التاريخ والوقت</TableCell>
                <TableCell>المنتج</TableCell>
                <TableCell>نوع الحركة</TableCell>
                <TableCell>الكمية المعدلة</TableCell>
                <TableCell>المخزون السابق</TableCell>
                <TableCell>المخزون بعد الحركة</TableCell>
                <TableCell>المستخدم المسؤول</TableCell>
                <TableCell>ملاحظات</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {inventoryLedgerList.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} align="center" sx={{ color: 'text.secondary', py: 4, fontFamily: 'Cairo' }}>
                    لا توجد حركات مخزنية مطابقة للبحث.
                  </TableCell>
                </TableRow>
              ) : (
                inventoryLedgerList.map((log) => (
                  <TableRow key={log.id} hover>
                    <TableCell>{log.id}</TableCell>
                    <TableCell>
                      {new Date(log.created_at).toLocaleString('ar-EG', { timeZone: 'Africa/Cairo' })}
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                        {log.product_name}
                      </Typography>
                      <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                        SKU: {log.product_sku}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={
                          log.transaction_type === 'STOCK_IN' ? 'شراء بضاعة' :
                          log.transaction_type === 'SALE' ? 'مبيعات' :
                          log.transaction_type === 'PREORDER_PICKUP' ? 'تسليم حجز' :
                          log.transaction_type === 'ADJUSTMENT_ADD' ? 'تسوية بالزيادة' : 'تسوية بالخصم'
                        }
                        color={
                          log.transaction_type === 'STOCK_IN' || log.transaction_type === 'ADJUSTMENT_ADD' ? 'success' :
                          log.transaction_type === 'SALE' ? 'info' :
                          log.transaction_type === 'PREORDER_PICKUP' ? 'primary' : 'error'
                        }
                        size="small"
                        sx={{ fontWeight: 'bold', fontFamily: 'Cairo' }}
                      />
                    </TableCell>
                    <TableCell>
                      <Typography
                        variant="body2"
                        sx={{
                          fontWeight: 'bold',
                          color: log.quantity_changed > 0 ? 'success.main' : 'error.main'
                        }}
                      >
                        {log.quantity_changed > 0 ? `+${log.quantity_changed}` : log.quantity_changed}
                      </Typography>
                    </TableCell>
                    <TableCell>{log.before_quantity}</TableCell>
                    <TableCell>{log.after_quantity}</TableCell>
                    <TableCell>{log.user_name}</TableCell>
                    <TableCell>{log.notes || '—'}</TableCell>
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

export default Inventory;

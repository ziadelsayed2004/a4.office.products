import React, { useState, useEffect } from 'react';
import { useAuth } from '../app/AuthContext.jsx';
import { useLanguage } from '../i18n/config.js';
import PageHeader from '../components/navigation/PageHeader.jsx';
import DataTable from '../components/data-display/DataTable.jsx';
import StatusChip from '../components/data-display/StatusChip.jsx';
import FilterPanel from '../components/forms/FilterPanel.jsx';
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
  Paper,
  Alert,
  Chip,
  Tabs,
  Tab,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControlLabel,
  RadioGroup,
  Radio,
  FormLabel,
  Card,
  CardContent
} from '@mui/material';
import {
  Refresh as RefreshIcon,
  Settings as SettingsIcon
} from '@mui/icons-material';

export function Inventory() {
  const { token } = useAuth();
  const { dir } = useLanguage();
  
  const [productsList, setProductsList] = useState([]);
  const [inventoryLedgerList, setInventoryLedgerList] = useState([]);
  const [ledgerTotalCount, setLedgerTotalCount] = useState(0);
  
  const [loading, setLoading] = useState(true);
  const [ledgerLoading, setLedgerLoading] = useState(false);
  const [error, setError] = useState('');

  // Active Tab
  const [activeTab, setActiveTab] = useState(0); // 0: Stock Overview, 1: Ledger History

  // Stock Overview search states
  const [stockSearch, setStockSearch] = useState('');
  const [stockCategory, setStockCategory] = useState('');

  // Ledger Filters state
  const [filterInvProduct, setFilterInvProduct] = useState('');
  const [filterInvType, setFilterInvType] = useState('');
  const [filterInvStartDate, setFilterInvStartDate] = useState('');
  const [filterInvEndDate, setFilterInvEndDate] = useState('');

  // Adjust Stock Dialog states
  const [showAdjustDialog, setShowAdjustDialog] = useState(false);
  const [adjustProduct, setAdjustProduct] = useState(null);
  const [adjustType, setAdjustType] = useState('ADD');
  const [adjustQty, setAdjustQty] = useState(1);
  const [adjustNotes, setAdjustNotes] = useState('');
  const [dialogError, setDialogError] = useState('');
  const [submitting, setSubmitting] = useState(false);

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
      let url = '/api/admin/inventory?limit=50';
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
        setLedgerTotalCount(payload.data?.total || 0);
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
  }, [token]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleOpenAdjustDialog = (prod) => {
    setAdjustProduct(prod);
    setAdjustType('ADD');
    setAdjustQty(1);
    setAdjustNotes('');
    setDialogError('');
    setShowAdjustDialog(true);
  };

  const handleAdjustStockSubmit = async (e) => {
    e.preventDefault();
    setDialogError('');
    setSubmitting(true);
    try {
      const res = await fetch('/api/admin/inventory/adjust', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          product_id: adjustProduct.id,
          adjustment_type: adjustType,
          quantity: parseInt(adjustQty, 10),
          notes: adjustNotes
        })
      });
      const payload = await res.json();
      if (res.status === 200) {
        setShowAdjustDialog(false);
        // Refresh both lists
        await Promise.all([loadProducts(), loadInventoryLedger()]);
      } else {
        setDialogError(payload.error || 'فشلت عملية تسوية المخزون.');
      }
    } catch (err) {
      setDialogError('حدث خطأ بالخادم.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleApplyLedgerFilters = () => {
    loadInventoryLedger();
  };

  const handleResetLedgerFilters = () => {
    setFilterInvProduct('');
    setFilterInvType('');
    setFilterInvStartDate('');
    setFilterInvEndDate('');
    // Reload ledger
    setTimeout(() => {
      loadInventoryLedger();
    }, 50);
  };

  // Get categories from products
  const categoriesList = React.useMemo(() => {
    const uniq = {};
    productsList.forEach(p => {
      if (p.category_id) {
        uniq[p.category_id] = p.category_name;
      }
    });
    return Object.keys(uniq).map(id => ({ id: parseInt(id, 10), name: uniq[id] }));
  }, [productsList]);

  // Client-side filter products
  const filteredProducts = React.useMemo(() => {
    return productsList.filter((p) => {
      const matchesSearch = !stockSearch || 
        p.name.toLowerCase().includes(stockSearch.toLowerCase()) ||
        p.sku.toLowerCase().includes(stockSearch.toLowerCase()) ||
        (p.barcode && p.barcode.includes(stockSearch));
      const matchesCategory = !stockCategory || p.category_id.toString() === stockCategory;
      return matchesSearch && matchesCategory;
    });
  }, [productsList, stockSearch, stockCategory]);

  // Mobile layout for stock overview cards
  const renderMobileStockCard = (p) => (
    <Card variant="outlined" sx={{ borderRadius: 1 }}>
      <CardContent sx={{ p: 2 }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mb: 1 }}>
          {p.name}
        </Typography>
        <Typography variant="body2" sx={{ color: 'text.secondary', mb: 0.5, fontSize: '0.8rem' }}>
          <strong>رمز SKU: </strong><code>{p.sku}</code> | <strong>الباركود: </strong>{p.barcode || '—'}
        </Typography>
        <Typography variant="body2" sx={{ color: 'text.secondary', mb: 1, fontSize: '0.8rem' }}>
          <strong>التصنيف: </strong>{p.category_name || '—'}
        </Typography>
        <Typography variant="body2" sx={{ color: 'text.secondary', mb: 1.5, fontSize: '0.8rem' }}>
          <strong>المخزون الحالي: </strong>
          <Chip
            label={p.stock}
            color={p.stock === 0 ? 'error' : p.stock <= p.low_stock_threshold ? 'warning' : 'success'}
            size="small"
            sx={{ fontWeight: 'bold', height: 20, px: 0.5, mx: 0.5 }}
          />
          | <strong>الحجوزات: </strong>
          <Chip label={p.open_preorders} size="small" variant="outlined" sx={{ height: 20, px: 0.5, mx: 0.5 }} />
        </Typography>
        <Box sx={{ display: 'flex', gap: 1, justifyContent: 'space-between', alignItems: 'center' }}>
          <Chip
            label={p.stock > 0 ? 'متاح للبيع الفوري' : 'غير متوفر للبيع الفوري'}
            color={p.stock > 0 ? 'success' : 'default'}
            variant="outlined"
            size="small"
            sx={{ fontWeight: 'bold', fontSize: '0.7rem' }}
          />
          <Button
            variant="outlined"
            size="small"
            onClick={() => handleOpenAdjustDialog(p)}
            startIcon={<SettingsIcon />}
            sx={{ fontFamily: 'Cairo' }}
          >
            تسوية
          </Button>
        </Box>
      </CardContent>
    </Card>
  );

  // Mobile layout for ledger transaction cards
  const renderMobileLedgerCard = (log) => (
    <Card variant="outlined" sx={{ borderRadius: 1 }}>
      <CardContent sx={{ p: 2 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            #{log.id} | {new Date(log.created_at).toLocaleString('ar-EG', { timeZone: 'Africa/Cairo' })}
          </Typography>
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
            sx={{ fontWeight: 'bold', fontSize: '0.7rem', height: 20 }}
          />
        </Box>
        <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mb: 1 }}>
          {log.product_name}
        </Typography>
        <Typography variant="body2" sx={{ color: 'text.secondary', mb: 0.5, fontSize: '0.8rem' }}>
          <strong>رمز SKU: </strong><code>log.product_sku</code> | <strong>المسؤول: </strong>{log.user_name}
        </Typography>
        <Typography variant="body2" sx={{ color: 'text.secondary', mb: 1, fontSize: '0.8rem' }}>
          <strong>التغير: </strong>
          <span style={{ fontWeight: 'bold', color: log.quantity_changed > 0 ? '#34c759' : '#ff3b30' }}>
            {log.quantity_changed > 0 ? `+${log.quantity_changed}` : log.quantity_changed}
          </span>
          {` (من ${log.before_quantity} إلى ${log.after_quantity})`}
        </Typography>
        {log.notes && (
          <Typography variant="caption" sx={{ color: 'text.secondary', bgcolor: 'action.hover', px: 1, py: 0.5, borderRadius: '4px', display: 'block', mt: 0.5 }}>
            <strong>السبب: </strong>{log.notes}
          </Typography>
        )}
      </CardContent>
    </Card>
  );

  return (
    <Box sx={{ width: '100%' }}>
      {/* Content Header */}
      <PageHeader
        titleKey="nav.inventory"
        actions={
          <Button
            variant="contained"
            startIcon={<RefreshIcon />}
            onClick={activeTab === 0 ? loadProducts : loadInventoryLedger}
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

      {/* Tabs */}
      <Paper variant="outlined" sx={{ mb: 3 }}>
        <Tabs
          value={activeTab}
          onChange={(e, newTab) => setActiveTab(newTab)}
          indicatorColor="primary"
          textColor="primary"
          variant="fullWidth"
          sx={{ borderBottom: '1px solid', borderColor: 'divider' }}
        >
          <Tab label="نظرة عامة على المخزون" sx={{ fontFamily: 'Cairo', fontWeight: 'bold' }} />
          <Tab label="دفتر حركات المخزن" sx={{ fontFamily: 'Cairo', fontWeight: 'bold' }} />
        </Tabs>
      </Paper>

      {/* TAB 0: Stock Overview */}
      {activeTab === 0 && (
        <Box>
          <Card variant="outlined" sx={{ p: 2, mb: 3, display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
            <TextField
              size="small"
              label="البحث عن منتج بالاسم أو SKU"
              value={stockSearch}
              onChange={(e) => setStockSearch(e.target.value)}
              sx={{
                flexGrow: 1,
                minWidth: 200,
                '& .MuiInputLabel-root': {
                  fontFamily: 'Cairo',
                  left: dir === 'rtl' ? 'auto' : 0,
                  right: dir === 'rtl' ? 24 : 'auto',
                  transformOrigin: dir === 'rtl' ? 'right' : 'left'
                },
                '& .MuiOutlinedInput-input': { fontFamily: 'Cairo', textAlign: dir === 'rtl' ? 'right' : 'left' }
              }}
            />
            <FormControl size="small" sx={{ minWidth: 180 }}>
              <InputLabel sx={{ fontFamily: 'Cairo', transformOrigin: dir === 'rtl' ? 'right' : 'left', right: dir === 'rtl' ? 24 : 'auto' }}>تصنيف المنتج</InputLabel>
              <Select
                value={stockCategory}
                label="تصنيف المنتج"
                onChange={(e) => setStockCategory(e.target.value)}
              >
                <MenuItem value="">الكل</MenuItem>
                {categoriesList.map((c) => (
                  <MenuItem key={c.id} value={c.id.toString()}>
                    {c.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Card>

          <DataTable
            loading={loading}
            columns={[
              { id: 'name', label: 'اسم المنتج' },
              { id: 'sku', label: 'رمز SKU', render: (p) => <code>{p.sku}</code> },
              { id: 'category', label: 'التصنيف', render: (p) => p.category_name || '—' },
              {
                id: 'stock',
                label: 'المخزون الحالي',
                render: (p) => (
                  <Chip
                    label={p.stock}
                    color={p.stock === 0 ? 'error' : p.stock <= p.low_stock_threshold ? 'warning' : 'success'}
                    size="small"
                    sx={{ fontWeight: 'bold' }}
                  />
                )
              },
              { id: 'preorders', label: 'الحجوزات المفتوحة', render: (p) => <Chip label={p.open_preorders} size="small" variant="outlined" /> },
              {
                id: 'saleable',
                label: 'حالة البيع الفوري',
                render: (p) => (
                  <StatusChip status={p.stock > 0 ? 1 : 0} />
                )
              },
              {
                id: 'actions',
                label: 'العمليات',
                render: (p) => (
                  <Button
                    variant="outlined"
                    size="small"
                    className="table-action-btn"
                    onClick={() => handleOpenAdjustDialog(p)}
                    startIcon={<SettingsIcon />}
                    sx={{ fontFamily: 'Cairo' }}
                  >
                    <span className="btn-text">تسوية المخزون</span>
                  </Button>
                )
              }
            ]}
            rows={filteredProducts}
            mobileRenderer={renderMobileStockCard}
            emptyTitle="لا توجد منتجات مطابقة للبحث"
            emptyDescription="تأكد من إدخال اسم منتج صحيح أو تغيير تصنيف التصفية الحالي."
          />
        </Box>
      )}

      {/* TAB 1: Ledger History */}
      {activeTab === 1 && (
        <Box>
          <FilterPanel
            onApply={handleApplyLedgerFilters}
            onReset={handleResetLedgerFilters}
            resultCount={ledgerTotalCount}
          >
            <FormControl fullWidth size="small">
              <InputLabel sx={{ fontFamily: 'Cairo', transformOrigin: dir === 'rtl' ? 'right' : 'left', right: dir === 'rtl' ? 24 : 'auto' }}>المنتج المحدد</InputLabel>
              <Select
                value={filterInvProduct}
                label="المنتج المحدد"
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

            <FormControl fullWidth size="small">
              <InputLabel sx={{ fontFamily: 'Cairo', transformOrigin: dir === 'rtl' ? 'right' : 'left', right: dir === 'rtl' ? 24 : 'auto' }}>نوع الحركة</InputLabel>
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

            <TextField
              fullWidth
              size="small"
              label="تاريخ البداية"
              type="date"
              InputLabelProps={{ shrink: true }}
              value={filterInvStartDate}
              onChange={(e) => setFilterInvStartDate(e.target.value)}
              sx={{
                '& .MuiInputLabel-root': {
                  fontFamily: 'Cairo',
                  left: dir === 'rtl' ? 'auto' : 0,
                  right: dir === 'rtl' ? 24 : 'auto',
                  transformOrigin: dir === 'rtl' ? 'right' : 'left'
                },
                '& .MuiOutlinedInput-input': { fontFamily: 'Cairo' }
              }}
            />

            <TextField
              fullWidth
              size="small"
              label="تاريخ النهاية"
              type="date"
              InputLabelProps={{ shrink: true }}
              value={filterInvEndDate}
              onChange={(e) => setFilterInvEndDate(e.target.value)}
              sx={{
                '& .MuiInputLabel-root': {
                  fontFamily: 'Cairo',
                  left: dir === 'rtl' ? 'auto' : 0,
                  right: dir === 'rtl' ? 24 : 'auto',
                  transformOrigin: dir === 'rtl' ? 'right' : 'left'
                },
                '& .MuiOutlinedInput-input': { fontFamily: 'Cairo' }
              }}
            />
          </FilterPanel>

          <DataTable
            loading={ledgerLoading}
            columns={[
              { id: 'id', label: 'الرقم' },
              {
                id: 'created_at',
                label: 'التاريخ والوقت',
                render: (log) => new Date(log.created_at).toLocaleString('ar-EG', { timeZone: 'Africa/Cairo' })
              },
              {
                id: 'product',
                label: 'المنتج',
                render: (log) => (
                  <Box>
                    <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                      {log.product_name}
                    </Typography>
                    <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                      SKU: {log.product_sku}
                    </Typography>
                  </Box>
                )
              },
              {
                id: 'type',
                label: 'نوع الحركة',
                render: (log) => (
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
                )
              },
              {
                id: 'diff',
                label: 'الكمية المعدلة',
                render: (log) => (
                  <Typography
                    variant="body2"
                    sx={{
                      fontWeight: 'bold',
                      color: log.quantity_changed > 0 ? 'success.main' : 'error.main'
                    }}
                  >
                    {log.quantity_changed > 0 ? `+${log.quantity_changed}` : log.quantity_changed}
                  </Typography>
                )
              },
              { id: 'before', label: 'المخزون السابق', render: (log) => log.before_quantity },
              { id: 'after', label: 'المخزون بعد الحركة', render: (log) => log.after_quantity },
              { id: 'user', label: 'المسؤول', render: (log) => log.user_name },
              { id: 'notes', label: 'الملاحظات والسبب', render: (log) => log.notes || '—' }
            ]}
            rows={inventoryLedgerList}
            mobileRenderer={renderMobileLedgerCard}
            emptyTitle="لا توجد حركات مخزنية مطابقة"
            emptyDescription="تأكد من ضبط فلاتر البحث أو حد تاريخ البداية والنهاية."
          />
        </Box>
      )}

      {/* Adjust Stock Dialog */}
      <Dialog open={showAdjustDialog} onClose={() => !submitting && setShowAdjustDialog(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontFamily: 'Cairo', fontWeight: 'bold', textAlign: dir === 'rtl' ? 'right' : 'left' }}>تسوية مخزون المنتج</DialogTitle>
        <form onSubmit={handleAdjustStockSubmit}>
          <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {dialogError && (
              <Alert severity="error" sx={{ mb: 1, fontFamily: 'Cairo', textAlign: dir === 'rtl' ? 'right' : 'left' }}>
                {dialogError}
              </Alert>
            )}
            <Typography variant="body2" sx={{ fontFamily: 'Cairo', fontWeight: 'bold' }}>
              المنتج الحالي: {adjustProduct?.name}
            </Typography>

            <FormControl component="fieldset">
              <FormLabel component="legend" sx={{ fontFamily: 'Cairo', fontSize: '0.85rem', textAlign: dir === 'rtl' ? 'right' : 'left' }}>نوع التسوية</FormLabel>
              <RadioGroup row value={adjustType} onChange={(e) => setAdjustType(e.target.value)}>
                <FormControlLabel value="ADD" control={<Radio />} label="إضافة مخزون (+)" sx={{ '& .MuiFormControlLabel-label': { fontFamily: 'Cairo', fontSize: '0.85rem' } }} />
                <FormControlLabel value="SUBTRACT" control={<Radio />} label="خصم مخزون (-)" sx={{ '& .MuiFormControlLabel-label': { fontFamily: 'Cairo', fontSize: '0.85rem' } }} />
              </RadioGroup>
            </FormControl>

            <TextField
              required
              fullWidth
              type="number"
              label="الكمية"
              value={adjustQty}
              onChange={(e) => setAdjustQty(e.target.value)}
              disabled={submitting}
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
              required
              fullWidth
              multiline
              rows={2}
              label="ملاحظات التسوية / السبب"
              value={adjustNotes}
              onChange={(e) => setAdjustNotes(e.target.value)}
              disabled={submitting}
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
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button onClick={() => setShowAdjustDialog(false)} disabled={submitting} sx={{ fontFamily: 'Cairo' }}>
              إلغاء
            </Button>
            <Button type="submit" variant="contained" disabled={submitting} sx={{ fontFamily: 'Cairo' }}>
              تأكيد التسوية
            </Button>
          </DialogActions>
        </form>
      </Dialog>
    </Box>
  );
}

export default Inventory;

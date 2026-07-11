import React, { useState, useEffect } from 'react';
import { useAuth } from '../app/AuthContext.jsx';
import { useLanguage } from '../i18n/config.js';
import PageHeader from '../components/navigation/PageHeader.jsx';
import DataTable from '../components/data-display/DataTable.jsx';
import StatusChip from '../components/data-display/StatusChip.jsx';
import ConfirmDialog from '../components/feedback/ConfirmDialog.jsx';
import EntityDrawer from '../components/drawers/EntityDrawer.jsx';
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
  Chip,
  Divider,
  Paper
} from '@mui/material';
import { Refresh as RefreshIcon, Search as SearchIcon, Visibility as ViewIcon } from '@mui/icons-material';

export function Preorders() {
  const { token } = useAuth();
  const { dir } = useLanguage();
  
  const [adminPreordersList, setAdminPreordersList] = useState([]);
  const [adminPreordersStats, setAdminPreordersStats] = useState(null);
  
  const [loading, setLoading] = useState(true);
  const [preordersLoading, setPreordersLoading] = useState(false);
  const [error, setError] = useState('');

  // Filters state
  const [searchPreorderQuery, setSearchPreorderQuery] = useState('');
  const [filterPreorderStatus, setFilterPreorderStatus] = useState('');

  // Confirmation modal states
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingStatusChange, setPendingStatusChange] = useState(null); // { preorderId, status }

  // Details drawer states
  const [selectedPreorder, setSelectedPreorder] = useState(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

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
  }, [token]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleStatusChangeClick = (preorderId, nextStatus) => {
    setPendingStatusChange({ preorderId, status: nextStatus });
    setConfirmOpen(true);
  };

  const confirmStatusChange = async () => {
    if (!pendingStatusChange) return;
    const { preorderId, status } = pendingStatusChange;
    setConfirmOpen(false);
    try {
      const res = await fetch(`/api/admin/preorders/${preorderId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ status })
      });
      const payload = await res.json();
      if (res.status === 200) {
        loadAdminPreorders();
        // If drawer is open and showing the active preorder, update its state
        if (selectedPreorder && selectedPreorder.id === preorderId) {
          setSelectedPreorder(prev => ({ ...prev, status }));
        }
      } else {
        alert(payload.error || 'فشلت عملية تحديث حالة الحجز.');
      }
    } catch (err) {
      alert('حدث خطأ بالاتصال بالخادم.');
    }
  };

  const handleOpenDetailsDrawer = (order) => {
    setSelectedPreorder(order);
    setDrawerOpen(true);
  };

  const getStatusLabel = (s) => {
    switch (s) {
      case 'DEPOSIT_PAID_WAITING_STOCK': return 'بانتظار المخزون';
      case 'READY_FOR_PICKUP': return 'جاهز للاستلام';
      case 'PICKED_UP': return 'تم التسليم النهائي';
      case 'CANCELLED': return 'ملغي';
      case 'EXPIRED': return 'منتهي';
      default: return s;
    }
  };

  // Mobile layout card representation
  const renderMobileRecord = (order) => (
    <Card variant="outlined" sx={{ borderRadius: 1 }}>
      <CardContent sx={{ p: 2 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 'bold' }}>
            حجز رقم: <code>{order.preorder_number}</code>
          </Typography>
          <StatusChip status={order.status} />
        </Box>
        <Typography variant="body2" sx={{ color: 'text.secondary', mb: 0.5, fontSize: '0.8rem' }}>
          <strong>العميل: </strong>{order.customer_name} | <strong>الهاتف: </strong>
          <code style={{ direction: 'ltr', display: 'inline-block' }}>{order.customer_phone}</code>
        </Typography>
        <Typography variant="body2" sx={{ color: 'text.secondary', mb: 1.5, fontSize: '0.8rem' }}>
          <strong>المتبقي: </strong>{(order.remaining_amount / 100).toFixed(2)} ج.م | 
          <strong>التسليم: </strong>{order.pickup_method === 'walk_in' ? 'معرض' : 'منزلي'}
        </Typography>

        <Box sx={{ display: 'flex', gap: 1, justifyContent: 'space-between', flexWrap: 'wrap', alignItems: 'center' }}>
          <Button
            variant="outlined"
            size="small"
            onClick={() => handleOpenDetailsDrawer(order)}
            startIcon={<ViewIcon />}
            sx={{ fontFamily: 'Cairo' }}
          >
            تفاصيل
          </Button>

          <FormControl size="small" sx={{ width: 130 }}>
            <Select
              value={order.status}
              onChange={(e) => handleStatusChangeClick(order.id, e.target.value)}
              sx={{ fontSize: '0.75rem', fontFamily: 'Cairo', height: 30 }}
            >
              <MenuItem value="DEPOSIT_PAID_WAITING_STOCK" sx={{ fontSize: '0.75rem' }}>بانتظار المخزون</MenuItem>
              <MenuItem value="READY_FOR_PICKUP" sx={{ fontSize: '0.75rem' }}>جاهز للاستلام</MenuItem>
              <MenuItem value="PICKED_UP" sx={{ fontSize: '0.75rem' }}>تم التسليم</MenuItem>
              <MenuItem value="CANCELLED" sx={{ fontSize: '0.75rem' }}>ملغي</MenuItem>
              <MenuItem value="EXPIRED" sx={{ fontSize: '0.75rem' }}>منتهي</MenuItem>
            </Select>
          </FormControl>
        </Box>
      </CardContent>
    </Card>
  );

  return (
    <Box sx={{ width: '100%' }}>
      {/* Content Header */}
      <PageHeader
        titleKey="nav.preorders"
        actions={
          <Button
            variant="contained"
            startIcon={<RefreshIcon />}
            onClick={loadAdminPreorders}
            sx={{ fontFamily: 'Cairo' }}
          >
            تحديث البيانات
          </Button>
        }
      />

      {/* KPI Aggregate cards */}
      {adminPreordersStats && (
        <Grid container spacing={3} sx={{ mb: 3 }}>
          <Grid item xs={12} sm={6} md={3}>
            <Card variant="outlined" sx={{ borderRadius: 1 }}>
              <CardContent sx={{ p: 2 }}>
                <Typography variant="caption" sx={{ color: 'text.secondary', fontFamily: 'Cairo' }}>إجمالي الحجوزات</Typography>
                <Typography variant="h6" sx={{ fontWeight: 'bold', mt: 1 }}>
                  {adminPreordersStats.total_count} حجز
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card variant="outlined" sx={{ borderRadius: 1 }}>
              <CardContent sx={{ p: 2 }}>
                <Typography variant="caption" sx={{ color: 'text.secondary', fontFamily: 'Cairo' }}>القيمة الإجمالية للحجوزات</Typography>
                <Typography variant="h6" sx={{ color: 'primary.main', fontWeight: 'bold', mt: 1 }}>
                  {(adminPreordersStats.total_amount / 100).toFixed(2)} ج.م
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card variant="outlined" sx={{ borderRadius: 1 }}>
              <CardContent sx={{ p: 2 }}>
                <Typography variant="caption" sx={{ color: 'text.secondary', fontFamily: 'Cairo' }}>إجمالي العربون المحصل</Typography>
                <Typography variant="h6" sx={{ color: 'success.main', fontWeight: 'bold', mt: 1 }}>
                  {(adminPreordersStats.total_deposit_paid / 100).toFixed(2)} ج.م
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card variant="outlined" sx={{ borderRadius: 1 }}>
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

          <Grid item xs={12} sm={3}>
            <FormControl fullWidth size="small">
              <InputLabel sx={{ fontFamily: 'Cairo', transformOrigin: dir === 'rtl' ? 'right' : 'left', right: dir === 'rtl' ? 24 : 'auto' }}>حالة الحجز</InputLabel>
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
        <Alert severity="error" sx={{ mb: 3, fontFamily: 'Cairo', textAlign: dir === 'rtl' ? 'right' : 'left' }}>
          {error}
        </Alert>
      )}

      <DataTable
        loading={loading || preordersLoading}
        columns={[
          { id: 'preorder_number', label: 'رقم الحجز', render: (order) => <code>{order.preorder_number}</code> },
          {
            id: 'created_at',
            label: 'تاريخ الحجز',
            render: (order) => new Date(order.created_at).toLocaleString('ar-EG', { timeZone: 'Africa/Cairo' })
          },
          {
            id: 'customer',
            label: 'العميل',
            render: (order) => (
              <Box>
                <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                  {order.customer_name}
                </Typography>
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                  هاتف: <code style={{ direction: 'ltr', display: 'inline-block' }}>{order.customer_phone}</code>
                </Typography>
              </Box>
            )
          },
          { id: 'total_amount', label: 'الإجمالي الصافي', render: (order) => `${(order.total_amount / 100).toFixed(2)} ج.م` },
          { id: 'deposit_paid', label: 'العربون المدفوع', render: (order) => `${(order.deposit_paid / 100).toFixed(2)} ج.م` },
          {
            id: 'remaining_amount',
            label: 'المتبقي للتحصيل',
            render: (order) => (
              <Typography variant="body2" sx={{ fontWeight: 'bold', color: order.remaining_amount > 0 ? 'warning.main' : 'success.main' }}>
                {(order.remaining_amount / 100).toFixed(2)} ج.م
              </Typography>
            )
          },
          {
            id: 'pickup_method',
            label: 'طريقة التسليم',
            render: (order) => (
              <Typography variant="body2" sx={{ fontFamily: 'Cairo' }}>
                {order.pickup_method === 'walk_in' ? 'استلام من المعرض' : 'توصيل منزلي'}
              </Typography>
            )
          },
          {
            id: 'status',
            label: 'الحالة',
            render: (order) => <StatusChip status={order.status} />
          },
          {
            id: 'actions',
            label: 'تعديل الحالة (الأدمن)',
            render: (order) => (
              <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                <Button
                  variant="outlined"
                  size="small"
                  onClick={() => handleOpenDetailsDrawer(order)}
                  startIcon={<ViewIcon />}
                  sx={{ fontFamily: 'Cairo' }}
                >
                  عرض
                </Button>
                <FormControl size="small" sx={{ width: 130 }}>
                  <Select
                    value={order.status}
                    onChange={(e) => handleStatusChangeClick(order.id, e.target.value)}
                    sx={{ fontSize: '0.8rem', fontFamily: 'Cairo' }}
                  >
                    <MenuItem value="DEPOSIT_PAID_WAITING_STOCK">بانتظار المخزون</MenuItem>
                    <MenuItem value="READY_FOR_PICKUP">جاهز للاستلام</MenuItem>
                    <MenuItem value="PICKED_UP">تم التسليم</MenuItem>
                    <MenuItem value="CANCELLED">ملغي</MenuItem>
                    <MenuItem value="EXPIRED">منتهي</MenuItem>
                  </Select>
                </FormControl>
              </Box>
            )
          }
        ]}
        rows={adminPreordersList}
        mobileRenderer={renderMobileRecord}
        emptyTitle="لا توجد حجوزات مضافة حالياً"
        emptyDescription="قم بتسجيل حجوزات العملاء من شاشة البيع المباشر أو البحث برقم حجز آخر."
      />

      {/* Confirmation dialog for status transition */}
      <ConfirmDialog
        open={confirmOpen}
        title="تغيير حالة الحجز المسبق"
        description={
          pendingStatusChange
            ? `هل أنت متأكد من تغيير حالة الحجز المسبق إلى "${getStatusLabel(pendingStatusChange.status)}"؟`
            : ''
        }
        type="warning"
        confirmText="تأكيد"
        cancelText="إلغاء"
        onConfirm={confirmStatusChange}
        onCancel={() => setConfirmOpen(false)}
      />

      {/* Preorder details drawer */}
      <EntityDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title={`حجز رقم: ${selectedPreorder?.preorder_number || ''}`}
        subtitle={`العميل: ${selectedPreorder?.customer_name || ''} (${selectedPreorder?.customer_phone || ''})`}
        size="large"
      >
        {selectedPreorder && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 'bold', fontFamily: 'Cairo' }}>حالة الحجز الحالية:</Typography>
              <StatusChip status={selectedPreorder.status} />
            </Box>

            <Divider />

            {/* Billing details card */}
            <Paper variant="outlined" sx={{ p: 2, bgcolor: 'action.hover' }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mb: 2, fontFamily: 'Cairo' }}>💵 البيانات المالية للحجز</Typography>
              <Grid container spacing={2}>
                <Grid item xs={6}>
                  <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', fontFamily: 'Cairo' }}>إجمالي القيمة المطلوب دفعها:</Typography>
                  <Typography variant="body1" sx={{ fontWeight: 'bold' }}>{(selectedPreorder.total_amount / 100).toFixed(2)} ج.م</Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', fontFamily: 'Cairo' }}>العربون المحصل عند الحجز:</Typography>
                  <Typography variant="body1" sx={{ fontWeight: 'bold', color: 'success.main' }}>{(selectedPreorder.deposit_paid / 100).toFixed(2)} ج.م</Typography>
                </Grid>
                <Grid item xs={12}>
                  <Divider sx={{ my: 0.5 }} />
                </Grid>
                <Grid item xs={12}>
                  <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', fontFamily: 'Cairo' }}>المبلغ المتبقي للتحصيل عند الاستلام:</Typography>
                  <Typography variant="h6" sx={{ fontWeight: 'bold', color: selectedPreorder.remaining_amount > 0 ? 'warning.main' : 'success.main' }}>
                    {(selectedPreorder.remaining_amount / 100).toFixed(2)} ج.م
                  </Typography>
                </Grid>
              </Grid>
            </Paper>

            {/* Preorder items */}
            <Box>
              <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mb: 1, fontFamily: 'Cairo' }}>📦 المنتجات المحجوزة في الطلب</Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                {Array.isArray(selectedPreorder.items) && selectedPreorder.items.map((item, idx) => (
                  <Paper variant="outlined" key={idx} sx={{ p: 1.5, borderRadius: 1 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Typography variant="body2" sx={{ fontWeight: 'bold' }}>{item.product_name}</Typography>
                      <Chip label={`${item.quantity} قطع`} size="small" variant="outlined" />
                    </Box>
                    <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mt: 0.5 }}>
                      رمز SKU: <code>{item.product_sku}</code>
                    </Typography>
                  </Paper>
                ))}
              </Box>
            </Box>

            <Divider />

            {/* Additional details */}
            <Box sx={{ fontSize: '0.85rem', display: 'flex', flexDirection: 'column', gap: 1 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#8e8e93' }}>الكاشير المسؤول:</span>
                <strong>{selectedPreorder.cashier_name}</strong>
              </Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#8e8e93' }}>طريقة الاستلام والتسليم:</span>
                <strong>{selectedPreorder.pickup_method === 'walk_in' ? 'استلام من معرض المنصة' : 'شحن وتوصيل منزلي للعميل'}</strong>
              </Box>
              {selectedPreorder.notes && (
                <Box sx={{ mt: 1 }}>
                  <span style={{ color: '#8e8e93', display: 'block', mb: 0.5 }}>ملاحظات الحجز المسبق:</span>
                  <Paper variant="outlined" sx={{ p: 1.5, fontSize: '0.8rem', bgcolor: 'action.hover' }}>
                    {selectedPreorder.notes}
                  </Paper>
                </Box>
              )}
            </Box>
          </Box>
        )}
      </EntityDrawer>
    </Box>
  );
}

export default Preorders;

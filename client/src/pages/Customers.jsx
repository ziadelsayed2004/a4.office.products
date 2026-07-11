import React, { useState, useEffect } from 'react';
import { useAuth } from '../app/AuthContext.jsx';
import { useLanguage } from '../i18n/config.js';
import PageHeader from '../components/navigation/PageHeader.jsx';
import DataTable from '../components/data-display/DataTable.jsx';
import StatusChip from '../components/data-display/StatusChip.jsx';
import EntityDrawer from '../components/drawers/EntityDrawer.jsx';
import {
  Box,
  Typography,
  Button,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Card,
  CardContent,
  Chip,
  Divider,
  Paper
} from '@mui/material';
import { Add as AddIcon, Search as SearchIcon, Visibility as ViewIcon } from '@mui/icons-material';

export function Customers() {
  const { token, user } = useAuth();
  const { dir } = useLanguage();
  const [customersList, setCustomersList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchInput, setSearchInput] = useState('');

  // Dialog & Drawer states
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [dialogError, setDialogError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Selected Customer details drawer
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [customerPreorders, setCustomerPreorders] = useState([]);
  const [preordersLoading, setPreordersLoading] = useState(false);
  const [preordersError, setPreordersError] = useState('');

  const loadCustomers = async (searchVal = '') => {
    if (!token) return;
    setLoading(true);
    setError('');
    try {
      const url = `/api/customers?q=${encodeURIComponent(searchVal)}`;
      const res = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const payload = await res.json();
      if (res.status === 200) {
        setCustomersList(payload.data || []);
      } else {
        setError(payload.error || 'فشل تحميل قائمة العملاء.');
      }
    } catch (err) {
      setError('حدث خطأ بالاتصال بالخادم.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCustomers(searchInput);
  }, [token, searchInput]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleOpenAddDialog = () => {
    setCustomerName('');
    setCustomerPhone('');
    setDialogError('');
    setShowAddDialog(true);
  };

  const handleCreateCustomerSubmit = async (e) => {
    e.preventDefault();
    setDialogError('');
    if (!customerName || !customerPhone) {
      setDialogError('اسم العميل ورقم الهاتف إجباريان.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/customers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          name: customerName.trim(),
          phone: customerPhone.trim()
        })
      });
      const payload = await res.json();
      if (res.status === 201) {
        setShowAddDialog(false);
        loadCustomers(searchInput);
      } else {
        setDialogError(payload.error || 'فشلت عملية إضافة العميل.');
      }
    } catch (err) {
      setDialogError('حدث خطأ بالاتصال بالخادم.');
    } finally {
      setSubmitting(false);
    }
  };

  // Open drawer and load preorder history
  const handleOpenDetails = async (customerObj) => {
    setSelectedCustomer(customerObj);
    setDrawerOpen(true);
    setCustomerPreorders([]);
    setPreordersError('');

    // Fetch preorders only for admin users to respect RBAC rules
    if (user?.role !== 'Admin') {
      return;
    }

    setPreordersLoading(true);
    try {
      const res = await fetch(`/api/admin/preorders?q=${encodeURIComponent(customerObj.phone)}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const payload = await res.json();
      if (res.status === 200) {
        // Filter precisely for this customer ID just in case fuzzy phone matches others
        const list = (payload.data || []).filter(item => item.customer_id === customerObj.id);
        setCustomerPreorders(list);
      } else {
        setPreordersError(payload.error || 'فشل تحميل سجل الحجوزات.');
      }
    } catch (err) {
      setPreordersError('حدث خطأ أثناء تحميل سجل الحركات.');
    } finally {
      setPreordersLoading(false);
    }
  };

  // Mobile card view layout
  const renderMobileRecord = (c) => (
    <Card variant="outlined" sx={{ borderRadius: 1 }}>
      <CardContent sx={{ p: 2 }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mb: 1 }}>
          {c.name}
        </Typography>
        <Typography variant="body2" sx={{ color: 'text.secondary', mb: 1.5, fontSize: '0.8rem' }}>
          <strong>رقم الهاتف: </strong>
          <code style={{ direction: 'ltr', display: 'inline-block' }}>{c.phone}</code>
        </Typography>
        <Box sx={{ display: 'flex', gap: 1, justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            سجل: {new Date(c.created_at || Date.now()).toLocaleDateString('ar-EG')}
          </Typography>
          <Button
            variant="outlined"
            size="small"
            onClick={() => handleOpenDetails(c)}
            startIcon={<ViewIcon />}
            sx={{ fontFamily: 'Cairo' }}
          >
            سجل الحجوزات
          </Button>
        </Box>
      </CardContent>
    </Card>
  );

  return (
    <Box>
      {/* Content Header */}
      <PageHeader
        titleKey="nav.customers"
        actions={
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={handleOpenAddDialog}
            sx={{ fontFamily: 'Cairo' }}
          >
            تسجيل عميل جديد
          </Button>
        }
      />

      {/* Filter Card */}
      <Paper variant="outlined" sx={{ p: 2, mb: 3 }}>
        <TextField
          fullWidth
          size="small"
          placeholder="ابحث بالاسم أو الهاتف..."
          label="بحث بالاسم أو رقم الهاتف"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
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
      </Paper>

      {error && (
        <Alert severity="error" sx={{ mb: 3, fontFamily: 'Cairo', textAlign: dir === 'rtl' ? 'right' : 'left' }}>
          {error}
        </Alert>
      )}

      <DataTable
        loading={loading}
        columns={[
          { id: 'id', label: 'الرقم التعريفي' },
          { id: 'name', label: 'اسم العميل', render: (c) => <strong>{c.name}</strong> },
          {
            id: 'phone',
            label: 'رقم الهاتف',
            render: (c) => <code style={{ direction: 'ltr', display: 'inline-block' }}>{c.phone}</code>
          },
          {
            id: 'created_at',
            label: 'تاريخ التسجيل',
            render: (c) => new Date(c.created_at || Date.now()).toLocaleDateString('ar-EG')
          },
          {
            id: 'actions',
            label: 'العمليات',
            render: (c) => (
              <Button
                variant="outlined"
                size="small"
                className="table-action-btn"
                onClick={() => handleOpenDetails(c)}
                startIcon={<ViewIcon />}
                sx={{ fontFamily: 'Cairo' }}
              >
                <span className="btn-text">الملف والسجل</span>
              </Button>
            )
          }
        ]}
        rows={customersList}
        mobileRenderer={renderMobileRecord}
        emptyTitle="لا توجد سجلات عملاء حالية"
        emptyDescription="تأكد من كتابة اسم عميل أو رقم هاتف صحيح للبحث."
      />

      {/* Add Dialog */}
      <Dialog open={showAddDialog} onClose={() => !submitting && setShowAddDialog(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontFamily: 'Cairo', fontWeight: 'bold', textAlign: dir === 'rtl' ? 'right' : 'left' }}>تسجيل عميل جديد</DialogTitle>
        <form onSubmit={handleCreateCustomerSubmit}>
          <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {dialogError && (
              <Alert severity="error" sx={{ mb: 1, fontFamily: 'Cairo', textAlign: dir === 'rtl' ? 'right' : 'left' }}>
                {dialogError}
              </Alert>
            )}
            <TextField
              fullWidth
              autoFocus
              label="اسم العميل"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
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
              fullWidth
              label="رقم الهاتف"
              value={customerPhone}
              onChange={(e) => setCustomerPhone(e.target.value)}
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
            <Button onClick={() => setShowAddDialog(false)} disabled={submitting} sx={{ fontFamily: 'Cairo' }}>
              إلغاء
            </Button>
            <Button type="submit" variant="contained" disabled={submitting} sx={{ fontFamily: 'Cairo' }}>
              إضافة العميل
            </Button>
          </DialogActions>
        </form>
      </Dialog>

      {/* Customer Preorders & Details Drawer */}
      <EntityDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title={selectedCustomer?.name || 'بيانات العميل'}
        subtitle={`رقم الهاتف: ${selectedCustomer?.phone || ''}`}
        size="large"
        loading={preordersLoading}
        error={preordersError}
      >
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 'bold', fontFamily: 'Cairo', borderBottom: '1px solid', borderColor: 'divider', pb: 1 }}>
            📂 سجل الحجوزات المسبقة (Pre-orders History)
          </Typography>

          {user?.role !== 'Admin' ? (
            <Alert severity="info" sx={{ fontFamily: 'Cairo', textAlign: dir === 'rtl' ? 'right' : 'left' }}>
              سجل الطلبات والحجوزات المالية متاح فقط لحساب المسؤول الإداري (Admin).
            </Alert>
          ) : customerPreorders.length === 0 ? (
            <Typography variant="body2" sx={{ color: 'text.secondary', fontFamily: 'Cairo', py: 4, textAlign: 'center' }}>
              لا يوجد سجل حجوزات مسبقة لهذا العميل حالياً.
            </Typography>
          ) : (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {customerPreorders.map((order) => (
                <Card variant="outlined" key={order.id} sx={{ borderRadius: 1 }}>
                  <CardContent sx={{ p: 2 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
                      <Typography variant="subtitle2" sx={{ fontWeight: 'bold' }}>
                        حجز رقم: <code>{order.preorder_number}</code>
                      </Typography>
                      <StatusChip status={order.status} />
                    </Box>
                    <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 1, fontFamily: 'Cairo' }}>
                      التاريخ: {new Date(order.created_at).toLocaleString('ar-EG', { timeZone: 'Africa/Cairo' })}
                    </Typography>

                    <Divider sx={{ my: 1 }} />

                    {/* Order Items */}
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, mb: 1.5 }}>
                      {Array.isArray(order.items) && order.items.map((item, idx) => (
                        <Typography key={idx} variant="body2" sx={{ color: 'text.primary', fontSize: '0.85rem' }}>
                          • {item.product_name} ({item.quantity} قطع)
                        </Typography>
                      ))}
                    </Box>

                    <Box sx={{ display: 'flex', justifyContent: 'space-between', bgcolor: 'action.hover', p: 1, borderRadius: 1, fontSize: '0.8rem' }}>
                      <Box>
                        إجمالي القيمة: <strong>{(order.total_amount / 100).toFixed(2)} ج.م</strong>
                      </Box>
                      <Box>
                        العربون: <strong style={{ color: '#34c759' }}>{(order.deposit_paid / 100).toFixed(2)} ج.م</strong>
                      </Box>
                      <Box>
                        المتبقي: <strong style={{ color: '#ff9500' }}>{(order.remaining_amount / 100).toFixed(2)} ج.m</strong>
                      </Box>
                    </Box>
                  </CardContent>
                </Card>
              ))}
            </Box>
          )}
        </Box>
      </EntityDrawer>
    </Box>
  );
}

export default Customers;

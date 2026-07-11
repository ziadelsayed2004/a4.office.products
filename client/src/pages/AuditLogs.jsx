import React, { useState, useEffect } from 'react';
import { useAuth } from '../app/AuthContext.jsx';
import { useLanguage } from '../i18n/config.js';
import PageHeader from '../components/navigation/PageHeader.jsx';
import DataTable from '../components/data-display/DataTable.jsx';
import EntityDrawer from '../components/drawers/EntityDrawer.jsx';
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
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow
} from '@mui/material';
import {
  Refresh as RefreshIcon,
  FilterList as FilterIcon,
  Clear as ClearIcon,
  Visibility as ViewIcon
} from '@mui/icons-material';

export function AuditLogs() {
  const { token } = useAuth();
  const { dir } = useLanguage();

  const [logsList, setLogsList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [usersList, setUsersList] = useState([]);

  // Filter States
  const [filterActionType, setFilterActionType] = useState('');
  const [filterEntityType, setFilterEntityType] = useState('');
  const [filterUserId, setFilterUserId] = useState('');
  const [filterShiftId, setFilterShiftId] = useState('');
  const [filterEntityId, setFilterEntityId] = useState('');
  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');

  // Selected Log Drawer State
  const [selectedLog, setSelectedLog] = useState(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

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

  const loadAuditLogs = async () => {
    if (!token) return;
    setLoading(true);
    setError('');
    try {
      const queryParams = new URLSearchParams();
      if (filterActionType) queryParams.append('actionType', filterActionType);
      if (filterEntityType) queryParams.append('entityType', filterEntityType);
      if (filterUserId) queryParams.append('userId', filterUserId);
      if (filterShiftId) queryParams.append('shiftId', filterShiftId);
      if (filterEntityId) queryParams.append('entityId', filterEntityId);
      if (filterStartDate) queryParams.append('startDate', filterStartDate);
      if (filterEndDate) queryParams.append('endDate', filterEndDate);

      const res = await fetch(`/api/admin/audit-logs?${queryParams.toString()}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const payload = await res.json();
      if (res.status === 200) {
        setLogsList(payload.data || []);
      } else {
        setError(payload.error || 'فشلت عملية تحميل سجل العمليات.');
      }
    } catch (err) {
      setError('حدث خطأ أثناء الاتصال بالخادم.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) {
      loadUsers();
      loadAuditLogs();
    }
  }, [token]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleClearFilters = () => {
    setFilterActionType('');
    setFilterEntityType('');
    setFilterUserId('');
    setFilterShiftId('');
    setFilterEntityId('');
    setFilterStartDate('');
    setFilterEndDate('');
  };

  const handleOpenDrawer = (log) => {
    setSelectedLog(log);
    setDrawerOpen(true);
  };

  const renderValueDiff = (before, after) => {
    if (!before && !after) {
      return (
        <Typography variant="body2" sx={{ color: 'text.secondary', fontFamily: 'Cairo', py: 2 }}>
          لا توجد بيانات تفصيلية مسجلة لهذه العملية.
        </Typography>
      );
    }

    const allKeys = Array.from(new Set([
      ...Object.keys(before || {}),
      ...Object.keys(after || {})
    ]));

    return (
      <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 1 }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell sx={{ fontFamily: 'Cairo', fontWeight: 'bold' }}>الحقل (Field)</TableCell>
              <TableCell sx={{ fontFamily: 'Cairo', fontWeight: 'bold' }}>القيمة السابقة (Before)</TableCell>
              <TableCell sx={{ fontFamily: 'Cairo', fontWeight: 'bold' }}>القيمة الجديدة (After)</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {allKeys.map(key => {
              const beforeVal = before ? before[key] : undefined;
              const afterVal = after ? after[key] : undefined;
              const isChanged = JSON.stringify(beforeVal) !== JSON.stringify(afterVal);

              const formatVal = (val) => {
                if (val === null || val === undefined) return <span style={{ color: '#999', fontSize: '0.75rem' }}>—</span>;
                if (typeof val === 'object') return <code>{JSON.stringify(val)}</code>;
                return val.toString();
              };

              return (
                <TableRow key={key} sx={{ bgcolor: isChanged ? 'action.hover' : 'inherit' }}>
                  <TableCell sx={{ fontWeight: 'bold', wordBreak: 'break-all' }}><code>{key}</code></TableCell>
                  <TableCell sx={{ textDecoration: isChanged && afterVal !== undefined ? 'line-through' : 'none', color: isChanged ? '#ff3b30' : 'inherit', wordBreak: 'break-all' }}>
                    {formatVal(beforeVal)}
                  </TableCell>
                  <TableCell sx={{ color: isChanged ? '#34c759' : 'inherit', fontWeight: isChanged ? 'bold' : 'normal', wordBreak: 'break-all' }}>
                    {formatVal(afterVal)}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>
    );
  };

  const renderMobileLogCard = (log) => (
    <Card variant="outlined" sx={{ borderRadius: 1 }}>
      <CardContent sx={{ p: 2 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1, alignItems: 'center' }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 'bold' }}>السجل #{log.id}</Typography>
          <Chip
            label={log.action_type}
            color="info"
            size="small"
            sx={{ fontWeight: 'bold', height: 18, fontSize: '0.65rem' }}
          />
        </Box>
        <Typography variant="body2" sx={{ mb: 0.5, fontSize: '0.85rem' }}>
          بواسطة: {log.user_name || `مستخدم (${log.user_id})`}
        </Typography>
        <Typography variant="body2" sx={{ mb: 1, fontSize: '0.85rem' }}>
          البيان: {log.notes || '—'}
        </Typography>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            <bdi>{new Date(log.created_at).toLocaleString('ar-EG', { timeZone: 'Africa/Cairo' })}</bdi>
          </Typography>
          {(log.before_values || log.after_values) && (
            <Button size="small" startIcon={<ViewIcon />} onClick={() => handleOpenDrawer(log)}>
              التفاصيل
            </Button>
          )}
        </Box>
      </CardContent>
    </Card>
  );

  return (
    <Box sx={{ width: '100%' }}>
      {/* Page Header */}
      <PageHeader
        titleKey="nav.audit"
        actions={
          <Button
            variant="contained"
            startIcon={<RefreshIcon />}
            onClick={loadAuditLogs}
            disabled={loading}
            sx={{ fontFamily: 'Cairo' }}
          >
            تحديث السجل
          </Button>
        }
      />

      {/* Filters Form */}
      <Paper variant="outlined" sx={{ p: 3, mb: 3, borderRadius: 1 }}>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            loadAuditLogs();
          }}
        >
          <Grid container spacing={2} alignItems="flex-end">
            <Grid item xs={12} sm={3}>
              <TextField
                fullWidth
                size="small"
                label="تاريخ البداية"
                type="date"
                InputLabelProps={{ shrink: true }}
                value={filterStartDate}
                onChange={(e) => setFilterStartDate(e.target.value)}
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
                value={filterEndDate}
                onChange={(e) => setFilterEndDate(e.target.value)}
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
              <FormControl fullWidth size="small">
                <InputLabel sx={{ fontFamily: 'Cairo', transformOrigin: dir === 'rtl' ? 'right' : 'left', right: dir === 'rtl' ? 24 : 'auto' }}>نوع الإجراء</InputLabel>
                <Select
                  value={filterActionType}
                  label="نوع الإجراء"
                  onChange={(e) => setFilterActionType(e.target.value)}
                >
                  <MenuItem value="">كل الإجراءات</MenuItem>
                  <MenuItem value="LOGIN">تسجيل الدخول</MenuItem>
                  <MenuItem value="LOGOUT">تسجيل الخروج</MenuItem>
                  <MenuItem value="USER_CREATE">إنشاء مستخدم</MenuItem>
                  <MenuItem value="USER_UPDATE">تعديل مستخدم</MenuItem>
                  <MenuItem value="USER_PASSWORD_CHANGE">تغيير الباسورد</MenuItem>
                  <MenuItem value="USER_DISABLE">تعطيل حساب</MenuItem>
                  <MenuItem value="USER_ENABLE">تفعيل حساب</MenuItem>
                  <MenuItem value="CATEGORY_CREATE">إنشاء تصنيف</MenuItem>
                  <MenuItem value="CATEGORY_UPDATE">تعديل تصنيف</MenuItem>
                  <MenuItem value="PRICE_TIER_CREATE">إنشاء فئة سعر</MenuItem>
                  <MenuItem value="PRICE_TIER_UPDATE">تعديل فئة سعر</MenuItem>
                  <MenuItem value="PRODUCT_CREATE">إنشاء منتج</MenuItem>
                  <MenuItem value="PRODUCT_UPDATE">تعديل منتج</MenuItem>
                  <MenuItem value="PRODUCT_QR_PRINT">طباعة ملصق QR</MenuItem>
                  <MenuItem value="STOCK_ADJUST">تسوية مخزون</MenuItem>
                  <MenuItem value="SETTINGS_UPDATE">تعديل الإعدادات</MenuItem>
                  <MenuItem value="CUSTOMER_CREATE">تسجيل عميل</MenuItem>
                  <MenuItem value="SALE_CREATE">عملية بيع مباشر</MenuItem>
                  <MenuItem value="ORDER_RETURN">تسجيل مرتجع مبيعات</MenuItem>
                  <MenuItem value="PREORDER_CREATE">إنشاء حجز مسبق</MenuItem>
                  <MenuItem value="PREORDER_PICKUP">تسليم حجز نهائي</MenuItem>
                  <MenuItem value="RECEIPT_REPRINT">إعادة طباعة إيصال</MenuItem>
                  <MenuItem value="SHIFT_OPEN">فتح وردية</MenuItem>
                  <MenuItem value="SHIFT_CLOSE_REQUEST">طلب إغلاق وردية</MenuItem>
                  <MenuItem value="SHIFT_APPROVE">اعتماد الوردية</MenuItem>
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} sm={3}>
              <FormControl fullWidth size="small">
                <InputLabel sx={{ fontFamily: 'Cairo', transformOrigin: dir === 'rtl' ? 'right' : 'left', right: dir === 'rtl' ? 24 : 'auto' }}>نوع الكيان</InputLabel>
                <Select
                  value={filterEntityType}
                  label="نوع الكيان"
                  onChange={(e) => setFilterEntityType(e.target.value)}
                >
                  <MenuItem value="">كل الكيانات</MenuItem>
                  <MenuItem value="USER">مستخدم (USER)</MenuItem>
                  <MenuItem value="PRODUCT">منتج (PRODUCT)</MenuItem>
                  <MenuItem value="CATEGORY">تصنيف (CATEGORY)</MenuItem>
                  <MenuItem value="PRICE_TIER">فئة سعر (PRICE_TIER)</MenuItem>
                  <MenuItem value="CUSTOMER">عميل (CUSTOMER)</MenuItem>
                  <MenuItem value="PREORDER">حجز مسبق (PREORDER)</MenuItem>
                  <MenuItem value="ORDER">فاتورة مبيعات (ORDER)</MenuItem>
                  <MenuItem value="SHIFT">وردية (SHIFT)</MenuItem>
                  <MenuItem value="SETTINGS">إعدادات النظام (SETTINGS)</MenuItem>
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} sm={3}>
              <FormControl fullWidth size="small">
                <InputLabel sx={{ fontFamily: 'Cairo', transformOrigin: dir === 'rtl' ? 'right' : 'left', right: dir === 'rtl' ? 24 : 'auto' }}>المستخدم المسؤول</InputLabel>
                <Select
                  value={filterUserId}
                  label="المستخدم المسؤول"
                  onChange={(e) => setFilterUserId(e.target.value)}
                >
                  <MenuItem value="">كل المستخدمين</MenuItem>
                  {usersList.map((u) => (
                    <MenuItem key={u.id} value={u.id.toString()}>
                      {u.name} ({u.username})
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} sm={2}>
              <TextField
                fullWidth
                size="small"
                type="number"
                label="رقم الوردية"
                value={filterShiftId}
                onChange={(e) => setFilterShiftId(e.target.value)}
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

            <Grid item xs={12} sm={2}>
              <TextField
                fullWidth
                size="small"
                type="number"
                label="معرف الكيان"
                value={filterEntityId}
                onChange={(e) => setFilterEntityId(e.target.value)}
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

            <Grid item xs={12} sm={5} sx={{ display: 'flex', gap: 1 }}>
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

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 5 }}>
          <CircularProgress />
        </Box>
      ) : (
        <Card variant="outlined" sx={{ borderRadius: 1 }}>
          <CardContent sx={{ p: 0 }}>
            <DataTable
              columns={[
                { id: 'id', label: 'المعرف', render: (log) => <strong>#{log.id}</strong> },
                {
                  id: 'created_at',
                  label: 'التاريخ والوقت',
                  render: (log) => <bdi>{new Date(log.created_at).toLocaleString('ar-EG', { timeZone: 'Africa/Cairo' })}</bdi>
                },
                { id: 'user_name', label: 'المستخدم', render: (log) => log.user_name || `مستخدم (${log.user_id})` },
                {
                  id: 'action_type',
                  label: 'نوع الإجراء',
                  render: (log) => (
                    <Chip
                      label={log.action_type}
                      color="info"
                      size="small"
                      sx={{ fontWeight: 'bold' }}
                    />
                  )
                },
                { id: 'shift_id', label: 'الوردية', render: (log) => log.shift_id ? `#${log.shift_id}` : '—' },
                { id: 'notes', label: 'البيان والملحوظات', render: (log) => log.notes || '—' },
                {
                  id: 'actions',
                  label: 'العمليات',
                  render: (log) => (log.before_values || log.after_values) ? (
                    <Button
                      variant="outlined"
                      size="small"
                      onClick={() => handleOpenDrawer(log)}
                      startIcon={<ViewIcon />}
                      sx={{ fontFamily: 'Cairo' }}
                    >
                      التفاصيل
                    </Button>
                  ) : '—'
                }
              ]}
              rows={logsList}
              mobileRenderer={renderMobileLogCard}
              emptyTitle="سجل العمليات فارغ"
              emptyDescription="سوف تظهر سجلات الحركات المالية وتعديلات المخازن هنا عند إجراء المعاملات."
            />
          </CardContent>
        </Card>
      )}

      {/* Details Diff Drawer */}
      <EntityDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title={selectedLog ? `تفاصيل مقارنة سجل العمليات #${selectedLog.id}` : ''}
      >
        {selectedLog && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <Paper variant="outlined" sx={{ p: 2, bgcolor: 'action.hover', borderRadius: 1 }}>
              <Grid container spacing={2} sx={{ fontSize: '0.85rem' }}>
                <Grid item xs={12} sm={6}>
                  نوع الإجراء: <strong>{selectedLog.action_type}</strong>
                </Grid>
                <Grid item xs={12} sm={6}>
                  نوع الكيان: <strong>{selectedLog.entity_type || '—'}</strong>
                </Grid>
                <Grid item xs={12} sm={6}>
                  معرف الكيان: <strong>{selectedLog.entity_id || '—'}</strong>
                </Grid>
                <Grid item xs={12} sm={6}>
                  الوردية المرتبطة: <strong>{selectedLog.shift_id ? `#${selectedLog.shift_id}` : '—'}</strong>
                </Grid>
                <Grid item xs={12}>
                  البيان: <strong>{selectedLog.notes || '—'}</strong>
                </Grid>
              </Grid>
            </Paper>

            <Box>
              <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mb: 1, fontFamily: 'Cairo' }}>
                مقارنة التغييرات قبل وبعد التعديل
              </Typography>
              {renderValueDiff(selectedLog.before_values, selectedLog.after_values)}
            </Box>

            <Box sx={{ display: 'flex', gap: 2, mt: 1 }}>
              <Button onClick={() => setDrawerOpen(false)} variant="contained" sx={{ fontFamily: 'Cairo', flex: 1 }}>
                إغلاق التفاصيل
              </Button>
            </Box>
          </Box>
        )}
      </EntityDrawer>
    </Box>
  );
}

export default AuditLogs;

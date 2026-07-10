import React from 'react';
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
  Chip
} from '@mui/material';
import { Refresh as RefreshIcon, FilterList as FilterListIcon } from '@mui/icons-material';

export default function AuditLogsTable({
  logsList,
  logsLoading,
  loadAuditLogs,
  filterActionType,
  setFilterActionType,
  filterStartDate,
  setFilterStartDate,
  filterEndDate,
  setFilterEndDate
}) {
  return (
    <Box sx={{ width: '100%' }}>
      {/* Content Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5" sx={{ fontWeight: 'bold', color: 'primary.main' }}>
          سجل العمليات (Audit Logs)
        </Typography>
        <Button
          variant="contained"
          startIcon={<RefreshIcon />}
          onClick={loadAuditLogs}
        >
          تحديث السجل
        </Button>
      </Box>

      {/* Filter Card */}
      <Paper sx={{ p: 3, mb: 3 }} variant="outlined">
        <Grid container spacing={2} alignItems="flex-end">
          <Grid item xs={12} sm={3}>
            <FormControl fullWidth size="small">
              <InputLabel id="action-type-select-label">نوع العملية</InputLabel>
              <Select
                labelId="action-type-select-label"
                id="action-type-select"
                value={filterActionType}
                label="نوع العملية"
                onChange={(e) => setFilterActionType(e.target.value)}
              >
                <MenuItem value="">كل العمليات</MenuItem>
                <MenuItem value="LOGIN">تسجيل الدخول</MenuItem>
                <MenuItem value="LOGOUT">تسجيل الخروج</MenuItem>
                <MenuItem value="USER_CREATE">إنشاء مستخدم</MenuItem>
                <MenuItem value="USER_UPDATE">تعديل مستخدم</MenuItem>
                <MenuItem value="USER_PASSWORD_CHANGE">تغيير الباسورد</MenuItem>
                <MenuItem value="USER_DISABLE">تعطيل مستخدم</MenuItem>
                <MenuItem value="USER_ENABLE">تفعيل مستخدم</MenuItem>
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
                <MenuItem value="SALE_CREATE">عملية بيع</MenuItem>
                <MenuItem value="RECEIPT_REPRINT">إعادة طباعة إيصال</MenuItem>
              </Select>
            </FormControl>
          </Grid>

          <Grid item xs={12} sm={3}>
            <TextField
              fullWidth
              size="small"
              label="تاريخ البداية"
              type="date"
              InputLabelProps={{ shrink: true }}
              value={filterStartDate}
              onChange={(e) => setFilterStartDate(e.target.value)}
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
            />
          </Grid>

          <Grid item xs={12} sm={3}>
            <Button
              fullWidth
              variant="outlined"
              startIcon={<FilterListIcon />}
              onClick={loadAuditLogs}
            >
              تصفية
            </Button>
          </Grid>
        </Grid>
      </Paper>

      {/* Table Data */}
      {logsLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 5 }}>
          <CircularProgress />
        </Box>
      ) : (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>المعرف</TableCell>
                <TableCell>التاريخ</TableCell>
                <TableCell>المستخدم</TableCell>
                <TableCell>نوع الإجراء</TableCell>
                <TableCell>التفاصيل</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {logsList.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} align="center" sx={{ color: 'text.secondary', py: 4 }}>
                    لا توجد سجلات مطابقة لخيارات البحث.
                  </TableCell>
                </TableRow>
              ) : (
                logsList.map((log) => (
                  <TableRow key={log.id} hover>
                    <TableCell>{log.id}</TableCell>
                    <TableCell>
                      {new Date(log.created_at).toLocaleString('ar-EG', { timeZone: 'Africa/Cairo' })}
                    </TableCell>
                    <TableCell>{log.user_name || `مستخدم (${log.user_id})`}</TableCell>
                    <TableCell>
                      <Chip
                        label={log.action_type}
                        color="info"
                        size="small"
                        sx={{ fontWeight: 'bold' }}
                      />
                    </TableCell>
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

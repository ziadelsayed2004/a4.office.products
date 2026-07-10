import React, { useState, useEffect } from 'react';
import { useAuth } from '../app/AuthContext.jsx';
import {
  Box,
  Typography,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  CircularProgress,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField
} from '@mui/material';
import { Add as AddIcon, Search as SearchIcon } from '@mui/icons-material';

export function Customers() {
  const { token } = useAuth();
  const [customersList, setCustomersList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchInput, setSearchInput] = useState('');

  // Dialog states
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [dialogError, setDialogError] = useState('');
  const [submitting, setSubmitting] = useState(false);

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
  }, [token, searchInput]);

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
          name: customerName,
          phone: customerPhone
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

  return (
    <Box>
      {/* Content Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5" sx={{ fontWeight: 'bold', color: 'primary.main', fontFamily: 'Cairo' }}>
          إدارة العملاء
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={handleOpenAddDialog}
          sx={{ fontFamily: 'Cairo' }}
        >
          تسجيل عميل جديد
        </Button>
      </Box>

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
          sx={{ '& .MuiInputLabel-root': { fontFamily: 'Cairo' }, '& .MuiOutlinedInput-input': { fontFamily: 'Cairo' } }}
        />
      </Paper>

      {error && (
        <Alert severity="error" sx={{ mb: 3, fontFamily: 'Cairo', textAlign: 'right' }}>
          {error}
        </Alert>
      )}

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 5 }}>
          <CircularProgress />
        </Box>
      ) : (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>الرقم التعريفي</TableCell>
                <TableCell>اسم العميل</TableCell>
                <TableCell>رقم الهاتف</TableCell>
                <TableCell>تاريخ التسجيل</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {customersList.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} align="center" sx={{ color: 'text.secondary', py: 4, fontFamily: 'Cairo' }}>
                    لا توجد سجلات مطابقة للبحث.
                  </TableCell>
                </TableRow>
              ) : (
                customersList.map((c) => (
                  <TableRow key={c.id} hover>
                    <TableCell>{c.id}</TableCell>
                    <TableCell sx={{ fontWeight: 'bold' }}>{c.name}</TableCell>
                    <TableCell>
                      <code>{c.phone}</code>
                    </TableCell>
                    <TableCell>
                      {new Date(c.created_at || Date.now()).toLocaleDateString('ar-EG')}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* Add Dialog */}
      <Dialog open={showAddDialog} onClose={() => !submitting && setShowAddDialog(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontFamily: 'Cairo', fontWeight: 'bold', textAlign: 'right' }}>تسجيل عميل جديد</DialogTitle>
        <form onSubmit={handleCreateCustomerSubmit}>
          <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {dialogError && (
              <Alert severity="error" sx={{ mb: 1, fontFamily: 'Cairo', textAlign: 'right' }}>
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
              sx={{ '& .MuiInputLabel-root': { fontFamily: 'Cairo' }, '& .MuiOutlinedInput-input': { fontFamily: 'Cairo' } }}
            />
            <TextField
              fullWidth
              label="رقم الهاتف"
              value={customerPhone}
              onChange={(e) => setCustomerPhone(e.target.value)}
              disabled={submitting}
              size="small"
              sx={{ '& .MuiInputLabel-root': { fontFamily: 'Cairo' }, '& .MuiOutlinedInput-input': { fontFamily: 'Cairo' } }}
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
    </Box>
  );
}

export default Customers;

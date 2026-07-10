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
  TextField,
  Chip,
  ButtonGroup
} from '@mui/material';
import { Add as AddIcon, Edit as EditIcon, PowerSettingsNew as PowerIcon } from '@mui/icons-material';

export function PriceTiers() {
  const { token, user } = useAuth();
  const [priceTiersList, setPriceTiersList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Dialog States
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [selectedPriceTier, setSelectedPriceTier] = useState(null);
  const [priceTierFormName, setPriceTierFormName] = useState('');
  const [priceTierFormDesc, setPriceTierFormDesc] = useState('');
  const [dialogError, setDialogError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const loadPriceTiers = async () => {
    if (!token) return;
    setLoading(true);
    setError('');
    try {
      const url = user?.role === 'Admin' ? '/api/admin/price-tiers?activeOnly=false' : '/api/admin/price-tiers';
      const res = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const payload = await res.json();
      if (res.status === 200) {
        setPriceTiersList(payload.data || []);
      } else {
        setError(payload.error || 'فشل تحميل فئات الأسعار.');
      }
    } catch (err) {
      setError('خطأ في الاتصال بالخادم.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPriceTiers();
  }, [token]);

  const handleOpenAddDialog = () => {
    setPriceTierFormName('');
    setPriceTierFormDesc('');
    setDialogError('');
    setShowAddDialog(true);
  };

  const handleOpenEditDialog = (tier) => {
    setSelectedPriceTier(tier);
    setPriceTierFormName(tier.name);
    setPriceTierFormDesc(tier.description || '');
    setDialogError('');
    setShowEditDialog(true);
  };

  const handleCreatePriceTierSubmit = async (e) => {
    e.preventDefault();
    setDialogError('');
    if (!priceTierFormName || priceTierFormName.trim().length === 0) {
      setDialogError('اسم فئة السعر مطلوب.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/admin/price-tiers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ name: priceTierFormName, description: priceTierFormDesc })
      });
      const payload = await res.json();
      if (res.status === 201) {
        setShowAddDialog(false);
        loadPriceTiers();
      } else {
        setDialogError(payload.error || 'فشل إنشاء فئة السعر.');
      }
    } catch (err) {
      setDialogError('حدث خطأ بالخادم.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditPriceTierSubmit = async (e) => {
    e.preventDefault();
    setDialogError('');
    if (!priceTierFormName || priceTierFormName.trim().length === 0) {
      setDialogError('اسم فئة السعر مطلوب.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`/api/admin/price-tiers/${selectedPriceTier.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ name: priceTierFormName, description: priceTierFormDesc })
      });
      const payload = await res.json();
      if (res.status === 200) {
        setShowEditDialog(false);
        setSelectedPriceTier(null);
        loadPriceTiers();
      } else {
        setDialogError(payload.error || 'فشل تحديث فئة السعر.');
      }
    } catch (err) {
      setDialogError('حدث خطأ بالخادم.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleTogglePriceTierStatus = async (targetTier) => {
    const isCurrentlyActive = targetTier.is_active === 1;
    try {
      const res = await fetch(`/api/admin/price-tiers/${targetTier.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ is_active: !isCurrentlyActive })
      });
      if (res.status === 200) {
        loadPriceTiers();
      } else {
        const payload = await res.json();
        alert(payload.error || 'فشل تعديل حالة فئة السعر.');
      }
    } catch (err) {
      alert('خطأ في الاتصال بالخادم.');
    }
  };

  return (
    <Box>
      {/* Content Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5" sx={{ fontWeight: 'bold', color: 'primary.main', fontFamily: 'Cairo' }}>
          إدارة فئات الأسعار
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={handleOpenAddDialog}
          sx={{ fontFamily: 'Cairo' }}
        >
          إضافة فئة سعر جديدة
        </Button>
      </Box>

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
                <TableCell>اسم فئة السعر</TableCell>
                <TableCell>الوصف</TableCell>
                <TableCell>الحالة</TableCell>
                <TableCell>العمليات</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {priceTiersList.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} align="center" sx={{ color: 'text.secondary', py: 4, fontFamily: 'Cairo' }}>
                    لا توجد فئات أسعار حالية.
                  </TableCell>
                </TableRow>
              ) : (
                priceTiersList.map((tier) => (
                  <TableRow key={tier.id} hover>
                    <TableCell>{tier.id}</TableCell>
                    <TableCell>{tier.name}</TableCell>
                    <TableCell>{tier.description || '—'}</TableCell>
                    <TableCell>
                      <Chip
                        label={tier.is_active === 1 ? 'نشط' : 'معطل'}
                        color={tier.is_active === 1 ? 'success' : 'error'}
                        size="small"
                        sx={{ fontWeight: 'bold', fontFamily: 'Cairo' }}
                      />
                    </TableCell>
                    <TableCell>
                      <ButtonGroup size="small" variant="outlined">
                        <Button
                          startIcon={<EditIcon />}
                          onClick={() => handleOpenEditDialog(tier)}
                          sx={{ fontFamily: 'Cairo' }}
                        >
                          تعديل
                        </Button>
                        <Button
                          color={tier.is_active === 1 ? 'error' : 'success'}
                          startIcon={<PowerIcon />}
                          onClick={() => handleTogglePriceTierStatus(tier)}
                          sx={{ fontFamily: 'Cairo' }}
                        >
                          {tier.is_active === 1 ? 'تعطيل' : 'تفعيل'}
                        </Button>
                      </ButtonGroup>
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
        <DialogTitle sx={{ fontFamily: 'Cairo', fontWeight: 'bold', textAlign: 'right' }}>إضافة فئة سعر جديدة</DialogTitle>
        <form onSubmit={handleCreatePriceTierSubmit}>
          <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {dialogError && (
              <Alert severity="error" sx={{ mb: 1, fontFamily: 'Cairo', textAlign: 'right' }}>
                {dialogError}
              </Alert>
            )}
            <TextField
              fullWidth
              autoFocus
              label="اسم فئة السعر"
              value={priceTierFormName}
              onChange={(e) => setPriceTierFormName(e.target.value)}
              disabled={submitting}
              size="small"
              sx={{ '& .MuiInputLabel-root': { fontFamily: 'Cairo' }, '& .MuiOutlinedInput-input': { fontFamily: 'Cairo' } }}
            />
            <TextField
              fullWidth
              label="الوصف"
              value={priceTierFormDesc}
              onChange={(e) => setPriceTierFormDesc(e.target.value)}
              disabled={submitting}
              size="small"
              multiline
              rows={2}
              sx={{ '& .MuiInputLabel-root': { fontFamily: 'Cairo' }, '& .MuiOutlinedInput-input': { fontFamily: 'Cairo' } }}
            />
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button onClick={() => setShowAddDialog(false)} disabled={submitting} sx={{ fontFamily: 'Cairo' }}>
              إلغاء
            </Button>
            <Button type="submit" variant="contained" disabled={submitting} sx={{ fontFamily: 'Cairo' }}>
              إضافة
            </Button>
          </DialogActions>
        </form>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={showEditDialog} onClose={() => !submitting && setShowEditDialog(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontFamily: 'Cairo', fontWeight: 'bold', textAlign: 'right' }}>تعديل فئة السعر</DialogTitle>
        <form onSubmit={handleEditPriceTierSubmit}>
          <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {dialogError && (
              <Alert severity="error" sx={{ mb: 1, fontFamily: 'Cairo', textAlign: 'right' }}>
                {dialogError}
              </Alert>
            )}
            <TextField
              fullWidth
              autoFocus
              label="اسم فئة السعر"
              value={priceTierFormName}
              onChange={(e) => setPriceTierFormName(e.target.value)}
              disabled={submitting}
              size="small"
              sx={{ '& .MuiInputLabel-root': { fontFamily: 'Cairo' }, '& .MuiOutlinedInput-input': { fontFamily: 'Cairo' } }}
            />
            <TextField
              fullWidth
              label="الوصف"
              value={priceTierFormDesc}
              onChange={(e) => setPriceTierFormDesc(e.target.value)}
              disabled={submitting}
              size="small"
              multiline
              rows={2}
              sx={{ '& .MuiInputLabel-root': { fontFamily: 'Cairo' }, '& .MuiOutlinedInput-input': { fontFamily: 'Cairo' } }}
            />
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button onClick={() => setShowEditDialog(false)} disabled={submitting} sx={{ fontFamily: 'Cairo' }}>
              إلغاء
            </Button>
            <Button type="submit" variant="contained" disabled={submitting} sx={{ fontFamily: 'Cairo' }}>
              حفظ
            </Button>
          </DialogActions>
        </form>
      </Dialog>
    </Box>
  );
}

export default PriceTiers;

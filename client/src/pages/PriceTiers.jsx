import React, { useState, useEffect } from 'react';
import { useAuth } from '../app/AuthContext.jsx';
import { useLanguage } from '../i18n/config.js';
import PageHeader from '../components/navigation/PageHeader.jsx';
import DataTable from '../components/data-display/DataTable.jsx';
import StatusChip from '../components/data-display/StatusChip.jsx';
import ConfirmDialog from '../components/feedback/ConfirmDialog.jsx';
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
  CardContent
} from '@mui/material';
import { Add as AddIcon, Edit as EditIcon, PowerSettingsNew as PowerIcon } from '@mui/icons-material';

export function PriceTiers() {
  const { token, user } = useAuth();
  const { t, dir } = useLanguage();
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

  // Status Toggle Confirmation States
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [selectedPriceTierForToggle, setSelectedPriceTierForToggle] = useState(null);

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
  }, [token]); // eslint-disable-line react-hooks/exhaustive-deps

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

  const handleTogglePriceTierStatus = (targetTier) => {
    setSelectedPriceTierForToggle(targetTier);
    setConfirmOpen(true);
  };

  const confirmToggleStatus = async () => {
    if (!selectedPriceTierForToggle) return;
    const targetTier = selectedPriceTierForToggle;
    const isCurrentlyActive = targetTier.is_active === 1;
    setConfirmOpen(false);
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

  // Mobile layout representation
  const renderMobileRecord = (tier) => (
    <Card variant="outlined" sx={{ borderRadius: 1 }}>
      <CardContent sx={{ p: 2 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 'bold' }}>
            {tier.name}
          </Typography>
          <StatusChip status={tier.is_active} />
        </Box>
        <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2, fontSize: '0.8rem' }}>
          {tier.description || '—'}
        </Typography>
        <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
          <Button
            variant="outlined"
            size="small"
            onClick={() => handleOpenEditDialog(tier)}
            startIcon={<EditIcon />}
            sx={{ fontFamily: 'Cairo' }}
          >
            تعديل
          </Button>
          <Button
            variant="outlined"
            size="small"
            color={tier.is_active === 1 ? 'error' : 'success'}
            onClick={() => handleTogglePriceTierStatus(tier)}
            startIcon={<PowerIcon />}
            sx={{ fontFamily: 'Cairo' }}
          >
            {tier.is_active === 1 ? 'تعطيل' : 'تفعيل'}
          </Button>
        </Box>
      </CardContent>
    </Card>
  );

  return (
    <Box>
      {/* Content Header */}
      <PageHeader
        titleKey="nav.priceTiers"
        actions={
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={handleOpenAddDialog}
            sx={{ fontFamily: 'Cairo' }}
          >
            إضافة فئة سعر جديدة
          </Button>
        }
      />

      {error && (
        <Alert severity="error" sx={{ mb: 3, fontFamily: 'Cairo', textAlign: dir === 'rtl' ? 'right' : 'left' }}>
          {error}
        </Alert>
      )}

      <DataTable
        loading={loading}
        columns={[
          { id: 'id', label: 'الرقم التعريفي' },
          { id: 'name', label: 'اسم فئة السعر' },
          { id: 'description', label: 'الوصف' },
          {
            id: 'is_active',
            label: 'الحالة',
            render: (tier) => <StatusChip status={tier.is_active} />
          },
          {
            id: 'actions',
            label: 'العمليات',
            render: (tier) => (
              <Box sx={{ display: 'flex', gap: 1 }}>
                <Button
                  variant="outlined"
                  size="small"
                  className="table-action-btn"
                  onClick={() => handleOpenEditDialog(tier)}
                  startIcon={<EditIcon />}
                  sx={{ fontFamily: 'Cairo' }}
                >
                  <span className="btn-text">تعديل</span>
                </Button>
                <Button
                  variant="outlined"
                  size="small"
                  className="table-action-btn"
                  color={tier.is_active === 1 ? 'error' : 'success'}
                  onClick={() => handleTogglePriceTierStatus(tier)}
                  startIcon={<PowerIcon />}
                  sx={{ fontFamily: 'Cairo' }}
                >
                  <span className="btn-text">{tier.is_active === 1 ? 'تعطيل' : 'تفعيل'}</span>
                </Button>
              </Box>
            )
          }
        ]}
        rows={priceTiersList}
        mobileRenderer={renderMobileRecord}
        emptyTitle="لا توجد فئات أسعار حالية"
        emptyDescription="قم بإضافة فئة أسعار جديدة لبدء إدارة تسعير منتجات الكتالوج."
      />

      {/* Add Dialog */}
      <Dialog open={showAddDialog} onClose={() => !submitting && setShowAddDialog(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontFamily: 'Cairo', fontWeight: 'bold', textAlign: dir === 'rtl' ? 'right' : 'left' }}>إضافة فئة سعر جديدة</DialogTitle>
        <form onSubmit={handleCreatePriceTierSubmit}>
          <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {dialogError && (
              <Alert severity="error" sx={{ mb: 1, fontFamily: 'Cairo', textAlign: dir === 'rtl' ? 'right' : 'left' }}>
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
              label="الوصف"
              value={priceTierFormDesc}
              onChange={(e) => setPriceTierFormDesc(e.target.value)}
              disabled={submitting}
              size="small"
              multiline
              rows={2}
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
              إضافة
            </Button>
          </DialogActions>
        </form>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={showEditDialog} onClose={() => !submitting && setShowEditDialog(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontFamily: 'Cairo', fontWeight: 'bold', textAlign: dir === 'rtl' ? 'right' : 'left' }}>تعديل فئة السعر</DialogTitle>
        <form onSubmit={handleEditPriceTierSubmit}>
          <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {dialogError && (
              <Alert severity="error" sx={{ mb: 1, fontFamily: 'Cairo', textAlign: dir === 'rtl' ? 'right' : 'left' }}>
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
              label="الوصف"
              value={priceTierFormDesc}
              onChange={(e) => setPriceTierFormDesc(e.target.value)}
              disabled={submitting}
              size="small"
              multiline
              rows={2}
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
            <Button onClick={() => setShowEditDialog(false)} disabled={submitting} sx={{ fontFamily: 'Cairo' }}>
              إلغاء
            </Button>
            <Button type="submit" variant="contained" disabled={submitting} sx={{ fontFamily: 'Cairo' }}>
              حفظ
            </Button>
          </DialogActions>
        </form>
      </Dialog>

      {/* Confirmation dialog for deactivating/activating price tiers */}
      <ConfirmDialog
        open={confirmOpen}
        title="تغيير حالة فئة السعر"
        description={
          selectedPriceTierForToggle?.is_active === 1
            ? `هل أنت متأكد من رغبتك في تعطيل فئة السعر "${selectedPriceTierForToggle?.name}"؟ سيؤثر هذا على تسعير المنتجات المرتبطة.`
            : `هل أنت متأكد من رغبتك في تفعيل فئة السعر "${selectedPriceTierForToggle?.name}"؟`
        }
        type="warning"
        confirmText="تأكيد"
        cancelText="إلغاء"
        onConfirm={confirmToggleStatus}
        onCancel={() => setConfirmOpen(false)}
      />
    </Box>
  );
}

export default PriceTiers;

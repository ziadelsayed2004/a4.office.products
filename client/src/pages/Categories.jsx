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

export function Categories() {
  const { token, user } = useAuth();
  const [categoriesList, setCategoriesList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Dialog States
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [categoryFormName, setCategoryFormName] = useState('');
  const [dialogError, setDialogError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const loadCategories = async () => {
    if (!token) return;
    setLoading(true);
    setError('');
    try {
      const url = user?.role === 'Admin' ? '/api/categories?activeOnly=false' : '/api/categories';
      const res = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const payload = await res.json();
      if (res.status === 200) {
        setCategoriesList(payload.data || []);
      } else {
        setError(payload.error || 'فشل تحميل قائمة التصنيفات.');
      }
    } catch (err) {
      setError('خطأ في الاتصال بالخادم.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCategories();
  }, [token]);

  const handleOpenAddDialog = () => {
    setCategoryFormName('');
    setDialogError('');
    setShowAddDialog(true);
  };

  const handleOpenEditDialog = (cat) => {
    setSelectedCategory(cat);
    setCategoryFormName(cat.name);
    setDialogError('');
    setShowEditDialog(true);
  };

  const handleCreateCategorySubmit = async (e) => {
    e.preventDefault();
    setDialogError('');
    if (!categoryFormName || categoryFormName.trim().length === 0) {
      setDialogError('اسم التصنيف مطلوب.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/admin/categories', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ name: categoryFormName })
      });
      const payload = await res.json();
      if (res.status === 201) {
        setShowAddDialog(false);
        loadCategories();
      } else {
        setDialogError(payload.error || 'فشل إنشاء التصنيف.');
      }
    } catch (err) {
      setDialogError('حدث خطأ بالخادم.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditCategorySubmit = async (e) => {
    e.preventDefault();
    setDialogError('');
    if (!categoryFormName || categoryFormName.trim().length === 0) {
      setDialogError('اسم التصنيف لا يمكن أن يكون فارغاً.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`/api/admin/categories/${selectedCategory.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ name: categoryFormName })
      });
      const payload = await res.json();
      if (res.status === 200) {
        setShowEditDialog(false);
        setSelectedCategory(null);
        loadCategories();
      } else {
        setDialogError(payload.error || 'فشل تحديث التصنيف.');
      }
    } catch (err) {
      setDialogError('حدث خطأ بالخادم.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleCategoryStatus = async (targetCat) => {
    const isCurrentlyActive = targetCat.is_active === 1;
    try {
      const res = await fetch(`/api/admin/categories/${targetCat.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ is_active: !isCurrentlyActive })
      });
      if (res.status === 200) {
        loadCategories();
      } else {
        const payload = await res.json();
        alert(payload.error || 'فشل تعديل حالة التصنيف.');
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
          إدارة التصنيفات
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={handleOpenAddDialog}
          sx={{ fontFamily: 'Cairo' }}
        >
          إضافة تصنيف جديد
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
                <TableCell>اسم التصنيف</TableCell>
                <TableCell>الحالة</TableCell>
                <TableCell>العمليات</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {categoriesList.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} align="center" sx={{ color: 'text.secondary', py: 4, fontFamily: 'Cairo' }}>
                    لا توجد تصنيفات حالية.
                  </TableCell>
                </TableRow>
              ) : (
                categoriesList.map((cat) => (
                  <TableRow key={cat.id} hover>
                    <TableCell>{cat.id}</TableCell>
                    <TableCell>{cat.name}</TableCell>
                    <TableCell>
                      <Chip
                        label={cat.is_active === 1 ? 'نشط' : 'معطل'}
                        color={cat.is_active === 1 ? 'success' : 'error'}
                        size="small"
                        sx={{ fontWeight: 'bold', fontFamily: 'Cairo' }}
                      />
                    </TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', gap: 1 }}>
                        <Button
                          variant="outlined"
                          size="small"
                          className="table-action-btn"
                          onClick={() => handleOpenEditDialog(cat)}
                          startIcon={<EditIcon />}
                          sx={{ fontFamily: 'Cairo' }}
                        >
                          <span className="btn-text">تعديل</span>
                        </Button>
                        <Button
                          variant="outlined"
                          size="small"
                          className="table-action-btn"
                          color={cat.is_active === 1 ? 'error' : 'success'}
                          onClick={() => handleToggleCategoryStatus(cat)}
                          startIcon={<PowerIcon />}
                          sx={{ fontFamily: 'Cairo' }}
                        >
                          <span className="btn-text">{cat.is_active === 1 ? 'تعطيل' : 'تفعيل'}</span>
                        </Button>
                      </Box>
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
        <DialogTitle sx={{ fontFamily: 'Cairo', fontWeight: 'bold', textAlign: 'right' }}>إضافة تصنيف جديد</DialogTitle>
        <form onSubmit={handleCreateCategorySubmit}>
          <DialogContent>
            {dialogError && (
              <Alert severity="error" sx={{ mb: 2, fontFamily: 'Cairo', textAlign: 'right' }}>
                {dialogError}
              </Alert>
            )}
            <TextField
              fullWidth
              autoFocus
              label="اسم التصنيف"
              value={categoryFormName}
              onChange={(e) => setCategoryFormName(e.target.value)}
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
              إضافة
            </Button>
          </DialogActions>
        </form>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={showEditDialog} onClose={() => !submitting && setShowEditDialog(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontFamily: 'Cairo', fontWeight: 'bold', textAlign: 'right' }}>تعديل اسم التصنيف</DialogTitle>
        <form onSubmit={handleEditCategorySubmit}>
          <DialogContent>
            {dialogError && (
              <Alert severity="error" sx={{ mb: 2, fontFamily: 'Cairo', textAlign: 'right' }}>
                {dialogError}
              </Alert>
            )}
            <TextField
              fullWidth
              autoFocus
              label="اسم التصنيف"
              value={categoryFormName}
              onChange={(e) => setCategoryFormName(e.target.value)}
              disabled={submitting}
              size="small"
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

export default Categories;

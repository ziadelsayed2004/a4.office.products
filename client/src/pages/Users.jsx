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
  ButtonGroup,
  FormControl,
  InputLabel,
  Select,
  MenuItem
} from '@mui/material';
import { Add as AddIcon, Edit as EditIcon, VpnKey as KeyIcon, PowerSettingsNew as PowerIcon } from '@mui/icons-material';

export function Users() {
  const { token, user } = useAuth();
  const [usersList, setUsersList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Dialog States
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);

  // Form Inputs
  const [userFormName, setUserFormName] = useState('');
  const [userFormUsername, setUserFormUsername] = useState('');
  const [userFormPassword, setUserFormPassword] = useState('');
  const [userFormPhone, setUserFormPhone] = useState('');
  const [userFormRole, setUserFormRole] = useState('Cashier');
  const [newPasswordState, setNewPasswordState] = useState('');
  
  const [dialogError, setDialogError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const loadUsers = async () => {
    if (!token) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/admin/users', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const payload = await res.json();
      if (res.status === 200) {
        setUsersList(payload.data || []);
      } else {
        setError(payload.error || 'فشل تحميل قائمة المستخدمين.');
      }
    } catch (err) {
      setError('خطأ في الاتصال بالخادم.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, [token]);

  const clearForm = () => {
    setUserFormName('');
    setUserFormUsername('');
    setUserFormPassword('');
    setUserFormPhone('');
    setUserFormRole('Cashier');
    setNewPasswordState('');
    setDialogError('');
  };

  const handleOpenAddDialog = () => {
    clearForm();
    setShowAddDialog(true);
  };

  const handleOpenEditDialog = (u) => {
    clearForm();
    setSelectedUser(u);
    setUserFormName(u.name);
    setUserFormPhone(u.phone || '');
    setUserFormRole(u.role);
    setShowEditDialog(true);
  };

  const handleOpenPasswordDialog = (u) => {
    clearForm();
    setSelectedUser(u);
    setShowPasswordDialog(true);
  };

  const handleCreateUserSubmit = async (e) => {
    e.preventDefault();
    setDialogError('');
    if (!userFormUsername || !userFormPassword || !userFormName) {
      setDialogError('يرجى ملء جميع الحقول المطلوبة.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          username: userFormUsername,
          password: userFormPassword,
          name: userFormName,
          phone: userFormPhone,
          role: userFormRole
        })
      });
      const payload = await res.json();
      if (res.status === 201) {
        setShowAddDialog(false);
        loadUsers();
      } else {
        setDialogError(payload.error || 'فشلت عملية إنشاء المستخدم.');
      }
    } catch (err) {
      setDialogError('حدث خطأ بالخادم.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditUserSubmit = async (e) => {
    e.preventDefault();
    setDialogError('');
    if (!userFormName) {
      setDialogError('الاسم الكامل مطلوب.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`/api/admin/users/${selectedUser.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          name: userFormName,
          phone: userFormPhone,
          role: userFormRole
        })
      });
      const payload = await res.json();
      if (res.status === 200) {
        setShowEditDialog(false);
        setSelectedUser(null);
        loadUsers();
      } else {
        setDialogError(payload.error || 'فشل تحديث بيانات المستخدم.');
      }
    } catch (err) {
      setDialogError('حدث خطأ بالخادم.');
    } finally {
      setSubmitting(false);
    }
  };

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    setDialogError('');
    if (!newPasswordState || newPasswordState.length < 4) {
      setDialogError('يرجى إدخال كلمة مرور صالحة لا تقل عن 4 أحرف.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`/api/admin/users/${selectedUser.id}/password`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ password: newPasswordState })
      });
      const payload = await res.json();
      if (res.status === 200) {
        setShowPasswordDialog(false);
        loadUsers();
      } else {
        setDialogError(payload.error || 'فشل تغيير الباسورد.');
      }
    } catch (err) {
      setDialogError('حدث خطأ بالخادم.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleUserStatus = async (targetUser) => {
    const isCurrentlyActive = targetUser.is_active === 1;
    const endpoint = `/api/admin/users/${targetUser.id}/${isCurrentlyActive ? 'disable' : 'enable'}`;
    try {
      const res = await fetch(endpoint, {
        method: 'PATCH',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.status === 200) {
        loadUsers();
      } else {
        const payload = await res.json();
        alert(payload.error || 'فشلت عملية تغيير حالة المستخدم.');
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
          إدارة المستخدمين
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={handleOpenAddDialog}
          sx={{ fontFamily: 'Cairo' }}
        >
          إضافة مستخدم جديد
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
                <TableCell>الاسم الكامل</TableCell>
                <TableCell>اسم المستخدم</TableCell>
                <TableCell>الصلاحية (الدور)</TableCell>
                <TableCell>رقم الهاتف</TableCell>
                <TableCell>الحالة</TableCell>
                <TableCell>العمليات</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {usersList.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} align="center" sx={{ color: 'text.secondary', py: 4, fontFamily: 'Cairo' }}>
                    لا يوجد مستخدمين مضافين.
                  </TableCell>
                </TableRow>
              ) : (
                usersList.map((u) => (
                  <TableRow key={u.id} hover>
                    <TableCell sx={{ fontWeight: 'bold' }}>{u.name}</TableCell>
                    <TableCell>{u.username}</TableCell>
                    <TableCell>
                      <Chip
                        label={u.role === 'Admin' ? 'مسؤول' : 'كاشير'}
                        color={u.role === 'Admin' ? 'primary' : 'info'}
                        size="small"
                        sx={{ fontWeight: 'bold', fontFamily: 'Cairo' }}
                      />
                    </TableCell>
                    <TableCell>{u.phone || '—'}</TableCell>
                    <TableCell>
                      <Chip
                        label={u.is_active === 1 ? 'نشط' : 'معطل'}
                        color={u.is_active === 1 ? 'success' : 'error'}
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
                          onClick={() => handleOpenEditDialog(u)}
                          startIcon={<EditIcon />}
                          sx={{ fontFamily: 'Cairo' }}
                        >
                          <span className="btn-text">تعديل</span>
                        </Button>
                        <Button
                          variant="outlined"
                          size="small"
                          className="table-action-btn"
                          onClick={() => handleOpenPasswordDialog(u)}
                          startIcon={<KeyIcon />}
                          sx={{ fontFamily: 'Cairo' }}
                        >
                          <span className="btn-text">الباسورد</span>
                        </Button>
                        <Button
                          variant="outlined"
                          size="small"
                          className="table-action-btn"
                          color={u.is_active === 1 ? 'error' : 'success'}
                          onClick={() => handleToggleUserStatus(u)}
                          disabled={u.id === user?.id}
                          startIcon={<PowerIcon />}
                          sx={{ fontFamily: 'Cairo' }}
                        >
                          <span className="btn-text">{u.is_active === 1 ? 'تعطيل' : 'تفعيل'}</span>
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
      <Dialog open={showAddDialog} onClose={() => !submitting && setShowAddDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontFamily: 'Cairo', fontWeight: 'bold', textAlign: 'right' }}>إضافة مستخدم جديد</DialogTitle>
        <form onSubmit={handleCreateUserSubmit}>
          <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {dialogError && (
              <Alert severity="error" sx={{ mb: 1, fontFamily: 'Cairo', textAlign: 'right' }}>
                {dialogError}
              </Alert>
            )}
            <TextField
              required
              fullWidth
              label="الاسم الكامل"
              value={userFormName}
              onChange={(e) => setUserFormName(e.target.value)}
              disabled={submitting}
              size="small"
              sx={{ '& .MuiInputLabel-root': { fontFamily: 'Cairo' }, '& .MuiOutlinedInput-input': { fontFamily: 'Cairo' } }}
            />
            <TextField
              required
              fullWidth
              label="اسم المستخدم"
              value={userFormUsername}
              onChange={(e) => setUserFormUsername(e.target.value)}
              disabled={submitting}
              size="small"
              sx={{ '& .MuiInputLabel-root': { fontFamily: 'Cairo' }, '& .MuiOutlinedInput-input': { fontFamily: 'Cairo' } }}
            />
            <TextField
              required
              fullWidth
              type="password"
              label="كلمة المرور"
              value={userFormPassword}
              onChange={(e) => setUserFormPassword(e.target.value)}
              disabled={submitting}
              size="small"
              sx={{ '& .MuiInputLabel-root': { fontFamily: 'Cairo' }, '& .MuiOutlinedInput-input': { fontFamily: 'Cairo' } }}
            />
            <TextField
              fullWidth
              label="رقم الهاتف"
              value={userFormPhone}
              onChange={(e) => setUserFormPhone(e.target.value)}
              disabled={submitting}
              size="small"
              sx={{ '& .MuiInputLabel-root': { fontFamily: 'Cairo' }, '& .MuiOutlinedInput-input': { fontFamily: 'Cairo' } }}
            />
            <FormControl fullWidth size="small">
              <InputLabel>الصلاحية (الدور)</InputLabel>
              <Select
                value={userFormRole}
                label="الصلاحية (الدور)"
                onChange={(e) => setUserFormRole(e.target.value)}
                disabled={submitting}
              >
                <MenuItem value="Cashier">كاشير</MenuItem>
                <MenuItem value="Admin">مسؤول (Admin)</MenuItem>
              </Select>
            </FormControl>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button onClick={() => setShowAddDialog(false)} disabled={submitting} sx={{ fontFamily: 'Cairo' }}>
              إلغاء
            </Button>
            <Button type="submit" variant="contained" disabled={submitting} sx={{ fontFamily: 'Cairo' }}>
              إنشاء المستخدم
            </Button>
          </DialogActions>
        </form>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={showEditDialog} onClose={() => !submitting && setShowEditDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontFamily: 'Cairo', fontWeight: 'bold', textAlign: 'right' }}>تعديل بيانات المستخدم</DialogTitle>
        <form onSubmit={handleEditUserSubmit}>
          <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {dialogError && (
              <Alert severity="error" sx={{ mb: 1, fontFamily: 'Cairo', textAlign: 'right' }}>
                {dialogError}
              </Alert>
            )}
            <TextField
              required
              fullWidth
              label="الاسم الكامل"
              value={userFormName}
              onChange={(e) => setUserFormName(e.target.value)}
              disabled={submitting}
              size="small"
              sx={{ '& .MuiInputLabel-root': { fontFamily: 'Cairo' }, '& .MuiOutlinedInput-input': { fontFamily: 'Cairo' } }}
            />
            <TextField
              fullWidth
              label="رقم الهاتف"
              value={userFormPhone}
              onChange={(e) => setUserFormPhone(e.target.value)}
              disabled={submitting}
              size="small"
              sx={{ '& .MuiInputLabel-root': { fontFamily: 'Cairo' }, '& .MuiOutlinedInput-input': { fontFamily: 'Cairo' } }}
            />
            <FormControl fullWidth size="small">
              <InputLabel>الصلاحية (الدور)</InputLabel>
              <Select
                value={userFormRole}
                label="الصلاحية (الدور)"
                onChange={(e) => setUserFormRole(e.target.value)}
                disabled={submitting || selectedUser?.id === user?.id}
              >
                <MenuItem value="Cashier">كاشير</MenuItem>
                <MenuItem value="Admin">مسؤول (Admin)</MenuItem>
              </Select>
            </FormControl>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button onClick={() => setShowEditDialog(false)} disabled={submitting} sx={{ fontFamily: 'Cairo' }}>
              إلغاء
            </Button>
            <Button type="submit" variant="contained" disabled={submitting} sx={{ fontFamily: 'Cairo' }}>
              حفظ التعديلات
            </Button>
          </DialogActions>
        </form>
      </Dialog>

      {/* Password Dialog */}
      <Dialog open={showPasswordDialog} onClose={() => !submitting && setShowPasswordDialog(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontFamily: 'Cairo', fontWeight: 'bold', textAlign: 'right' }}>تغيير كلمة المرور</DialogTitle>
        <form onSubmit={handlePasswordSubmit}>
          <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {dialogError && (
              <Alert severity="error" sx={{ mb: 1, fontFamily: 'Cairo', textAlign: 'right' }}>
                {dialogError}
              </Alert>
            )}
            <TextField
              required
              fullWidth
              type="password"
              label="كلمة المرور الجديدة"
              value={newPasswordState}
              onChange={(e) => setNewPasswordState(e.target.value)}
              disabled={submitting}
              size="small"
              sx={{ '& .MuiInputLabel-root': { fontFamily: 'Cairo' }, '& .MuiOutlinedInput-input': { fontFamily: 'Cairo' } }}
            />
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button onClick={() => setShowPasswordDialog(false)} disabled={submitting} sx={{ fontFamily: 'Cairo' }}>
              إلغاء
            </Button>
            <Button type="submit" variant="contained" disabled={submitting} sx={{ fontFamily: 'Cairo' }}>
              تغيير كلمة المرور
            </Button>
          </DialogActions>
        </form>
      </Dialog>
    </Box>
  );
}

export default Users;

import React, { useState, useEffect } from 'react';
import { useAuth } from '../app/AuthContext.jsx';
import { useLanguage } from '../i18n/config.js';
import PageHeader from '../components/navigation/PageHeader.jsx';
import DataTable from '../components/data-display/DataTable.jsx';
import StatusChip from '../components/data-display/StatusChip.jsx';
import EntityDrawer from '../components/drawers/EntityDrawer.jsx';
import ConfirmDialog from '../components/feedback/ConfirmDialog.jsx';
import {
  Box,
  Typography,
  Button,
  Card,
  CardContent,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  CircularProgress,
  Paper,
  Chip
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  VpnKey as KeyIcon,
  PowerSettingsNew as PowerIcon
} from '@mui/icons-material';

export function Users() {
  const { token, user } = useAuth();
  const { dir } = useLanguage();
  const [usersList, setUsersList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Drawer States
  const [showAddDrawer, setShowAddDrawer] = useState(false);
  const [showEditDrawer, setShowEditDrawer] = useState(false);
  const [showPasswordDrawer, setShowPasswordDrawer] = useState(false);
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

  // Confirm Toggle Status State
  const [confirmToggleOpen, setConfirmToggleOpen] = useState(false);
  const [toggleTargetUser, setToggleTargetUser] = useState(null);

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
  }, [token]); // eslint-disable-line react-hooks/exhaustive-deps

  const clearForm = () => {
    setUserFormName('');
    setUserFormUsername('');
    setUserFormPassword('');
    setUserFormPhone('');
    setUserFormRole('Cashier');
    setNewPasswordState('');
    setDialogError('');
  };

  const handleOpenAddDrawer = () => {
    clearForm();
    setShowAddDrawer(true);
  };

  const handleOpenEditDrawer = (u) => {
    clearForm();
    setSelectedUser(u);
    setUserFormName(u.name);
    setUserFormPhone(u.phone || '');
    setUserFormRole(u.role);
    setShowEditDrawer(true);
  };

  const handleOpenPasswordDrawer = (u) => {
    clearForm();
    setSelectedUser(u);
    setShowPasswordDrawer(true);
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
        setShowAddDrawer(false);
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
        setShowEditDrawer(false);
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
        setShowPasswordDrawer(false);
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

  const handleToggleUserStatus = async () => {
    if (!token || !toggleTargetUser) return;
    setConfirmToggleOpen(false);
    const isCurrentlyActive = toggleTargetUser.is_active === 1;
    const endpoint = `/api/admin/users/${toggleTargetUser.id}/${isCurrentlyActive ? 'disable' : 'enable'}`;
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
    } finally {
      setToggleTargetUser(null);
    }
  };

  // Mobile Render Card
  const renderMobileUserCard = (u) => (
    <Card variant="outlined" sx={{ borderRadius: 1 }}>
      <CardContent sx={{ p: 2 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 'bold' }}>{u.name}</Typography>
          <Chip
            label={u.role === 'Admin' ? 'مسؤول' : 'كاشير'}
            color={u.role === 'Admin' ? 'primary' : 'info'}
            size="small"
            sx={{ height: 18, fontSize: '0.65rem', fontWeight: 'bold', fontFamily: 'Cairo' }}
          />
        </Box>
        <Typography variant="body2" sx={{ color: 'text.secondary', mb: 0.5 }}>
          اسم المستخدم: {u.username}
        </Typography>
        {u.phone && (
          <Typography variant="body2" sx={{ color: 'text.secondary', mb: 1, direction: 'ltr', textAlign: dir === 'rtl' ? 'right' : 'left' }}>
            الهاتف: {u.phone}
          </Typography>
        )}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 1 }}>
          <StatusChip status={u.is_active === 1 ? 1 : 2} label={u.is_active === 1 ? 'نشط' : 'معطل'} />
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button size="small" onClick={() => handleOpenEditDrawer(u)}>تعديل</Button>
            <Button size="small" color="warning" onClick={() => handleOpenPasswordDrawer(u)}>كلمة المرور</Button>
            {u.id !== user?.id && (
              <Button
                size="small"
                color={u.is_active === 1 ? 'error' : 'success'}
                onClick={() => {
                  setToggleTargetUser(u);
                  setConfirmToggleOpen(true);
                }}
              >
                {u.is_active === 1 ? 'تعطيل' : 'تفعيل'}
              </Button>
            )}
          </Box>
        </Box>
      </CardContent>
    </Card>
  );

  return (
    <Box>
      {/* Content Header */}
      <PageHeader
        titleKey="nav.users"
        actions={
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={handleOpenAddDrawer}
            sx={{ fontFamily: 'Cairo' }}
          >
            إضافة مستخدم جديد
          </Button>
        }
      />

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
                { id: 'name', label: 'الاسم الكامل', render: (u) => <strong>{u.name}</strong> },
                { id: 'username', label: 'اسم المستخدم' },
                {
                  id: 'role',
                  label: 'الصلاحية (الدور)',
                  render: (u) => (
                    <Chip
                      label={u.role === 'Admin' ? 'مسؤول' : 'كاشير'}
                      color={u.role === 'Admin' ? 'primary' : 'info'}
                      size="small"
                      sx={{ fontWeight: 'bold', fontFamily: 'Cairo' }}
                    />
                  )
                },
                { id: 'phone', label: 'رقم الهاتف', render: (u) => u.phone ? <code style={{ direction: 'ltr', display: 'inline-block' }}>{u.phone}</code> : '—' },
                {
                  id: 'is_active',
                  label: 'الحالة',
                  render: (u) => <StatusChip status={u.is_active === 1 ? 1 : 2} label={u.is_active === 1 ? 'نشط' : 'معطل'} />
                },
                {
                  id: 'actions',
                  label: 'العمليات',
                  render: (u) => (
                    <Box sx={{ display: 'flex', gap: 1 }}>
                      <Button
                        variant="outlined"
                        size="small"
                        onClick={() => handleOpenEditDrawer(u)}
                        startIcon={<EditIcon />}
                        sx={{ fontFamily: 'Cairo' }}
                      >
                        تعديل
                      </Button>
                      <Button
                        variant="outlined"
                        size="small"
                        onClick={() => handleOpenPasswordDrawer(u)}
                        startIcon={<KeyIcon />}
                        sx={{ fontFamily: 'Cairo' }}
                      >
                        الباسورد
                      </Button>
                      <Button
                        variant="outlined"
                        size="small"
                        color={u.is_active === 1 ? 'error' : 'success'}
                        onClick={() => {
                          setToggleTargetUser(u);
                          setConfirmToggleOpen(true);
                        }}
                        disabled={u.id === user?.id}
                        startIcon={<PowerIcon />}
                        sx={{ fontFamily: 'Cairo' }}
                      >
                        {u.is_active === 1 ? 'تعطيل' : 'تفعيل'}
                      </Button>
                    </Box>
                  )
                }
              ]}
              rows={usersList}
              mobileRenderer={renderMobileUserCard}
              emptyTitle="لا يوجد مستخدمين"
              emptyDescription="سوف تظهر قائمة الحسابات المسجلة في النظام والتحكم بصلاحياتها هنا."
            />
          </CardContent>
        </Card>
      )}

      {/* Add User Drawer */}
      <EntityDrawer
        open={showAddDrawer}
        onClose={() => !submitting && setShowAddDrawer(false)}
        title="إضافة مستخدم جديد"
      >
        <form onSubmit={handleCreateUserSubmit}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
            {dialogError && (
              <Alert severity="error" sx={{ fontFamily: 'Cairo', textAlign: dir === 'rtl' ? 'right' : 'left' }}>
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
              label="اسم المستخدم"
              value={userFormUsername}
              onChange={(e) => setUserFormUsername(e.target.value)}
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
              type="password"
              label="كلمة المرور"
              value={userFormPassword}
              onChange={(e) => setUserFormPassword(e.target.value)}
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
              value={userFormPhone}
              onChange={(e) => setUserFormPhone(e.target.value)}
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
            <FormControl fullWidth size="small">
              <InputLabel sx={{ fontFamily: 'Cairo', transformOrigin: dir === 'rtl' ? 'right' : 'left', right: dir === 'rtl' ? 24 : 'auto' }}>الصلاحية (الدور)</InputLabel>
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

            <Box sx={{ display: 'flex', gap: 2, mt: 1 }}>
              <Button onClick={() => setShowAddDrawer(false)} disabled={submitting} sx={{ fontFamily: 'Cairo', flex: 1 }}>
                إلغاء
              </Button>
              <Button type="submit" variant="contained" disabled={submitting} sx={{ fontFamily: 'Cairo', flex: 2 }}>
                إنشاء المستخدم
              </Button>
            </Box>
          </Box>
        </form>
      </EntityDrawer>

      {/* Edit User Drawer */}
      <EntityDrawer
        open={showEditDrawer}
        onClose={() => !submitting && setShowEditDrawer(false)}
        title="تعديل بيانات المستخدم"
      >
        <form onSubmit={handleEditUserSubmit}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
            {dialogError && (
              <Alert severity="error" sx={{ fontFamily: 'Cairo', textAlign: dir === 'rtl' ? 'right' : 'left' }}>
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
              value={userFormPhone}
              onChange={(e) => setUserFormPhone(e.target.value)}
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
            <FormControl fullWidth size="small">
              <InputLabel sx={{ fontFamily: 'Cairo', transformOrigin: dir === 'rtl' ? 'right' : 'left', right: dir === 'rtl' ? 24 : 'auto' }}>الصلاحية (الدور)</InputLabel>
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

            <Box sx={{ display: 'flex', gap: 2, mt: 1 }}>
              <Button onClick={() => setShowEditDrawer(false)} disabled={submitting} sx={{ fontFamily: 'Cairo', flex: 1 }}>
                إلغاء
              </Button>
              <Button type="submit" variant="contained" disabled={submitting} sx={{ fontFamily: 'Cairo', flex: 2 }}>
                حفظ التعديلات
              </Button>
            </Box>
          </Box>
        </form>
      </EntityDrawer>

      {/* Password Reset Drawer */}
      <EntityDrawer
        open={showPasswordDrawer}
        onClose={() => !submitting && setShowPasswordDrawer(false)}
        title="تغيير كلمة المرور"
      >
        <form onSubmit={handlePasswordSubmit}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
            {dialogError && (
              <Alert severity="error" sx={{ fontFamily: 'Cairo', textAlign: dir === 'rtl' ? 'right' : 'left' }}>
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

            <Box sx={{ display: 'flex', gap: 2, mt: 1 }}>
              <Button onClick={() => setShowPasswordDrawer(false)} disabled={submitting} sx={{ fontFamily: 'Cairo', flex: 1 }}>
                إلغاء
              </Button>
              <Button type="submit" variant="contained" disabled={submitting} sx={{ fontFamily: 'Cairo', flex: 2 }}>
                تغيير كلمة المرور
              </Button>
            </Box>
          </Box>
        </form>
      </EntityDrawer>

      {/* Toggle Account Status Confirm Dialog */}
      <ConfirmDialog
        open={confirmToggleOpen}
        title={toggleTargetUser?.is_active === 1 ? 'تعطيل حساب مستخدم' : 'تفعيل حساب مستخدم'}
        description={
          toggleTargetUser?.is_active === 1
            ? `هل أنت متأكد من رغبتك في تعطيل الحساب الخاص بـ (${toggleTargetUser?.name})؟ لن يتمكن من تسجيل الدخول للنظام بعد ذلك.`
            : `هل أنت متأكد من رغبتك في إعادة تفعيل الحساب الخاص بـ (${toggleTargetUser?.name})؟ سيتمكن من تسجيل الدخول فوراً بالصلاحيات المحددة.`
        }
        type={toggleTargetUser?.is_active === 1 ? 'error' : 'success'}
        confirmText="تأكيد"
        cancelText="إلغاء"
        onConfirm={handleToggleUserStatus}
        onCancel={() => {
          setConfirmToggleOpen(false);
          setToggleTargetUser(null);
        }}
      />
    </Box>
  );
}

export default Users;

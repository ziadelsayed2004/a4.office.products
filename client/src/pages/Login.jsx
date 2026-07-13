import { useState } from 'react';
import {
  Alert,
  Button,
  CircularProgress,
  IconButton,
  InputAdornment,
  Paper,
  TextField,
} from '@mui/material';
import { PersonRounded, VisibilityOffRounded, VisibilityRounded } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../app/AuthContext.jsx';
import { Field } from '../components/forms/Field.jsx';
import { FormActions } from '../components/forms/FormActions.jsx';
import logo from '../assets/a4-logo.png';
import '../styles/Login.css';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ username: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    setError('');
    setLoading(true);
    try {
      const user = await login(form.username.trim(), form.password);
      navigate(user.role === 'Admin' ? '/' : '/pos', { replace: true });
    } catch (requestError) {
      setError(requestError.message || 'تعذر تسجيل الدخول. راجع البيانات وحاول مرة أخرى.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="login-page">
      <Paper component="section" className="login-dialog" elevation={0}>
        <div className="login-logo-wrap">
          <img src={logo} alt="A4 Office Products" className="login-logo" />
        </div>

        <header className="login-header">
          <h1>دخول إلى المنصة</h1>
          <p>سجّل الدخول بحساب المدير أو الكاشير للمتابعة.</p>
        </header>

        {error && (
          <Alert severity="error" className="login-alert">
            {error}
          </Alert>
        )}

        <form className="login-form" onSubmit={submit} noValidate>
          <Field label="اسم المستخدم" required density="comfortable" ltr>
            <TextField
              value={form.username}
              onChange={(event) => setForm((value) => ({ ...value, username: event.target.value }))}
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              disabled={loading}
              slotProps={{
                input: {
                  endAdornment: (
                    <InputAdornment position="end">
                      <PersonRounded fontSize="small" />
                    </InputAdornment>
                  ),
                },
              }}
            />
          </Field>

          <Field label="كلمة المرور" required density="comfortable" ltr>
            <TextField
              type={showPassword ? 'text' : 'password'}
              value={form.password}
              onChange={(event) => setForm((value) => ({ ...value, password: event.target.value }))}
              autoComplete="current-password"
              disabled={loading}
              slotProps={{
                input: {
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        size="small"
                        aria-label={showPassword ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
                        onClick={() => setShowPassword((value) => !value)}
                        disabled={loading}
                      >
                        {showPassword ? <VisibilityOffRounded /> : <VisibilityRounded />}
                      </IconButton>
                    </InputAdornment>
                  ),
                },
              }}
            />
          </Field>

          <FormActions className="login-actions">
            <Button
              type="submit"
              fullWidth
              variant="contained"
              size="large"
              disabled={loading || !form.username.trim() || !form.password}
            >
              {loading ? (
                <>
                  <CircularProgress size={18} color="inherit" /> جاري تسجيل الدخول...
                </>
              ) : (
                'دخول إلى المنصة'
              )}
            </Button>
          </FormActions>
        </form>

        <div className="login-demo">
          <span>حساب الإدارة التجريبي</span>
          <code>admin / admin123</code>
        </div>

        <p className="login-footer">A4 Office Products — منصة إدارة المكتبة ونقطة البيع</p>
      </Paper>
    </main>
  );
}

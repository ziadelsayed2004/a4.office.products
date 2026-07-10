import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../app/AuthContext.jsx';
import {
  Box,
  Button,
  TextField,
  Typography,
  Paper,
  Alert,
  CircularProgress
} from '@mui/material';
import logoImg from '../assets/logo.png';

export function Login() {
  const { login, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  const [usernameInput, setUsernameInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isAuthenticated) {
      navigate('/');
    }
  }, [isAuthenticated, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoginError('');
    if (!usernameInput || !passwordInput) {
      setLoginError('يرجى إدخال اسم المستخدم وكلمة المرور.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: usernameInput, password: passwordInput })
      });
      
      const payload = await res.json();
      if (res.status === 200) {
        login(payload.data.accessToken, payload.data.user);
        navigate('/');
      } else {
        setLoginError(payload.error || 'فشلت عملية تسجيل الدخول.');
      }
    } catch (err) {
      setLoginError('خطأ في الاتصال بالخادم. يرجى المحاولة لاحقاً.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '100vw',
        height: '100vh',
        backgroundColor: 'background.default',
        direction: 'rtl'
      }}
    >
      <Paper
        elevation={0}
        variant="outlined"
        sx={{
          width: '100%',
          maxWidth: 420,
          p: 4,
          textAlign: 'center',
          backgroundColor: 'background.paper',
          borderRadius: 3
        }}
      >
        <Box component="img" src={logoImg} alt="A4 Logo" sx={{ height: 80, mb: 2, objectFit: 'contain' }} />
        <Typography
          variant="h4"
          sx={{
            fontWeight: 'bold',
            color: 'primary.main',
            mb: 1,
            fontFamily: 'Cairo'
          }}
        >
          نظام نقاط بيع A4
        </Typography>
        <Typography
          variant="body2"
          sx={{
            color: 'text.secondary',
            mb: 4,
            fontFamily: 'Cairo'
          }}
        >
          تسجيل الدخول للنظام لإدارة المبيعات والمخازن
        </Typography>

        {loginError && (
          <Alert severity="error" sx={{ mb: 3, fontFamily: 'Cairo', textAlign: 'right' }}>
            {loginError}
          </Alert>
        )}

        <form onSubmit={handleSubmit}>
          <TextField
            margin="normal"
            required
            fullWidth
            id="username"
            label="اسم المستخدم"
            name="username"
            autoComplete="username"
            autoFocus
            value={usernameInput}
            onChange={(e) => setUsernameInput(e.target.value)}
            disabled={loading}
            size="small"
            sx={{
              mb: 2,
              '& .MuiInputLabel-root': { fontFamily: 'Cairo' },
              '& .MuiOutlinedInput-input': { fontFamily: 'Cairo' }
            }}
          />
          <TextField
            margin="normal"
            required
            fullWidth
            name="password"
            label="كلمة المرور"
            type="password"
            id="password"
            autoComplete="current-password"
            value={passwordInput}
            onChange={(e) => setPasswordInput(e.target.value)}
            disabled={loading}
            size="small"
            sx={{
              mb: 3,
              '& .MuiInputLabel-root': { fontFamily: 'Cairo' },
              '& .MuiOutlinedInput-input': { fontFamily: 'Cairo' }
            }}
          />
          <Button
            type="submit"
            fullWidth
            variant="contained"
            size="large"
            disabled={loading}
            sx={{
              py: 1.2,
              fontFamily: 'Cairo',
              fontWeight: 'bold'
            }}
          >
            {loading ? <CircularProgress size={24} color="inherit" /> : 'دخول'}
          </Button>
        </form>
      </Paper>
    </Box>
  );
}

export default Login;

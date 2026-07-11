import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../app/AuthContext.jsx';
import { useLanguage } from '../i18n/config.js';
import { useColorMode } from '../theme/ThemeConfig.jsx';
import {
  Box,
  Button,
  TextField,
  Typography,
  Paper,
  Alert,
  CircularProgress,
  IconButton
} from '@mui/material';
import {
  DarkMode as DarkModeIcon,
  LightMode as LightModeIcon
} from '@mui/icons-material';
import logoImg from '../assets/logo.png';

export function Login() {
  const { login, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const { t, locale, changeLanguage, dir } = useLanguage();
  const { mode, toggleColorMode } = useColorMode();

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
      setLoginError(t('auth.usernameRequired'));
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
        setLoginError(payload.error || t('auth.loginFailed'));
      }
    } catch (err) {
      setLoginError(t('auth.loginFailed'));
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
        position: 'relative'
      }}
    >
      {/* Pre-auth controls: Theme and Language */}
      <Box
        sx={{
          position: 'absolute',
          top: 16,
          left: dir === 'ltr' ? 'auto' : 16,
          right: dir === 'rtl' ? 'auto' : 16,
          display: 'flex',
          gap: 1.5,
          alignItems: 'center',
          zIndex: 10
        }}
      >
        {/* Language selector switch */}
        <Button
          size="small"
          onClick={() => changeLanguage(locale === 'ar' ? 'en' : 'ar')}
          sx={{
            fontFamily: 'Cairo',
            fontWeight: 600,
            fontSize: '0.8rem',
            color: 'text.secondary',
            textTransform: 'none',
            border: '1px solid',
            borderColor: 'divider',
            borderRadius: '4px',
            px: 1.5,
            py: 0.5,
            backgroundColor: 'background.paper',
            '&:hover': {
              backgroundColor: 'action.hover'
            }
          }}
        >
          {locale === 'ar' ? 'English' : 'العربية'}
        </Button>

        {/* Theme control switch */}
        <IconButton
          size="small"
          onClick={toggleColorMode}
          sx={{
            border: '1px solid',
            borderColor: 'divider',
            borderRadius: '4px',
            p: 0.5,
            color: 'text.secondary',
            backgroundColor: 'background.paper',
            '&:hover': {
              backgroundColor: 'action.hover'
            }
          }}
        >
          {mode === 'dark' ? <LightModeIcon fontSize="small" /> : <DarkModeIcon fontSize="small" />}
        </IconButton>
      </Box>

      <Paper
        elevation={0}
        variant="outlined"
        sx={{
          width: '100%',
          maxWidth: 420,
          p: 4,
          textAlign: 'center',
          backgroundColor: 'background.paper',
          borderRadius: 1,
          mx: 2
        }}
      >
        <Box component="img" src={logoImg} alt="A4 Logo" sx={{ height: 80, mb: 2, objectFit: 'contain' }} />
        <Typography
          variant="h5"
          sx={{
            fontWeight: 'bold',
            color: 'primary.main',
            mb: 1,
            fontFamily: 'Cairo'
          }}
        >
          {t('auth.loginTitle')}
        </Typography>
        <Typography
          variant="body2"
          sx={{
            color: 'text.secondary',
            mb: 4,
            fontFamily: 'Cairo'
          }}
        >
          {t('auth.loginSubtitle')}
        </Typography>

        {loginError && (
          <Alert severity="error" sx={{ mb: 3, fontFamily: 'Cairo', textAlign: dir === 'rtl' ? 'right' : 'left' }}>
            {loginError}
          </Alert>
        )}

        <form onSubmit={handleSubmit}>
          <TextField
            margin="normal"
            required
            fullWidth
            id="username"
            label={t('auth.username')}
            name="username"
            autoComplete="username"
            autoFocus
            value={usernameInput}
            onChange={(e) => setUsernameInput(e.target.value)}
            disabled={loading}
            size="small"
            sx={{
              mb: 2,
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
            margin="normal"
            required
            fullWidth
            name="password"
            label={t('auth.password')}
            type="password"
            id="password"
            autoComplete="current-password"
            value={passwordInput}
            onChange={(e) => setPasswordInput(e.target.value)}
            disabled={loading}
            size="small"
            sx={{
              mb: 3,
              '& .MuiInputLabel-root': {
                fontFamily: 'Cairo',
                left: dir === 'rtl' ? 'auto' : 0,
                right: dir === 'rtl' ? 24 : 'auto',
                transformOrigin: dir === 'rtl' ? 'right' : 'left'
              },
              '& .MuiOutlinedInput-input': { fontFamily: 'Cairo', textAlign: dir === 'rtl' ? 'right' : 'left' }
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
            {loading ? <CircularProgress size={24} color="inherit" /> : t('auth.loginButton')}
          </Button>
        </form>
      </Paper>
    </Box>
  );
}

export default Login;

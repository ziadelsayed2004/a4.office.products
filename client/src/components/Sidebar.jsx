import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../app/AuthContext.jsx';
import {
  Box,
  Typography,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Button,
  Paper,
  Divider,
  ListSubheader
} from '@mui/material';
import {
  Dashboard as DashboardIcon,
  People as PeopleIcon,
  Category as CategoryIcon,
  RequestQuote as RequestQuoteIcon,
  Inventory as InventoryIcon,
  History as HistoryIcon,
  Payment as PaymentIcon,
  Person as PersonIcon,
  AccessTime as AccessTimeIcon,
  BookmarkBorder as BookmarkBorderIcon,
  ReceiptLong as ReceiptLongIcon,
  Assessment as AssessmentIcon,
  Print as PrintIcon,
  ShoppingCart as ShoppingCartIcon,
  Receipt as ReceiptIcon,
  Calculate as CalculateIcon,
  ExitToApp as ExitToAppIcon,
  DarkMode as DarkModeIcon,
  LightMode as LightModeIcon,
  Translate as TranslateIcon
} from '@mui/icons-material';
import { useColorMode } from '../theme/ThemeConfig.jsx';
import { useLanguage } from '../i18n/config.js';
import '../styles/Sidebar.css';
import logoImg from '../assets/logo.png';

export default function Sidebar({ onClose }) {
  const { user, currentShift, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { mode, toggleColorMode } = useColorMode();
  const { t, locale, changeLanguage } = useLanguage();

  if (!user) return null;

  const currentPath = location.pathname;

  const adminSections = [
    {
      titleKey: 'nav.mainSection',
      items: [
        { textKey: 'nav.dashboard', path: '/', icon: <DashboardIcon /> },
        { textKey: 'nav.logs', path: '/logs', icon: <ReceiptLongIcon /> }
      ]
    },
    {
      titleKey: 'nav.posSection',
      items: [
        { textKey: 'nav.pos', path: '/pos', icon: <ShoppingCartIcon /> },
        { textKey: 'nav.receipts', path: '/receipts', icon: <ReceiptIcon /> }
      ]
    },
    {
      titleKey: 'nav.catalogSection',
      items: [
        { textKey: 'nav.products', path: '/products', icon: <InventoryIcon /> },
        { textKey: 'nav.categories', path: '/categories', icon: <CategoryIcon /> },
        { textKey: 'nav.priceTiers', path: '/price-tiers', icon: <RequestQuoteIcon /> },
        { textKey: 'nav.inventory', path: '/inventory', icon: <HistoryIcon /> }
      ]
    },
    {
      titleKey: 'nav.preorderSection',
      items: [
        { textKey: 'nav.preorders', path: '/preorders', icon: <BookmarkBorderIcon /> },
        { textKey: 'nav.customers', path: '/customers', icon: <PersonIcon /> }
      ]
    },
    {
      titleKey: 'nav.financeSection',
      items: [
        { textKey: 'nav.payments', path: '/payments', icon: <PaymentIcon /> }
      ]
    },
    {
      titleKey: 'nav.shiftSection',
      items: [
        { textKey: 'nav.shiftSummary', path: '/shift-summary', icon: <CalculateIcon /> },
        { textKey: 'nav.shifts', path: '/shifts', icon: <AccessTimeIcon /> }
      ]
    },
    {
      titleKey: 'nav.adminSection',
      items: [
        { textKey: 'nav.reports', path: '/reports', icon: <AssessmentIcon /> },
        { textKey: 'nav.users', path: '/users', icon: <PeopleIcon /> }
      ]
    },
    {
      titleKey: 'nav.settingsSection',
      items: [
        { textKey: 'nav.printerSettings', path: '/printer-settings', icon: <PrintIcon /> }
      ]
    }
  ];

  const cashierSections = [
    {
      titleKey: 'nav.posSection',
      items: [
        { textKey: 'nav.pos', path: '/pos', icon: <ShoppingCartIcon /> },
        { textKey: 'nav.receipts', path: '/receipts', icon: <ReceiptIcon /> }
      ]
    },
    {
      titleKey: 'nav.preorderSection',
      items: [
        { textKey: 'nav.preorders', path: '/preorders', icon: <BookmarkBorderIcon /> }
      ]
    },
    {
      titleKey: 'nav.shiftSection',
      items: [
        { textKey: 'nav.shiftSummary', path: '/shift-summary', icon: <CalculateIcon /> }
      ]
    }
  ];

  const menuSections = user.role === 'Admin' ? adminSections : cashierSections;

  return (
    <Box
      sx={{
        width: 270,
        backgroundColor: 'background.paper',
        borderLeft: '1px solid',
        borderColor: 'divider',
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        p: 2,
        boxSizing: 'border-box'
      }}
    >
      {/* Title */}
      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', mb: 3 }}>
        <Box component="img" src={logoImg} alt="A4 Logo" sx={{ height: 60, mb: 1, objectFit: 'contain' }} />
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, justifyContent: 'center' }}>
          {locale === 'ar' ? (
            <>
              <Typography variant="h6" sx={{ fontWeight: 'bold', color: 'primary.main', fontFamily: 'Cairo' }}>منصة</Typography>
              <Typography variant="h6" sx={{ fontWeight: 'bold', color: 'primary.main', fontFamily: 'Cairo', dir: 'ltr' }}>A4</Typography>
              <Typography variant="h6" sx={{ fontWeight: 'bold', color: 'primary.main', fontFamily: 'Cairo' }}>المكتبية</Typography>
            </>
          ) : (
            <Typography variant="h6" sx={{ fontWeight: 'bold', color: 'primary.main', fontFamily: 'Cairo' }}>
              A4 Platform
            </Typography>
          )}
        </Box>
      </Box>

      {/* User Profile */}
      <Paper
        sx={{
          p: 2,
          mb: 3,
          backgroundColor: 'background.default',
          textAlign: locale === 'ar' ? 'right' : 'left'
        }}
        variant="outlined"
      >
        <Typography variant="subtitle2" sx={{ fontWeight: 'bold' }}>
          {user.full_name}
        </Typography>
        <Typography variant="caption" sx={{ color: 'primary.main', mt: 0.5, display: 'block' }}>
          {user.role === 'Admin' ? t('auth.admin') : t('auth.cashier')}
        </Typography>
      </Paper>

      {/* Navigation List */}
      <Box sx={{ flexGrow: 1, overflowY: 'auto', mb: 2 }}>
        {menuSections.map((section) => (
          <List
            key={section.titleKey}
            disablePadding
            subheader={
              <ListSubheader
                sx={{
                  backgroundColor: 'transparent',
                  fontFamily: 'Cairo',
                  fontWeight: 'bold',
                  fontSize: '0.725rem',
                  lineHeight: '28px',
                  color: 'text.secondary',
                  textAlign: locale === 'ar' ? 'right' : 'left',
                  px: 1
                }}
              >
                {t(section.titleKey)}
              </ListSubheader>
            }
            sx={{ mb: 1.5 }}
          >
            {section.items.map((item) => {
              const isSelected = currentPath === item.path;
              return (
                <ListItemButton
                  key={item.path}
                  selected={isSelected}
                  onClick={() => {
                    navigate(item.path);
                    if (onClose) onClose();
                  }}
                  sx={{
                    mb: 0.5,
                    py: 0.75,
                    borderRadius: 1,
                    '&.Mui-selected': {
                      backgroundColor: (theme) => theme.palette.mode === 'light' ? 'rgba(15, 95, 166, 0.10)' : 'rgba(96, 165, 250, 0.14)',
                      color: 'primary.main',
                      '& .MuiListItemIcon-root': {
                        color: 'primary.main'
                      },
                      '&:hover': {
                        backgroundColor: (theme) => theme.palette.mode === 'light' ? 'rgba(15, 95, 166, 0.15)' : 'rgba(96, 165, 250, 0.20)',
                      }
                    }
                  }}
                >
                  <ListItemIcon sx={{ minWidth: 36, color: isSelected ? 'primary.main' : 'text.secondary' }}>
                    {item.icon}
                  </ListItemIcon>
                  <ListItemText
                    primary={t(item.textKey)}
                    primaryTypographyProps={{
                      fontSize: '0.825rem',
                      fontWeight: isSelected ? 700 : 500,
                      fontFamily: 'Cairo'
                    }}
                  />
                </ListItemButton>
              );
            })}
          </List>
        ))}
      </Box>

      <Divider sx={{ mb: 2 }} />

      {/* Shift status indicator */}
      <Box sx={{ mb: 2 }}>
        <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 0.5, textAlign: locale === 'ar' ? 'right' : 'left' }}>
          {t('shift.statusLabel')}
        </Typography>
        {currentShift && currentShift.status === 'OPEN' ? (
          <Box className="shift-status-active">
            <span className="dot dot-active"></span>
            <Typography variant="caption" sx={{ fontWeight: 'bold', fontSize: '0.75rem' }}>
              {t('shift.open', { amount: (currentShift.opening_cash / 100).toFixed(2) })}
            </Typography>
          </Box>
        ) : currentShift && currentShift.status === 'CLOSE_REQUESTED' ? (
          <Box className="shift-status-waiting">
            <span className="dot dot-waiting"></span>
            <Typography variant="caption" sx={{ fontWeight: 'bold', fontSize: '0.75rem' }}>
              {t('shift.pendingClose')}
            </Typography>
          </Box>
        ) : (
          <Box className="shift-status-inactive">
            <span className="dot dot-inactive"></span>
            <Typography variant="caption" sx={{ fontWeight: 'bold', fontSize: '0.75rem' }}>
              {t('shift.closed')}
            </Typography>
          </Box>
        )}
      </Box>

      {/* Language Toggle button */}
      <Button
        variant="outlined"
        fullWidth
        onClick={() => changeLanguage(locale === 'ar' ? 'en' : 'ar')}
        startIcon={<TranslateIcon />}
        sx={{
          mb: 1,
          py: 1,
          fontFamily: 'Cairo',
          fontWeight: 'bold',
          borderColor: 'divider',
          color: 'text.primary',
          '&:hover': {
            borderColor: 'primary.main',
            backgroundColor: mode === 'dark' ? 'rgba(59, 130, 246, 0.08)' : 'rgba(15, 95, 166, 0.04)'
          }
        }}
      >
        {locale === 'ar' ? 'English (EN)' : 'العربية (AR)'}
      </Button>

      {/* Theme Toggle button */}
      <Button
        variant="outlined"
        fullWidth
        onClick={toggleColorMode}
        startIcon={mode === 'dark' ? <LightModeIcon /> : <DarkModeIcon />}
        sx={{
          mb: 1,
          py: 1,
          fontFamily: 'Cairo',
          fontWeight: 'bold',
          borderColor: 'divider',
          color: 'text.primary',
          '&:hover': {
            borderColor: 'primary.main',
            backgroundColor: mode === 'dark' ? 'rgba(59, 130, 246, 0.08)' : 'rgba(15, 95, 166, 0.04)'
          }
        }}
      >
        {mode === 'dark' ? t('nav.lightMode') : t('nav.darkMode')}
      </Button>

      {/* Logout button */}
      <Button
        variant="outlined"
        color="error"
        fullWidth
        startIcon={<ExitToAppIcon />}
        onClick={async () => {
          await logout();
          if (onClose) onClose();
          navigate('/login');
        }}
        sx={{
          py: 1,
          fontFamily: 'Cairo',
          fontWeight: 'bold'
        }}
      >
        {t('nav.logout')}
      </Button>
    </Box>
  );
}

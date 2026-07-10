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
  Divider
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
  ExitToApp as ExitToAppIcon
} from '@mui/icons-material';
import '../styles/Sidebar.css';
import logoImg from '../assets/logo.png';

export default function Sidebar({ onClose }) {
  const { user, currentShift, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  if (!user) return null;

  const currentPath = location.pathname;

  const adminMenu = [
    { text: 'لوحة الإحصائيات', path: '/', icon: <DashboardIcon /> },
    { text: 'إدارة المستخدمين', path: '/users', icon: <PeopleIcon /> },
    { text: 'إدارة التصنيفات', path: '/categories', icon: <CategoryIcon /> },
    { text: 'إدارة فئات الأسعار', path: '/price-tiers', icon: <RequestQuoteIcon /> },
    { text: 'إدارة المنتجات', path: '/products', icon: <InventoryIcon /> },
    { text: 'دفتر المخزون', path: '/inventory', icon: <HistoryIcon /> },
    { text: 'طرق الدفع', path: '/payments', icon: <PaymentIcon /> },
    { text: 'العملاء', path: '/customers', icon: <PersonIcon /> },
    { text: 'مراجعة الورديات', path: '/shifts', icon: <AccessTimeIcon /> },
    { text: 'إدارة الحجوزات', path: '/preorders', icon: <BookmarkBorderIcon /> },
    { text: 'سجل العمليات', path: '/logs', icon: <ReceiptLongIcon /> },
    { text: 'التقارير التفصيلية', path: '/reports', icon: <AssessmentIcon /> },
    { text: 'إعدادات الطابعات', path: '/printer-settings', icon: <PrintIcon /> }
  ];

  const cashierMenu = [
    { text: 'نقطة البيع (POS)', path: '/pos', icon: <ShoppingCartIcon /> },
    { text: 'دفتر الإيصالات', path: '/receipts', icon: <ReceiptIcon /> },
    { text: 'ملخص الوردية الحالية', path: '/shift-summary', icon: <CalculateIcon /> }
  ];

  const menuItems = user.role === 'Admin' ? adminMenu : cashierMenu;

  return (
    <Box
      sx={{
        width: 280,
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
          <Typography variant="h6" sx={{ fontWeight: 'bold', color: 'primary.main', fontFamily: 'Cairo' }}>منصة</Typography>
          <Typography variant="h6" sx={{ fontWeight: 'bold', color: 'primary.main', fontFamily: 'Cairo', dir: 'ltr' }}>A4</Typography>
          <Typography variant="h6" sx={{ fontWeight: 'bold', color: 'primary.main', fontFamily: 'Cairo' }}>المكتبية</Typography>
        </Box>
      </Box>

      {/* User Profile */}
      <Paper
        sx={{
          p: 2,
          mb: 3,
          backgroundColor: 'background.default',
          textAlign: 'right'
        }}
        variant="outlined"
      >
        <Typography variant="subtitle2" sx={{ fontWeight: 'bold' }}>
          {user.full_name}
        </Typography>
        <Typography variant="caption" sx={{ color: 'primary.main', mt: 0.5, display: 'block' }}>
          {user.role === 'Admin' ? 'مدير النظام' : 'كاشير مبيعات'}
        </Typography>
      </Paper>

      {/* Navigation List */}
      <Box sx={{ flexGrow: 1, overflowY: 'auto', mb: 2 }}>
        <List component="nav" disablePadding>
          {menuItems.map((item) => {
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
                  '&.Mui-selected': {
                    backgroundColor: (theme) => theme.palette.mode === 'light' ? 'rgba(137, 44, 220, 0.08)' : 'rgba(183, 98, 255, 0.12)',
                    color: 'primary.main',
                    '& .MuiListItemIcon-root': {
                      color: 'primary.main'
                    }
                  }
                }}
              >
                <ListItemIcon sx={{ minWidth: 40, color: isSelected ? 'primary.main' : 'text.secondary' }}>
                  {item.icon}
                </ListItemIcon>
                <ListItemText
                  primary={item.text}
                  primaryTypographyProps={{
                    fontSize: '0.85rem',
                    fontWeight: isSelected ? 700 : 500,
                    fontFamily: 'Cairo'
                  }}
                />
              </ListItemButton>
            );
          })}
        </List>
      </Box>

      <Divider sx={{ mb: 2 }} />

      {/* Shift status indicator */}
      <Box sx={{ mb: 2 }}>
        <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 0.5, textAlign: 'right' }}>
          حالة الوردية الحالية:
        </Typography>
        {currentShift && currentShift.status === 'OPEN' ? (
          <Box className="shift-status-active">
            <span className="dot dot-active"></span>
            <Typography variant="caption" sx={{ fontWeight: 'bold', fontSize: '0.75rem' }}>
              مفتوحة (عهدة: {(currentShift.opening_cash / 100).toFixed(2)} ج.م)
            </Typography>
          </Box>
        ) : currentShift && currentShift.status === 'CLOSE_REQUESTED' ? (
          <Box className="shift-status-waiting">
            <span className="dot dot-waiting"></span>
            <Typography variant="caption" sx={{ fontWeight: 'bold', fontSize: '0.75rem' }}>
              بانتظار موافقة الإغلاق
            </Typography>
          </Box>
        ) : (
          <Box className="shift-status-inactive">
            <span className="dot dot-inactive"></span>
            <Typography variant="caption" sx={{ fontWeight: 'bold', fontSize: '0.75rem' }}>
              لا توجد وردية نشطة
            </Typography>
          </Box>
        )}
      </Box>

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
        تسجيل الخروج
      </Button>
    </Box>
  );
}

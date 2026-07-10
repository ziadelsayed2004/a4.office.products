import React, { useState } from 'react';
import { Outlet, Navigate, useLocation, Link } from 'react-router-dom';
import Sidebar from '../components/Sidebar.jsx';
import { Box, Typography, AppBar, Toolbar, IconButton, Drawer } from '@mui/material';
import { Menu as MenuIcon } from '@mui/icons-material';
import { useAuth } from '../app/AuthContext.jsx';

export function MainLayout() {
  const { user } = useAuth();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };

  // Map route paths to page titles in Arabic
  const PAGE_TITLES = {
    '/': 'لوحة الإحصائيات',
    '/users': 'إدارة المستخدمين',
    '/categories': 'إدارة التصنيفات',
    '/price-tiers': 'إدارة فئات الأسعار',
    '/products': 'إدارة المنتجات',
    '/inventory': 'دفتر المخزون',
    '/payments': 'طرق الدفع',
    '/customers': 'العملاء',
    '/shifts': 'مراجعة الورديات',
    '/preorders': 'إدارة الحجوزات',
    '/logs': 'سجل العمليات',
    '/reports': 'التقارير التفصيلية',
    '/printer-settings': 'إعدادات الطابعات',
    '/pos': 'نقطة البيع (POS)',
    '/receipts': 'دفتر الإيصالات',
    '/shift-summary': 'ملخص الوردية الحالية'
  };

  const title = PAGE_TITLES[location.pathname] || '';
  const drawerWidth = 280;

  return (
    <Box dir="rtl" sx={{ display: 'flex', minHeight: '100vh', width: '100vw', backgroundColor: 'background.default' }}>
      {/* AppBar for mobile top bar */}
      <AppBar
        position="fixed"
        elevation={1}
        sx={{
          width: { md: `calc(100% - ${drawerWidth}px)` },
          mr: { md: `${drawerWidth}px` },
          display: { md: 'none' }, // Show only on mobile
          backgroundColor: 'background.paper',
          color: 'text.primary',
          borderBottom: '1px solid',
          borderColor: 'divider',
          zIndex: (theme) => theme.zIndex.drawer + 1
        }}
      >
        <Toolbar sx={{ justifyContent: 'space-between', px: 2 }}>
          <IconButton
            color="inherit"
            aria-label="open drawer"
            edge="start"
            onClick={handleDrawerToggle}
            sx={{ ml: 2 }}
          >
            <MenuIcon />
          </IconButton>
          <Typography variant="h6" noWrap component="div" sx={{ fontFamily: 'Cairo', fontWeight: 'bold' }}>
            {title}
          </Typography>
          <Box sx={{ width: 40 }} /> {/* Spacer to center the title on mobile if needed */}
        </Toolbar>
      </AppBar>

      {/* Sidebar for Desktop */}
      <Box
        component="nav"
        sx={{ width: { md: drawerWidth }, flexShrink: { md: 0 }, display: { xs: 'none', md: 'block' } }}
      >
        <Sidebar />
      </Box>

      {/* Sidebar Drawer for Mobile */}
      <Drawer
        variant="temporary"
        open={mobileOpen}
        onClose={handleDrawerToggle}
        ModalProps={{
          keepMounted: true, // Better open performance on mobile.
        }}
        sx={{
          display: { xs: 'block', md: 'none' },
          '& .MuiDrawer-paper': { boxSizing: 'border-box', width: drawerWidth },
        }}
        anchor="right" // Opens from the right in RTL layouts
      >
        <Sidebar onClose={handleDrawerToggle} />
      </Drawer>

      {/* Main content workspace */}
      <Box
        component="main"
        dir="rtl"
        sx={{
          textAlign: 'right',
          flexGrow: 1,
          p: 3,
          width: { md: `calc(100% - ${drawerWidth}px)` },
          mt: { xs: '64px', md: 0 }, // Clear mobile header
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column'
        }}
      >
        {/* Breadcrumbs Navigation */}
        <Box sx={{ display: 'flex', gap: 1, fontSize: '0.8rem', color: 'text.secondary', mb: 2, alignItems: 'center', fontFamily: 'Cairo' }}>
          <Link to="/" style={{ color: 'inherit', textDecoration: 'none', transition: 'color 0.2s', fontWeight: 500 }} onMouseEnter={(e) => e.target.style.color = '#0f5fa6'} onMouseLeave={(e) => e.target.style.color = 'inherit'}>الرئيسية</Link>
          <span>&gt;</span>
          <Typography variant="caption" sx={{ color: 'primary.main', fontWeight: 'bold', fontSize: '0.8rem', fontFamily: 'Cairo' }}>
            {title}
          </Typography>
        </Box>

        {/* Dynamic route view */}
        <Box sx={{ flexGrow: 1 }}>
          <Outlet />
        </Box>
      </Box>
    </Box>
  );
}

export default MainLayout;

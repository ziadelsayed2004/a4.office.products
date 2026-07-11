import React, { useState } from 'react';
import { Outlet, Navigate, useLocation, Link } from 'react-router-dom';
import Sidebar from '../components/Sidebar.jsx';
import Breadcrumbs from '../components/navigation/Breadcrumbs.jsx';
import { Box, Typography, AppBar, Toolbar, IconButton, Drawer, Tooltip } from '@mui/material';
import { Menu as MenuIcon, DarkMode as DarkModeIcon, LightMode as LightModeIcon } from '@mui/icons-material';
import { useAuth } from '../app/AuthContext.jsx';
import { useColorMode } from '../theme/ThemeConfig.jsx';
import { useLanguage } from '../i18n/config.js';

export function MainLayout() {
  const { user } = useAuth();
  const { t, dir } = useLanguage();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { mode, toggleColorMode } = useColorMode();

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };

  // Map route paths to page titles in Arabic/English
  const PAGE_TITLES = {
    '/': t('nav.dashboard'),
    '/users': t('nav.users'),
    '/categories': t('nav.categories'),
    '/price-tiers': t('nav.priceTiers'),
    '/products': t('nav.products'),
    '/inventory': t('nav.inventory'),
    '/payments': t('nav.payments'),
    '/customers': t('nav.customers'),
    '/shifts': t('nav.shifts'),
    '/preorders': t('nav.preorders'),
    '/logs': t('nav.logs'),
    '/reports': t('nav.reports'),
    '/printer-settings': t('nav.printerSettings'),
    '/pos': t('nav.pos'),
    '/receipts': t('nav.receipts'),
    '/shift-summary': t('nav.shiftSummary')
  };

  const title = PAGE_TITLES[location.pathname] || '';
  const drawerWidth = 270;

  return (
    <Box dir={dir} sx={{ display: 'flex', minHeight: '100vh', width: '100vw', backgroundColor: 'background.default' }}>
      {/* AppBar for mobile top bar */}
      <AppBar
        position="fixed"
        elevation={1}
        sx={{
          width: { md: `calc(100% - ${drawerWidth}px)` },
          mr: dir === 'rtl' ? { md: `${drawerWidth}px` } : 0,
          ml: dir === 'ltr' ? { md: `${drawerWidth}px` } : 0,
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
            sx={{ ml: dir === 'rtl' ? 2 : 0, mr: dir === 'ltr' ? 2 : 0 }}
          >
            <MenuIcon />
          </IconButton>
          <Typography variant="h6" noWrap component="div" sx={{ fontFamily: 'Cairo', fontWeight: 'bold' }}>
            {title}
          </Typography>
          <Tooltip title={mode === 'dark' ? t('nav.lightMode') : t('nav.darkMode')}>
            <IconButton onClick={toggleColorMode} color="inherit">
              {mode === 'dark' ? <LightModeIcon /> : <DarkModeIcon />}
            </IconButton>
          </Tooltip>
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
        anchor={dir === 'rtl' ? 'right' : 'left'}
      >
        <Sidebar onClose={handleDrawerToggle} />
      </Drawer>

      {/* Main content workspace */}
      <Box
        component="main"
        dir={dir}
        sx={{
          textAlign: dir === 'rtl' ? 'right' : 'left',
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
        <Breadcrumbs />

        {/* Dynamic route view */}
        <Box sx={{ flexGrow: 1 }}>
          <Outlet />
        </Box>
      </Box>
    </Box>
  );
}

export default MainLayout;

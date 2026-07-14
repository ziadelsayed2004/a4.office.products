import { useEffect, useMemo, useRef, useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  AppBar,
  Avatar,
  Badge,
  Box,
  Chip,
  Collapse,
  Divider,
  Drawer,
  IconButton,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  ListSubheader,
  Menu,
  MenuItem,
  Toolbar,
  Tooltip,
  Typography,
  useTheme,
} from '@mui/material';
import {
  AccountCircleRounded,
  AssignmentReturnRounded,
  AssessmentRounded,
  BadgeRounded,
  CategoryRounded,
  DarkModeRounded,
  DashboardRounded,
  DescriptionRounded,
  EventAvailableRounded,
  ExpandLessRounded,
  ExpandMoreRounded,
  GroupsRounded,
  HistoryRounded,
  Inventory2Rounded,
  LightModeRounded,
  LogoutRounded,
  MenuOpenRounded,
  MenuRounded,
  PaymentsRounded,
  PointOfSaleRounded,
  PrintRounded,
  ReceiptLongRounded,
  SellRounded,
  ShoppingBasketRounded,
  SwapHorizRounded,
  CloseRounded,
} from '@mui/icons-material';
import { useAuth } from '../app/AuthContext.jsx';
import { APP_CONFIG } from '../config/appConfig.js';
import { Breadcrumbs } from '../components/Breadcrumbs.jsx';
import { useColorMode } from '../theme/ThemeConfig.jsx';
import { t } from '../locales/t.js';
import logo from '../assets/a4-logo.png';
import '../styles/MainLayout.css';

const titles = {
  '/': ['لوحة التحكم', 'ملخص سريع لحالة المبيعات والمخزون والحجوزات'],
  '/pos': ['نقطة البيع', 'بيع مباشر أو إنشاء واستلام حجز مسبق'],
  '/shift-summary': ['شيفتي الحالية', 'متابعة حركات الشيفت وطلب التقفيل'],
  '/receipts': ['الإيصالات', 'البحث عن الإيصالات وعرضها وإعادة طباعتها'],
  '/invoices': ['مركز الفواتير', 'بحث وعرض الفواتير المحفوظة بحسب صلاحياتك'],
  '/products': ['المنتجات', 'إدارة المنتجات والأسعار وخصائص الحجز'],
  '/categories': ['التصنيفات', 'تنظيم المنتجات داخل تصنيفات واضحة'],
  '/price-tiers': ['فئات الأسعار', 'إدارة أسعار القطاعي والجملة والفئات الخاصة'],
  '/inventory': ['المخزون', 'متابعة الرصيد الفعلي وحركات التسوية'],
  '/preorders': ['الحجوزات المسبقة', 'متابعة الحجز من العربون حتى الاستلام'],
  '/customers': ['العملاء', 'بيانات عملاء الحجوزات المسبقة'],
  '/payments': ['طرق الدفع', 'تفعيل طرق الدفع المتاحة داخل الكاشير'],
  '/return-authorizations': [
    'بطاقات اعتماد المرتجع',
    'إدارة بطاقات التأكيد الإدارية المستمرة وتغيير QR',
  ],
  '/returns': ['المرتجعات', 'مراجعة عمليات المرتجع وإدارة بطاقات الاعتماد والطباعة'],
  '/shifts': ['مراجعة الشيفتات', 'اعتماد أو رفض طلبات تقفيل الكاشير'],
  '/users': ['المستخدمون', 'إدارة حسابات الأدمن والكاشير'],
  '/reports': ['التقارير', 'تقارير المبيعات والحجوزات والمخزون والشيفتات'],
  '/logs': ['سجل العمليات', 'تتبع كل العمليات الحساسة داخل النظام'],
  '/printer-settings': ['إعدادات الطباعة', 'إعدادات ريسيت البيع وملصقات المنتجات'],
};

export function MainLayout() {
  const { user, isAdmin, currentShift, logout } = useAuth();
  const { mode, toggleColorMode } = useColorMode();
  const muiTheme = useTheme();
  const location = useLocation();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(
    () => localStorage.getItem(APP_CONFIG.storageKeys.sidebarCollapsed) === '1'
  );
  const [mobileOpen, setMobileOpen] = useState(false);
  const [profileAnchor, setProfileAnchor] = useState(null);
  const [openGroups, setOpenGroups] = useState({});
  const activeItemRef = useRef(null);

  useEffect(() => {
    localStorage.setItem(APP_CONFIG.storageKeys.sidebarCollapsed, collapsed ? '1' : '0');
  }, [collapsed]);

  useEffect(() => {
    setMobileOpen(false);
    setProfileAnchor(null);
  }, [location.pathname]);

  useEffect(() => {
    activeItemRef.current?.scrollIntoView?.({ block: 'nearest' });
  }, [location.pathname, mobileOpen]);

  const menu = useMemo(() => {
    const cashier = [
      {
        key: 'cashier',
        section: t('nav.cashier'),
        items: [
          { label: t('nav.pos'), path: '/pos', icon: <PointOfSaleRounded /> },
          {
            label: t('nav.currentShift'),
            path: '/shift-summary',
            icon: <EventAvailableRounded />,
          },
          {
            label: t('nav.receipts'),
            path: '/receipts',
            icon: <ReceiptLongRounded />,
          },
          {
            label: t('nav.invoices'),
            path: '/invoices',
            icon: <DescriptionRounded />,
          },
        ],
      },
    ];
    if (!isAdmin) return cashier;
    return [
      {
        key: 'home',
        section: t('nav.home'),
        items: [{ label: t('nav.dashboard'), path: '/', icon: <DashboardRounded /> }],
      },
      {
        key: 'sales',
        section: 'المبيعات والتشغيل',
        items: [
          {
            label: t('nav.invoices'),
            path: '/invoices',
            icon: <DescriptionRounded />,
          },
          {
            label: t('nav.shifts'),
            path: '/shifts',
            icon: <SwapHorizRounded />,
          },
          {
            label: t('nav.preorders'),
            path: '/preorders',
            icon: <BadgeRounded />,
          },
          {
            label: 'المرتجعات',
            path: '/returns',
            icon: <AssignmentReturnRounded />,
          },
        ],
      },
      {
        key: 'catalog',
        section: 'الكتالوج والمخزون',
        items: [
          {
            label: t('nav.products'),
            path: '/products',
            icon: <ShoppingBasketRounded />,
          },
          {
            label: t('nav.inventory'),
            path: '/inventory',
            icon: <Inventory2Rounded />,
          },
          {
            label: t('nav.customers'),
            path: '/customers',
            icon: <GroupsRounded />,
          },
        ],
      },
      {
        key: 'oversight',
        section: 'الرقابة',
        items: [
          {
            label: t('nav.users'),
            path: '/users',
            icon: <AccountCircleRounded />,
          },
          {
            label: t('nav.reports'),
            path: '/reports',
            icon: <AssessmentRounded />,
          },
          { label: t('nav.audit'), path: '/logs', icon: <HistoryRounded /> },
        ],
      },
      {
        key: 'settings',
        section: 'الإعدادات',
        items: [
          {
            label: t('nav.categories'),
            path: '/categories',
            icon: <CategoryRounded />,
          },
          {
            label: t('nav.priceTiers'),
            path: '/price-tiers',
            icon: <SellRounded />,
          },
          {
            label: t('nav.payments'),
            path: '/payments',
            icon: <PaymentsRounded />,
          },
          {
            label: t('nav.printers'),
            path: '/printer-settings',
            icon: <PrintRounded />,
          },
        ],
      },
    ];
  }, [isAdmin]);

  useEffect(() => {
    const activeGroup = menu.find((group) =>
      group.items.some((item) => item.path === location.pathname)
    );
    if (!activeGroup || openGroups[activeGroup.key] !== false) return;
    setOpenGroups((current) => ({ ...current, [activeGroup.key]: true }));
  }, [location.pathname, menu, openGroups]);

  const go = (path) => {
    navigate(path);
    setMobileOpen(false);
  };

  const handleLogout = async () => {
    setProfileAnchor(null);
    await logout();
    navigate('/login');
  };

  const [pageTitle, pageSubtitle] = titles[location.pathname] || [
    APP_CONFIG.brandName,
    APP_CONFIG.brandSubtitle,
  ];
  const drawerAnchor = muiTheme.direction === 'rtl' ? 'left' : 'right';
  const layoutClass = `main-layout ${collapsed ? 'is-collapsed' : 'is-expanded'}`;

  const renderDrawer = ({ mobile = false } = {}) => {
    const drawerCollapsed = !mobile && collapsed;
    const profileStatus = isAdmin
      ? 'مدير النظام'
      : `كاشير · ${currentShift?.status === 'OPEN' ? `شيفت #${currentShift.id}` : 'دون شيفت مفتوح'}`;

    return (
      <div className="main-layout__drawer-container">
        <div
          className={`sidebar-header ${drawerCollapsed ? 'sidebar-header--collapsed' : 'sidebar-header--expanded'}`}
        >
          <div className="sidebar-logo-box">
            <img className="sidebar-logo" src={logo} alt={APP_CONFIG.logoAlt} />
          </div>
          <div className="sidebar-brand-container">
            <strong>{APP_CONFIG.brandName}</strong>
            <span>{APP_CONFIG.brandSubtitle}</span>
          </div>
          {mobile && (
            <IconButton
              className="sidebar-mobile-close"
              onClick={() => setMobileOpen(false)}
              aria-label="إغلاق القائمة"
            >
              <CloseRounded />
            </IconButton>
          )}
        </div>

        <div className="sidebar-profile-wrap">
          <Tooltip
            placement="left"
            title={drawerCollapsed ? `${user?.name || 'المستخدم'} · ${profileStatus}` : ''}
          >
            <ListItemButton
              className="profile-card"
              onClick={(event) => setProfileAnchor(event.currentTarget)}
            >
              <Avatar className="profile-card__avatar">{user?.name?.slice(0, 1) || 'A'}</Avatar>
              <div className="profile-card__info">
                <strong>{user?.name}</strong>
                <span>{profileStatus}</span>
              </div>
            </ListItemButton>
          </Tooltip>
        </div>
        <Divider className="sidebar-divider" />

        <div className="sidebar-menu-wrapper">
          {menu.map((group) => {
            const groupExpanded = drawerCollapsed || openGroups[group.key] !== false;
            return (
              <List
                className="sidebar-menu-list"
                key={group.key}
                subheader={
                  <ListSubheader component="div" className="sidebar-subheader" disableSticky>
                    <button
                      type="button"
                      className="sidebar-group-toggle"
                      onClick={() =>
                        setOpenGroups((current) => ({
                          ...current,
                          [group.key]: current[group.key] === false,
                        }))
                      }
                      aria-expanded={groupExpanded}
                    >
                      <span>{group.section}</span>
                      {groupExpanded ? <ExpandLessRounded /> : <ExpandMoreRounded />}
                    </button>
                  </ListSubheader>
                }
              >
                <Collapse in={groupExpanded} timeout="auto" unmountOnExit>
                  {group.items.map((item) => {
                    const active = location.pathname === item.path;
                    return (
                      <ListItem disablePadding className="sidebar-list-item" key={item.path}>
                        <Tooltip placement="left" title={drawerCollapsed ? item.label : ''}>
                          <ListItemButton
                            className="sidebar-item-btn"
                            selected={active}
                            aria-current={active ? 'page' : undefined}
                            ref={active ? activeItemRef : undefined}
                            onClick={() => go(item.path)}
                          >
                            <ListItemIcon className="sidebar-item-icon">{item.icon}</ListItemIcon>
                            <ListItemText primary={item.label} className="sidebar-item-text" />
                          </ListItemButton>
                        </Tooltip>
                      </ListItem>
                    );
                  })}
                </Collapse>
              </List>
            );
          })}
        </div>

        <div className="sidebar-toggle-container">
          <Tooltip placement="left" title={drawerCollapsed ? 'توسيع القائمة' : 'تصغير القائمة'}>
            <IconButton
              className="sidebar-toggle-button"
              onClick={() => setCollapsed((value) => !value)}
            >
              {drawerCollapsed ? <MenuRounded /> : <MenuOpenRounded />}
            </IconButton>
          </Tooltip>
        </div>
      </div>
    );
  };

  return (
    <Box className={layoutClass}>
      <AppBar position="fixed" className="main-layout__appbar">
        <Toolbar className="main-layout__toolbar">
          <IconButton
            className="main-layout__mobile-menu"
            edge="start"
            onClick={() => setMobileOpen((value) => !value)}
            aria-label={mobileOpen ? 'إغلاق القائمة' : 'فتح القائمة'}
            aria-expanded={mobileOpen}
          >
            <MenuRounded />
          </IconButton>
          <div className="main-layout__page-caption">
            <Typography component="strong">{pageTitle}</Typography>
            <Typography component="span">{pageSubtitle}</Typography>
          </div>
          <div className="main-layout__actions">
            {!isAdmin && currentShift?.status === 'OPEN' && (
              <Chip
                className="main-layout__shift-chip"
                size="small"
                color="success"
                variant="outlined"
                label={`شيفت #${currentShift.id}`}
              />
            )}
            <Tooltip title={mode === 'light' ? 'الوضع الداكن' : 'الوضع الفاتح'}>
              <IconButton
                onClick={toggleColorMode}
                aria-label={mode === 'light' ? 'تفعيل الوضع الداكن' : 'تفعيل الوضع الفاتح'}
              >
                {mode === 'light' ? <DarkModeRounded /> : <LightModeRounded />}
              </IconButton>
            </Tooltip>
            <Tooltip title="الحساب">
              <IconButton
                onClick={(event) => setProfileAnchor(event.currentTarget)}
                aria-label="فتح قائمة الحساب"
              >
                <Badge color="success" variant="dot" overlap="circular">
                  <Avatar className="main-layout__avatar">{user?.name?.slice(0, 1) || 'A'}</Avatar>
                </Badge>
              </IconButton>
            </Tooltip>
          </div>
        </Toolbar>
      </AppBar>

      <Box component="nav" className="main-layout__sidebar-nav" aria-label="القائمة الرئيسية">
        <Drawer
          variant="temporary"
          anchor={drawerAnchor}
          open={mobileOpen}
          onClose={() => setMobileOpen(false)}
          className="main-layout__mobile-drawer"
          slotProps={{
            root: { keepMounted: true },
            paper: { className: 'main-layout__mobile-drawer-paper' },
          }}
        >
          {renderDrawer({ mobile: true })}
        </Drawer>
        <Drawer
          variant="permanent"
          anchor={drawerAnchor}
          open
          className="main-layout__desktop-drawer"
          slotProps={{
            paper: { className: 'main-layout__desktop-drawer-paper' },
          }}
        >
          {renderDrawer()}
        </Drawer>
      </Box>

      <Box component="main" className="main-layout__main">
        <Toolbar className="main-layout__content-spacer" />
        <div className="main-layout__content">
          <Breadcrumbs />
          <Outlet />
        </div>
        <footer className="main-layout__footer">{APP_CONFIG.brandName}</footer>
      </Box>

      <Menu
        anchorEl={profileAnchor}
        open={Boolean(profileAnchor)}
        onClose={() => setProfileAnchor(null)}
        transformOrigin={{ horizontal: 'left', vertical: 'top' }}
        anchorOrigin={{ horizontal: 'left', vertical: 'bottom' }}
      >
        <Box className="user-menu-header">
          <Typography className="user-menu-header__name">{user?.name}</Typography>
          <Typography className="user-menu-header__role">
            @{user?.username} · {user?.role === 'Admin' ? 'مدير النظام' : 'كاشير'}
          </Typography>
        </Box>
        <Divider />
        <MenuItem className="user-menu-item user-menu-item--logout" onClick={handleLogout}>
          <LogoutRounded fontSize="small" />
          <span>تسجيل الخروج</span>
        </MenuItem>
      </Menu>
    </Box>
  );
}

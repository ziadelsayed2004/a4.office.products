import { useEffect, useMemo, useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  Avatar, Badge, Box, Chip, IconButton, Menu, MenuItem, Tooltip, Typography
} from '@mui/material';
import {
  AssessmentRounded, BadgeRounded, CategoryRounded, DashboardRounded, DarkModeRounded,
  GroupsRounded, Inventory2Rounded, LightModeRounded, MenuOpenRounded,
  MenuRounded, PaymentsRounded, PointOfSaleRounded, PrintRounded, ReceiptLongRounded,
  SellRounded, ShoppingBasketRounded, SwapHorizRounded, LogoutRounded,
  AccountCircleRounded, HistoryRounded, EventAvailableRounded
} from '@mui/icons-material';
import { useAuth } from '../app/AuthContext.jsx';
import { useAppTheme } from '../theme/AppTheme.jsx';
import { t } from '../locales/t.js';
import logo from '../assets/a4-logo.png';
import '../styles/layout.css';

const titles = {
  '/': ['لوحة التحكم', 'ملخص سريع لحالة المبيعات والمخزون والحجوزات'],
  '/pos': ['نقطة البيع', 'بيع مباشر أو إنشاء واستلام حجز مسبق'],
  '/shift-summary': ['شيفتي الحالية', 'متابعة حركات الشيفت وطلب التقفيل'],
  '/receipts': ['الإيصالات', 'البحث عن الإيصالات وعرضها وإعادة طباعتها'],
  '/products': ['المنتجات', 'إدارة المنتجات والأسعار وخصائص الحجز'],
  '/categories': ['التصنيفات', 'تنظيم المنتجات داخل تصنيفات واضحة'],
  '/price-tiers': ['فئات الأسعار', 'إدارة أسعار القطاعي والجملة والفئات الخاصة'],
  '/inventory': ['المخزون', 'متابعة الرصيد الفعلي وحركات التسوية'],
  '/preorders': ['الحجوزات المسبقة', 'متابعة الحجز من العربون حتى الاستلام'],
  '/customers': ['العملاء', 'بيانات عملاء الحجوزات المسبقة'],
  '/payments': ['طرق الدفع', 'تفعيل طرق الدفع المتاحة داخل الكاشير'],
  '/shifts': ['مراجعة الشيفتات', 'اعتماد أو رفض طلبات تقفيل الكاشير'],
  '/users': ['المستخدمون', 'إدارة حسابات الأدمن والكاشير'],
  '/reports': ['التقارير', 'تقارير المبيعات والحجوزات والمخزون والشيفتات'],
  '/logs': ['سجل العمليات', 'تتبع كل العمليات الحساسة داخل النظام'],
  '/printer-settings': ['إعدادات الطباعة', 'إعدادات ريسيت البيع وملصقات المنتجات']
};

export function MainLayout() {
  const { user, isAdmin, currentShift, logout } = useAuth();
  const { mode, toggleMode } = useAppTheme();
  const location = useLocation();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem('a4_sidebar_collapsed') === '1');
  const [mobileOpen, setMobileOpen] = useState(false);
  const [profileAnchor, setProfileAnchor] = useState(null);

  useEffect(() => {
    localStorage.setItem('a4_sidebar_collapsed', collapsed ? '1' : '0');
  }, [collapsed]);

  useEffect(() => {
    setMobileOpen(false);
    setProfileAnchor(null);
  }, [location.pathname]);

  useEffect(() => {
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') setMobileOpen(false);
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, []);

  const menu = useMemo(() => {
    const cashier = [{ section: t('nav.cashier'), items: [
      { label: t('nav.pos'), path: '/pos', icon: <PointOfSaleRounded/> },
      { label: t('nav.currentShift'), path: '/shift-summary', icon: <EventAvailableRounded/> },
      { label: t('nav.receipts'), path: '/receipts', icon: <ReceiptLongRounded/> }
    ] }];
    if (!isAdmin) return cashier;
    return [
      { section: t('nav.home'), items: [{ label: t('nav.dashboard'), path: '/', icon: <DashboardRounded/> }] },
      ...cashier,
      { section: t('nav.catalog'), items: [
        { label: t('nav.products'), path: '/products', icon: <ShoppingBasketRounded/> },
        { label: t('nav.categories'), path: '/categories', icon: <CategoryRounded/> },
        { label: t('nav.priceTiers'), path: '/price-tiers', icon: <SellRounded/> },
        { label: t('nav.inventory'), path: '/inventory', icon: <Inventory2Rounded/> }
      ]},
      { section: t('nav.operations'), items: [
        { label: t('nav.preorders'), path: '/preorders', icon: <BadgeRounded/> },
        { label: t('nav.customers'), path: '/customers', icon: <GroupsRounded/> },
        { label: t('nav.payments'), path: '/payments', icon: <PaymentsRounded/> }
      ]},
      { section: t('nav.management'), items: [
        { label: t('nav.shifts'), path: '/shifts', icon: <SwapHorizRounded/> },
        { label: t('nav.users'), path: '/users', icon: <AccountCircleRounded/> },
        { label: t('nav.reports'), path: '/reports', icon: <AssessmentRounded/> },
        { label: t('nav.audit'), path: '/logs', icon: <HistoryRounded/> },
        { label: t('nav.printers'), path: '/printer-settings', icon: <PrintRounded/> }
      ]}
    ];
  }, [isAdmin]);

  const go = (path) => { navigate(path); setMobileOpen(false); };
  const [pageTitle, pageSubtitle] = titles[location.pathname] || ['منصة A4', 'إدارة المكتبة'];
  const shellClass = ['app-shell', collapsed ? 'is-collapsed' : '', mobileOpen ? 'is-mobile-open' : ''].filter(Boolean).join(' ');

  return <div className={shellClass}>
    <header className="app-topbar">
      <div className="app-topbar__brand">
        <IconButton className="hide-desktop" onClick={() => setMobileOpen(v => !v)} aria-label={mobileOpen ? "إغلاق القائمة" : "فتح القائمة"} aria-expanded={mobileOpen}><MenuRounded/></IconButton>
        <img className="app-brand-logo" src={logo} alt="A4 Office Products"/>
        <div className="app-brand-copy"><strong>A4 Office Products</strong><span>منصة إدارة المكتبة</span></div>
      </div>
      <div className="app-topbar__content">
        <div className="app-page-caption"><strong>{pageTitle}</strong><span>{pageSubtitle}</span></div>
        <div className="app-topbar__actions">
          {currentShift?.status === 'OPEN' && <Chip className="hide-mobile" size="small" color="success" variant="outlined" label={`شيفت #${currentShift.id}`}/>}          
          <Tooltip title={mode === 'light' ? 'الوضع الداكن' : 'الوضع الفاتح'}><IconButton onClick={toggleMode}>{mode === 'light' ? <DarkModeRounded/> : <LightModeRounded/>}</IconButton></Tooltip>
          <Tooltip title="الحساب"><IconButton onClick={(e) => setProfileAnchor(e.currentTarget)}><Badge color="success" variant="dot" overlap="circular"><Avatar sx={{ width: 34, height: 34, bgcolor: 'primary.main', fontSize: '.78rem' }}>{user?.name?.slice(0, 1) || 'A'}</Avatar></Badge></IconButton></Tooltip>
          <Menu anchorEl={profileAnchor} open={Boolean(profileAnchor)} onClose={() => setProfileAnchor(null)} transformOrigin={{ horizontal: 'left', vertical: 'top' }} anchorOrigin={{ horizontal: 'left', vertical: 'bottom' }}>
            <Box sx={{ px: 2, py: 1.1, minWidth: 210 }}><Typography fontWeight={800} fontSize=".8rem">{user?.name}</Typography><Typography color="text.secondary" fontSize=".68rem">@{user?.username} · {user?.role === 'Admin' ? 'مدير النظام' : 'كاشير'}</Typography></Box>
            <MenuItem onClick={async () => { setProfileAnchor(null); await logout(); navigate('/login'); }}><LogoutRounded fontSize="small" sx={{ marginInlineEnd: 1 }}/><span>تسجيل الخروج</span></MenuItem>
          </Menu>
        </div>
      </div>
    </header>

    <aside className="app-sidebar" aria-label="القائمة الرئيسية">
      <div className="app-sidebar__profile"><div className="app-profile-card"><Avatar sx={{ width: 35, height: 35, bgcolor: 'primary.main', fontSize: '.78rem' }}>{user?.name?.slice(0,1)}</Avatar><div className="app-profile-card__copy"><strong>{user?.name}</strong><span>{user?.username} · {user?.role === 'Admin' ? 'مدير' : 'كاشير'}</span></div></div></div>
      <nav className="app-sidebar__scroll">
        {menu.map((group) => <section className="app-sidebar__section" key={group.section}><div className="app-sidebar__heading">{group.section}</div>{group.items.map((item) => {
          const active = location.pathname === item.path;
          return <Tooltip placement="left" title={collapsed ? item.label : ''} key={item.path}><button type="button" className={`app-nav-item ${active ? 'is-active' : ''}`} aria-current={active ? 'page' : undefined} onClick={() => go(item.path)}>{item.icon}<span>{item.label}</span></button></Tooltip>;
        })}</section>)}
      </nav>
      <div className="app-sidebar__footer">
        <Tooltip placement="left" title={collapsed ? 'توسيع القائمة' : 'تصغير القائمة'}>
          <button type="button" className="app-nav-item app-sidebar-toggle" onClick={() => setCollapsed(v => !v)}>
            {collapsed ? <MenuRounded/> : <MenuOpenRounded/>}
            <span>{collapsed ? 'توسيع القائمة' : 'تصغير القائمة'}</span>
          </button>
        </Tooltip>
      </div>
    </aside>

    <button type="button" className="app-mobile-overlay" aria-label="إغلاق القائمة" tabIndex={mobileOpen ? 0 : -1} onClick={() => setMobileOpen(false)}/>
    <main className="app-main"><Outlet/></main>
  </div>;
}

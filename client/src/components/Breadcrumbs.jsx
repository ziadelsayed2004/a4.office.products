import { Breadcrumbs as MuiBreadcrumbs, Link, Typography } from '@mui/material';
import { ChevronLeftRounded, HomeRounded } from '@mui/icons-material';
import { Link as RouterLink, useLocation } from 'react-router-dom';
import { t } from '../locales/t.js';
import './Breadcrumbs.css';

const routeLabels = {
  '/': 'nav.dashboard',
  '/pos': 'nav.pos',
  '/shift-summary': 'nav.currentShift',
  '/receipts': 'nav.receipts',
  '/invoices': 'nav.invoices',
  '/products': 'nav.products',
  '/categories': 'nav.categories',
  '/price-tiers': 'nav.priceTiers',
  '/inventory': 'nav.inventory',
  '/preorders': 'nav.preorders',
  '/customers': 'nav.customers',
  '/payments': 'nav.payments',
  '/returns': 'nav.returns',
  '/shifts': 'nav.shifts',
  '/users': 'nav.users',
  '/reports': 'nav.reports',
  '/logs': 'nav.audit',
  '/notifications': 'nav.notifications',
  '/printer-settings': 'nav.printers',
};

function fallbackLabel(pathname) {
  const segment = pathname.split('/').filter(Boolean).at(-1);
  if (!segment) return t('nav.dashboard');

  try {
    return decodeURIComponent(segment).replaceAll('-', ' ');
  } catch {
    return segment.replaceAll('-', ' ');
  }
}

export function Breadcrumbs({ currentLabel, className = '' }) {
  const location = useLocation();

  if (location.pathname === '/login') return null;

  const normalizedPath = location.pathname !== '/' ? location.pathname.replace(/\/$/, '') : '/';
  const labelKey = routeLabels[normalizedPath];
  const resolvedLabel = currentLabel || (labelKey ? t(labelKey) : fallbackLabel(normalizedPath));

  return (
    <nav className={`breadcrumbs-container ${className}`.trim()} aria-label="مسار التنقل">
      <MuiBreadcrumbs
        className="breadcrumbs-list"
        separator={<ChevronLeftRounded fontSize="small" />}
      >
        <Link
          className="breadcrumbs-link"
          component={RouterLink}
          underline="hover"
          color="inherit"
          to="/"
        >
          <HomeRounded className="breadcrumbs-home-icon" />
          {t('nav.home')}
        </Link>
        <Typography className="breadcrumbs-current">{resolvedLabel}</Typography>
      </MuiBreadcrumbs>
    </nav>
  );
}

export default Breadcrumbs;

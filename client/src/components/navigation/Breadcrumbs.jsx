import React from 'react';
import { useLocation, Link as RouterLink } from 'react-router-dom';
import { Breadcrumbs as MuiBreadcrumbs, Link, Typography, Box } from '@mui/material';
import NavigateBeforeIcon from '@mui/icons-material/NavigateBefore';
import NavigateNextIcon from '@mui/icons-material/NavigateNext';
import HomeIcon from '@mui/icons-material/Home';
import { useLanguage } from '../../i18n/config.js';
import './Breadcrumbs.css';

const getBreadcrumbLabelKey = (name) => {
  const routeKeyMap = {
    'users': 'nav.users',
    'categories': 'nav.categories',
    'price-tiers': 'nav.priceTiers',
    'products': 'nav.products',
    'inventory': 'nav.inventory',
    'payments': 'nav.payments',
    'customers': 'nav.customers',
    'pos': 'nav.pos',
    'receipts': 'nav.receipts',
    'shifts': 'nav.shifts',
    'shift-summary': 'nav.shiftSummary',
    'preorders': 'nav.preorders',
    'reports': 'nav.reports',
    'printer-settings': 'nav.printerSettings',
    'logs': 'nav.logs'
  };
  return routeKeyMap[name] || '';
};

export const Breadcrumbs = () => {
  const location = useLocation();
  const { t, dir } = useLanguage();
  const pathnames = location.pathname.split('/').filter((x) => x);

  if (location.pathname === '/login') {
    return null;
  }

  const separator = dir === 'rtl' ? <NavigateBeforeIcon fontSize="small" /> : <NavigateNextIcon fontSize="small" />;

  return (
    <Box className="breadcrumbs-container">
      <MuiBreadcrumbs
        separator={separator}
        aria-label="breadcrumb"
        className="breadcrumbs-list"
        sx={{
          '& .MuiBreadcrumbs-ol': {
            flexDirection: dir === 'rtl' ? 'row' : 'row',
            justifyContent: 'flex-start'
          }
        }}
      >
        <Link
          component={RouterLink}
          underline="hover"
          color="inherit"
          to="/"
          className="breadcrumbs-link"
        >
          <HomeIcon className="breadcrumbs-home-icon" sx={{ ml: dir === 'rtl' ? 0.5 : 0, mr: dir === 'ltr' ? 0.5 : 0 }} />
          {t('nav.mainSection')}
        </Link>
        {pathnames.map((name, index) => {
          const routeTo = `/${pathnames.slice(0, index + 1).join('/')}`;
          const isLast = index === pathnames.length - 1;
          const labelKey = getBreadcrumbLabelKey(name);
          const label = labelKey ? t(labelKey) : name;

          return isLast ? (
            <Typography key={name} className="breadcrumbs-current">
              {label}
            </Typography>
          ) : (
            <Link
              component={RouterLink}
              underline="hover"
              color="inherit"
              to={routeTo}
              key={name}
            >
              {label}
            </Link>
          );
        })}
      </MuiBreadcrumbs>
    </Box>
  );
};

export default Breadcrumbs;

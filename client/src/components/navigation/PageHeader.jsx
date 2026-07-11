import { ChevronLeft, HomeRounded } from '@mui/icons-material';
import { useLocation } from 'react-router-dom';
import { t } from '../../locales/t.js';

const labels = {
  '/': 'nav.dashboard', '/pos': 'nav.pos', '/shift-summary': 'nav.currentShift', '/receipts': 'nav.receipts',
  '/products': 'nav.products', '/categories': 'nav.categories', '/price-tiers': 'nav.priceTiers', '/inventory': 'nav.inventory',
  '/preorders': 'nav.preorders', '/customers': 'nav.customers', '/payments': 'nav.payments', '/shifts': 'nav.shifts', '/users': 'nav.users',
  '/reports': 'nav.reports', '/logs': 'nav.audit', '/printer-settings': 'nav.printers'
};

export function PageHeader({ title, description, actions }) {
  const location = useLocation();
  return <header className="page-header">
    <div className="page-header__copy">
      <div className="breadcrumbs"><HomeRounded fontSize="inherit"/><span>{t('nav.home')}</span><ChevronLeft fontSize="inherit"/><span>{t(labels[location.pathname] || '', title)}</span></div>
      <h1 className="page-header__title">{title}</h1>
      {description && <p className="page-header__description">{description}</p>}
    </div>
    {actions && <div className="page-header__actions">{actions}</div>}
  </header>;
}

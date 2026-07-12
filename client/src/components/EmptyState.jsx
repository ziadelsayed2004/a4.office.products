import { InboxRounded } from '@mui/icons-material';
import './EmptyState.css';

export function EmptyState({
  title = 'لا توجد بيانات',
  description = 'لا توجد سجلات مطابقة للعرض حالياً.',
  action,
  icon,
}) {
  return (
    <div className="empty-state" role="status">
      <div className="empty-state__icon" aria-hidden="true">
        {icon || <InboxRounded />}
      </div>
      <strong className="empty-state__title">{title}</strong>
      <p className="empty-state__description">{description}</p>
      {action && <div className="empty-state__action">{action}</div>}
    </div>
  );
}

export default EmptyState;

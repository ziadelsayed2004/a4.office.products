import { InboxRounded } from '@mui/icons-material';
export function EmptyState({ title = 'لا توجد بيانات', description = 'لا توجد سجلات مطابقة للعرض حالياً.', action }) { return <div className="empty-state"><div className="empty-state__icon"><InboxRounded/></div><strong>{title}</strong><span>{description}</span>{action}</div>; }

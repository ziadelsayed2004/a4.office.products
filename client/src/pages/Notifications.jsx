import { useEffect, useRef, useState } from 'react';
import { Alert, Button, Chip, Pagination, ToggleButton, ToggleButtonGroup } from '@mui/material';
import {
  CheckCircleRounded,
  DoneAllRounded,
  ErrorRounded,
  InfoRounded,
  NotificationsNoneRounded,
  OpenInNewRounded,
  RefreshRounded,
  WarningAmberRounded,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '../components/PageHeader.jsx';
import { EmptyState } from '../components/EmptyState.jsx';
import { LoadingState } from '../components/LoadingState.jsx';
import {
  getAdminNotifications,
  markAdminNotificationRead,
  markAllAdminNotificationsRead,
} from '../services/adminNotifications.js';
import { dateTime } from '../utils/formatters.js';
import '../styles/Notifications.css';

const PAGE_SIZE = 20;

const severityMeta = Object.freeze({
  INFO: { label: 'معلومة', icon: <InfoRounded /> },
  SUCCESS: { label: 'تم بنجاح', icon: <CheckCircleRounded /> },
  WARNING: { label: 'تنبيه', icon: <WarningAmberRounded /> },
  ERROR: { label: 'هام', icon: <ErrorRounded /> },
});

export default function Notifications() {
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [unreadCount, setUnreadCount] = useState(0);
  const [filter, setFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const requestSequence = useRef(0);

  const load = async (nextPage = page, nextFilter = filter) => {
    const requestId = ++requestSequence.current;
    setLoading(true);
    try {
      const data = await getAdminNotifications({
        limit: PAGE_SIZE,
        offset: (nextPage - 1) * PAGE_SIZE,
        unreadOnly: nextFilter === 'unread',
      });
      if (requestId !== requestSequence.current) return;
      setItems(data.notifications || []);
      setTotal(Number(data.pagination?.total || 0));
      setUnreadCount(Number(data.unreadCount || 0));
      setError('');
    } catch (loadError) {
      if (requestId === requestSequence.current) setError(loadError.message);
    } finally {
      if (requestId === requestSequence.current) setLoading(false);
    }
  };

  useEffect(() => {
    load(1, 'all');
    return () => {
      requestSequence.current += 1;
    };
  }, []);

  const changeFilter = (_event, nextFilter) => {
    if (!nextFilter) return;
    setFilter(nextFilter);
    setPage(1);
    load(1, nextFilter);
  };

  const readOne = async (item, { open = false } = {}) => {
    try {
      if (!item.is_read) await markAdminNotificationRead(item.id);
      setItems((current) =>
        filter === 'unread'
          ? current.filter((candidate) => candidate.id !== item.id)
          : current.map((candidate) =>
              candidate.id === item.id ? { ...candidate, is_read: true } : candidate
            )
      );
      if (!item.is_read) {
        setUnreadCount((value) => Math.max(0, value - 1));
        if (filter === 'unread') setTotal((value) => Math.max(0, value - 1));
      }
      if (open && item.action_path) navigate(item.action_path);
    } catch (readError) {
      setError(readError.message);
    }
  };

  const readAll = async () => {
    try {
      await markAllAdminNotificationsRead();
      setUnreadCount(0);
      if (filter === 'unread') {
        setItems([]);
        setTotal(0);
      } else {
        setItems((current) => current.map((item) => ({ ...item, is_read: true })));
      }
    } catch (readError) {
      setError(readError.message);
    }
  };

  const changePage = (_event, nextPage) => {
    setPage(nextPage);
    load(nextPage, filter);
  };

  return (
    <div className="a4-page notifications-page">
      <PageHeader
        title="الإشعارات"
        description="متابعة الأحداث التشغيلية التي تحتاج انتباه أو مراجعة من الأدمن."
        actions={
          <div className="notifications-page__header-actions">
            <Button variant="outlined" startIcon={<RefreshRounded />} onClick={() => load()}>
              تحديث
            </Button>
            <Button
              variant="contained"
              startIcon={<DoneAllRounded />}
              onClick={readAll}
              disabled={unreadCount === 0}
            >
              قراءة الكل
            </Button>
          </div>
        }
      />

      <section className="notifications-page__toolbar">
        <ToggleButtonGroup exclusive size="small" value={filter} onChange={changeFilter}>
          <ToggleButton value="all">كل الإشعارات</ToggleButton>
          <ToggleButton value="unread">غير المقروء ({unreadCount})</ToggleButton>
        </ToggleButtonGroup>
        <span>{total} إشعار</span>
      </section>

      {error && <Alert severity="error">{error}</Alert>}
      {loading ? (
        <LoadingState label="جاري تحميل الإشعارات..." />
      ) : items.length === 0 ? (
        <EmptyState
          icon={<NotificationsNoneRounded />}
          title={filter === 'unread' ? 'لا توجد إشعارات غير مقروءة' : 'لا توجد إشعارات بعد'}
          description="ستظهر هنا تنبيهات الشيفتات والحجوزات والمرتجعات المهمة."
        />
      ) : (
        <section className="notifications-list">
          {items.map((item) => {
            const meta = severityMeta[item.severity] || severityMeta.INFO;
            return (
              <article
                className={`notification-card notification-card--${item.severity.toLowerCase()} ${item.is_read ? 'is-read' : 'is-unread'}`}
                key={item.id}
              >
                <div className="notification-card__icon" aria-hidden="true">
                  {meta.icon}
                </div>
                <div className="notification-card__body">
                  <div className="notification-card__heading">
                    <strong>{item.title}</strong>
                    {!item.is_read && <span className="notification-card__unread-dot" />}
                  </div>
                  <p>{item.message}</p>
                  <div className="notification-card__meta">
                    <Chip size="small" label={meta.label} />
                    <span>{dateTime(item.created_at)}</span>
                    {item.actor_name && <span>بواسطة {item.actor_name}</span>}
                  </div>
                </div>
                <div className="notification-card__actions">
                  {!item.is_read && (
                    <Button
                      size="small"
                      startIcon={<DoneAllRounded />}
                      onClick={() => readOne(item)}
                    >
                      كمقروء
                    </Button>
                  )}
                  {item.action_path && (
                    <Button
                      size="small"
                      variant="outlined"
                      startIcon={<OpenInNewRounded />}
                      onClick={() => readOne(item, { open: true })}
                    >
                      فتح
                    </Button>
                  )}
                </div>
              </article>
            );
          })}
        </section>
      )}

      {!loading && total > PAGE_SIZE && (
        <div className="notifications-page__pagination">
          <Pagination
            color="primary"
            count={Math.ceil(total / PAGE_SIZE)}
            page={page}
            onChange={changePage}
          />
        </div>
      )}
    </div>
  );
}

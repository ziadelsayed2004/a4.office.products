import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Button,
  Chip,
  CircularProgress,
  List,
  ListItemButton,
  ListItemText,
} from '@mui/material';
import {
  AssignmentReturnRounded,
  AttachMoneyRounded,
  CheckCircleRounded,
  ErrorRounded,
  InfoRounded,
  NotificationsNoneRounded,
  NotificationsRounded,
  OpenInNewRounded,
  PointOfSaleRounded,
  ReceiptLongRounded,
  RefreshRounded,
  SwapHorizRounded,
  TrendingUpRounded,
  WarningAmberRounded,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '../components/PageHeader.jsx';
import { MetricCard } from '../components/MetricCard.jsx';
import { LoadingState } from '../components/LoadingState.jsx';
import { useAdminLiveOverview } from '../hooks/useAdminLiveOverview.js';
import {
  ADMIN_NOTIFICATIONS_CHANGED_EVENT,
  getAdminNotifications,
  markAdminNotificationRead,
} from '../services/adminNotifications.js';
import { dateTime, money, number } from '../utils/formatters.js';
import '../styles/Dashboard.css';

function first(...values) {
  return values.find((value) => value !== undefined && value !== null);
}

function normalizedOverview(data = {}) {
  const summary = data.summary || data.today || data;
  return {
    generatedAt: data.generatedAt || data.generated_at,
    summary: {
      grossSales: Number(first(summary.grossSales, summary.totalSales, summary.total_sales, 0)),
      refunds: Number(first(summary.refunds, summary.totalRefunds, summary.total_refunds, 0)),
      netSales: Number(
        first(
          summary.netSales,
          summary.netAfterRefunds,
          summary.net_after_returns,
          Number(first(summary.grossSales, summary.totalSales, summary.total_sales, 0)) -
            Number(first(summary.refunds, summary.totalRefunds, summary.total_refunds, 0))
        )
      ),
      invoiceCount: Number(first(summary.invoiceCount, summary.salesCount, summary.sales_count, 0)),
      averageTicket: Number(first(summary.averageTicket, summary.average_ticket, 0)),
      totalDeposits: Number(first(summary.totalDeposits, summary.total_deposits, 0)),
    },
    openShifts: data.openShifts || data.activeShifts || data.open_shifts || [],
    recentActivity: data.recentActivity || data.recent_activity || [],
    alerts: data.alerts || {},
  };
}

function connectionLabel(connection) {
  return (
    {
      live: 'مباشر',
      connecting: 'جاري الاتصال',
      fallback: 'تحديث احتياطي',
      paused: 'متوقف مؤقتاً',
    }[connection] || 'غير متصل'
  );
}

function activityMeta(activity) {
  const type = String(activity.type || activity.activityType || '').toUpperCase();
  const isReturn = type.includes('RETURN') || activity.returnNumber || activity.return_number;
  return {
    isReturn,
    number:
      activity.returnNumber ||
      activity.return_number ||
      activity.invoiceNumber ||
      activity.invoice_number ||
      `#${activity.id || '—'}`,
  };
}

const notificationIcons = Object.freeze({
  INFO: <InfoRounded />,
  SUCCESS: <CheckCircleRounded />,
  WARNING: <WarningAmberRounded />,
  ERROR: <ErrorRounded />,
});

export default function Dashboard() {
  const navigate = useNavigate();
  const { data, loading, error, connection, lastUpdated, refresh } = useAdminLiveOverview();
  const [notifications, setNotifications] = useState([]);
  const [notificationsUnreadCount, setNotificationsUnreadCount] = useState(0);
  const [notificationsLoading, setNotificationsLoading] = useState(true);
  const [notificationsError, setNotificationsError] = useState('');
  const overview = normalizedOverview(data || {});
  const summary = overview.summary;
  const pendingShifts = Number(
    first(overview.alerts.pendingShifts, overview.alerts.pendingShiftReviews, 0)
  );

  const loadNotifications = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setNotificationsLoading(true);
    try {
      const notificationData = await getAdminNotifications({ limit: 3 });
      setNotifications(notificationData.notifications || []);
      setNotificationsUnreadCount(Number(notificationData.unreadCount || 0));
      setNotificationsError('');
    } catch (loadError) {
      setNotificationsError(loadError.message);
    } finally {
      if (!silent) setNotificationsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadNotifications();
    const reloadNotifications = () => loadNotifications({ silent: true });
    const interval = window.setInterval(reloadNotifications, 30_000);
    window.addEventListener(ADMIN_NOTIFICATIONS_CHANGED_EVENT, reloadNotifications);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener(ADMIN_NOTIFICATIONS_CHANGED_EVENT, reloadNotifications);
    };
  }, [loadNotifications]);

  useEffect(() => {
    if (overview.generatedAt) loadNotifications({ silent: true });
  }, [overview.generatedAt, loadNotifications]);

  const openNotification = async (notification) => {
    try {
      if (!notification.is_read) {
        await markAdminNotificationRead(notification.id);
        setNotifications((current) =>
          current.map((item) => (item.id === notification.id ? { ...item, is_read: true } : item))
        );
        setNotificationsUnreadCount((value) => Math.max(0, value - 1));
      }
      navigate(notification.action_path || '/notifications');
    } catch (readError) {
      setNotificationsError(readError.message);
    }
  };

  const refreshDashboard = () => {
    refresh();
    loadNotifications();
  };

  return (
    <div className="a4-page dashboard-live-page">
      <PageHeader
        title="لوحة التحكم المباشرة"
        description="مبيعات اليوم، الشيفتات المفتوحة وآخر العمليات بتحديث تلقائي."
        actions={
          <>
            <Chip
              size="small"
              variant="outlined"
              color={
                connection === 'live'
                  ? 'success'
                  : connection === 'fallback'
                    ? 'warning'
                    : 'default'
              }
              label={connectionLabel(connection)}
            />
            <Button
              variant="outlined"
              startIcon={<RefreshRounded />}
              onClick={refreshDashboard}
              disabled={loading}
            >
              تحديث
            </Button>
          </>
        }
      />

      {error && (
        <Alert severity={data ? 'warning' : 'error'}>
          {error}
          {data ? ' تظل آخر لقطة صحيحة ظاهرة حتى عودة الاتصال.' : ''}
        </Alert>
      )}

      {loading && !data ? (
        <LoadingState label="جاري تحميل لوحة التشغيل..." />
      ) : (
        <>
          <div className="a4-grid a4-grid--metrics dashboard-live-metrics">
            <MetricCard
              icon={<AttachMoneyRounded />}
              label="إجمالي مبيعات اليوم"
              value={money(summary.grossSales)}
              hint={`${number(summary.invoiceCount)} فاتورة`}
            />
            <MetricCard
              icon={<AssignmentReturnRounded />}
              label="مرتجعات اليوم"
              value={money(summary.refunds)}
              hint="مخصومة من الصافي"
            />
            <MetricCard
              icon={<TrendingUpRounded />}
              label="الصافي بعد المرتجعات"
              value={money(summary.netSales)}
              hint={`متوسط الفاتورة ${money(summary.averageTicket)}`}
            />
            <MetricCard
              icon={<SwapHorizRounded />}
              label="شيفتات مفتوحة"
              value={number(overview.openShifts.length)}
              hint={`${number(pendingShifts)} بانتظار المراجعة`}
            />
          </div>

          <section className="a4-page-section dashboard-notifications-panel">
            <div className="dashboard-panel-heading dashboard-notifications-panel__heading">
              <div>
                <div className="dashboard-notifications-panel__title-row">
                  <NotificationsRounded />
                  <h2 className="a4-section-title">أحدث الإشعارات</h2>
                  {notificationsUnreadCount > 0 && (
                    <Chip
                      size="small"
                      color="error"
                      label={`${number(notificationsUnreadCount)} غير مقروء`}
                    />
                  )}
                </div>
                <p className="a4-section-subtitle">
                  آخر التنبيهات التشغيلية المرتبطة بمركز الإشعارات.
                </p>
              </div>
              <Button
                size="small"
                variant="outlined"
                endIcon={<OpenInNewRounded />}
                onClick={() => navigate('/notifications')}
              >
                قراءة المزيد
              </Button>
            </div>

            {notificationsError && <Alert severity="warning">{notificationsError}</Alert>}

            {notificationsLoading && notifications.length === 0 ? (
              <div className="dashboard-notifications-panel__state">
                <CircularProgress size={24} />
                <span>جاري تحميل الإشعارات...</span>
              </div>
            ) : notifications.length === 0 ? (
              <div className="dashboard-notifications-panel__state">
                <NotificationsNoneRounded />
                <span>لا توجد إشعارات حتى الآن.</span>
              </div>
            ) : (
              <div className="dashboard-notifications-list">
                {notifications.map((notification) => (
                  <button
                    type="button"
                    className={`dashboard-notification-item dashboard-notification-item--${String(notification.severity || 'INFO').toLowerCase()} ${notification.is_read ? 'is-read' : 'is-unread'}`}
                    key={notification.id}
                    onClick={() => openNotification(notification)}
                  >
                    <span className="dashboard-notification-item__icon" aria-hidden="true">
                      {notificationIcons[notification.severity] || notificationIcons.INFO}
                    </span>
                    <span className="dashboard-notification-item__content">
                      <span className="dashboard-notification-item__heading">
                        <strong>{notification.title}</strong>
                        {!notification.is_read && <i aria-label="غير مقروء" />}
                      </span>
                      <span>{notification.message}</span>
                      <small>{dateTime(notification.created_at)}</small>
                    </span>
                  </button>
                ))}
              </div>
            )}
          </section>

          <div className="dashboard-live-grid">
            <section className="a4-page-section dashboard-live-panel">
              <div className="dashboard-panel-heading">
                <div>
                  <h2 className="a4-section-title">من يعمل الآن</h2>
                  <p className="a4-section-subtitle">
                    المصدر المالي هو الشيفت المفتوح؛ الاتصال يظهر بشكل مستقل.
                  </p>
                </div>
                <Button size="small" onClick={() => navigate('/shifts?status=OPEN')}>
                  كل الشيفتات
                </Button>
              </div>
              {overview.openShifts.length ? (
                <div className="dashboard-shifts-list">
                  {overview.openShifts.map((shift) => {
                    const payments = shift.paymentBreakdown || shift.payment_breakdown || {};
                    return (
                      <button
                        className="dashboard-shift-card"
                        type="button"
                        key={shift.id}
                        onClick={() => navigate(`/shifts?shiftId=${shift.id}`)}
                      >
                        <div className="dashboard-shift-card__heading">
                          <div>
                            <strong>{shift.cashierName || shift.cashier_name}</strong>
                            <span className="a4-ltr">#{shift.id}</span>
                          </div>
                          <Chip
                            size="small"
                            color={shift.isOnline || shift.is_online ? 'success' : 'default'}
                            variant="outlined"
                            label={shift.isOnline || shift.is_online ? 'متصل الآن' : 'غير متصل'}
                          />
                        </div>
                        <div className="dashboard-shift-card__metrics">
                          <span>
                            المبيعات <b>{money(first(shift.grossSales, shift.totalSales, 0))}</b>
                          </span>
                          <span>
                            المرتجع <b>{money(first(shift.refunds, shift.totalRefunds, 0))}</b>
                          </span>
                          <span>
                            الفواتير <b>{number(first(shift.invoiceCount, shift.salesCount, 0))}</b>
                          </span>
                        </div>
                        <small>
                          فتح {dateTime(shift.openedAt || shift.opened_at)} · آخر حركة{' '}
                          {dateTime(shift.lastActivityAt || shift.last_activity_at)}
                        </small>
                        {Object.keys(payments).length > 0 && (
                          <div className="dashboard-shift-card__payments">
                            {Object.entries(payments).map(([method, amount]) => (
                              <span key={method}>
                                {method}: {money(amount)}
                              </span>
                            ))}
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <Alert severity="info">لا يوجد شيفت مفتوح حالياً.</Alert>
              )}
            </section>

            <section className="a4-page-section dashboard-live-panel">
              <div className="dashboard-panel-heading">
                <div>
                  <h2 className="a4-section-title">آخر المبيعات والمرتجعات</h2>
                  <p className="a4-section-subtitle">تظهر بعد اكتمال المعاملة المالية.</p>
                </div>
                <Button size="small" onClick={() => navigate('/invoices')}>
                  مركز الفواتير
                </Button>
              </div>
              {overview.recentActivity.length ? (
                <List disablePadding className="dashboard-activity-list">
                  {overview.recentActivity.map((activity, index) => {
                    const meta = activityMeta(activity);
                    return (
                      <ListItemButton
                        divider
                        key={`${meta.number}-${index}`}
                        onClick={() =>
                          navigate(
                            meta.isReturn
                              ? `/returns?search=${encodeURIComponent(meta.number)}`
                              : `/invoices?invoiceNumber=${encodeURIComponent(meta.number)}`
                          )
                        }
                      >
                        <div
                          className={`dashboard-activity-icon ${meta.isReturn ? 'is-return' : 'is-sale'}`}
                        >
                          {meta.isReturn ? <AssignmentReturnRounded /> : <ReceiptLongRounded />}
                        </div>
                        <ListItemText
                          primary={meta.isReturn ? `مرتجع ${meta.number}` : `فاتورة ${meta.number}`}
                          secondary={`${activity.cashierName || activity.cashier_name || '—'} · شيفت #${activity.shiftId || activity.shift_id || '—'} · ${dateTime(activity.createdAt || activity.created_at)}`}
                        />
                        <strong className={meta.isReturn ? 'dashboard-negative' : ''}>
                          {meta.isReturn ? '−' : ''}
                          {money(activity.amount)}
                        </strong>
                      </ListItemButton>
                    );
                  })}
                </List>
              ) : (
                <Alert severity="info">لا توجد عمليات مسجلة اليوم.</Alert>
              )}
            </section>
          </div>

          <p className="dashboard-last-updated">
            <PointOfSaleRounded fontSize="inherit" /> آخر تحديث:{' '}
            {dateTime(lastUpdated || overview.generatedAt)}
          </p>
        </>
      )}
    </div>
  );
}

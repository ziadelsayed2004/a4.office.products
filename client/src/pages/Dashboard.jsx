import { Alert, Button, Chip, List, ListItemButton, ListItemText } from '@mui/material';
import {
  AssignmentReturnRounded,
  AttachMoneyRounded,
  PointOfSaleRounded,
  ReceiptLongRounded,
  RefreshRounded,
  SwapHorizRounded,
  TrendingUpRounded,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '../components/PageHeader.jsx';
import { MetricCard } from '../components/MetricCard.jsx';
import { LoadingState } from '../components/LoadingState.jsx';
import { useAdminLiveOverview } from '../hooks/useAdminLiveOverview.js';
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

export default function Dashboard() {
  const navigate = useNavigate();
  const { data, loading, error, connection, lastUpdated, refresh } = useAdminLiveOverview();
  const overview = normalizedOverview(data || {});
  const summary = overview.summary;
  const pendingShifts = Number(
    first(overview.alerts.pendingShifts, overview.alerts.pendingShiftReviews, 0)
  );
  const lowStock = Number(first(overview.alerts.lowStock, overview.alerts.lowStockCount, 0));

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
              onClick={() => refresh()}
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

          {(pendingShifts > 0 || lowStock > 0) && (
            <div className="dashboard-alert-strip">
              {pendingShifts > 0 && (
                <Button
                  color="warning"
                  onClick={() => navigate('/shifts?status=PENDING_ADMIN_REVIEW')}
                >
                  {number(pendingShifts)} شيفت يحتاج مراجعة
                </Button>
              )}
              {lowStock > 0 && (
                <Button color="warning" onClick={() => navigate('/inventory')}>
                  {number(lowStock)} تنبيه مخزون
                </Button>
              )}
            </div>
          )}

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

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Button, MenuItem, Tab, Tabs, TextField } from '@mui/material';
import {
  AssessmentRounded,
  BadgeRounded,
  DownloadRounded,
  GroupsRounded,
  Inventory2Rounded,
  PaymentsRounded,
  PointOfSaleRounded,
  ReceiptLongRounded,
  RefreshRounded,
  SwapHorizRounded,
} from '@mui/icons-material';
import { api } from '../services/apiClient.js';
import { PageHeader } from '../components/PageHeader.jsx';
import { MetricCard } from '../components/MetricCard.jsx';
import { DataTable } from '../components/DataTable.jsx';
import { StatusChip } from '../components/StatusChip.jsx';
import { FilterPanel } from '../components/FilterPanel.jsx';
import { Field } from '../components/forms/Field.jsx';
import { LoadingState } from '../components/LoadingState.jsx';
import { AppSnackbar } from '../components/AppSnackbar.jsx';
import { dateTime, money, number, statusLabel } from '../utils/formatters.js';
import '../styles/Reports.css';

const reportTabs = [
  { id: 'sales', label: 'المبيعات', icon: <PointOfSaleRounded /> },
  { id: 'invoices', label: 'الفواتير', icon: <ReceiptLongRounded /> },
  { id: 'payments', label: 'المدفوعات', icon: <PaymentsRounded /> },
  { id: 'preorders', label: 'الحجوزات', icon: <BadgeRounded /> },
  { id: 'inventory', label: 'المخزون', icon: <Inventory2Rounded /> },
  { id: 'shifts', label: 'الشيفتات', icon: <SwapHorizRounded /> },
  { id: 'cashiers', label: 'الكاشير', icon: <GroupsRounded /> },
];

const initialFilters = {
  startDate: '',
  endDate: '',
  cashierId: '',
  shiftId: '',
  categoryId: '',
  status: '',
  search: '',
  invoiceNumber: '',
  receiptNumber: '',
  customer: '',
  stockStatus: '',
  paymentMethod: '',
  origin: '',
  direction: '',
  stage: '',
  productName: '',
  sku: '',
};

function buildQuery(filters) {
  return new URLSearchParams(
    Object.entries(filters)
      .filter(([, value]) => value !== '' && value !== null && value !== undefined)
      .map(([key, value]) => [key, String(value)])
  ).toString();
}

export default function Reports() {
  const [tab, setTab] = useState('sales');
  const [filters, setFilters] = useState(initialFilters);
  const [data, setData] = useState({ summary: {}, rows: [] });
  const [users, setUsers] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState('');
  const [toast, setToast] = useState(null);

  const loadReferences = useCallback(async () => {
    try {
      const [usersResponse, categoriesResponse] = await Promise.all([
        api.get('/api/admin/users'),
        api.get('/api/categories?activeOnly=false'),
      ]);
      setUsers((usersResponse.data || []).filter((user) => user.role === 'Cashier'));
      setCategories(categoriesResponse.data || []);
    } catch {
      // Reference filters are optional; the report itself can still be used.
    }
  }, []);

  const load = useCallback(
    async (activeTab = tab, activeFilters = filters) => {
      setLoading(true);
      setError('');
      try {
        const query = buildQuery(activeFilters);
        const response = await api.get(
          `/api/admin/reports/${activeTab}${query ? `?${query}` : ''}`
        );
        const payload = response.data || {};
        const rowKey =
          activeTab === 'sales'
            ? 'orders'
            : activeTab === 'preorders'
              ? 'preorders'
              : activeTab === 'inventory'
                ? 'products'
                : activeTab === 'shifts'
                  ? 'shifts'
                  : 'rows';
        setData({ summary: payload.summary || {}, rows: payload.rows || payload[rowKey] || [] });
      } catch (err) {
        setError(err.message);
        setData({ summary: {}, rows: [] });
      } finally {
        setLoading(false);
      }
    },
    [filters, tab]
  );

  useEffect(() => {
    loadReferences();
    load('sales', initialFilters);
  }, [loadReferences]);

  const changeTab = (_, nextTab) => {
    setTab(nextTab);
    setFilters(initialFilters);
    load(nextTab, initialFilters);
  };

  const reset = () => {
    setFilters(initialFilters);
    load(tab, initialFilters);
  };

  const exportCsv = async () => {
    setExporting(true);
    try {
      const query = buildQuery(filters);
      await api.download(
        `/api/admin/reports/export?type=${tab}${query ? `&${query}` : ''}`,
        `تقرير_${tab}_${new Date().toISOString().slice(0, 10)}.csv`
      );
      setToast({ message: 'تم تجهيز ملف التقرير للتنزيل.' });
    } catch (err) {
      setToast({ severity: 'error', message: err.message });
    } finally {
      setExporting(false);
    }
  };

  const columns = useMemo(() => {
    if (tab === 'invoices') {
      return [
        {
          key: 'invoice_number',
          label: 'رقم الفاتورة',
          render: (row) => <span className="a4-ltr">{row.invoice_number}</span>,
        },
        {
          key: 'receipt_number',
          label: 'رقم الإيصال',
          render: (row) => <span className="a4-ltr">{row.receipt_number || '—'}</span>,
        },
        {
          key: 'origin',
          label: 'المصدر',
          render: (row) => (row.origin === 'PREORDER_PICKUP' ? 'استلام حجز' : 'بيع مباشر'),
        },
        { key: 'status', label: 'الحالة', render: (row) => <StatusChip status={row.status} /> },
        { key: 'cashier_name', label: 'الكاشير' },
        { key: 'shift_id', label: 'الشيفت', render: (row) => `#${row.shift_id}` },
        { key: 'customer_name', label: 'العميل' },
        { key: 'total', label: 'الإجمالي', render: (row) => money(row.total) },
        {
          key: 'preorder',
          label: 'الحجز المرتبط',
          render: (row) => row.preorder?.preorder_number || '—',
        },
        { key: 'returns', label: 'المرتجعات', render: (row) => number(row.returns?.length || 0) },
        { key: 'created_at', label: 'التاريخ', render: (row) => dateTime(row.created_at) },
      ];
    }
    if (tab === 'payments') {
      return [
        { key: 'created_at', label: 'التاريخ', render: (row) => dateTime(row.created_at) },
        { key: 'stage', label: 'المرحلة' },
        {
          key: 'direction',
          label: 'الاتجاه',
          render: (row) => (row.direction === 'OUT' ? 'صادر' : 'وارد'),
        },
        { key: 'payment_method', label: 'الطريقة' },
        {
          key: 'applied_amount',
          label: 'المبلغ المطبق',
          render: (row) => money(row.applied_amount),
        },
        {
          key: 'cash_received',
          label: 'النقد المستلم',
          render: (row) => money(row.cash_received || 0),
        },
        { key: 'change_amount', label: 'الباقي', render: (row) => money(row.change_amount || 0) },
        { key: 'cashier_name', label: 'الكاشير' },
        { key: 'shift_id', label: 'الشيفت', render: (row) => `#${row.shift_id}` },
        {
          key: 'reference_number_saved',
          label: 'المرجع',
          render: (row) => (
            <span className="a4-ltr">
              {row.reference_number_saved || row.reference_number || '—'}
            </span>
          ),
        },
      ];
    }
    if (tab === 'cashiers') {
      return [
        { key: 'cashier_name', label: 'الكاشير' },
        { key: 'invoice_count', label: 'عدد الفواتير', render: (row) => number(row.invoice_count) },
        {
          key: 'invoice_total',
          label: 'إجمالي الفواتير',
          render: (row) => money(row.invoice_total),
        },
        { key: 'refund_total', label: 'المرتجعات', render: (row) => money(row.refund_total) },
      ];
    }
    if (tab === 'sales') {
      return [
        {
          key: 'invoice_number',
          label: 'رقم الفاتورة',
          render: (row) => <span className="a4-ltr">{row.invoice_number}</span>,
        },
        { key: 'created_at', label: 'التاريخ والوقت', render: (row) => dateTime(row.created_at) },
        { key: 'cashier_name', label: 'الكاشير' },
        { key: 'subtotal', label: 'قبل الخصم', render: (row) => money(row.subtotal) },
        { key: 'discount', label: 'الخصم', render: (row) => money(row.discount) },
        { key: 'total', label: 'الصافي', render: (row) => <strong>{money(row.total)}</strong> },
        {
          key: 'payments',
          label: 'طرق الدفع',
          render: (row) =>
            row.payments?.length
              ? row.payments
                  .map((payment) => `${payment.method}: ${money(payment.amount)}`)
                  .join(' + ')
              : '—',
        },
      ];
    }
    if (tab === 'preorders') {
      return [
        {
          key: 'preorder_number',
          label: 'رقم الحجز',
          render: (row) => <span className="a4-ltr">{row.preorder_number}</span>,
        },
        { key: 'customer_name', label: 'العميل' },
        {
          key: 'customer_phone',
          label: 'الهاتف',
          render: (row) => <span className="a4-ltr">{row.customer_phone}</span>,
        },
        { key: 'cashier_name', label: 'الكاشير' },
        { key: 'total_amount', label: 'الإجمالي', render: (row) => money(row.total_amount) },
        { key: 'deposit_paid', label: 'العربون', render: (row) => money(row.deposit_paid) },
        {
          key: 'remaining_amount',
          label: 'المتبقي',
          render: (row) => <strong>{money(row.remaining_amount)}</strong>,
        },
        {
          key: 'status',
          label: 'الحالة',
          render: (row) => <StatusChip status={row.status} label={statusLabel(row.status)} />,
        },
        { key: 'created_at', label: 'تاريخ الحجز', render: (row) => dateTime(row.created_at) },
      ];
    }
    if (tab === 'inventory') {
      return [
        { key: 'name', label: 'المنتج' },
        {
          key: 'sku',
          label: 'رمز SKU',
          render: (row) => <span className="a4-ltr">{row.sku}</span>,
        },
        { key: 'category_name', label: 'التصنيف' },
        {
          key: 'current_stock',
          label: 'المخزون الفعلي',
          render: (row) => <strong>{number(row.current_stock)}</strong>,
        },
        {
          key: 'open_preorder_quantity',
          label: 'كمية الحجز المفتوح',
          render: (row) => number(row.open_preorder_quantity),
        },
        {
          key: 'availability_policy',
          label: 'سياسة التوفر',
          render: (row) =>
            row.availability_policy === 'STOCK_WITH_PREORDER_WHEN_OUT_OF_STOCK'
              ? 'حجز عند النفاد'
              : 'مخزون فقط',
        },
        {
          key: 'can_preorder_now',
          label: 'مؤهل للحجز الآن',
          render: (row) => (row.can_preorder_now ? 'نعم' : 'لا'),
        },
        {
          key: 'low_stock_threshold',
          label: 'حد التنبيه',
          render: (row) => number(row.low_stock_threshold),
        },
        {
          key: 'stock_state',
          label: 'حالة المخزون',
          render: (row) =>
            row.current_stock === 0 ? (
              <StatusChip status="inactive" label="نفد المخزون" />
            ) : row.current_stock <= row.low_stock_threshold ? (
              <StatusChip status="warning" label="مخزون منخفض" />
            ) : (
              <StatusChip status="active" label="متوفر" />
            ),
        },
      ];
    }
    return [
      { key: 'id', label: 'رقم الشيفت', render: (row) => `#${row.id}` },
      { key: 'cashier_name', label: 'الكاشير' },
      { key: 'opened_at', label: 'وقت الفتح', render: (row) => dateTime(row.opened_at) },
      { key: 'closed_at', label: 'وقت الإغلاق', render: (row) => dateTime(row.closed_at) },
      { key: 'opening_cash', label: 'عهدة البداية', render: (row) => money(row.opening_cash) },
      {
        key: 'expected_closing_cash',
        label: 'المتوقع',
        render: (row) => money(row.expected_closing_cash),
      },
      {
        key: 'actual_closing_cash',
        label: 'الفعلي',
        render: (row) => money(row.actual_closing_cash),
      },
      { key: 'status', label: 'الحالة', render: (row) => <StatusChip status={row.status} /> },
    ];
  }, [tab]);

  const metrics = useMemo(() => {
    const summary = data.summary || {};
    if (tab === 'sales') {
      return [
        ['إجمالي قبل الخصم', money(summary.total_sales), 'قيمة السلع قبل الخصومات'],
        ['إجمالي الخصومات', money(summary.total_discount), 'الخصومات المسجلة'],
        ['صافي المبيعات', money(summary.total_net), 'القيمة المحصلة'],
        ['عدد الفواتير', number(summary.invoices_count), 'فاتورة مكتملة'],
      ];
    }
    if (tab === 'invoices') {
      return [
        ['إجمالي الفواتير', money(summary.total_net), 'قبل خصم المرتجعات'],
        ['المرتجعات', money(summary.total_refunded), 'مرتجعات محفوظة'],
        ['الصافي بعد المرتجعات', money(summary.net_after_returns), 'القيمة التشغيلية'],
        ['عدد الفواتير', number(summary.invoices_count), 'حسب الفلاتر'],
      ];
    }
    if (tab === 'payments') {
      return [
        ['وارد', money(summary.incoming), 'دفعات داخلة'],
        ['صادر', money(summary.outgoing), 'مبالغ مستردة'],
        ['النقد المستلم', money(summary.cash_received), 'قبل رد الباقي'],
        ['الباقي للعميل', money(summary.change_given), 'محسوب من الخادم'],
      ];
    }
    if (tab === 'cashiers') {
      return [
        ['عدد الكاشير', number(summary.cashier_count), 'حسابات تشغيلية'],
        ['إجمالي الفواتير', money(summary.invoice_total), 'حسب الفترة'],
      ];
    }
    if (tab === 'preorders') {
      return [
        ['عدد الحجوزات', number(summary.total_count), 'حسب الفلاتر الحالية'],
        ['إجمالي الحجوزات', money(summary.total_amount), 'قيمة الحجوزات كاملة'],
        ['العربون المحصل', money(summary.total_deposit_paid), 'تم تحصيله عند الحجز'],
        ['المبالغ المتبقية', money(summary.total_remaining_amount), 'تحصل عند الاستلام'],
      ];
    }
    if (tab === 'inventory') {
      return [
        ['إجمالي المنتجات', number(summary.total_products), 'منتج نشط'],
        ['مخزون منخفض', number(summary.low_stock_count), 'يحتاج إعادة تزويد'],
        ['نفد المخزون', number(summary.out_of_stock_count), 'رصيد صفر'],
      ];
    }
    return [
      ['إجمالي الشيفتات', number(summary.total_shifts), 'حسب الفلاتر الحالية'],
      ['شيفتات مفتوحة', number(summary.open_shifts), 'قيد التشغيل'],
      ['بانتظار المراجعة', number(summary.pending_review_shifts), 'تحتاج اعتماد الأدمن'],
      ['شيفتات مغلقة', number(summary.closed_shifts), 'تم اعتمادها'],
    ];
  }, [data.summary, tab]);

  return (
    <div className="a4-page reports-page">
      <PageHeader
        title="التقارير"
        description="اعرض المبيعات والحجوزات والمخزون والشيفتات، ثم صدّر النتائج إلى ملف CSV عربي متوافق مع Excel."
        actions={
          <>
            <Button
              variant="outlined"
              startIcon={<RefreshRounded />}
              onClick={() => load()}
              disabled={loading}
            >
              تحديث
            </Button>
            <Button
              variant="contained"
              startIcon={<DownloadRounded />}
              onClick={exportCsv}
              disabled={exporting || loading}
            >
              {exporting ? 'جاري التصدير...' : 'تصدير التقرير'}
            </Button>
          </>
        }
      />

      <section className="a4-page-section report-tabs-panel">
        <Tabs
          value={tab}
          onChange={changeTab}
          variant="scrollable"
          scrollButtons="auto"
          aria-label="أنواع التقارير"
        >
          {reportTabs.map((item) => (
            <Tab
              key={item.id}
              value={item.id}
              icon={item.icon}
              iconPosition="start"
              label={item.label}
            />
          ))}
        </Tabs>
      </section>

      <FilterPanel resultCount={data.rows.length} onApply={() => load()} onReset={reset}>
        {tab !== 'inventory' && (
          <>
            <Field label="من تاريخ">
              <TextField
                type="date"
                value={filters.startDate}
                onChange={(event) =>
                  setFilters((state) => ({ ...state, startDate: event.target.value }))
                }
              />
            </Field>
            <Field label="إلى تاريخ">
              <TextField
                type="date"
                value={filters.endDate}
                onChange={(event) =>
                  setFilters((state) => ({ ...state, endDate: event.target.value }))
                }
              />
            </Field>
          </>
        )}
        {(tab === 'sales' ||
          tab === 'invoices' ||
          tab === 'payments' ||
          tab === 'preorders' ||
          tab === 'shifts') && (
          <Field label="الكاشير">
            <TextField
              select
              value={filters.cashierId}
              onChange={(event) =>
                setFilters((state) => ({ ...state, cashierId: event.target.value }))
              }
            >
              <MenuItem value="">كل الكاشير</MenuItem>
              {users.map((user) => (
                <MenuItem key={user.id} value={user.id}>
                  {user.name}
                </MenuItem>
              ))}
            </TextField>
          </Field>
        )}
        {tab === 'sales' && (
          <>
            <Field label="رقم الشيفت">
              <TextField
                type="number"
                value={filters.shiftId}
                onChange={(event) =>
                  setFilters((state) => ({ ...state, shiftId: event.target.value }))
                }
                placeholder="اختياري"
              />
            </Field>
            <Field label="التصنيف">
              <TextField
                select
                value={filters.categoryId}
                onChange={(event) =>
                  setFilters((state) => ({ ...state, categoryId: event.target.value }))
                }
              >
                <MenuItem value="">كل التصنيفات</MenuItem>
                {categories.map((category) => (
                  <MenuItem key={category.id} value={category.id}>
                    {category.name}
                  </MenuItem>
                ))}
              </TextField>
            </Field>
          </>
        )}
        {tab === 'invoices' && (
          <>
            <Field label="رقم الفاتورة">
              <TextField
                value={filters.invoiceNumber}
                onChange={(event) =>
                  setFilters((state) => ({ ...state, invoiceNumber: event.target.value }))
                }
              />
            </Field>
            <Field label="رقم الإيصال">
              <TextField
                value={filters.receiptNumber}
                onChange={(event) =>
                  setFilters((state) => ({ ...state, receiptNumber: event.target.value }))
                }
              />
            </Field>
            <Field label="رقم الشيفت">
              <TextField
                type="number"
                value={filters.shiftId}
                onChange={(event) =>
                  setFilters((state) => ({ ...state, shiftId: event.target.value }))
                }
              />
            </Field>
            <Field label="طريقة الدفع">
              <TextField
                value={filters.paymentMethod}
                onChange={(event) =>
                  setFilters((state) => ({ ...state, paymentMethod: event.target.value }))
                }
              />
            </Field>
            <Field label="المصدر">
              <TextField
                select
                value={filters.origin}
                onChange={(event) =>
                  setFilters((state) => ({ ...state, origin: event.target.value }))
                }
              >
                <MenuItem value="">الكل</MenuItem>
                <MenuItem value="SALE">بيع مباشر</MenuItem>
                <MenuItem value="PREORDER_PICKUP">استلام حجز</MenuItem>
              </TextField>
            </Field>
            <Field label="الحالة">
              <TextField
                select
                value={filters.status}
                onChange={(event) =>
                  setFilters((state) => ({ ...state, status: event.target.value }))
                }
              >
                <MenuItem value="">الكل</MenuItem>
                <MenuItem value="COMPLETED">مكتملة</MenuItem>
                <MenuItem value="PARTIALLY_RETURNED">مرتجع جزئي</MenuItem>
                <MenuItem value="RETURNED">مرتجعة</MenuItem>
              </TextField>
            </Field>
            <Field label="العميل أو الهاتف">
              <TextField
                value={filters.customer}
                onChange={(event) =>
                  setFilters((state) => ({ ...state, customer: event.target.value }))
                }
              />
            </Field>
            <Field label="المنتج">
              <TextField
                value={filters.productName}
                onChange={(event) =>
                  setFilters((state) => ({ ...state, productName: event.target.value }))
                }
              />
            </Field>
            <Field label="SKU أو باركود">
              <TextField
                value={filters.sku}
                onChange={(event) => setFilters((state) => ({ ...state, sku: event.target.value }))}
              />
            </Field>
          </>
        )}
        {tab === 'payments' && (
          <>
            <Field label="رقم الشيفت">
              <TextField
                type="number"
                value={filters.shiftId}
                onChange={(event) =>
                  setFilters((state) => ({ ...state, shiftId: event.target.value }))
                }
              />
            </Field>
            <Field label="المرحلة">
              <TextField
                select
                value={filters.stage}
                onChange={(event) =>
                  setFilters((state) => ({ ...state, stage: event.target.value }))
                }
              >
                <MenuItem value="">الكل</MenuItem>
                <MenuItem value="SALE">بيع</MenuItem>
                <MenuItem value="PREORDER_DEPOSIT">عربون</MenuItem>
                <MenuItem value="PREORDER_PICKUP">استلام</MenuItem>
                <MenuItem value="REFUND">مرتجع</MenuItem>
              </TextField>
            </Field>
            <Field label="الاتجاه">
              <TextField
                select
                value={filters.direction}
                onChange={(event) =>
                  setFilters((state) => ({ ...state, direction: event.target.value }))
                }
              >
                <MenuItem value="">الكل</MenuItem>
                <MenuItem value="IN">وارد</MenuItem>
                <MenuItem value="OUT">صادر</MenuItem>
              </TextField>
            </Field>
            <Field label="الطريقة">
              <TextField
                value={filters.paymentMethod}
                onChange={(event) =>
                  setFilters((state) => ({
                    ...state,
                    method: event.target.value,
                    paymentMethod: event.target.value,
                  }))
                }
              />
            </Field>
          </>
        )}
        {tab === 'preorders' && (
          <>
            <Field label="البحث">
              <TextField
                value={filters.search}
                onChange={(event) =>
                  setFilters((state) => ({ ...state, search: event.target.value }))
                }
                placeholder="رقم الحجز أو العميل أو الهاتف"
              />
            </Field>
            <Field label="حالة الحجز">
              <TextField
                select
                value={filters.status}
                onChange={(event) =>
                  setFilters((state) => ({ ...state, status: event.target.value }))
                }
              >
                <MenuItem value="">كل الحالات</MenuItem>
                <MenuItem value="DEPOSIT_PAID_WAITING_STOCK">بانتظار المخزون</MenuItem>
                <MenuItem value="READY_FOR_PICKUP">جاهز للاستلام</MenuItem>
                <MenuItem value="PICKED_UP">تم الاستلام</MenuItem>
                <MenuItem value="CANCELLED">ملغي</MenuItem>
              </TextField>
            </Field>
          </>
        )}
        {tab === 'inventory' && (
          <>
            <Field label="البحث">
              <TextField
                value={filters.search}
                onChange={(event) =>
                  setFilters((state) => ({ ...state, search: event.target.value }))
                }
                placeholder="اسم المنتج أو SKU أو الباركود"
              />
            </Field>
            <Field label="التصنيف">
              <TextField
                select
                value={filters.categoryId}
                onChange={(event) =>
                  setFilters((state) => ({ ...state, categoryId: event.target.value }))
                }
              >
                <MenuItem value="">كل التصنيفات</MenuItem>
                {categories.map((category) => (
                  <MenuItem key={category.id} value={category.id}>
                    {category.name}
                  </MenuItem>
                ))}
              </TextField>
            </Field>
            <Field label="حالة المخزون">
              <TextField
                select
                value={filters.stockStatus}
                onChange={(event) =>
                  setFilters((state) => ({ ...state, stockStatus: event.target.value }))
                }
              >
                <MenuItem value="">الكل</MenuItem>
                <MenuItem value="LOW_STOCK">مخزون منخفض</MenuItem>
                <MenuItem value="OUT_OF_STOCK">نفد المخزون</MenuItem>
              </TextField>
            </Field>
          </>
        )}
        {tab === 'shifts' && (
          <Field label="حالة الشيفت">
            <TextField
              select
              value={filters.status}
              onChange={(event) =>
                setFilters((state) => ({ ...state, status: event.target.value }))
              }
            >
              <MenuItem value="">كل الحالات</MenuItem>
              <MenuItem value="OPEN">مفتوح</MenuItem>
              <MenuItem value="PENDING_ADMIN_REVIEW">بانتظار المراجعة</MenuItem>
              <MenuItem value="CLOSED">مغلق</MenuItem>
            </TextField>
          </Field>
        )}
      </FilterPanel>

      {error && <Alert severity="error">{error}</Alert>}

      <div className="a4-grid a4-grid--metrics">
        {metrics.map(([label, value, hint]) => (
          <MetricCard
            key={label}
            icon={<AssessmentRounded />}
            label={label}
            value={value}
            hint={hint}
          />
        ))}
      </div>

      <section className="a4-page-section">
        {loading ? (
          <LoadingState label="جاري تجهيز التقرير..." />
        ) : (
          <DataTable
            columns={columns}
            rows={data.rows}
            mobilePrimary={(row) =>
              row.invoice_number || row.preorder_number || row.name || `شيفت #${row.id}`
            }
          />
        )}
      </section>
      <AppSnackbar state={toast} onClose={() => setToast(null)} />
    </div>
  );
}

import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Button,
  Chip,
  MenuItem,
  Pagination,
  Paper,
  Tab,
  Tabs,
  TextField,
} from '@mui/material';
import {
  AddRounded,
  HistoryRounded,
  PrintRounded,
  RefreshRounded,
  SyncRounded,
  VisibilityRounded,
} from '@mui/icons-material';
import { useSearchParams } from 'react-router-dom';
import { api } from '../services/apiClient.js';
import { printReturnApprovalCardInFrame } from '../services/printService.js';
import { PageHeader } from '../components/PageHeader.jsx';
import { DataTable } from '../components/DataTable.jsx';
import { EntityDrawer } from '../components/EntityDrawer.jsx';
import { Field } from '../components/forms/Field.jsx';
import { FieldGrid } from '../components/forms/FieldGrid.jsx';
import { StatusChip } from '../components/StatusChip.jsx';
import { ConfirmDialog } from '../components/ConfirmDialog.jsx';
import { AppSnackbar } from '../components/AppSnackbar.jsx';
import { dateTime, money, number } from '../utils/formatters.js';
import '../styles/ReturnAuthorizations.css';

const PAGE_SIZE = 25;

function bodyOf(response) {
  return response?.data || response || {};
}

function arrayOf(value, ...keys) {
  if (Array.isArray(value)) return value;
  for (const key of keys) if (Array.isArray(value?.[key])) return value[key];
  return [];
}

function valueOf(value, ...keys) {
  for (const key of keys) {
    if (value?.[key] !== undefined && value?.[key] !== null) return value[key];
  }
  return undefined;
}

function returnRow(row) {
  const item = row.return || row;
  return {
    ...item,
    id: valueOf(item, 'id', 'returnId', 'return_id'),
    returnNumber: valueOf(item, 'returnNumber', 'return_number'),
    invoiceNumber: valueOf(item, 'invoiceNumber', 'invoice_number'),
    cashierName: valueOf(item, 'cashierName', 'cashier_name'),
    shiftId: valueOf(item, 'shiftId', 'shift_id'),
    totalRefunded: Number(
      valueOf(item, 'totalRefunded', 'total_refunded', 'totalRefund', 'total_refund') || 0
    ),
    approvalCardNumber: valueOf(item, 'approvalCardNumber', 'approval_card_number'),
    createdAt: valueOf(item, 'createdAt', 'created_at'),
  };
}

function cardRow(row) {
  return {
    ...row,
    id: valueOf(row, 'id'),
    cardNumber: valueOf(row, 'cardNumber', 'card_number'),
    ownerAdminName: valueOf(row, 'ownerAdminName', 'owner_admin_name'),
    printCount: Number(valueOf(row, 'printCount', 'print_count') || 0),
    lastPrintedAt: valueOf(row, 'lastPrintedAt', 'last_printed_at'),
    lastUsedAt: valueOf(row, 'lastUsedAt', 'last_used_at'),
  };
}

export default function Returns() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialSearch = String(searchParams.get('search') || '').trim();
  const [tab, setTab] = useState(() => (searchParams.get('tab') === 'cards' ? 'cards' : 'history'));
  const [returns, setReturns] = useState([]);
  const [returnTotal, setReturnTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState(() => ({
    returnNumber: /^RTN/i.test(initialSearch) ? initialSearch : '',
    invoiceNumber: initialSearch && !/^RTN/i.test(initialSearch) ? initialSearch : '',
    startDate: '',
    endDate: '',
  }));
  const [cards, setCards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [usesCard, setUsesCard] = useState(null);
  const [uses, setUses] = useState([]);
  const [creating, setCreating] = useState(false);
  const [newLabel, setNewLabel] = useState('');
  const [printCard, setPrintCard] = useState(null);
  const [printForm, setPrintForm] = useState({ mode: 'a4', copies: 1 });
  const [printing, setPrinting] = useState(false);
  const [pendingAction, setPendingAction] = useState(null);
  const [disableReason, setDisableReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);

  const pageCount = Math.max(1, Math.ceil(returnTotal / PAGE_SIZE));

  const loadReturns = async (nextPage = page, nextFilters = filters) => {
    setLoading(true);
    try {
      const query = new URLSearchParams({
        limit: String(PAGE_SIZE),
        offset: String((nextPage - 1) * PAGE_SIZE),
      });
      if (nextFilters.returnNumber.trim())
        query.set('returnNumber', nextFilters.returnNumber.trim());
      if (nextFilters.invoiceNumber.trim())
        query.set('invoiceNumber', nextFilters.invoiceNumber.trim());
      if (nextFilters.startDate) query.set('startDate', nextFilters.startDate);
      if (nextFilters.endDate) query.set('endDate', nextFilters.endDate);
      const payload = bodyOf(await api.get(`/api/admin/returns?${query}`));
      const rows = arrayOf(payload, 'returns', 'rows').map(returnRow);
      setReturns(rows);
      setReturnTotal(Number(payload.total ?? payload.pagination?.total ?? rows.length));
    } catch (error) {
      setToast({ severity: 'error', message: error.message });
    } finally {
      setLoading(false);
    }
  };

  const loadCards = async () => {
    setLoading(true);
    try {
      const payload = bodyOf(await api.get('/api/admin/return-approval-cards'));
      setCards(arrayOf(payload, 'cards', 'rows').map(cardRow));
    } catch (error) {
      setToast({ severity: 'error', message: error.message });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (tab === 'history') loadReturns();
    else loadCards();
  }, [tab]);

  const openReturn = async (row) => {
    setDetailLoading(true);
    setDetail({ return: row, items: [], payments: [], auditTimeline: [] });
    try {
      setDetail(bodyOf(await api.get(`/api/admin/returns/${row.id}`)));
    } catch (error) {
      setDetail(null);
      setToast({ severity: 'error', message: error.message });
    } finally {
      setDetailLoading(false);
    }
  };

  const openUses = async (card) => {
    setUsesCard(card);
    setUses([]);
    try {
      const payload = bodyOf(
        await api.get(`/api/admin/return-approval-cards/${card.id}/uses?page=1&limit=50`)
      );
      setUses(arrayOf(payload, 'uses', 'rows'));
    } catch (error) {
      setUsesCard(null);
      setToast({ severity: 'error', message: error.message });
    }
  };

  const createCard = async () => {
    if (!newLabel.trim()) {
      setToast({ severity: 'warning', message: 'اكتب اسماً واضحاً للكارت.' });
      return;
    }
    setSaving(true);
    try {
      await api.post('/api/admin/return-approval-cards', { label: newLabel.trim() });
      setCreating(false);
      setNewLabel('');
      setToast({ message: 'تم إنشاء كارت الاعتماد.' });
      await loadCards();
    } catch (error) {
      setToast({ severity: 'error', message: error.message });
    } finally {
      setSaving(false);
    }
  };

  const performCardAction = async () => {
    if (!pendingAction) return;
    if (pendingAction.type === 'disable' && !disableReason.trim()) {
      setToast({ severity: 'warning', message: 'سبب إيقاف الكارت مطلوب.' });
      return;
    }
    setSaving(true);
    try {
      await api.post(
        `/api/admin/return-approval-cards/${pendingAction.card.id}/${pendingAction.type}`,
        pendingAction.type === 'disable' ? { reason: disableReason.trim() } : {}
      );
      setToast({
        message:
          pendingAction.type === 'rotate'
            ? 'تم تغيير QR وإبطال النسخة القديمة.'
            : pendingAction.type === 'disable'
              ? 'تم إيقاف الكارت.'
              : 'تم تفعيل الكارت.',
      });
      setPendingAction(null);
      setDisableReason('');
      await loadCards();
    } catch (error) {
      setToast({ severity: 'error', message: error.message });
    } finally {
      setSaving(false);
    }
  };

  const printApprovalCard = async () => {
    if (!printCard || printing) return;
    setPrinting(true);
    try {
      await printReturnApprovalCardInFrame({
        cardId: printCard.id,
        mode: printForm.mode,
        copies: printForm.copies,
      });
      setPrintCard(null);
      setToast({ message: 'تم تسجيل الطلب وفتح طباعة كارت الاعتماد.' });
      await loadCards();
    } catch (error) {
      setToast({ severity: 'error', message: error.message });
    } finally {
      setPrinting(false);
    }
  };

  const returnColumns = useMemo(
    () => [
      {
        key: 'returnNumber',
        label: 'رقم المرتجع',
        render: (row) => <strong className="a4-ltr">{row.returnNumber}</strong>,
      },
      {
        key: 'invoiceNumber',
        label: 'الفاتورة',
        render: (row) => <span className="a4-ltr">{row.invoiceNumber}</span>,
      },
      { key: 'cashierName', label: 'الكاشير' },
      {
        key: 'shiftId',
        label: 'الشيفت',
        render: (row) => <span className="a4-ltr">#{row.shiftId}</span>,
      },
      {
        key: 'totalRefunded',
        label: 'المبلغ',
        render: (row) => <strong>{money(row.totalRefunded)}</strong>,
      },
      {
        key: 'approvalCardNumber',
        label: 'كارت الاعتماد',
        render: (row) => <span className="a4-ltr">{row.approvalCardNumber || '—'}</span>,
      },
      { key: 'createdAt', label: 'وقت التنفيذ', render: (row) => dateTime(row.createdAt) },
      {
        key: 'actions',
        label: 'التفاصيل',
        render: (row) => (
          <Button startIcon={<VisibilityRounded />} onClick={() => openReturn(row)}>
            عرض
          </Button>
        ),
      },
    ],
    []
  );

  const cardColumns = useMemo(
    () => [
      {
        key: 'cardNumber',
        label: 'رقم الكارت',
        render: (row) => <strong className="a4-ltr">{row.cardNumber}</strong>,
      },
      { key: 'label', label: 'الاسم' },
      {
        key: 'ownerAdminName',
        label: 'الأدمن المالك',
        render: (row) => (
          <div className="returns-page__card-owner">
            <span>{row.ownerAdminName}</span>
            {row.ownerAdminActive === false && <small>الحساب غير نشط أو لم يعد Admin</small>}
          </div>
        ),
      },
      {
        key: 'status',
        label: 'الحالة',
        render: (row) => {
          const usable = row.status === 'ACTIVE' && row.ownerAdminActive !== false;
          return (
            <StatusChip
              status={usable ? 'active' : 'inactive'}
              label={usable ? 'نشط' : row.status === 'ACTIVE' ? 'مالك غير نشط' : 'متوقف'}
            />
          );
        },
      },
      { key: 'printCount', label: 'مرات الطباعة', render: (row) => number(row.printCount) },
      { key: 'lastPrintedAt', label: 'آخر طباعة', render: (row) => dateTime(row.lastPrintedAt) },
      { key: 'lastUsedAt', label: 'آخر استخدام', render: (row) => dateTime(row.lastUsedAt) },
      {
        key: 'actions',
        label: 'الإجراءات',
        render: (row) => (
          <div className="a4-actions returns-page__card-actions">
            <Button
              startIcon={<PrintRounded />}
              disabled={row.status !== 'ACTIVE' || row.ownerAdminActive === false}
              onClick={() => {
                setPrintForm({ mode: 'a4', copies: 1 });
                setPrintCard(row);
              }}
            >
              طباعة
            </Button>
            <Button startIcon={<HistoryRounded />} onClick={() => openUses(row)}>
              الاستخدامات
            </Button>
            <Button
              startIcon={<SyncRounded />}
              disabled={row.status !== 'ACTIVE'}
              onClick={() => setPendingAction({ type: 'rotate', card: row })}
            >
              تغيير QR
            </Button>
            <Button
              color={row.status === 'ACTIVE' ? 'error' : 'success'}
              disabled={row.status !== 'ACTIVE' && row.ownerAdminActive === false}
              onClick={() =>
                setPendingAction({
                  type: row.status === 'ACTIVE' ? 'disable' : 'enable',
                  card: row,
                })
              }
            >
              {row.status === 'ACTIVE' ? 'إيقاف' : 'تفعيل'}
            </Button>
          </div>
        ),
      },
    ],
    []
  );

  const detailReturn = returnRow(detail?.return || {});
  const detailItems = arrayOf(detail, 'items', 'returnItems');
  const detailPayments = arrayOf(detail, 'payments', 'refundPayments');
  const auditTimeline = arrayOf(detail, 'auditTimeline', 'audit_timeline');
  const inventoryMovements = arrayOf(detail, 'inventoryMovements', 'inventory_movements');
  const approvalSnapshot =
    detailReturn.approvalSnapshot ||
    detailReturn.approval_snapshot ||
    detail?.approvalSnapshot ||
    {};

  return (
    <div className="a4-page returns-page">
      <PageHeader
        title="المرتجعات"
        description="مراجعة المرتجعات المالية وإدارة كروت اعتماد الأدمن المستمرة."
        actions={
          <>
            <Button
              startIcon={<RefreshRounded />}
              onClick={() => (tab === 'history' ? loadReturns() : loadCards())}
            >
              تحديث
            </Button>
            {tab === 'cards' && (
              <Button
                variant="contained"
                startIcon={<AddRounded />}
                onClick={() => setCreating(true)}
              >
                كارت جديد
              </Button>
            )}
          </>
        }
      />

      <Paper variant="outlined" className="returns-page__tabs">
        <Tabs
          value={tab}
          onChange={(_, value) => {
            setTab(value);
            setSearchParams(value === 'cards' ? { tab: 'cards' } : {});
          }}
        >
          <Tab value="history" label="سجل المرتجعات" />
          <Tab value="cards" label="كروت الاعتماد" />
        </Tabs>
      </Paper>

      {tab === 'history' ? (
        <>
          <Paper variant="outlined" className="returns-page__filters">
            <Field label="رقم المرتجع">
              <TextField
                value={filters.returnNumber}
                onChange={(event) =>
                  setFilters((current) => ({ ...current, returnNumber: event.target.value }))
                }
                placeholder="RTN-..."
              />
            </Field>
            <Field label="رقم الفاتورة">
              <TextField
                value={filters.invoiceNumber}
                onChange={(event) =>
                  setFilters((current) => ({ ...current, invoiceNumber: event.target.value }))
                }
                placeholder="INV-..."
              />
            </Field>
            <Field label="من تاريخ">
              <TextField
                type="date"
                value={filters.startDate}
                onChange={(event) =>
                  setFilters((current) => ({ ...current, startDate: event.target.value }))
                }
              />
            </Field>
            <Field label="إلى تاريخ">
              <TextField
                type="date"
                value={filters.endDate}
                onChange={(event) =>
                  setFilters((current) => ({ ...current, endDate: event.target.value }))
                }
              />
            </Field>
            <Button
              variant="contained"
              onClick={() => {
                setPage(1);
                loadReturns(1, filters);
              }}
            >
              تطبيق
            </Button>
          </Paper>
          {loading && <Alert severity="info">جاري تحميل سجل المرتجعات...</Alert>}
          <DataTable
            columns={returnColumns}
            rows={returns}
            mobilePrimary={(row) => row.returnNumber}
            emptyTitle="لا توجد مرتجعات"
            emptyDescription="لم تُسجل عمليات مطابقة للفلاتر الحالية."
          />
          {pageCount > 1 && (
            <Pagination
              className="returns-page__pagination"
              page={page}
              count={pageCount}
              onChange={(_, value) => {
                setPage(value);
                loadReturns(value);
              }}
            />
          )}
        </>
      ) : (
        <>
          <Alert severity="info">
            الكارت قابل لإعادة الاستخدام حتى إيقافه أو تغيير QR. تغيير QR يبطل النسخة القديمة فوراً.
          </Alert>
          {loading && <Alert severity="info">جاري تحميل كروت الاعتماد...</Alert>}
          <DataTable
            columns={cardColumns}
            rows={cards}
            mobilePrimary={(row) => row.label}
            emptyTitle="لا توجد كروت اعتماد"
            emptyDescription="أنشئ أول كارت اعتماد إداري للمرتجعات."
          />
        </>
      )}

      <EntityDrawer
        open={Boolean(detail)}
        onClose={() => setDetail(null)}
        title={`تفاصيل المرتجع ${detailReturn.returnNumber || ''}`}
        subtitle={detailReturn.invoiceNumber ? `الفاتورة ${detailReturn.invoiceNumber}` : undefined}
        loading={detailLoading}
        wide
      >
        <div className="returns-page__detail">
          <div className="returns-page__summary-grid">
            <div>
              <span>الكاشير</span>
              <strong>{detailReturn.cashierName || '—'}</strong>
            </div>
            <div>
              <span>الشيفت</span>
              <strong className="a4-ltr">#{detailReturn.shiftId || '—'}</strong>
            </div>
            <div>
              <span>المبلغ المسترد</span>
              <strong>{money(detailReturn.totalRefunded)}</strong>
            </div>
            <div>
              <span>كارت الاعتماد</span>
              <strong className="a4-ltr">{detailReturn.approvalCardNumber || '—'}</strong>
            </div>
            <div>
              <span>التنفيذ</span>
              <strong>{dateTime(detailReturn.createdAt)}</strong>
            </div>
            <div>
              <span>الإيصال</span>
              <strong className="a4-ltr">
                {valueOf(detail?.receipt, 'receiptNumber', 'receipt_number') || '—'}
              </strong>
            </div>
            <div className="returns-page__summary-wide">
              <span>سبب المرتجع</span>
              <strong>{detailReturn.reason || '—'}</strong>
            </div>
            <div className="returns-page__summary-wide">
              <span>ملاحظة الكاشير</span>
              <strong>{detailReturn.cashierNote || '—'}</strong>
            </div>
          </div>
          <h3>اعتماد الأدمن</h3>
          <div className="returns-page__summary-grid">
            <div>
              <span>اسم الكارت وقت الاستخدام</span>
              <strong>{approvalSnapshot.label || detailReturn.approvalCardLabel || '—'}</strong>
            </div>
            <div>
              <span>الأدمن المالك وقت الاستخدام</span>
              <strong>
                {approvalSnapshot.ownerAdminName || detailReturn.authorizedByName || '—'}
              </strong>
            </div>
            <div>
              <span>نسخة QR المستخدمة</span>
              <strong className="a4-ltr">
                v{approvalSnapshot.tokenVersion || detailReturn.approvalCardVersion || '—'}
              </strong>
            </div>
          </div>
          <h3>البنود</h3>
          <div className="returns-page__records">
            {detailItems.map((item, index) => (
              <article key={valueOf(item, 'id', 'returnItemId', 'return_item_id') || index}>
                <div>
                  <strong>
                    {valueOf(item, 'productName', 'product_name', 'product_name_snapshot')}
                  </strong>
                  <span className="a4-ltr">{valueOf(item, 'sku', 'sku_snapshot')}</span>
                </div>
                <span>× {number(valueOf(item, 'quantity') || 0)}</span>
                <strong>{money(valueOf(item, 'refundAmount', 'refund_amount') || 0)}</strong>
                <Chip
                  size="small"
                  label={
                    String(valueOf(item, 'disposition') || '').toUpperCase() === 'RESTOCK'
                      ? 'عاد للمخزون'
                      : 'لم يعد للمخزون'
                  }
                />
                {valueOf(item, 'noRestockReason', 'no_restock_reason') && (
                  <small>{valueOf(item, 'noRestockReason', 'no_restock_reason')}</small>
                )}
              </article>
            ))}
          </div>
          <h3>رد المبلغ</h3>
          <div className="returns-page__records">
            {detailPayments.map((payment, index) => (
              <article key={valueOf(payment, 'id') || index}>
                <strong>{valueOf(payment, 'methodName', 'method_name', 'method')}</strong>
                <span>{money(valueOf(payment, 'amount') || 0)}</span>
                <span className="a4-ltr">
                  {valueOf(payment, 'referenceNumber', 'reference_number') || 'نقدي'}
                </span>
              </article>
            ))}
          </div>
          {inventoryMovements.length > 0 && (
            <>
              <h3>حركات المخزون</h3>
              <div className="returns-page__records">
                {inventoryMovements.map((movement, index) => (
                  <article key={valueOf(movement, 'id', 'movementId', 'movement_id') || index}>
                    <div>
                      <strong>{valueOf(movement, 'productName', 'product_name') || 'منتج'}</strong>
                      <span>
                        {valueOf(movement, 'transactionType', 'transaction_type') || 'RETURN'}
                      </span>
                    </div>
                    <span>
                      التغيير:{' '}
                      {number(
                        valueOf(movement, 'quantityChanged', 'quantity_changed', 'quantity') || 0
                      )}
                    </span>
                    <span>
                      قبل: {number(valueOf(movement, 'beforeQuantity', 'before_quantity') || 0)}
                    </span>
                    <strong>
                      بعد: {number(valueOf(movement, 'afterQuantity', 'after_quantity') || 0)}
                    </strong>
                  </article>
                ))}
              </div>
            </>
          )}
          {auditTimeline.length > 0 && (
            <>
              <h3>خط المراجعة</h3>
              <div className="returns-page__timeline">
                {auditTimeline.map((event, index) => (
                  <div key={valueOf(event, 'id') || index}>
                    <strong>{valueOf(event, 'actionType', 'action_type')}</strong>
                    <span>
                      {valueOf(event, 'actorName', 'actor_name', 'userName', 'user_name')}
                    </span>
                    <time>{dateTime(valueOf(event, 'createdAt', 'created_at'))}</time>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </EntityDrawer>

      <EntityDrawer
        open={Boolean(usesCard)}
        onClose={() => setUsesCard(null)}
        title={`استخدامات ${usesCard?.label || ''}`}
        subtitle={usesCard?.cardNumber}
        wide
      >
        <div className="returns-page__records">
          {uses.length ? (
            uses.map((use, index) => (
              <article key={valueOf(use, 'id', 'returnId', 'return_id') || index}>
                <strong className="a4-ltr">{valueOf(use, 'returnNumber', 'return_number')}</strong>
                <span>{valueOf(use, 'cashierName', 'cashier_name')}</span>
                <span className="a4-ltr">{valueOf(use, 'invoiceNumber', 'invoice_number')}</span>
                <span>{money(valueOf(use, 'totalRefunded', 'total_refunded') || 0)}</span>
                <time>
                  {dateTime(valueOf(use, 'usedAt', 'used_at', 'createdAt', 'created_at'))}
                </time>
              </article>
            ))
          ) : (
            <Alert severity="info">لم يُستخدم هذا الكارت في أي مرتجع بعد.</Alert>
          )}
        </div>
      </EntityDrawer>

      <EntityDrawer
        open={creating}
        onClose={() => setCreating(false)}
        title="كارت اعتماد جديد"
        onSubmit={createCard}
        submitLabel="إنشاء الكارت"
        loading={saving}
      >
        <Field label="اسم الكارت" required>
          <TextField
            value={newLabel}
            onChange={(event) => setNewLabel(event.target.value)}
            placeholder="مثال: كارت مدير الفرع"
          />
        </Field>
      </EntityDrawer>

      <EntityDrawer
        open={Boolean(printCard)}
        onClose={() => setPrintCard(null)}
        title="طباعة كارت الاعتماد"
        subtitle={`${printCard?.label || ''} · ${printCard?.cardNumber || ''}`}
        onSubmit={printApprovalCard}
        submitLabel="فتح الطباعة"
        loading={printing}
      >
        <FieldGrid>
          <Field label="وضع الطباعة" required>
            <TextField
              select
              value={printForm.mode}
              onChange={(event) =>
                setPrintForm((current) => ({ ...current, mode: event.target.value }))
              }
            >
              <MenuItem value="a4">ورقة A4 بعلامات قص</MenuItem>
              <MenuItem value="direct">مقاس الكارت 85.6×54 مم</MenuItem>
            </TextField>
          </Field>
          <Field label="عدد النسخ" required>
            <TextField
              type="number"
              value={printForm.copies}
              onChange={(event) =>
                setPrintForm((current) => ({
                  ...current,
                  copies: Math.min(20, Math.max(1, Number(event.target.value) || 1)),
                }))
              }
              slotProps={{ htmlInput: { min: 1, max: 20 } }}
            />
          </Field>
        </FieldGrid>
        <Alert severity="warning">لا تسلّم الكارت للكاشير، ولا تنشر صورته خارج الإدارة.</Alert>
      </EntityDrawer>

      <ConfirmDialog
        open={Boolean(pendingAction)}
        onClose={() => {
          setPendingAction(null);
          setDisableReason('');
        }}
        onConfirm={performCardAction}
        loading={saving}
        danger={pendingAction?.type === 'disable' || pendingAction?.type === 'rotate'}
        title={
          pendingAction?.type === 'rotate'
            ? 'تغيير QR للكارت'
            : pendingAction?.type === 'disable'
              ? 'إيقاف كارت الاعتماد'
              : 'تفعيل كارت الاعتماد'
        }
        confirmLabel={
          pendingAction?.type === 'rotate'
            ? 'تغيير وإبطال القديم'
            : pendingAction?.type === 'disable'
              ? 'إيقاف'
              : 'تفعيل'
        }
        description={
          pendingAction?.type === 'disable' ? (
            <Field label="سبب الإيقاف" required>
              <TextField
                multiline
                minRows={2}
                value={disableReason}
                onChange={(event) => setDisableReason(event.target.value)}
              />
            </Field>
          ) : pendingAction?.type === 'rotate' ? (
            'ستتوقف كل النسخ المطبوعة بالـQR الحالي فوراً، ويجب طباعة نسخة جديدة.'
          ) : (
            'سيصبح الكارت قابلاً للاستخدام مرة أخرى بالـQR الحالي.'
          )
        }
      />
      <AppSnackbar state={toast} onClose={() => setToast(null)} />
    </div>
  );
}

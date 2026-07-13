import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  MenuItem,
  Pagination,
  TextField,
  Tooltip,
} from '@mui/material';
import {
  AddRounded,
  BlockRounded,
  PrintRounded,
  RefreshRounded,
  ReplayRounded,
  SearchRounded,
  VisibilityRounded,
} from '@mui/icons-material';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../services/apiClient.js';
import { PageHeader } from '../components/PageHeader.jsx';
import { DataTable } from '../components/DataTable.jsx';
import { FilterPanel } from '../components/FilterPanel.jsx';
import { Field } from '../components/forms/Field.jsx';
import { FieldGrid } from '../components/forms/FieldGrid.jsx';
import { LoadingState } from '../components/LoadingState.jsx';
import { AppSnackbar } from '../components/AppSnackbar.jsx';
import { StatusChip } from '../components/StatusChip.jsx';
import { ConfirmDialog } from '../components/ConfirmDialog.jsx';
import { createIdempotencyKey } from '../utils/money.js';
import { dateTime, money, number, statusLabel } from '../utils/formatters.js';
import '../styles/ReturnAuthorizations.css';

const PAGE_SIZE = 25;
const INITIAL_FILTERS = Object.freeze({
  status: '',
  invoiceNumber: '',
  startDate: '',
  endDate: '',
});

function authorizationRows(response) {
  const data = response?.data || response || {};
  const rows = data.authorizations || data.rows || [];
  const pagination = data.pagination || {};
  return { rows, total: Number(pagination.total ?? data.total ?? rows.length) };
}

function remainingQuantity(item) {
  return Math.max(
    0,
    Number(
      item.remainingQuantity ??
        item.returnable_quantity ??
        Number(item.quantity || 0) - Number(item.returned_quantity || 0)
    )
  );
}

export default function ReturnAuthorizations() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState(INITIAL_FILTERS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [toast, setToast] = useState(null);
  const [detail, setDetail] = useState(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [invoiceId, setInvoiceId] = useState('');
  const [invoice, setInvoice] = useState(null);
  const [itemDrafts, setItemDrafts] = useState({});
  const [reason, setReason] = useState('');
  const [expiryHours, setExpiryHours] = useState(24);
  const [quote, setQuote] = useState(null);
  const [createKey, setCreateKey] = useState(() => createIdempotencyKey('return-card'));
  const [pendingAction, setPendingAction] = useState(null);

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const invoiceItems = useMemo(() => invoice?.items || [], [invoice]);

  const load = async (nextPage = 1, nextFilters = filters) => {
    setLoading(true);
    setError('');
    try {
      const query = new URLSearchParams({
        limit: String(PAGE_SIZE),
        offset: String((nextPage - 1) * PAGE_SIZE),
      });
      Object.entries(nextFilters).forEach(([key, value]) => {
        if (value) query.set(key, String(value));
      });
      const normalized = authorizationRows(
        await api.get(`/api/admin/return-authorizations?${query}`)
      );
      setRows(normalized.rows);
      setTotal(normalized.total);
      setPage(nextPage);
    } catch (loadError) {
      setRows([]);
      setTotal(0);
      setError(loadError.message);
    } finally {
      setLoading(false);
    }
  };

  const prepareInvoice = async (orderId = invoiceId) => {
    const cleanId = String(orderId || '').trim();
    if (!cleanId) {
      setToast({ severity: 'warning', message: 'أدخل معرّف الفاتورة أولًا.' });
      return;
    }
    setSaving(true);
    setQuote(null);
    try {
      const nextInvoice = (await api.get(`/api/admin/invoices/${cleanId}`)).data;
      const drafts = {};
      (nextInvoice.items || []).forEach((item) => {
        drafts[item.id] = {
          selected: false,
          quantity: remainingQuantity(item) > 0 ? 1 : 0,
          disposition: 'RESTOCK',
          noRestockReason: '',
        };
      });
      setInvoice(nextInvoice);
      setInvoiceId(String(nextInvoice.id || cleanId));
      setItemDrafts(drafts);
      setCreateOpen(true);
      setSearchParams({}, { replace: true });
    } catch (invoiceError) {
      setToast({ severity: 'error', message: invoiceError.message });
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    load(1, INITIAL_FILTERS);
    const orderId = searchParams.get('orderId');
    if (orderId) {
      setInvoiceId(orderId);
      prepareInvoice(orderId);
    }
  }, []);

  const selectedItems = () =>
    invoiceItems
      .filter((item) => itemDrafts[item.id]?.selected)
      .map((item) => ({
        orderItemId: item.id,
        quantity: Number(itemDrafts[item.id].quantity),
        disposition: itemDrafts[item.id].disposition,
        ...(itemDrafts[item.id].disposition === 'NO_RESTOCK'
          ? { noRestockReason: itemDrafts[item.id].noRestockReason.trim() }
          : {}),
      }));

  const validateDraft = () => {
    const items = selectedItems();
    if (!items.length) throw new Error('اختر بندًا واحدًا على الأقل للمرتجع.');
    for (const item of items) {
      const source = invoiceItems.find((row) => row.id === item.orderItemId);
      if (!Number.isInteger(item.quantity) || item.quantity < 1)
        throw new Error('كمية كل بند يجب أن تكون عددًا صحيحًا موجبًا.');
      if (item.quantity > remainingQuantity(source))
        throw new Error(`كمية ${source.product_name || source.productName} تتجاوز المتبقي.`);
      if (item.disposition === 'NO_RESTOCK' && !item.noRestockReason)
        throw new Error('سبب عدم إعادة البند للمخزون مطلوب.');
    }
    return items;
  };

  const requestQuote = async () => {
    try {
      const items = validateDraft();
      setSaving(true);
      setQuote(
        (
          await api.post('/api/admin/return-authorizations/quote', {
            orderId: Number(invoice.id),
            items,
          })
        ).data
      );
      setCreateKey(createIdempotencyKey('return-card'));
    } catch (quoteError) {
      setToast({ severity: 'error', message: quoteError.message });
    } finally {
      setSaving(false);
    }
  };

  const createAuthorization = async () => {
    try {
      const items = validateDraft();
      if (!reason.trim()) throw new Error('سبب المرتجع مطلوب.');
      setSaving(true);
      const response = await api.post(
        '/api/admin/return-authorizations',
        {
          orderId: Number(invoice.id),
          items,
          reason: reason.trim(),
          expiresAt: new Date(Date.now() + Number(expiryHours) * 60 * 60 * 1000).toISOString(),
        },
        { headers: { 'Idempotency-Key': createKey } }
      );
      setCreateOpen(false);
      setInvoice(null);
      setQuote(null);
      setReason('');
      setDetail(response.data);
      setDetailOpen(true);
      setToast({ message: 'تم إصدار بطاقة المرتجع وحجز الكميات المحددة.' });
      await load(1, filters);
    } catch (createError) {
      setToast({ severity: 'error', message: createError.message });
    } finally {
      setSaving(false);
    }
  };

  const openDetail = async (row) => {
    setSaving(true);
    try {
      setDetail((await api.get(`/api/admin/return-authorizations/${row.id}`)).data);
      setDetailOpen(true);
    } catch (detailError) {
      setToast({ severity: 'error', message: detailError.message });
    } finally {
      setSaving(false);
    }
  };

  const printCard = async (authorization) => {
    setSaving(true);
    try {
      await api.post(`/api/admin/return-authorizations/${authorization.id}/print-request`, {
        requestKey: createIdempotencyKey('return-card-print'),
        copies: 1,
        reason: 'طباعة بطاقة المرتجع',
      });
      navigate(`/return-authorizations/${authorization.id}/print`);
    } catch (printError) {
      setToast({ severity: 'error', message: printError.message });
    } finally {
      setSaving(false);
    }
  };

  const confirmAction = async () => {
    if (!pendingAction) return;
    setSaving(true);
    try {
      const endpoint = `/api/admin/return-authorizations/${pendingAction.row.id}/${pendingAction.type}`;
      const response = await api.post(
        endpoint,
        pendingAction.type === 'revoke'
          ? { reason: 'إلغاء يدوي من مدير النظام' }
          : { requestKey: createIdempotencyKey('return-card-reissue') }
      );
      setPendingAction(null);
      setToast({
        message:
          pendingAction.type === 'revoke'
            ? 'تم إلغاء بطاقة المرتجع.'
            : 'تم إصدار رمز جديد وإبطال الرمز السابق.',
      });
      if (response.data) {
        setDetail(response.data);
        setDetailOpen(true);
      }
      await load(page, filters);
    } catch (actionError) {
      setToast({ severity: 'error', message: actionError.message });
    } finally {
      setSaving(false);
    }
  };

  const columns = [
    {
      key: 'authorizationNumber',
      label: 'رقم البطاقة',
      render: (row) => <strong className="a4-ltr">{row.authorizationNumber}</strong>,
    },
    {
      key: 'invoiceNumber',
      label: 'الفاتورة',
      render: (row) => <span className="a4-ltr">{row.invoiceNumber}</span>,
    },
    { key: 'itemCount', label: 'البنود', render: (row) => number(row.itemCount) },
    { key: 'totalRefund', label: 'مبلغ الرد', render: (row) => money(row.totalRefund) },
    {
      key: 'status',
      label: 'الحالة',
      render: (row) => <StatusChip status={row.status} label={statusLabel(row.status)} />,
    },
    { key: 'expiresAt', label: 'الانتهاء', render: (row) => dateTime(row.expiresAt) },
    {
      key: 'actions',
      label: 'الإجراءات',
      render: (row) => (
        <div className="table-actions">
          <Tooltip title="التفاصيل">
            <IconButton size="small" onClick={() => openDetail(row)}>
              <VisibilityRounded fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="طباعة 80 مم">
            <span>
              <IconButton
                size="small"
                onClick={() => printCard(row)}
                disabled={row.status !== 'ACTIVE'}
              >
                <PrintRounded fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>
          <Tooltip title="إعادة إصدار الرمز">
            <span>
              <IconButton
                size="small"
                onClick={() => setPendingAction({ type: 'reissue', row })}
                disabled={row.status !== 'ACTIVE'}
              >
                <ReplayRounded fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>
          <Tooltip title="إلغاء البطاقة">
            <span>
              <IconButton
                size="small"
                color="error"
                onClick={() => setPendingAction({ type: 'revoke', row })}
                disabled={row.status !== 'ACTIVE'}
              >
                <BlockRounded fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>
        </div>
      ),
    },
  ];

  return (
    <div className="a4-page return-authorizations-page">
      <PageHeader
        title="بطاقات المرتجع"
        description="بطاقات QR دقيقة لمرة واحدة؛ المسح للمعاينة والتنفيذ الذري من شيفت الكاشير."
        actions={
          <>
            <Button variant="outlined" startIcon={<RefreshRounded />} onClick={() => load(page)}>
              تحديث
            </Button>
            <Button
              variant="contained"
              startIcon={<AddRounded />}
              onClick={() => {
                setInvoice(null);
                setInvoiceId('');
                setQuote(null);
                setCreateOpen(true);
              }}
            >
              إصدار بطاقة
            </Button>
          </>
        }
      />

      <FilterPanel
        resultCount={total}
        onApply={() => load(1, filters)}
        onReset={() => {
          setFilters(INITIAL_FILTERS);
          load(1, INITIAL_FILTERS);
        }}
      >
        <Field label="الحالة">
          <TextField
            select
            value={filters.status}
            onChange={(event) => setFilters((value) => ({ ...value, status: event.target.value }))}
          >
            <MenuItem value="">الكل</MenuItem>
            <MenuItem value="ACTIVE">فعالة</MenuItem>
            <MenuItem value="CONSUMED">مستخدمة</MenuItem>
            <MenuItem value="REVOKED">ملغاة</MenuItem>
            <MenuItem value="EXPIRED">منتهية</MenuItem>
          </TextField>
        </Field>
        <Field label="رقم الفاتورة" ltr>
          <TextField
            value={filters.invoiceNumber}
            onChange={(event) =>
              setFilters((value) => ({ ...value, invoiceNumber: event.target.value }))
            }
          />
        </Field>
        <Field label="من تاريخ">
          <TextField
            type="date"
            value={filters.startDate}
            onChange={(event) =>
              setFilters((value) => ({ ...value, startDate: event.target.value }))
            }
          />
        </Field>
        <Field label="إلى تاريخ">
          <TextField
            type="date"
            value={filters.endDate}
            onChange={(event) => setFilters((value) => ({ ...value, endDate: event.target.value }))}
          />
        </Field>
      </FilterPanel>

      {error && <Alert severity="error">{error}</Alert>}
      <section className="a4-page-section">
        {loading ? (
          <LoadingState />
        ) : (
          <>
            <DataTable
              columns={columns}
              rows={rows}
              mobilePrimary={(row) => row.authorizationNumber}
            />
            {pageCount > 1 && (
              <Pagination
                className="return-authorizations-page__pagination"
                count={pageCount}
                page={page}
                onChange={(_, nextPage) => load(nextPage)}
              />
            )}
          </>
        )}
      </section>

      <Dialog
        open={createOpen}
        onClose={saving ? undefined : () => setCreateOpen(false)}
        fullWidth
        maxWidth="lg"
      >
        <DialogTitle>إصدار بطاقة مرتجع دقيقة</DialogTitle>
        <DialogContent dividers>
          <div className="return-authorization-form">
            <div className="return-authorization-form__lookup">
              <Field label="معرّف الفاتورة" required ltr>
                <TextField
                  value={invoiceId}
                  onChange={(event) => setInvoiceId(event.target.value)}
                  onKeyDown={(event) => event.key === 'Enter' && prepareInvoice()}
                />
              </Field>
              <Button
                variant="outlined"
                startIcon={<SearchRounded />}
                onClick={() => prepareInvoice()}
                disabled={saving}
              >
                تحميل الفاتورة
              </Button>
            </div>
            {invoice && (
              <>
                <Alert severity="info">
                  الفاتورة <strong className="a4-ltr">{invoice.invoice_number}</strong> — الخادم
                  سيحسب المبلغ وتوزيعه ولا يقبل مبلغًا يدويًا.
                </Alert>
                <div className="return-authorization-items">
                  {invoiceItems.map((item) => {
                    const remaining = remainingQuantity(item);
                    const draft = itemDrafts[item.id] || {};
                    return (
                      <article key={item.id} className={remaining === 0 ? 'is-disabled' : ''}>
                        <Checkbox
                          checked={Boolean(draft.selected)}
                          disabled={remaining === 0}
                          onChange={(event) => {
                            setItemDrafts((value) => ({
                              ...value,
                              [item.id]: { ...value[item.id], selected: event.target.checked },
                            }));
                            setQuote(null);
                          }}
                        />
                        <div className="return-authorization-items__name">
                          <strong>{item.product_name || item.productName}</strong>
                          <span>المتبقي {number(remaining)}</span>
                        </div>
                        <Field label="الكمية">
                          <TextField
                            type="number"
                            value={draft.quantity ?? 0}
                            disabled={!draft.selected}
                            onChange={(event) => {
                              setItemDrafts((value) => ({
                                ...value,
                                [item.id]: {
                                  ...value[item.id],
                                  quantity: Number(event.target.value),
                                },
                              }));
                              setQuote(null);
                            }}
                            slotProps={{ htmlInput: { min: 1, max: remaining } }}
                          />
                        </Field>
                        <Field label="حالة المخزون">
                          <TextField
                            select
                            value={draft.disposition || 'RESTOCK'}
                            disabled={!draft.selected}
                            onChange={(event) => {
                              setItemDrafts((value) => ({
                                ...value,
                                [item.id]: {
                                  ...value[item.id],
                                  disposition: event.target.value,
                                },
                              }));
                              setQuote(null);
                            }}
                          >
                            <MenuItem value="RESTOCK">يعود للمخزون</MenuItem>
                            <MenuItem value="NO_RESTOCK">تالف / لا يعود</MenuItem>
                          </TextField>
                        </Field>
                        {draft.disposition === 'NO_RESTOCK' && (
                          <Field
                            className="return-authorization-items__reason"
                            label="سبب التلف"
                            required
                          >
                            <TextField
                              value={draft.noRestockReason || ''}
                              disabled={!draft.selected}
                              onChange={(event) => {
                                setItemDrafts((value) => ({
                                  ...value,
                                  [item.id]: {
                                    ...value[item.id],
                                    noRestockReason: event.target.value,
                                  },
                                }));
                                setQuote(null);
                              }}
                            />
                          </Field>
                        )}
                      </article>
                    );
                  })}
                </div>
                <FieldGrid>
                  <Field label="سبب المرتجع" required>
                    <TextField
                      value={reason}
                      onChange={(event) => setReason(event.target.value)}
                      multiline
                      minRows={2}
                    />
                  </Field>
                  <Field label="الصلاحية بالساعات" required>
                    <TextField
                      type="number"
                      value={expiryHours}
                      onChange={(event) => setExpiryHours(Number(event.target.value))}
                      slotProps={{ htmlInput: { min: 1, max: 168 } }}
                    />
                  </Field>
                </FieldGrid>
                {quote && (
                  <div className="return-authorization-quote">
                    <strong>إجمالي الرد: {money(quote.totalRefund)}</strong>
                    {(quote.allocations || []).map((allocation) => (
                      <span key={`${allocation.method}-${allocation.amount}`}>
                        {allocation.methodName}: {money(allocation.amount)} ·{' '}
                        {allocation.refundMode === 'CASH_DRAWER' ? 'من العهدة' : 'مرجع خارجي'}
                      </span>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateOpen(false)} disabled={saving}>
            إغلاق
          </Button>
          <Button variant="outlined" onClick={requestQuote} disabled={!invoice || saving}>
            حساب المرتجع
          </Button>
          <Button variant="contained" onClick={createAuthorization} disabled={!quote || saving}>
            {saving ? 'جاري الإصدار...' : 'إصدار البطاقة'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={detailOpen}
        onClose={saving ? undefined : () => setDetailOpen(false)}
        fullWidth
        maxWidth="md"
      >
        <DialogTitle>بطاقة {detail?.authorizationNumber}</DialogTitle>
        <DialogContent dividers>
          {detail && (
            <div className="return-authorization-detail">
              <StatusChip status={detail.status} label={statusLabel(detail.status)} />
              <div className="return-authorization-detail__grid">
                <span>الفاتورة</span>
                <strong className="a4-ltr">{detail.invoiceNumber}</strong>
                <span>الإجمالي</span>
                <strong>{money(detail.totalRefund)}</strong>
                <span>الانتهاء</span>
                <strong>{dateTime(detail.expiresAt)}</strong>
                <span>السبب</span>
                <strong>{detail.reason}</strong>
              </div>
              <div className="return-authorization-detail__items">
                {(detail.items || []).map((item) => (
                  <div key={item.id || item.orderItemId}>
                    <span>
                      {item.productName} × {number(item.quantity)}
                    </span>
                    <strong>
                      {item.disposition === 'RESTOCK' ? 'يعود للمخزون' : 'لا يعود للمخزون'}
                    </strong>
                  </div>
                ))}
              </div>
            </div>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDetailOpen(false)}>إغلاق</Button>
          <Button
            variant="contained"
            startIcon={<PrintRounded />}
            onClick={() => printCard(detail)}
            disabled={detail?.status !== 'ACTIVE' || saving}
          >
            طباعة بطاقة 80 مم
          </Button>
        </DialogActions>
      </Dialog>

      <ConfirmDialog
        open={Boolean(pendingAction)}
        title={pendingAction?.type === 'revoke' ? 'إلغاء بطاقة المرتجع' : 'إعادة إصدار الرمز'}
        description={
          pendingAction?.type === 'revoke'
            ? `سيُلغى الرمز الخاص بـ«${pendingAction?.row.authorizationNumber || ''}» ولن يقبله الكاشير.`
            : `سيُبطل الرمز السابق لـ«${pendingAction?.row.authorizationNumber || ''}» ويصدر رمز جديد.`
        }
        confirmLabel={pendingAction?.type === 'revoke' ? 'إلغاء البطاقة' : 'إعادة الإصدار'}
        danger={pendingAction?.type === 'revoke'}
        loading={saving}
        onClose={() => setPendingAction(null)}
        onConfirm={confirmAction}
      />
      <AppSnackbar state={toast} onClose={() => setToast(null)} />
    </div>
  );
}

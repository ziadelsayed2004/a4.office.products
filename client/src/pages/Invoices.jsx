import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Alert,
  Button,
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
  AssignmentReturnRounded,
  PictureAsPdfRounded,
  PrintRounded,
  QrCodeScannerRounded,
  RefreshRounded,
  SearchRounded,
  VisibilityRounded,
} from '@mui/icons-material';
import { api } from '../services/apiClient.js';
import { printReceiptInFrame } from '../services/printService.js';
import { useAuth } from '../app/AuthContext.jsx';
import { PageHeader } from '../components/PageHeader.jsx';
import { DataTable } from '../components/DataTable.jsx';
import { FilterPanel } from '../components/FilterPanel.jsx';
import { Field } from '../components/forms/Field.jsx';
import { InvoiceDetails } from '../components/InvoiceDetails.jsx';
import { LoadingState } from '../components/LoadingState.jsx';
import { AppSnackbar } from '../components/AppSnackbar.jsx';
import { StatusChip } from '../components/StatusChip.jsx';
import { dateTime, money, statusLabel } from '../utils/formatters.js';
import '../styles/Invoices.css';

const PAGE_SIZE = 25;

const initialAdminFilters = {
  invoiceNumber: '',
  receiptNumber: '',
  startDate: '',
  endDate: '',
  cashierId: '',
  shiftId: '',
  paymentMethod: '',
  origin: '',
  status: '',
  customer: '',
  productName: '',
  sku: '',
};

function first(...values) {
  return values.find((value) => value !== undefined && value !== null && value !== '');
}

function normalizeList(response) {
  const data = response?.data ?? response ?? {};
  if (Array.isArray(data)) return { rows: data, total: data.length };
  const rows = Array.isArray(data.rows) ? data.rows : [];
  return { rows, total: Number(data.total ?? rows.length) };
}

function invoiceId(invoice) {
  return first(invoice?.id, invoice?.invoice_id, invoice?.invoiceId);
}

function invoiceNumber(invoice) {
  return first(
    invoice?.invoice_number,
    invoice?.invoiceNumber,
    invoiceId(invoice) ? `#${invoiceId(invoice)}` : '—'
  );
}

function receiptNumber(invoice) {
  return first(
    invoice?.receipt_number,
    invoice?.receiptNumber,
    invoice?.receipts?.[0]?.receipt_number,
    invoice?.receipts?.[0]?.receiptNumber
  );
}

function receiptId(receipt) {
  return first(
    receipt?.id,
    receipt?.receipt_id,
    receipt?.receiptId,
    receipt?.receipt_number,
    receipt?.receiptNumber
  );
}

function originLabel(value) {
  return (
    {
      SALE: 'بيع مباشر',
      ORDER_SALE: 'بيع مباشر',
      PREORDER_PICKUP: 'استلام حجز',
    }[String(value || '').toUpperCase()] ||
    value ||
    '—'
  );
}

function buildQuery(filters, page = 1) {
  const query = new URLSearchParams({
    limit: String(PAGE_SIZE),
    offset: String((page - 1) * PAGE_SIZE),
  });
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== '' && value !== null && value !== undefined) query.set(key, String(value));
  });
  return query;
}

export default function Invoices() {
  const { isAdmin, currentShift } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [adminFilters, setAdminFilters] = useState(initialAdminFilters);
  const [lookup, setLookup] = useState({ type: 'invoiceNumber', value: '', shiftId: '' });
  const [cashierMode, setCashierMode] = useState('own');
  const [selected, setSelected] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedReceiptId, setSelectedReceiptId] = useState('');
  const [printReason, setPrintReason] = useState('');
  const [printing, setPrinting] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [toast, setToast] = useState(null);

  const hasOpenShift = currentShift?.status === 'OPEN';
  const canPrint = isAdmin || hasOpenShift;
  const receipts = useMemo(() => {
    if (Array.isArray(selected?.receipts) && selected.receipts.length) return selected.receipts;
    const id = first(selected?.receipt_id, selected?.receiptId);
    const number = first(selected?.receipt_number, selected?.receiptNumber);
    return id || number ? [{ id, receipt_number: number, print_count: selected?.print_count }] : [];
  }, [selected]);

  const selectedReceipt =
    receipts.find((item) => String(receiptId(item)) === String(selectedReceiptId)) || receipts[0];

  const assignList = (response, nextPage) => {
    const normalized = normalizeList(response);
    setRows(normalized.rows);
    setTotal(normalized.total);
    setPage(nextPage);
  };

  const loadAdmin = async (nextPage = 1, filters = adminFilters) => {
    setLoading(true);
    setError('');
    try {
      const query = buildQuery(filters, nextPage);
      assignList(await api.get(`/api/admin/invoices?${query}`), nextPage);
    } catch (err) {
      setRows([]);
      setTotal(0);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const loadOwnShift = async (nextPage = 1) => {
    setLoading(true);
    setError('');
    setCashierMode('own');
    try {
      const query = buildQuery({ ownShift: true, shiftId: lookup.shiftId }, nextPage);
      assignList(await api.get(`/api/pos/invoices/lookup?${query}`), nextPage);
    } catch (err) {
      setRows([]);
      setTotal(0);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const lookupExactInvoice = async (overrideLookup = null) => {
    const criteria = overrideLookup || lookup;
    const value = criteria.value.trim();
    if (!value) {
      setToast({ severity: 'warning', message: 'أدخل رقم الفاتورة أو الإيصال أو رمز QR.' });
      return;
    }

    setLoading(true);
    setError('');
    setCashierMode('exact');
    try {
      const query = new URLSearchParams({ [criteria.type]: value });
      const response = await api.get(`/api/pos/invoices/lookup?${query}`);
      const normalized = normalizeList(response);
      setRows(normalized.rows);
      setTotal(normalized.total);
      setPage(1);
      if (normalized.rows.length === 1) await openDetails(normalized.rows[0]);
      if (overrideLookup?.type === 'token') setSearchParams({}, { replace: true });
    } catch (err) {
      setRows([]);
      setTotal(0);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchDetail = async (row, { showDialog = true } = {}) => {
    const id = invoiceId(row);
    if (!id) {
      setSelected(row);
      setDetailOpen(showDialog);
      return row;
    }

    setDetailLoading(true);
    try {
      let endpoint = isAdmin ? `/api/admin/invoices/${id}` : `/api/pos/invoices/${id}`;
      if (!isAdmin && cashierMode === 'exact' && lookup.value.trim()) {
        endpoint += `?${new URLSearchParams({ [lookup.type]: lookup.value.trim() })}`;
      }
      const response = await api.get(endpoint);
      const detail = response.data || response || row;
      setSelected(detail);
      const detailReceipts = Array.isArray(detail.receipts) ? detail.receipts : [];
      setSelectedReceiptId(
        receiptId(detailReceipts[0]) || first(detail.receipt_id, detail.receiptId, '')
      );
      setDetailOpen(showDialog);
      return detail;
    } catch (err) {
      setToast({ severity: 'error', message: err.message });
      return null;
    } finally {
      setDetailLoading(false);
    }
  };

  const openDetails = (row) => {
    setPrintReason('');
    if (!isAdmin && Array.isArray(row?.items)) {
      setSelected(row);
      const rowReceipts = Array.isArray(row.receipts) ? row.receipts : [];
      setSelectedReceiptId(receiptId(rowReceipts[0]) || first(row.receipt_id, row.receiptId, ''));
      setDetailOpen(true);
      return Promise.resolve(row);
    }
    return fetchDetail(row);
  };

  const downloadInvoicePdf = async () => {
    const id = invoiceId(selected);
    if (!id) return;
    setExportingPdf(true);
    try {
      let endpoint = isAdmin ? `/api/admin/invoices/${id}/pdf` : `/api/pos/invoices/${id}/pdf`;
      if (!isAdmin && cashierMode === 'exact' && lookup.value.trim()) {
        endpoint += `?${new URLSearchParams({ [lookup.type]: lookup.value.trim() })}`;
      }
      await api.download(endpoint, `invoice_${invoiceNumber(selected)}.pdf`);
      setToast({ message: 'تم تجهيز ملف PDF للتنزيل.' });
    } catch (err) {
      setToast({ severity: 'error', message: err.message });
    } finally {
      setExportingPdf(false);
    }
  };

  const printSelectedReceipt = async () => {
    const id =
      !isAdmin && cashierMode === 'exact'
        ? first(
            selectedReceipt?.receipt_number,
            selectedReceipt?.receiptNumber,
            receiptId(selectedReceipt)
          )
        : receiptId(selectedReceipt);
    if (!id) return;
    if (!canPrint) {
      setToast({ severity: 'warning', message: 'يلزم شيفت مفتوح خاص بك لطلب الطباعة.' });
      return;
    }

    setPrinting(true);
    try {
      const count = Number(first(selectedReceipt.print_count, selectedReceipt.printCount, 0));
      await printReceiptInFrame({
        receiptId: id,
        reason: printReason,
        isReprint: count > 0,
      });
      setPrintReason('');
      setToast({ message: 'تم تسجيل طلب الطباعة وفتح مستند الإيصال.' });
      await fetchDetail(selected, { showDialog: true });
    } catch (err) {
      setToast({ severity: 'error', message: err.message });
    } finally {
      setPrinting(false);
    }
  };

  useEffect(() => {
    const token = searchParams.get('token')?.trim();
    if (token && !isAdmin) {
      const tokenLookup = { type: 'token', value: token, shiftId: '' };
      setLookup(tokenLookup);
      lookupExactInvoice(tokenLookup);
    } else if (isAdmin) {
      const linkedFilters = {
        ...initialAdminFilters,
        invoiceNumber: searchParams.get('invoiceNumber')?.trim() || '',
        receiptNumber: searchParams.get('receiptNumber')?.trim() || '',
        shiftId: searchParams.get('shiftId')?.trim() || '',
        cashierId: searchParams.get('cashierId')?.trim() || '',
      };
      setAdminFilters(linkedFilters);
      loadAdmin(1, linkedFilters);
    } else loadOwnShift(1);
  }, [isAdmin]);

  const columns = useMemo(
    () => [
      {
        key: 'invoice_number',
        label: 'رقم الفاتورة',
        render: (row) => <strong className="a4-ltr">{invoiceNumber(row)}</strong>,
      },
      {
        key: 'receipt_number',
        label: 'رقم الإيصال',
        render: (row) => <span className="a4-ltr">{receiptNumber(row) || '—'}</span>,
      },
      {
        key: 'origin',
        label: 'المصدر',
        render: (row) => originLabel(first(row.origin, row.reference_type)),
      },
      {
        key: 'status',
        label: 'الحالة',
        render: (row) => <StatusChip status={row.status} label={statusLabel(row.status)} />,
      },
      {
        key: 'cashier_name',
        label: 'الكاشير',
        render: (row) => first(row.cashier_name, row.cashier?.name, '—'),
      },
      {
        key: 'shift_id',
        label: 'الشيفت',
        render: (row) =>
          first(row.shift_id, row.shift?.id) ? `#${first(row.shift_id, row.shift?.id)}` : '—',
      },
      {
        key: 'customer_name',
        label: 'العميل',
        render: (row) => first(row.customer_name, row.customer?.name, '—'),
      },
      {
        key: 'total',
        label: 'الإجمالي',
        render: (row) => <strong>{money(first(row.total, row.total_amount, 0))}</strong>,
      },
      {
        key: 'created_at',
        label: 'التاريخ',
        render: (row) => dateTime(first(row.created_at, row.createdAt)),
      },
      {
        key: 'actions',
        label: 'الإجراءات',
        render: (row) => (
          <Tooltip title="عرض الفاتورة">
            <IconButton size="small" onClick={() => openDetails(row)} aria-label="عرض الفاتورة">
              <VisibilityRounded fontSize="small" />
            </IconButton>
          </Tooltip>
        ),
      },
    ],
    [isAdmin]
  );

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const changePage = (_, nextPage) => {
    if (isAdmin) loadAdmin(nextPage);
    else if (cashierMode === 'own') loadOwnShift(nextPage);
  };

  const resetAdminFilters = () => {
    setAdminFilters(initialAdminFilters);
    loadAdmin(1, initialAdminFilters);
  };

  return (
    <div className="a4-page invoices-page">
      <PageHeader
        title="مركز الفواتير"
        description={
          isAdmin
            ? 'ابحث في كل الفواتير وافتح نسختها المحفوظة وسجلها التشغيلي.'
            : 'افتح فاتورة برقمها أو رقم الإيصال أو QR، أو اعرض فواتير شيفتاتك.'
        }
        actions={
          <Button
            variant="outlined"
            startIcon={<RefreshRounded />}
            onClick={() => (isAdmin ? loadAdmin(page) : loadOwnShift(page))}
            disabled={loading}
          >
            تحديث
          </Button>
        }
      />

      {isAdmin ? (
        <FilterPanel resultCount={total} onApply={() => loadAdmin(1)} onReset={resetAdminFilters}>
          <Field label="رقم الفاتورة" ltr>
            <TextField
              value={adminFilters.invoiceNumber}
              onChange={(event) =>
                setAdminFilters((state) => ({ ...state, invoiceNumber: event.target.value }))
              }
            />
          </Field>
          <Field label="رقم الإيصال" ltr>
            <TextField
              value={adminFilters.receiptNumber}
              onChange={(event) =>
                setAdminFilters((state) => ({ ...state, receiptNumber: event.target.value }))
              }
            />
          </Field>
          <Field label="من تاريخ">
            <TextField
              type="date"
              value={adminFilters.startDate}
              onChange={(event) =>
                setAdminFilters((state) => ({ ...state, startDate: event.target.value }))
              }
            />
          </Field>
          <Field label="إلى تاريخ">
            <TextField
              type="date"
              value={adminFilters.endDate}
              onChange={(event) =>
                setAdminFilters((state) => ({ ...state, endDate: event.target.value }))
              }
            />
          </Field>
          <Field label="رقم الكاشير">
            <TextField
              type="number"
              value={adminFilters.cashierId}
              onChange={(event) =>
                setAdminFilters((state) => ({ ...state, cashierId: event.target.value }))
              }
            />
          </Field>
          <Field label="رقم الشيفت">
            <TextField
              type="number"
              value={adminFilters.shiftId}
              onChange={(event) =>
                setAdminFilters((state) => ({ ...state, shiftId: event.target.value }))
              }
            />
          </Field>
          <Field label="طريقة الدفع">
            <TextField
              value={adminFilters.paymentMethod}
              onChange={(event) =>
                setAdminFilters((state) => ({ ...state, paymentMethod: event.target.value }))
              }
            />
          </Field>
          <Field label="مصدر الفاتورة">
            <TextField
              select
              value={adminFilters.origin}
              onChange={(event) =>
                setAdminFilters((state) => ({ ...state, origin: event.target.value }))
              }
            >
              <MenuItem value="">الكل</MenuItem>
              <MenuItem value="SALE">بيع مباشر</MenuItem>
              <MenuItem value="PREORDER_PICKUP">استلام حجز</MenuItem>
            </TextField>
          </Field>
          <Field label="حالة الفاتورة">
            <TextField
              select
              value={adminFilters.status}
              onChange={(event) =>
                setAdminFilters((state) => ({ ...state, status: event.target.value }))
              }
            >
              <MenuItem value="">الكل</MenuItem>
              <MenuItem value="COMPLETED">مكتملة</MenuItem>
              <MenuItem value="PARTIALLY_RETURNED">مرتجع جزئي</MenuItem>
              <MenuItem value="RETURNED">مرتجعة</MenuItem>
              <MenuItem value="VOID">ملغاة</MenuItem>
            </TextField>
          </Field>
          <Field label="العميل">
            <TextField
              value={adminFilters.customer}
              onChange={(event) =>
                setAdminFilters((state) => ({ ...state, customer: event.target.value }))
              }
            />
          </Field>
          <Field label="المنتج">
            <TextField
              value={adminFilters.productName}
              onChange={(event) =>
                setAdminFilters((state) => ({ ...state, productName: event.target.value }))
              }
            />
          </Field>
          <Field label="SKU أو الباركود" ltr>
            <TextField
              value={adminFilters.sku}
              onChange={(event) =>
                setAdminFilters((state) => ({ ...state, sku: event.target.value }))
              }
            />
          </Field>
        </FilterPanel>
      ) : (
        <>
          <section className="a4-page-section invoice-lookup-panel">
            <div className="invoice-lookup-panel__heading">
              <QrCodeScannerRounded color="primary" />
              <div>
                <h2 className="a4-section-title">بحث مباشر آمن</h2>
                <p className="a4-section-subtitle">
                  البحث الدقيق لا يغير الدفع أو المخزون أو الشيفت.
                </p>
              </div>
            </div>
            <div className="invoice-lookup-panel__form">
              <Field label="نوع البحث">
                <TextField
                  select
                  value={lookup.type}
                  onChange={(event) =>
                    setLookup((state) => ({ ...state, type: event.target.value }))
                  }
                >
                  <MenuItem value="invoiceNumber">رقم الفاتورة</MenuItem>
                  <MenuItem value="receiptNumber">رقم الإيصال</MenuItem>
                  <MenuItem value="token">رمز QR الآمن</MenuItem>
                </TextField>
              </Field>
              <Field label="القيمة" ltr>
                <TextField
                  autoFocus
                  value={lookup.value}
                  onChange={(event) =>
                    setLookup((state) => ({ ...state, value: event.target.value }))
                  }
                  onKeyDown={(event) => event.key === 'Enter' && lookupExactInvoice()}
                />
              </Field>
              <Button
                variant="contained"
                startIcon={<SearchRounded />}
                onClick={() => lookupExactInvoice()}
                disabled={loading}
              >
                فتح الفاتورة
              </Button>
            </div>
          </section>

          <section className="a4-page-section invoice-own-shift-panel">
            <div>
              <h2 className="a4-section-title">فواتير شيفتاتي</h2>
              <p className="a4-section-subtitle">
                اترك رقم الشيفت فارغاً لعرض فواتير الشيفتات المسموحة لك.
              </p>
            </div>
            <div className="invoice-own-shift-panel__form">
              <Field label="رقم الشيفت">
                <TextField
                  type="number"
                  value={lookup.shiftId}
                  onChange={(event) =>
                    setLookup((state) => ({ ...state, shiftId: event.target.value }))
                  }
                />
              </Field>
              <Button
                variant="outlined"
                startIcon={<SearchRounded />}
                onClick={() => loadOwnShift(1)}
                disabled={loading}
              >
                عرض القائمة
              </Button>
            </div>
          </section>
        </>
      )}

      {error && <Alert severity="error">{error}</Alert>}
      {!isAdmin && !hasOpenShift && (
        <Alert severity="info">
          عرض الفواتير متاح بدون شيفت مفتوح. الطباعة وإعادتها تحتاجان شيفتاً مفتوحاً خاصاً بك.
        </Alert>
      )}

      <section className="a4-page-section">
        {loading ? (
          <LoadingState label="جاري تحميل الفواتير..." />
        ) : (
          <DataTable
            columns={columns}
            rows={rows}
            mobilePrimary={invoiceNumber}
            emptyTitle="لا توجد فواتير"
            emptyDescription="غيّر معايير البحث أو الفلاتر ثم حاول مرة أخرى."
          />
        )}
        {!loading && total > PAGE_SIZE && cashierMode !== 'exact' && (
          <div className="invoices-pagination">
            <Pagination count={pageCount} page={page} onChange={changePage} color="primary" />
            <span>{total} فاتورة</span>
          </div>
        )}
      </section>

      <Dialog
        open={detailOpen}
        onClose={printing ? undefined : () => setDetailOpen(false)}
        fullWidth
        maxWidth="lg"
      >
        <DialogTitle>تفاصيل الفاتورة {selected ? invoiceNumber(selected) : ''}</DialogTitle>
        <DialogContent dividers>
          {detailLoading ? (
            <LoadingState />
          ) : (
            <InvoiceDetails invoice={selected} isAdmin={isAdmin} />
          )}
          {receipts.length > 0 && (
            <section className="invoice-print-options">
              <h3>طلب الطباعة</h3>
              <div className="invoice-print-options__fields">
                <Field label="الإيصال">
                  <TextField
                    select
                    value={selectedReceiptId || receiptId(receipts[0])}
                    onChange={(event) => setSelectedReceiptId(event.target.value)}
                  >
                    {receipts.map((receipt) => (
                      <MenuItem key={receiptId(receipt)} value={receiptId(receipt)}>
                        {first(
                          receipt.receipt_number,
                          receipt.receiptNumber,
                          `#${receiptId(receipt)}`
                        )}
                      </MenuItem>
                    ))}
                  </TextField>
                </Field>
                <Field label="سبب إعادة الطباعة" hint="اختياري">
                  <TextField
                    value={printReason}
                    onChange={(event) => setPrintReason(event.target.value)}
                  />
                </Field>
              </div>
              {!isAdmin && !hasOpenShift && (
                <Alert severity="warning">الطباعة معطلة حتى تفتح شيفتاً خاصاً بك.</Alert>
              )}
            </section>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDetailOpen(false)} disabled={printing || exportingPdf}>
            إغلاق
          </Button>
          {isAdmin && selected && (
            <Button
              variant="outlined"
              startIcon={<AssignmentReturnRounded />}
              onClick={() => {
                setDetailOpen(false);
                navigate('/returns?tab=cards');
              }}
            >
              إدارة بطاقات اعتماد المرتجع
            </Button>
          )}
          {selected && (
            <Button
              variant="outlined"
              startIcon={<PictureAsPdfRounded />}
              onClick={downloadInvoicePdf}
              disabled={exportingPdf || (!isAdmin && !hasOpenShift)}
            >
              {exportingPdf ? 'جاري إنشاء PDF...' : 'تنزيل PDF'}
            </Button>
          )}
          {receipts.length > 0 && (
            <Button
              variant="contained"
              startIcon={<PrintRounded />}
              onClick={printSelectedReceipt}
              disabled={printing || !canPrint}
            >
              {printing ? 'جاري تجهيز الطباعة...' : 'طباعة الإيصال'}
            </Button>
          )}
        </DialogActions>
      </Dialog>

      <AppSnackbar state={toast} onClose={() => setToast(null)} />
    </div>
  );
}

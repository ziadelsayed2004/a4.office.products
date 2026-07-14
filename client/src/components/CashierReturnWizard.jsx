import { useMemo, useRef, useState } from 'react';
import {
  Alert,
  Button,
  Chip,
  Divider,
  IconButton,
  MenuItem,
  Paper,
  Step,
  StepLabel,
  Stepper,
  TextField,
} from '@mui/material';
import {
  AddRounded,
  AssignmentReturnRounded,
  CheckCircleRounded,
  DeleteOutlineRounded,
  QrCodeScannerRounded,
  RemoveRounded,
  RestartAltRounded,
} from '@mui/icons-material';
import { api } from '../services/apiClient.js';
import { useScannerCapture } from '../hooks/useScannerCapture.js';
import { Field } from './forms/Field.jsx';
import { AppSnackbar } from './AppSnackbar.jsx';
import { createIdempotencyKey } from '../utils/money.js';
import { money, number } from '../utils/formatters.js';
import './CashierReturnWizard.css';

const STEPS = ['تحديد الفاتورة', 'مسح المرتجعات', 'مراجعة المبلغ', 'اعتماد وتنفيذ'];

function bodyOf(response) {
  return response?.data || response || {};
}

function valueOf(value, ...keys) {
  for (const key of keys) {
    if (value?.[key] !== undefined && value?.[key] !== null) return value[key];
  }
  return undefined;
}

function itemId(item) {
  return Number(valueOf(item, 'orderItemId', 'order_item_id', 'id'));
}

function normalizeInvoice(response) {
  const payload = bodyOf(response);
  const invoice = payload.invoice || payload.order || payload;
  const sourceItems = payload.items || invoice.items || [];
  const orderId = Number(valueOf(invoice, 'orderId', 'order_id', 'id'));
  return {
    ...invoice,
    orderId,
    invoiceNumber: valueOf(invoice, 'invoiceNumber', 'invoice_number'),
    receiptNumber: valueOf(invoice, 'receiptNumber', 'receipt_number'),
    items: sourceItems.map((item) => {
      const soldQuantity = Number(valueOf(item, 'soldQuantity', 'sold_quantity', 'quantity') || 0);
      const remaining = Number(
        valueOf(
          item,
          'remainingReturnableQuantity',
          'remaining_returnable_quantity',
          'remainingQuantity',
          'remaining_quantity'
        ) ?? soldQuantity
      );
      return {
        ...item,
        orderItemId: itemId(item),
        productId: Number(valueOf(item, 'productId', 'product_id')),
        productName: valueOf(item, 'productName', 'product_name', 'product_name_snapshot', 'name'),
        sku: valueOf(item, 'sku', 'sku_snapshot'),
        barcode: valueOf(item, 'barcode'),
        unitPrice: Number(valueOf(item, 'unitPrice', 'unit_price') || 0),
        soldQuantity,
        remainingReturnableQuantity: Math.max(0, remaining),
        quantity: 0,
        disposition: 'RESTOCK',
        noRestockReason: '',
      };
    }),
  };
}

function normalizeResolvedItems(response, invoice, scannedCode) {
  const payload = bodyOf(response);
  const values =
    payload.matches ||
    payload.candidates ||
    payload.items ||
    (payload.item || payload.match ? [payload.item || payload.match] : [payload]);
  const candidates = (Array.isArray(values) ? values : [values]).filter(Boolean);
  const ids = new Set(candidates.map(itemId).filter(Number.isFinite));
  const productIds = new Set(
    candidates
      .map((item) => Number(valueOf(item, 'productId', 'product_id', 'id')))
      .filter(Number.isFinite)
  );
  const clean = String(scannedCode || '')
    .trim()
    .toLowerCase();
  return invoice.items.filter((item) => {
    if (ids.has(item.orderItemId)) return true;
    if (productIds.has(item.productId)) return true;
    return [item.sku, item.barcode]
      .filter(Boolean)
      .some((code) => String(code).trim().toLowerCase() === clean);
  });
}

function quoteValue(quote) {
  return quote?.authorization || quote?.quote || quote || {};
}

function allocationKey(allocation, index) {
  return String(
    valueOf(
      allocation,
      'id',
      'paymentMethodId',
      'payment_method_id',
      'methodCode',
      'method_code'
    ) ?? index
  );
}

function isExternalAllocation(allocation) {
  return (
    String(valueOf(allocation, 'refundMode', 'refund_mode') || '').toUpperCase() ===
    'EXTERNAL_REFERENCE'
  );
}

export function CashierReturnWizard({ onComplete }) {
  const activeInputRef = useRef(null);
  const [invoiceCode, setInvoiceCode] = useState('');
  const [itemCode, setItemCode] = useState('');
  const [approvalCode, setApprovalCode] = useState('');
  const [invoice, setInvoice] = useState(null);
  const [candidateItems, setCandidateItems] = useState([]);
  const [reason, setReason] = useState('مرتجع عميل');
  const [quote, setQuote] = useState(null);
  const [approval, setApproval] = useState(null);
  const [approvalCardToken, setApprovalCardToken] = useState('');
  const [refundReferences, setRefundReferences] = useState({});
  const [requestKey, setRequestKey] = useState(() => createIdempotencyKey('return'));
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState(null);

  const selectedItems = useMemo(
    () => (invoice?.items || []).filter((item) => item.quantity > 0),
    [invoice]
  );
  const quoteData = quoteValue(quote);
  const allocations = quoteData.allocations || quote?.allocations || [];
  const totalRefund = Number(
    valueOf(quoteData, 'totalRefund', 'total_refund', 'refundTotal', 'refund_total') || 0
  );
  const activeStep = !invoice ? 0 : !quote ? 1 : !approval ? 2 : 3;

  const resetApproval = () => {
    setApproval(null);
    setApprovalCode('');
    setApprovalCardToken('');
    setRefundReferences({});
    setRequestKey(createIdempotencyKey('return'));
  };

  const invalidateQuote = () => {
    setQuote(null);
    resetApproval();
  };

  const reset = () => {
    setInvoiceCode('');
    setItemCode('');
    setInvoice(null);
    setCandidateItems([]);
    setReason('مرتجع عميل');
    setQuote(null);
    resetApproval();
    requestAnimationFrame(() => activeInputRef.current?.focus());
  };

  const prepareInvoice = async (rawCode = invoiceCode) => {
    const code = String(rawCode || '').trim();
    if (!code || loading) return;
    setLoading(true);
    try {
      const prepared = normalizeInvoice(
        await api.post('/api/pos/returns/prepare', { invoiceCode: code })
      );
      if (!prepared.orderId || !prepared.items.length) {
        throw new Error('الفاتورة لا تحتوي على بنود قابلة للمراجعة.');
      }
      setInvoice(prepared);
      setInvoiceCode(code);
      setCandidateItems([]);
      setQuote(null);
      resetApproval();
      const available = prepared.items.filter((item) => item.remainingReturnableQuantity > 0);
      setToast(
        available.length
          ? { message: 'تم تحديد الفاتورة. امسح المنتجات المرتجعة واحداً تلو الآخر.' }
          : { severity: 'warning', message: 'لا توجد كمية متبقية قابلة للإرجاع في هذه الفاتورة.' }
      );
      requestAnimationFrame(() => activeInputRef.current?.focus());
    } catch (error) {
      setToast({ severity: 'error', message: error.message });
    } finally {
      setLoading(false);
    }
  };

  const incrementItem = (target) => {
    if (!target || target.remainingReturnableQuantity <= 0) {
      setToast({ severity: 'warning', message: 'هذا البند مسترد بالكامل ولا توجد كمية متبقية.' });
      return;
    }
    if (target.quantity >= target.remainingReturnableQuantity) {
      setToast({ severity: 'warning', message: 'لا يمكن تجاوز الكمية المتبقية في الفاتورة.' });
      return;
    }
    setInvoice((current) => ({
      ...current,
      items: current.items.map((item) =>
        item.orderItemId === target.orderItemId ? { ...item, quantity: item.quantity + 1 } : item
      ),
    }));
    setCandidateItems([]);
    setItemCode('');
    invalidateQuote();
  };

  const resolveItem = async (rawCode = itemCode) => {
    const code = String(rawCode || '').trim();
    if (!invoice || !code || loading) return;
    setLoading(true);
    try {
      const response = await api.post('/api/pos/returns/items/resolve', {
        orderId: invoice.orderId,
        code,
      });
      const matches = normalizeResolvedItems(response, invoice, code).filter(
        (item) => item.remainingReturnableQuantity > 0
      );
      if (!matches.length)
        throw new Error('هذا المنتج غير موجود ضمن بنود الفاتورة القابلة للإرجاع.');
      if (matches.length > 1) {
        setCandidateItems(matches);
        setToast({
          severity: 'info',
          message: 'يوجد أكثر من بند مطابق بسعر مختلف؛ اختر البند المقصود.',
        });
      } else {
        incrementItem(matches[0]);
      }
    } catch (error) {
      setToast({ severity: 'error', message: error.message });
    } finally {
      setLoading(false);
    }
  };

  const setItemQuantity = (orderItemId, rawQuantity) => {
    const currentItem = invoice?.items.find((item) => item.orderItemId === orderItemId);
    if (!currentItem) return;
    const quantity = Math.max(
      0,
      Math.min(currentItem.remainingReturnableQuantity, Math.trunc(Number(rawQuantity) || 0))
    );
    setInvoice((current) => ({
      ...current,
      items: current.items.map((item) =>
        item.orderItemId === orderItemId ? { ...item, quantity } : item
      ),
    }));
    invalidateQuote();
  };

  const updateItem = (orderItemId, patch) => {
    setInvoice((current) => ({
      ...current,
      items: current.items.map((item) =>
        item.orderItemId === orderItemId ? { ...item, ...patch } : item
      ),
    }));
    invalidateQuote();
  };

  const requestQuote = async () => {
    if (!selectedItems.length || loading) {
      setToast({ severity: 'warning', message: 'امسح منتجاً مرتجعاً واحداً على الأقل.' });
      return;
    }
    if (!reason.trim()) {
      setToast({ severity: 'warning', message: 'اكتب سبب المرتجع.' });
      return;
    }
    const invalidNoRestock = selectedItems.some(
      (item) => item.disposition === 'NO_RESTOCK' && !item.noRestockReason.trim()
    );
    if (invalidNoRestock) {
      setToast({ severity: 'warning', message: 'اكتب سبب عدم إعادة كل بند محدد إلى المخزون.' });
      return;
    }
    setLoading(true);
    try {
      const response = await api.post('/api/pos/returns/quote', {
        orderId: invoice.orderId,
        reason: reason.trim(),
        items: selectedItems.map((item) => ({
          orderItemId: item.orderItemId,
          quantity: item.quantity,
          disposition: item.disposition,
          noRestockReason: item.disposition === 'NO_RESTOCK' ? item.noRestockReason.trim() : null,
        })),
      });
      setQuote(bodyOf(response));
      resetApproval();
      setToast({ message: 'تم حساب المبلغ. راجعه ثم امسح بطاقة اعتماد الأدمن.' });
      requestAnimationFrame(() => activeInputRef.current?.focus());
    } catch (error) {
      setToast({ severity: 'error', message: error.message });
    } finally {
      setLoading(false);
    }
  };

  const approve = async (rawCode = approvalCode) => {
    const code = String(rawCode || '').trim();
    if (!quote || !code || loading) return;
    setLoading(true);
    try {
      const resolved = bodyOf(await api.post('/api/pos/scan/resolve', { code }));
      const type = String(resolved.type || resolved.kind || '').toLowerCase();
      if (type !== 'return_approval_card') {
        throw new Error('الرمز الممسوح ليس بطاقة اعتماد مرتجع.');
      }
      if (String(resolved.action || '').toUpperCase() !== 'VALID') {
        throw new Error(resolved.message || 'بطاقة الاعتماد غير نشطة.');
      }
      setApproval(resolved.data || resolved.card || resolved);
      setApprovalCardToken(code);
      setApprovalCode('');
      setRequestKey(createIdempotencyKey('return'));
      setToast({ message: 'تم اعتماد البطاقة. راجع مراجع الرد ثم نفّذ المرتجع.' });
    } catch (error) {
      resetApproval();
      setToast({ severity: 'error', message: error.message });
    } finally {
      setLoading(false);
    }
  };

  const execute = async () => {
    if (!quote || !approvalCardToken || loading) return;
    const externalReferences = allocations
      .map((allocation, index) => ({ allocation, key: allocationKey(allocation, index) }))
      .filter(({ allocation }) => isExternalAllocation(allocation))
      .map(({ allocation, key }) => ({
        allocationId: valueOf(allocation, 'paymentMethodId', 'payment_method_id', 'id'),
        referenceNumber: String(refundReferences[key] || '').trim(),
      }));
    if (externalReferences.some((reference) => !reference.referenceNumber)) {
      setToast({ severity: 'warning', message: 'أدخل مرجع الرد لكل طريقة دفع غير نقدية.' });
      return;
    }
    setLoading(true);
    try {
      const response = await api.post(
        '/api/pos/returns/execute',
        {
          orderId: invoice.orderId,
          reason: reason.trim(),
          items: selectedItems.map((item) => ({
            orderItemId: item.orderItemId,
            quantity: item.quantity,
            disposition: item.disposition,
            noRestockReason: item.disposition === 'NO_RESTOCK' ? item.noRestockReason.trim() : null,
          })),
          approvalCardToken,
          refundReferences: externalReferences,
        },
        { headers: { 'Idempotency-Key': requestKey } }
      );
      const result = bodyOf(response);
      reset();
      await onComplete?.(result);
    } catch (error) {
      setToast({ severity: 'error', message: error.message });
    } finally {
      setLoading(false);
    }
  };

  const handleScan = (code) => {
    if (!invoice) return prepareInvoice(code);
    if (!quote) return resolveItem(code);
    return approve(code);
  };

  useScannerCapture({
    onScan: handleScan,
    disabled: loading,
    restoreFocusRef: activeInputRef,
  });

  return (
    <section className="cashier-return-wizard" aria-label="إنشاء مرتجع">
      <Paper variant="outlined" className="cashier-return-wizard__head">
        <div className="cashier-return-wizard__title">
          <span>
            <AssignmentReturnRounded />
          </span>
          <div>
            <h2>إنشاء مرتجع</h2>
            <p>حدّد الفاتورة، امسح ما استلمته فعلياً، ثم اطلب اعتماد الأدمن.</p>
          </div>
        </div>
        <Button startIcon={<RestartAltRounded />} onClick={reset} disabled={loading}>
          بدء من جديد
        </Button>
        <Stepper activeStep={activeStep} alternativeLabel>
          {STEPS.map((label) => (
            <Step key={label}>
              <StepLabel>{label}</StepLabel>
            </Step>
          ))}
        </Stepper>
      </Paper>

      {!invoice && (
        <Paper variant="outlined" className="cashier-return-wizard__panel">
          <Alert severity="info">
            عرض الفاتورة يتم بالـQR أو رقم الفاتورة أو رقم الإيصال بشكل مطابق، والتنفيذ يتطلب شيفتك
            المفتوحة.
          </Alert>
          <div className="cashier-return-wizard__scan-row">
            <Field label="QR أو رقم الفاتورة أو الإيصال" required ltr>
              <TextField
                inputRef={activeInputRef}
                value={invoiceCode}
                onChange={(event) => setInvoiceCode(event.target.value)}
                onKeyDown={(event) => event.key === 'Enter' && prepareInvoice()}
                placeholder="امسح الرمز أو اكتب الرقم"
                slotProps={{ input: { endAdornment: <QrCodeScannerRounded /> } }}
              />
            </Field>
            <Button
              variant="contained"
              onClick={() => prepareInvoice()}
              disabled={loading || !invoiceCode.trim()}
            >
              تحديد الفاتورة
            </Button>
          </div>
        </Paper>
      )}

      {invoice && (
        <>
          <Paper variant="outlined" className="cashier-return-wizard__invoice">
            <div>
              <span>الفاتورة</span>
              <strong className="a4-ltr">{invoice.invoiceNumber || '—'}</strong>
            </div>
            <div>
              <span>الإيصال</span>
              <strong className="a4-ltr">{invoice.receiptNumber || '—'}</strong>
            </div>
            <div>
              <span>المتاح للإرجاع</span>
              <strong>
                {number(
                  invoice.items.reduce((sum, item) => sum + item.remainingReturnableQuantity, 0)
                )}
              </strong>
            </div>
            <Button size="small" onClick={reset}>
              تغيير الفاتورة
            </Button>
          </Paper>

          {!quote && (
            <Paper variant="outlined" className="cashier-return-wizard__panel">
              <div className="cashier-return-wizard__scan-row">
                <Field label="باركود أو SKU للمنتج المرتجع" required ltr>
                  <TextField
                    inputRef={activeInputRef}
                    value={itemCode}
                    onChange={(event) => setItemCode(event.target.value)}
                    onKeyDown={(event) => event.key === 'Enter' && resolveItem()}
                    placeholder="كل مسحة تضيف وحدة واحدة"
                    slotProps={{ input: { endAdornment: <QrCodeScannerRounded /> } }}
                  />
                </Field>
                <Button
                  variant="contained"
                  onClick={() => resolveItem()}
                  disabled={loading || !itemCode.trim()}
                >
                  إضافة المنتج
                </Button>
              </div>

              {candidateItems.length > 1 && (
                <div
                  className="cashier-return-wizard__candidates"
                  role="group"
                  aria-label="اختر بند الفاتورة"
                >
                  {candidateItems.map((item) => (
                    <Button
                      key={item.orderItemId}
                      variant="outlined"
                      onClick={() => incrementItem(item)}
                    >
                      {item.productName} · {money(item.unitPrice)} · متبقي{' '}
                      {number(item.remainingReturnableQuantity - item.quantity)}
                    </Button>
                  ))}
                </div>
              )}

              <Divider />
              <div className="cashier-return-wizard__items">
                {selectedItems.length ? (
                  selectedItems.map((item) => (
                    <article key={item.orderItemId}>
                      <div className="cashier-return-wizard__item-name">
                        <strong>{item.productName}</strong>
                        <span className="a4-ltr">
                          {item.sku || item.barcode || '—'} · {money(item.unitPrice)}
                        </span>
                      </div>
                      <div className="cashier-return-wizard__quantity">
                        <IconButton
                          aria-label={`إنقاص ${item.productName}`}
                          onClick={() => setItemQuantity(item.orderItemId, item.quantity - 1)}
                        >
                          <RemoveRounded />
                        </IconButton>
                        <TextField
                          value={item.quantity}
                          onChange={(event) =>
                            setItemQuantity(item.orderItemId, event.target.value)
                          }
                          slotProps={{
                            htmlInput: {
                              'aria-label': `كمية مرتجع ${item.productName}`,
                              inputMode: 'numeric',
                              min: 0,
                              max: item.remainingReturnableQuantity,
                            },
                          }}
                        />
                        <IconButton
                          aria-label={`زيادة ${item.productName}`}
                          onClick={() => incrementItem(item)}
                        >
                          <AddRounded />
                        </IconButton>
                      </div>
                      <TextField
                        select
                        label="حركة المخزون"
                        value={item.disposition}
                        onChange={(event) =>
                          updateItem(item.orderItemId, {
                            disposition: event.target.value,
                            noRestockReason:
                              event.target.value === 'RESTOCK' ? '' : item.noRestockReason,
                          })
                        }
                      >
                        <MenuItem value="RESTOCK">إعادة للمخزون</MenuItem>
                        <MenuItem value="NO_RESTOCK">عدم إعادة للمخزون</MenuItem>
                      </TextField>
                      <IconButton
                        color="error"
                        aria-label={`حذف ${item.productName}`}
                        onClick={() => setItemQuantity(item.orderItemId, 0)}
                      >
                        <DeleteOutlineRounded />
                      </IconButton>
                      {item.disposition === 'NO_RESTOCK' && (
                        <TextField
                          className="cashier-return-wizard__no-restock"
                          label="سبب عدم الإعادة للمخزون"
                          required
                          value={item.noRestockReason}
                          onChange={(event) =>
                            updateItem(item.orderItemId, { noRestockReason: event.target.value })
                          }
                        />
                      )}
                    </article>
                  ))
                ) : (
                  <div className="cashier-return-wizard__empty">لم تُمسح أي منتجات مرتجعة بعد.</div>
                )}
              </div>
              <Field label="سبب المرتجع" required>
                <TextField
                  value={reason}
                  onChange={(event) => {
                    setReason(event.target.value);
                    invalidateQuote();
                  }}
                />
              </Field>
              <div className="cashier-return-wizard__actions">
                <Button
                  variant="contained"
                  onClick={requestQuote}
                  disabled={loading || !selectedItems.length}
                >
                  حساب ومراجعة مبلغ الرد
                </Button>
              </div>
            </Paper>
          )}

          {quote && (
            <Paper
              variant="outlined"
              className="cashier-return-wizard__panel cashier-return-wizard__review"
            >
              <div className="cashier-return-wizard__review-head">
                <div>
                  <span>إجمالي المبلغ المسترد</span>
                  <strong>{money(totalRefund)}</strong>
                </div>
                <Button variant="outlined" onClick={invalidateQuote} disabled={loading}>
                  تعديل البنود
                </Button>
              </div>
              <div className="cashier-return-wizard__review-items">
                {(quoteData.items || selectedItems).map((item) => (
                  <div key={itemId(item)}>
                    <span>
                      {valueOf(item, 'productName', 'product_name') || 'منتج'} ×{' '}
                      {number(valueOf(item, 'quantity') || 0)}
                    </span>
                    <strong>
                      {String(valueOf(item, 'disposition') || 'RESTOCK').toUpperCase() === 'RESTOCK'
                        ? 'إعادة للمخزون'
                        : 'بدون إعادة'}
                    </strong>
                  </div>
                ))}
              </div>
              <Divider />
              <div className="cashier-return-wizard__allocations">
                {allocations.map((allocation, index) => {
                  const key = allocationKey(allocation, index);
                  return (
                    <section key={key}>
                      <div>
                        <strong>
                          {valueOf(
                            allocation,
                            'methodName',
                            'method_name',
                            'method',
                            'methodCode',
                            'method_code'
                          )}
                        </strong>
                        <span>{money(valueOf(allocation, 'amount') || 0)}</span>
                      </div>
                      {isExternalAllocation(allocation) ? (
                        <Field label="مرجع الرد الخارجي" required ltr>
                          <TextField
                            value={refundReferences[key] || ''}
                            onChange={(event) => {
                              setRefundReferences((current) => ({
                                ...current,
                                [key]: event.target.value,
                              }));
                              setRequestKey(createIdempotencyKey('return'));
                            }}
                          />
                        </Field>
                      ) : (
                        <Alert severity="warning">سيخرج هذا المبلغ من عهدة شيفتك الحالية.</Alert>
                      )}
                    </section>
                  );
                })}
              </div>

              {!approval ? (
                <div className="cashier-return-wizard__approval">
                  <Alert severity="info">
                    بطاقة اعتماد الأدمن هي الخطوة الأخيرة، ولا تُحفظ قيمتها في الشاشة بعد التنفيذ.
                  </Alert>
                  <div className="cashier-return-wizard__scan-row">
                    <Field label="بطاقة اعتماد الأدمن" required ltr>
                      <TextField
                        inputRef={activeInputRef}
                        type="password"
                        value={approvalCode}
                        onChange={(event) => setApprovalCode(event.target.value)}
                        onKeyDown={(event) => event.key === 'Enter' && approve()}
                        autoComplete="off"
                        placeholder="امسح كارت الاعتماد"
                        slotProps={{ input: { endAdornment: <QrCodeScannerRounded /> } }}
                      />
                    </Field>
                    <Button
                      variant="contained"
                      onClick={() => approve()}
                      disabled={loading || !approvalCode.trim()}
                    >
                      اعتماد الكارت
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="cashier-return-wizard__approved">
                  <CheckCircleRounded />
                  <div>
                    <strong>{approval.label || 'بطاقة اعتماد نشطة'}</strong>
                    <span className="a4-ltr">
                      {approval.cardNumber || approval.card_number || ''}
                    </span>
                  </div>
                  <Chip color="success" label="تم الاعتماد" />
                  <Button variant="text" onClick={resetApproval} disabled={loading}>
                    مسح كارت آخر
                  </Button>
                </div>
              )}

              <div className="cashier-return-wizard__actions">
                <Button
                  variant="contained"
                  color="success"
                  onClick={execute}
                  disabled={loading || !approval}
                >
                  {loading ? 'جاري تنفيذ المرتجع...' : 'تأكيد استلام المنتجات ورد المبلغ'}
                </Button>
              </div>
            </Paper>
          )}
        </>
      )}
      <AppSnackbar state={toast} onClose={() => setToast(null)} />
    </section>
  );
}

export default CashierReturnWizard;

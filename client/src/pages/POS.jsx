import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Button, Dialog, DialogActions, DialogContent, DialogTitle, Divider,
  IconButton, MenuItem, Paper, Tab, Tabs, TextField, Typography, useMediaQuery, useTheme
} from '@mui/material';
import {
  AddRounded, PointOfSaleRounded, QrCodeScannerRounded, ReceiptLongRounded,
  RemoveRounded, SearchRounded
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/apiClient.js';
import { printReceiptInFrame } from '../services/printService.js';
import { useAuth } from '../app/AuthContext.jsx';
import { useScannerCapture } from '../hooks/useScannerCapture.js';
import { PaymentEntry, paymentRowsToPayload } from '../components/PaymentEntry.jsx';
import { Field } from '../components/forms/Field.jsx';
import { EmptyState } from '../components/EmptyState.jsx';
import { AppSnackbar } from '../components/AppSnackbar.jsx';
import { money, number, statusLabel } from '../utils/formatters.js';
import { createIdempotencyKey, parsePiasters, piastersToInput } from '../utils/money.js';
import '../styles/POSPage.css';

const MODES = { SALE: 'sale', PREORDER: 'preorder', PICKUP: 'pickup' };

function resolvePayload(response) {
  const value = response?.data || response || {};
  const type = String(value.type || value.kind || '').toLowerCase();
  const data = value.data || value.product || value.preorder || value.invoice || value;
  return { type, data, raw: value };
}

function firstPrice(product) {
  return (product.prices || []).find((price) => price.price !== null && price.price !== undefined) || null;
}

export default function POS() {
  const { currentShift, loadShift } = useAuth();
  const navigate = useNavigate();
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down('sm'));
  const searchRef = useRef(null);
  const [mode, setMode] = useState(MODES.SALE);
  const [query, setQuery] = useState('');
  const [scanCode, setScanCode] = useState('');
  const [products, setProducts] = useState([]);
  const [cart, setCart] = useState([]);
  const [paymentMethods, setPaymentMethods] = useState([]);
  const [printSettings, setPrintSettings] = useState({});
  const [payments, setPayments] = useState({});
  const [pickupPayments, setPickupPayments] = useState({});
  const [discountInput, setDiscountInput] = useState('0.00');
  const [depositInput, setDepositInput] = useState('0.00');
  const [customer, setCustomer] = useState({ customerName: '', customerPhone: '', pickupMethod: 'walk_in' });
  const [openingInput, setOpeningInput] = useState('0.00');
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [pickupOpen, setPickupOpen] = useState(false);
  const [pickupData, setPickupData] = useState(null);
  const [success, setSuccess] = useState(null);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState(null);
  const [requestKey, setRequestKey] = useState(() => createIdempotencyKey('sale'));
  const [pickupKey, setPickupKey] = useState(() => createIdempotencyKey('pickup'));

  const activeMethods = useMemo(() => paymentMethods.filter((method) => method.is_active === 1), [paymentMethods]);
  const subtotal = useMemo(() => cart.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0), [cart]);
  let discount = 0;
  try { discount = parsePiasters(discountInput || '0'); } catch { discount = 0; }
  const total = Math.max(0, subtotal - discount);
  const baseDeposit = useMemo(() => cart.reduce(
    (sum, item) => sum + Math.round(item.quantity * item.unitPrice * Number(item.defaultPreorderDepositPct || 0) / 100), 0
  ), [cart]);
  const minimumDeposit = subtotal > 0 && discount > 0 ? Math.round(baseDeposit * total / subtotal) : baseDeposit;
  let selectedDeposit = minimumDeposit;
  try { selectedDeposit = parsePiasters(depositInput || '0'); } catch { selectedDeposit = minimumDeposit; }
  const due = mode === MODES.PREORDER ? selectedDeposit : total;

  const loadMethods = async () => {
    try {
      const [methodsResponse, settingsResponse] = await Promise.all([
        api.get('/api/payment-methods'),
        api.get('/api/printer-settings').catch(() => ({ data: {} }))
      ]);
      setPaymentMethods(methodsResponse.data || []);
      setPrintSettings(settingsResponse.data || {});
    }
    catch (error) { setToast({ severity: 'error', message: error.message }); }
  };

  const search = async (text = query) => {
    setLoading(true);
    try {
      setProducts((await api.get(`/api/pos/products/search?q=${encodeURIComponent(text)}`)).data || []);
    } catch (error) {
      setToast({ severity: 'error', message: error.message });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMethods();
    if (currentShift?.status === 'OPEN') search('');
  }, [currentShift?.id, currentShift?.status]);

  useEffect(() => {
    if (mode === MODES.PREORDER) setDepositInput(piastersToInput(minimumDeposit));
  }, [minimumDeposit, mode]);

  useEffect(() => {
    if (!checkoutOpen && !pickupOpen) requestAnimationFrame(() => searchRef.current?.focus());
  }, [checkoutOpen, pickupOpen]);

  const addProduct = (product, targetMode = mode) => {
    if (targetMode === MODES.SALE && !product.canSellNow) {
      setToast({ severity: 'error', message: product.canPreorderNow ? 'نفد المخزون. أنشئ حجزاً منفصلاً لهذا الطلب.' : 'المنتج غير متاح للبيع حالياً.' });
      return;
    }
    if (targetMode === MODES.PREORDER && !product.canPreorderNow) {
      setToast({ severity: 'error', message: product.availabilityPolicy === 'STOCK_ONLY' ? 'هذا المنتج للبيع من المخزون فقط ولا يقبل الحجز.' : 'الحجز متاح فقط بعد وصول المخزون الفعلي إلى صفر.' });
      return;
    }
    const price = firstPrice(product);
    if (!price) {
      setToast({ severity: 'error', message: 'لا يوجد سعر نشط لهذا المنتج.' });
      return;
    }
    setCart((current) => {
      const index = current.findIndex((item) => item.productId === product.id);
      if (index < 0) return [...current, {
        productId: product.id, name: product.name, sku: product.sku,
        quantity: 1, stockOnHand: product.stockOnHand, prices: product.prices,
        priceTierId: price.price_tier_id, unitPrice: price.price,
        defaultPreorderDepositPct: product.defaultPreorderDepositPct
      }];
      const next = [...current];
      const max = targetMode === MODES.SALE ? next[index].stockOnHand : Number.MAX_SAFE_INTEGER;
      if (next[index].quantity >= max) {
        setToast({ severity: 'warning', message: 'لا يمكن تجاوز المخزون الفعلي المتاح.' });
        return current;
      }
      next[index] = { ...next[index], quantity: next[index].quantity + 1 };
      return next;
    });
  };

  const updateQuantity = (index, change) => {
    setCart((current) => {
      const item = current[index];
      const quantity = item.quantity + change;
      if (quantity <= 0) return current.filter((_, itemIndex) => itemIndex !== index);
      if (mode === MODES.SALE && quantity > item.stockOnHand) {
        setToast({ severity: 'warning', message: 'الكمية المطلوبة تتجاوز المخزون الفعلي.' });
        return current;
      }
      return current.map((row, itemIndex) => itemIndex === index ? { ...row, quantity } : row);
    });
  };

  const changeTier = (index, tierId) => {
    setCart((current) => current.map((item, itemIndex) => {
      if (itemIndex !== index) return item;
      const price = item.prices.find((row) => String(row.price_tier_id) === String(tierId));
      return { ...item, priceTierId: price.price_tier_id, unitPrice: price.price };
    }));
  };

  const resolveScan = async (code) => {
    const clean = String(code || '').trim();
    if (!clean) return;
    setLoading(true);
    try {
      const resolved = resolvePayload(await api.post('/api/pos/scan/resolve', { code: clean }));
      if (resolved.type === 'invoice') {
        navigate(`/invoices?token=${encodeURIComponent(clean)}`);
      } else if (resolved.type === 'preorder') {
        const value = resolved.data.preorder ? resolved.data : resolved.raw;
        setPickupData(value);
        setPickupPayments({});
        setPickupKey(createIdempotencyKey('pickup'));
        setPickupOpen(true);
      } else if (resolved.type === 'product') {
        const product = resolved.data.product || resolved.data;
        if (product.canSellNow) {
          if (mode !== MODES.SALE) { setMode(MODES.SALE); setCart([]); }
          addProduct(product, MODES.SALE);
          setToast({ message: `تمت إضافة ${product.name} للبيع.` });
        } else if (product.canPreorderNow) {
          if (mode !== MODES.PREORDER) { setMode(MODES.PREORDER); setCart([]); }
          addProduct(product, MODES.PREORDER);
          setToast({ message: `المنتج نافد ومسموح حجزه. تم فتح مسار الحجز.` });
        } else {
          setToast({ severity: 'error', message: 'نفد المخزون وهذا المنتج مضبوط للبيع من المخزون فقط.' });
        }
      } else {
        setToast({ severity: 'error', message: 'نوع الرمز غير معروف.' });
      }
    } catch (error) {
      setToast({ severity: 'error', message: error.message });
    } finally {
      setLoading(false);
      setScanCode('');
    }
  };

  useScannerCapture({
    onScan: resolveScan,
    disabled: checkoutOpen || pickupOpen,
    restoreFocusRef: searchRef
  });

  const changeMode = (_, nextMode) => {
    setMode(nextMode);
    setCart([]);
    setPayments({});
    setDiscountInput('0.00');
    if (nextMode === MODES.PICKUP) requestAnimationFrame(() => searchRef.current?.focus());
  };

  const openShift = async () => {
    setLoading(true);
    try {
      await api.post('/api/shifts/open', { openingCash: parsePiasters(openingInput) });
      await loadShift();
      setToast({ message: 'تم فتح الشيفت.' });
    } catch (error) {
      setToast({ severity: 'error', message: error.message });
    } finally { setLoading(false); }
  };

  const startCheckout = () => {
    if (!cart.length) return;
    if (discount > subtotal) return setToast({ severity: 'error', message: 'الخصم أكبر من الإجمالي.' });
    if (mode === MODES.PREORDER) {
      if (!customer.customerName.trim() || !customer.customerPhone.trim()) return setToast({ severity: 'error', message: 'اسم العميل ورقم الهاتف مطلوبان للحجز.' });
      if (selectedDeposit < minimumDeposit || selectedDeposit > total) return setToast({ severity: 'error', message: `العربون يجب أن يكون بين ${money(minimumDeposit)} و${money(total)}.` });
    }
    setPayments({});
    setRequestKey(createIdempotencyKey(mode));
    setCheckoutOpen(true);
  };

  const completeCheckout = async () => {
    setLoading(true);
    try {
      const paymentPayload = paymentRowsToPayload(activeMethods, payments, due);
      const itemPayload = cart.map((item) => ({ product_id: item.productId, quantity: item.quantity, price_tier_id: item.priceTierId }));
      const options = { headers: { 'Idempotency-Key': requestKey } };
      const response = mode === MODES.PREORDER
        ? await api.post('/api/pos/preorders', {
          ...customer, items: itemPayload, discount, depositPaid: selectedDeposit, payments: paymentPayload
        }, options)
        : await api.post('/api/pos/orders/checkout', {
          items: itemPayload, discount, payments: paymentPayload
        }, options);
      const result = { ...response.data, workflow: mode };
      setSuccess(result);
      setCart([]);
      setPayments({});
      await search('');
      const autoKey = mode === MODES.PREORDER ? 'auto_print_preorder_deposit' : 'auto_print_sale';
      if (String(printSettings[autoKey] ?? 'true') !== 'false' && result.receipt_id) {
        printReceiptInFrame({
          receiptId: result.receipt_id,
          copies: printSettings.copies || printSettings.receipt_copies,
          isReprint: false
        }).catch((printError) => setToast({ severity: 'error', message: `تم حفظ العملية لكن تعذرت الطباعة: ${printError.message}` }));
      }
    } catch (error) {
      setToast({ severity: 'error', message: error.message });
    } finally { setLoading(false); }
  };

  const completePickup = async () => {
    if (!pickupData?.preorder) return;
    setLoading(true);
    try {
      const paymentPayload = paymentRowsToPayload(activeMethods, pickupPayments, pickupData.preorder.remaining_amount);
      const response = await api.post(
        `/api/pos/preorders/${pickupData.preorder.id}/pickup`,
        { payments: paymentPayload },
        { headers: { 'Idempotency-Key': pickupKey } }
      );
      setPickupOpen(false);
      setPickupData(null);
      setSuccess({ ...response.data, workflow: MODES.PICKUP });
      setCheckoutOpen(true);
      await search('');
      if (String(printSettings.auto_print_preorder_pickup ?? 'true') !== 'false' && response.data.receipt_id) {
        printReceiptInFrame({
          receiptId: response.data.receipt_id,
          copies: printSettings.copies || printSettings.receipt_copies,
          isReprint: false
        }).catch((printError) => setToast({ severity: 'error', message: `تم التسليم لكن تعذرت الطباعة: ${printError.message}` }));
      }
    } catch (error) {
      setToast({ severity: 'error', message: error.message });
    } finally { setLoading(false); }
  };

  if (!currentShift || currentShift.status !== 'OPEN') {
    return (
      <div className="a4-page pos-page">
        <Paper className="shift-gate" variant="outlined">
          <div className="shift-gate__icon"><PointOfSaleRounded /></div>
          <h2>{currentShift?.status === 'PENDING_ADMIN_REVIEW' ? 'الشيفت قيد مراجعة الإدارة' : 'افتح شيفت لبدء العمليات'}</h2>
          <p>عرض الفواتير متاح من مركز الفواتير دون شيفت، لكن البيع والتحصيل يحتاجان شيفتاً مفتوحاً باسمك.</p>
          {!currentShift && <><Field label="عهدة البداية بالجنيه" required><TextField value={openingInput} onChange={(event) => setOpeningInput(event.target.value)} inputMode="decimal" /></Field><Button variant="contained" fullWidth onClick={openShift} disabled={loading}>فتح الشيفت</Button></>}
          <Button variant="text" fullWidth onClick={() => navigate('/invoices')}>فتح مركز الفواتير</Button>
        </Paper>
        <AppSnackbar state={toast} onClose={() => setToast(null)} />
      </div>
    );
  }

  return (
    <div className="a4-page pos-page">
      <Paper variant="outlined" className="pos-mode-tabs"><Tabs value={mode} onChange={changeMode} variant="fullWidth"><Tab value={MODES.SALE} label="بيع مباشر" /><Tab value={MODES.PREORDER} label="حجز عند النفاد" /><Tab value={MODES.PICKUP} label="استلام حجز" /></Tabs></Paper>
      <div className="pos-scanbar"><Field label="مسح رمز المنتج أو الحجز أو الفاتورة"><TextField inputRef={searchRef} value={scanCode} onChange={(event) => setScanCode(event.target.value)} onKeyDown={(event) => event.key === 'Enter' && resolveScan(scanCode)} placeholder="امسح الرمز ثم Enter" slotProps={{ input: { endAdornment: <QrCodeScannerRounded /> } }} /></Field></div>

      {mode === MODES.PICKUP ? <Paper className="pickup-scanner" variant="outlined"><div className="pickup-scanner__icon"><QrCodeScannerRounded /></div><h2>استلام حجز مسبق</h2><p>امسح رمز الحجز لعرضه دون أي أثر جانبي، ثم راجع المخزون والتحصيل قبل التسليم.</p><div className="pickup-scanner__form"><Field className="pickup-scanner__field" label="رمز الحجز"><TextField value={scanCode} onChange={(event) => setScanCode(event.target.value)} onKeyDown={(event) => event.key === 'Enter' && resolveScan(scanCode)} /></Field><Button variant="contained" startIcon={<SearchRounded />} onClick={() => resolveScan(scanCode)}>بحث</Button></div></Paper> : <div className="pos-workspace">
        <section className="a4-page-section pos-catalog">
          <div className="pos-search"><Field className="pos-search__field" label="بحث المنتجات"><TextField value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => event.key === 'Enter' && search()} /></Field><Button variant="outlined" startIcon={<SearchRounded />} onClick={() => search()}>بحث</Button></div>
          <div className="pos-product-grid">{products.length ? products.map((product) => {
            const price = firstPrice(product);
            const eligible = mode === MODES.SALE ? product.canSellNow : product.canPreorderNow;
            return <button type="button" className="pos-product-card" key={product.id} onClick={() => addProduct(product)}><div className="pos-product-card__head"><span className="a4-ltr">{product.sku}</span><strong className={eligible ? '' : 'is-out'}>{mode === MODES.SALE ? `${number(product.stockOnHand)} متاح` : product.canPreorderNow ? 'متاح للحجز' : 'غير مؤهل للحجز'}</strong></div><h3>{product.name}</h3><div className="pos-product-card__meta"><span>{product.category_name}</span><b>{price ? money(price.price) : 'لا يوجد سعر'}</b></div></button>;
          }) : <EmptyState title="لا توجد منتجات" description="ابحث بالاسم أو SKU أو امسح رمز المنتج." />}</div>
        </section>

        <aside className="a4-page-section pos-cart">
          <h2 className="a4-section-title">{mode === MODES.SALE ? 'سلة البيع' : 'طلب الحجز'}</h2>
          <div className="pos-cart__items">{cart.length ? cart.map((item, index) => <article className="pos-cart-item" key={item.productId}><div className="pos-cart-item__head"><div><strong>{item.name}</strong><span className="a4-ltr">{item.sku}</span></div><Field label="فئة السعر" density="compact"><TextField select size="small" value={item.priceTierId} onChange={(event) => changeTier(index, event.target.value)}>{item.prices.map((price) => <MenuItem key={price.price_tier_id} value={price.price_tier_id}>{price.tier_name} — {money(price.price)}</MenuItem>)}</TextField></Field></div><div className="pos-cart-item__bottom"><div className="qty-control"><IconButton size="small" onClick={() => updateQuantity(index, -1)}><RemoveRounded /></IconButton><strong>{number(item.quantity)}</strong><IconButton size="small" onClick={() => updateQuantity(index, 1)}><AddRounded /></IconButton></div><b>{money(item.quantity * item.unitPrice)}</b></div></article>) : <EmptyState title="السلة فارغة" description="أضف منتجاً من النتائج." />}</div>
          {mode === MODES.PREORDER && <div className="pos-customer"><Field label="اسم العميل" required><TextField value={customer.customerName} onChange={(event) => setCustomer((value) => ({ ...value, customerName: event.target.value }))} /></Field><Field label="رقم الهاتف" required ltr><TextField value={customer.customerPhone} onChange={(event) => setCustomer((value) => ({ ...value, customerPhone: event.target.value }))} /></Field><Field label="طريقة الاستلام"><TextField select value={customer.pickupMethod} onChange={(event) => setCustomer((value) => ({ ...value, pickupMethod: event.target.value }))}><MenuItem value="walk_in">من المكتبة</MenuItem><MenuItem value="delivery">توصيل</MenuItem></TextField></Field></div>}
          <div className="pos-summary"><div><span>المجموع الفرعي</span><strong>{money(subtotal)}</strong></div><div><span>الخصم بالجنيه</span><Field className="pos-summary__discount-field" label="الخصم"><TextField value={discountInput} onChange={(event) => setDiscountInput(event.target.value)} inputMode="decimal" /></Field></div>{mode === MODES.PREORDER && <><div><span>الحد الأدنى للعربون</span><strong>{money(minimumDeposit)}</strong></div><div><span>العربون المحصل الآن</span><Field className="pos-summary__discount-field" label="العربون"><TextField value={depositInput} onChange={(event) => setDepositInput(event.target.value)} inputMode="decimal" /></Field></div></>}<div className="pos-summary__total"><span>المطلوب الآن</span><strong>{money(due)}</strong></div></div>
          <Button variant="contained" size="large" fullWidth startIcon={<ReceiptLongRounded />} onClick={startCheckout} disabled={!cart.length}>{mode === MODES.PREORDER ? 'تحصيل العربون وإنشاء الحجز' : 'الدفع وإصدار الإيصال'}</Button>
        </aside>
      </div>}

      <Dialog open={checkoutOpen} onClose={loading ? undefined : () => { setCheckoutOpen(false); setSuccess(null); }} fullScreen={fullScreen} fullWidth maxWidth="sm"><DialogTitle>{success ? 'تمت العملية بنجاح' : 'توزيع مبلغ الدفع'}</DialogTitle><DialogContent dividers>{success ? <div className="checkout-success"><div className="checkout-success__icon"><ReceiptLongRounded /></div><h2>{success.workflow === MODES.PREORDER ? 'تم إنشاء الحجز' : success.workflow === MODES.PICKUP ? 'تم استلام الحجز' : 'تم تسجيل البيع'}</h2>{success.receipt_number && <p>رقم الإيصال: <strong className="a4-ltr">{success.receipt_number}</strong></p>}{success.invoice_number && <p>رقم الفاتورة: <strong className="a4-ltr">{success.invoice_number}</strong></p>}{success.preorder_number && <p>رقم الحجز: <strong className="a4-ltr">{success.preorder_number}</strong></p>}</div> : <PaymentEntry methods={activeMethods} due={due} value={payments} onChange={(value) => { setPayments(value); setRequestKey(createIdempotencyKey(mode)); }} />}</DialogContent><DialogActions>{success ? <><Button onClick={() => { setCheckoutOpen(false); setSuccess(null); }}>عملية جديدة</Button><Button variant="contained" onClick={() => navigate(`/receipts/${success.receipt_id}/print`)}>عرض مستند الطباعة</Button></> : <><Button onClick={() => setCheckoutOpen(false)}>إلغاء</Button><Button variant="contained" onClick={completeCheckout} disabled={loading}>{loading ? 'جاري التسجيل...' : 'تأكيد الدفع'}</Button></>}</DialogActions></Dialog>

      <Dialog open={pickupOpen} onClose={loading ? undefined : () => setPickupOpen(false)} fullScreen={fullScreen} fullWidth maxWidth="md"><DialogTitle>مراجعة استلام الحجز {pickupData?.preorder?.preorder_number}</DialogTitle><DialogContent dividers>{pickupData && <div className="pickup-dialog"><div className="a4-grid a4-grid--two"><Paper variant="outlined" className="pickup-detail-card"><Typography color="text.secondary" variant="caption">العميل</Typography><Typography fontWeight={800}>{pickupData.preorder.customer_name}</Typography><Typography className="a4-ltr">{pickupData.preorder.customer_phone}</Typography></Paper><Paper variant="outlined" className="pickup-detail-card"><Typography color="text.secondary" variant="caption">الحالة</Typography><Typography fontWeight={800}>{statusLabel(pickupData.preorder.status)}</Typography><Typography>المتبقي: {money(pickupData.preorder.remaining_amount)}</Typography></Paper></div><div className="pickup-items">{(pickupData.items || []).map((item) => <div key={item.id}><span>{item.product_name} × {number(item.quantity)}</span><strong className={item.stock < item.quantity ? 'stock-error' : ''}>المتاح {number(item.stock)}</strong></div>)}</div><Divider className="pickup-dialog__divider" /><PaymentEntry methods={activeMethods} due={pickupData.preorder.remaining_amount} value={pickupPayments} onChange={(value) => { setPickupPayments(value); setPickupKey(createIdempotencyKey('pickup')); }} /></div>}</DialogContent><DialogActions><Button onClick={() => setPickupOpen(false)}>إغلاق</Button><Button variant="contained" onClick={completePickup} disabled={loading || pickupData?.preorder?.status !== 'READY_FOR_PICKUP' || pickupData?.items?.some((item) => item.stock < item.quantity)}>{pickupData?.preorder?.status !== 'READY_FOR_PICKUP' ? 'الحجز غير جاهز' : loading ? 'جاري التسليم...' : 'تحصيل المتبقي وتسليم الحجز'}</Button></DialogActions></Dialog>
      <AppSnackbar state={toast} onClose={() => setToast(null)} />
    </div>
  );
}

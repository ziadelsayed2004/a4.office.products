import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert, Button, Dialog, DialogActions, DialogContent, DialogTitle, Divider, IconButton,
  InputAdornment, MenuItem, Paper, Tab, Tabs, TextField, Typography, useMediaQuery, useTheme
} from '@mui/material';
import {
  AddRounded, DeleteOutlineRounded, LocalOfferRounded, PointOfSaleRounded, QrCodeScannerRounded,
  ReceiptLongRounded, RemoveRounded, SearchRounded, ShoppingCartRounded, SwapHorizRounded
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client.js';
import { useAuth } from '../app/AuthContext.jsx';
import { PageHeader } from '../components/navigation/PageHeader.jsx';
import { Field } from '../components/forms/Field.jsx';
import { AppSnackbar } from '../components/feedback/AppSnackbar.jsx';
import { EmptyState } from '../components/feedback/EmptyState.jsx';
import { money, number, statusLabel } from '../utils/formatters.js';
import '../styles/pos.css';

const emptyCustomer = { customerName: '', customerPhone: '', pickupMethod: 'walk_in' };

export default function POS() {
  const { currentShift, loadShift, setCurrentShift } = useAuth();
  const navigate = useNavigate();
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down('sm'));
  const scanRef = useRef(null);
  const [tab, setTab] = useState('sale');
  const [scan, setScan] = useState('');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [cart, setCart] = useState([]);
  const [paymentMethods, setPaymentMethods] = useState([]);
  const [discountEgp, setDiscountEgp] = useState('0');
  const [customer, setCustomer] = useState(emptyCustomer);
  const [openingCash, setOpeningCash] = useState('0');
  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);
  const [toast, setToast] = useState(null);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [payments, setPayments] = useState({});
  const [success, setSuccess] = useState(null);
  const [pickupOpen, setPickupOpen] = useState(false);
  const [pickupData, setPickupData] = useState(null);
  const [pickupPayments, setPickupPayments] = useState({});

  useEffect(() => {
    api.get('/api/payment-methods').then(r => setPaymentMethods((r.data || []).filter(x => x.is_active))).catch(e => setToast({ severity: 'error', message: e.message }));
    setTimeout(() => scanRef.current?.focus(), 150);
  }, []);

  const subtotal = useMemo(() => cart.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0), [cart]);
  const discountMinor = Math.max(0, Math.round(Number(discountEgp || 0) * 100));
  const saleTotal = Math.max(0, subtotal - discountMinor);
  const depositRequired = useMemo(() => {
    const raw = cart.reduce((sum, item) => sum + Math.round(item.quantity * item.unitPrice * ((item.product.default_preorder_deposit_pct || 50) / 100)), 0);
    return subtotal > 0 && discountMinor > 0 ? Math.round(raw * (saleTotal / subtotal)) : raw;
  }, [cart, subtotal, discountMinor, saleTotal]);
  const due = tab === 'preorder' ? depositRequired : saleTotal;

  const ensureDefaultPayment = (totalMinor, setter) => {
    if (!paymentMethods.length) return;
    setter(prev => {
      const hasAny = Object.values(prev).some(v => Number(v) > 0);
      if (hasAny) return prev;
      return { [paymentMethods[0].id]: (totalMinor / 100).toFixed(2) };
    });
  };

  const openShift = async () => {
    setLoading(true);
    try {
      const res = await api.post('/api/shifts/open', { openingCash: Number(openingCash || 0) });
      setCurrentShift(res.data.shift);
      setToast({ message: res.data.resumed ? 'تم استكمال الشيفت المفتوح.' : 'تم فتح الشيفت بنجاح.' });
    } catch (e) { setToast({ severity: 'error', message: e.message }); }
    finally { setLoading(false); }
  };

  const searchProducts = async (value = query) => {
    setSearching(true);
    try { setResults((await api.get(`/api/pos/products/search?q=${encodeURIComponent(value.trim())}`)).data || []); }
    catch (e) { setToast({ severity: 'error', message: e.message }); }
    finally { setSearching(false); }
  };

  const addProduct = (product) => {
    if (tab === 'sale' && product.stock <= 0) return setToast({ severity: 'warning', message: 'المنتج غير متوفر بالمخزون. استخدم الحجز المسبق.' });
    if (tab === 'sale' && !product.can_be_sold) return setToast({ severity: 'warning', message: 'هذا المنتج غير متاح للبيع المباشر.' });
    if (tab === 'preorder' && !product.can_be_preordered) return setToast({ severity: 'warning', message: 'هذا المنتج غير متاح للحجز المسبق.' });
    const price = product.prices?.find(p => p.price > 0) || product.prices?.[0];
    if (!price) return setToast({ severity: 'error', message: 'لا يوجد سعر متاح لهذا المنتج.' });
    setCart(prev => {
      const found = prev.find(x => x.product.id === product.id && x.priceTierId === price.price_tier_id);
      if (found) {
        const nextQty = found.quantity + 1;
        if (tab === 'sale' && nextQty > product.stock) { setToast({ severity: 'warning', message: `المتاح من المنتج ${product.stock} فقط.` }); return prev; }
        return prev.map(x => x === found ? { ...x, quantity: nextQty } : x);
      }
      return [...prev, { product, quantity: 1, priceTierId: price.price_tier_id, unitPrice: price.price }];
    });
    setQuery(''); setScan(''); setTimeout(() => scanRef.current?.focus(), 50);
  };

  const scanCode = async () => {
    const code = scan.trim(); if (!code) return;
    if (code.startsWith('pre_')) { await scanPreorder(code); return; }
    setSearching(true);
    try { addProduct((await api.post('/api/pos/scan-product', { code })).data); }
    catch (e) { setToast({ severity: 'error', message: e.message }); }
    finally { setSearching(false); }
  };

  const updateQty = (index, delta) => setCart(prev => prev.flatMap((item, i) => {
    if (i !== index) return [item];
    const quantity = item.quantity + delta;
    if (quantity <= 0) return [];
    if (tab === 'sale' && quantity > item.product.stock) { setToast({ severity: 'warning', message: `الحد الأقصى المتاح ${item.product.stock}.` }); return [item]; }
    return [{ ...item, quantity }];
  }));
  const updateTier = (index, tierId) => setCart(prev => prev.map((item, i) => {
    if (i !== index) return item;
    const price = item.product.prices.find(p => p.price_tier_id === Number(tierId));
    return price ? { ...item, priceTierId: price.price_tier_id, unitPrice: price.price } : item;
  }));

  const startCheckout = () => {
    if (!cart.length) return setToast({ severity: 'warning', message: 'أضف منتجاً واحداً على الأقل.' });
    if (tab === 'preorder' && (!customer.customerName.trim() || !customer.customerPhone.trim())) return setToast({ severity: 'warning', message: 'اسم العميل ورقم الهاتف مطلوبان للحجز.' });
    setSuccess(null); setPayments({}); ensureDefaultPayment(due, setPayments); setCheckoutOpen(true);
  };
  const paymentPayload = (state) => Object.entries(state).filter(([,v]) => Number(v) > 0).map(([method, v]) => ({ method, amount: Math.round(Number(v) * 100) }));
  const completeCheckout = async () => {
    const list = paymentPayload(payments); const paid = list.reduce((a,b) => a + b.amount, 0);
    if (paid !== due) return setToast({ severity: 'error', message: `مجموع الدفعات ${money(paid)} ويجب أن يساوي ${money(due)}.` });
    setLoading(true);
    try {
      const items = cart.map(i => ({ product_id: i.product.id, quantity: i.quantity, price_tier_id: i.priceTierId }));
      const body = tab === 'preorder'
        ? { ...customer, items, discount: discountMinor, depositPaid: due, payments: list }
        : { customerId: null, items, discount: discountMinor, payments: list };
      const endpoint = tab === 'preorder' ? '/api/pos/preorders' : '/api/pos/orders/checkout';
      const res = await api.post(endpoint, body);
      setSuccess(res.data); setCart([]); setDiscountEgp('0'); setCustomer(emptyCustomer); setPayments({}); await loadShift();
    } catch (e) { setToast({ severity: 'error', message: e.message }); }
    finally { setLoading(false); }
  };

  const scanPreorder = async (token = scan) => {
    if (!token.trim()) return setToast({ severity: 'warning', message: 'أدخل رمز استلام الحجز.' });
    setLoading(true);
    try {
      const data = (await api.post('/api/pos/preorders/scan', { token: token.trim() })).data;
      setPickupData(data); setPickupPayments({}); ensureDefaultPayment(data.preorder.remaining_amount, setPickupPayments); setPickupOpen(true); setScan('');
    } catch (e) { setToast({ severity: 'error', message: e.message }); }
    finally { setLoading(false); }
  };
  const completePickup = async () => {
    const list = paymentPayload(pickupPayments); const dueMinor = pickupData.preorder.remaining_amount; const paid = list.reduce((a,b) => a + b.amount, 0);
    if (paid !== dueMinor) return setToast({ severity: 'error', message: `مجموع الدفعات يجب أن يساوي ${money(dueMinor)}.` });
    setLoading(true);
    try { const res = await api.post(`/api/pos/preorders/${pickupData.preorder.id}/pickup`, { payments: list }); setSuccess(res.data); setPickupOpen(false); setCheckoutOpen(true); setPickupData(null); setPickupPayments({}); await loadShift(); }
    catch (e) { setToast({ severity: 'error', message: e.message }); }
    finally { setLoading(false); }
  };

  if (!currentShift || currentShift.status !== 'OPEN') return <div className="a4-page"><PageHeader title="نقطة البيع" description="يجب فتح شيفت نشط قبل تنفيذ أي عملية بيع أو حجز أو استلام."/><section className="shift-gate"><div className="shift-gate__icon"><PointOfSaleRounded/></div><h2>ابدأ الشيفت</h2><p>أدخل عهدة بداية الدرج. يمكن أن تكون صفر إذا لم توجد عهدة افتتاحية.</p><Field label="عهدة البداية بالجنيه"><TextField type="number" value={openingCash} onChange={e => setOpeningCash(e.target.value)} inputProps={{ min: 0, step: .01 }}/></Field><Button variant="contained" size="large" onClick={openShift} disabled={loading}>{loading ? 'جاري فتح الشيفت...' : 'فتح الشيفت وبدء العمل'}</Button></section><AppSnackbar state={toast} onClose={() => setToast(null)}/></div>;

  return <div className="a4-page pos-page">
    <PageHeader title="نقطة البيع" description="واجهة سريعة مهيأة للسكان ولوحة المفاتيح واللمس." actions={<Button variant="outlined" startIcon={<SwapHorizRounded/>} onClick={() => navigate('/shift-summary')}>ملخص الشيفت</Button>}/>
    <Paper variant="outlined" className="pos-mode-tabs"><Tabs value={tab} onChange={(_,v) => { setTab(v); setCart([]); setDiscountEgp('0'); }} variant="scrollable"><Tab value="sale" icon={<PointOfSaleRounded/>} iconPosition="start" label="بيع مباشر"/><Tab value="preorder" icon={<LocalOfferRounded/>} iconPosition="start" label="حجز مسبق"/><Tab value="pickup" icon={<QrCodeScannerRounded/>} iconPosition="start" label="استلام حجز"/></Tabs></Paper>

    {tab === 'pickup' ? <section className="pickup-scanner a4-page-section"><div className="pickup-scanner__icon"><QrCodeScannerRounded/></div><h2>سكان رمز الحجز</h2><p>امسح الرمز الموجود على ريسيت الحجز أو الصقه في الحقل التالي.</p><div className="pickup-scanner__form"><TextField label="رمز استلام الحجز" autoFocus value={scan} onChange={e => setScan(e.target.value)} onKeyDown={e => e.key === 'Enter' && scanPreorder()} placeholder="pre_xxxxxxxxxxxxxxxxx" inputProps={{ dir: 'ltr' }} fullWidth/><Button variant="contained" onClick={() => scanPreorder()} disabled={loading}>عرض الحجز</Button></div></section> : <>
      <section className="pos-scanbar"><TextField label="رمز المنتج أو الباركود" inputRef={scanRef} value={scan} onChange={e => setScan(e.target.value)} onKeyDown={e => e.key === 'Enter' && scanCode()} placeholder="امسح رمز المنتج أو اكتب SKU / الباركود" fullWidth InputProps={{ startAdornment: <InputAdornment position="start"><QrCodeScannerRounded color="primary"/></InputAdornment>, endAdornment: <InputAdornment position="end"><Button size="small" onClick={scanCode}>إضافة</Button></InputAdornment> }}/></section>
      <div className="pos-workspace">
        <section className="pos-catalog a4-page-section"><div className="a4-toolbar"><div><h2 className="a4-section-title">البحث عن المنتجات</h2><p className="a4-section-subtitle">النتائج النشطة المتاحة للبيع أو الحجز.</p></div></div><div className="pos-search"><TextField label="البحث عن منتج" value={query} onChange={e => setQuery(e.target.value)} onKeyDown={e => e.key === 'Enter' && searchProducts()} placeholder="ابحث باسم المنتج أو الكود" fullWidth InputProps={{ startAdornment: <InputAdornment position="start"><SearchRounded/></InputAdornment> }}/><Button variant="outlined" onClick={() => searchProducts()} disabled={searching}>بحث</Button></div>
          <div className="pos-product-grid">{results.length ? results.map(product => <button className="pos-product-card" type="button" key={product.id} onClick={() => addProduct(product)}><div className="pos-product-card__head"><span>{product.category_name}</span><strong className={product.stock <= 0 ? 'is-out' : ''}>{product.stock <= 0 ? 'غير متوفر' : `${number(product.stock)} متاح`}</strong></div><h3>{product.name}</h3><div className="pos-product-card__meta"><span className="a4-ltr">{product.sku}</span><b>{money(product.prices?.find(p => p.price > 0)?.price || 0)}</b></div></button>) : <EmptyState title="ابدأ البحث" description="اكتب جزءاً من الاسم أو امسح رمز المنتج لإضافته مباشرة."/>}</div>
        </section>
        <aside className="pos-cart a4-page-section"><div className="a4-toolbar"><div><h2 className="a4-section-title">{tab === 'preorder' ? 'منتجات الحجز' : 'سلة البيع'}</h2><p className="a4-section-subtitle">{number(cart.reduce((s,i) => s + i.quantity, 0))} قطعة</p></div><ShoppingCartRounded color="primary"/></div>
          <div className="pos-cart__items">{cart.length ? cart.map((item,index) => <article className="pos-cart-item" key={`${item.product.id}-${index}`}><div className="pos-cart-item__head"><div><strong>{item.product.name}</strong><span className="a4-ltr">{item.product.sku}</span></div><IconButton size="small" color="error" onClick={() => setCart(v => v.filter((_,i) => i !== index))}><DeleteOutlineRounded fontSize="small"/></IconButton></div><TextField label="فئة السعر" select size="small" value={item.priceTierId} onChange={e => updateTier(index,e.target.value)} fullWidth>{item.product.prices.map(p => <MenuItem key={p.price_tier_id} value={p.price_tier_id}>{p.tier_name} — {money(p.price)}</MenuItem>)}</TextField><div className="pos-cart-item__bottom"><div className="qty-control"><IconButton size="small" onClick={() => updateQty(index,-1)}><RemoveRounded/></IconButton><strong>{number(item.quantity)}</strong><IconButton size="small" onClick={() => updateQty(index,1)}><AddRounded/></IconButton></div><b>{money(item.quantity * item.unitPrice)}</b></div></article>) : <EmptyState title="السلة فارغة" description="أضف المنتجات بالسكان أو من نتائج البحث."/>}</div>
          {tab === 'preorder' && <div className="pos-customer"><Field label="اسم العميل" required><TextField size="small" value={customer.customerName} onChange={e => setCustomer(v => ({ ...v, customerName: e.target.value }))}/></Field><Field label="رقم الهاتف" required><TextField size="small" inputProps={{ dir: 'ltr' }} value={customer.customerPhone} onChange={e => setCustomer(v => ({ ...v, customerPhone: e.target.value }))}/></Field><Field label="طريقة الاستلام"><TextField select size="small" value={customer.pickupMethod} onChange={e => setCustomer(v => ({ ...v, pickupMethod: e.target.value }))}><MenuItem value="walk_in">استلام من المكتبة</MenuItem><MenuItem value="delivery">توصيل</MenuItem></TextField></Field></div>}
          <div className="pos-summary"><div><span>المجموع الفرعي</span><strong>{money(subtotal)}</strong></div><div><span>الخصم</span><TextField label="الخصم بالجنيه" size="small" type="number" value={discountEgp} onChange={e => setDiscountEgp(e.target.value)} inputProps={{ min: 0, step: .01 }} sx={{ width: 120 }}/></div>{tab === 'preorder' && <div><span>الحد الأدنى للعربون</span><strong>{money(depositRequired)}</strong></div>}<div className="pos-summary__total"><span>{tab === 'preorder' ? 'المطلوب الآن' : 'الإجمالي'}</span><strong>{money(due)}</strong></div></div>
          <Button variant="contained" size="large" fullWidth startIcon={<ReceiptLongRounded/>} onClick={startCheckout} disabled={!cart.length}>{tab === 'preorder' ? 'تحصيل العربون وإنشاء الحجز' : 'الدفع وإصدار الريسيت'}</Button>
        </aside>
      </div>
    </>}

    <Dialog open={checkoutOpen} onClose={loading ? undefined : () => { setCheckoutOpen(false); setSuccess(null); }} fullScreen={fullScreen} fullWidth maxWidth="sm">
      <DialogTitle>{success ? 'تمت العملية بنجاح' : 'توزيع مبلغ الدفع'}</DialogTitle><DialogContent dividers>{success ? <div className="checkout-success"><div className="checkout-success__icon"><ReceiptLongRounded/></div><h2>{success.preorder_number ? 'تم إنشاء الحجز' : success.preorder_id ? 'تم استلام الحجز' : 'تم تسجيل البيع'}</h2><p>رقم الإيصال: <strong className="a4-ltr">{success.receipt_number}</strong></p>{success.invoice_number && <p>رقم الفاتورة: <strong className="a4-ltr">{success.invoice_number}</strong></p>}{success.preorder_number && <><p>رقم الحجز: <strong className="a4-ltr">{success.preorder_number}</strong></p><p>المتبقي عند الاستلام: <strong>{money(success.remaining_amount)}</strong></p></>}</div> : <><Alert severity="info" sx={{ mb: 2 }}>وزّع المبلغ المطلوب بالكامل على طريقة دفع واحدة أو أكثر. المطلوب: <strong>{money(due)}</strong></Alert><div className="a4-form-grid">{paymentMethods.map(method => <Field key={method.id} label={method.name_ar}><TextField type="number" inputProps={{ min: 0, step: .01, dir: 'ltr' }} value={payments[method.id] || ''} onChange={e => setPayments(v => ({ ...v, [method.id]: e.target.value }))}/></Field>)}</div></>}</DialogContent><DialogActions>{success ? <><Button onClick={() => { setCheckoutOpen(false); setSuccess(null); }}>عملية جديدة</Button><Button variant="contained" onClick={() => navigate(`/receipts?code=${encodeURIComponent(success.receipt_number)}`)}>عرض وطباعة الريسيت</Button></> : <><Button onClick={() => setCheckoutOpen(false)}>إلغاء</Button><Button variant="contained" onClick={completeCheckout} disabled={loading}>{loading ? 'جاري التسجيل...' : 'تأكيد الدفع'}</Button></>}</DialogActions>
    </Dialog>

    <Dialog open={pickupOpen} onClose={loading ? undefined : () => setPickupOpen(false)} fullScreen={fullScreen} fullWidth maxWidth="md"><DialogTitle>استلام الحجز {pickupData?.preorder?.preorder_number}</DialogTitle><DialogContent dividers>{pickupData && <div className="pickup-dialog"><div className="a4-grid a4-grid--two"><Paper variant="outlined" sx={{ p: 2 }}><Typography color="text.secondary" variant="caption">العميل</Typography><Typography fontWeight={800}>{pickupData.preorder.customer_name}</Typography><Typography className="a4-ltr">{pickupData.preorder.customer_phone}</Typography></Paper><Paper variant="outlined" sx={{ p: 2 }}><Typography color="text.secondary" variant="caption">الحالة</Typography><Typography fontWeight={800}>{statusLabel(pickupData.preorder.status)}</Typography><Typography>المتبقي: {money(pickupData.preorder.remaining_amount)}</Typography></Paper></div><div className="pickup-items">{pickupData.items.map(item => <div key={item.id}><span>{item.product_name} × {number(item.quantity)}</span><strong className={item.stock < item.quantity ? 'stock-error' : ''}>المتاح {number(item.stock)}</strong></div>)}</div><Divider sx={{ my: 2 }}/><div className="a4-form-grid">{paymentMethods.map(method => <Field key={method.id} label={method.name_ar}><TextField type="number" inputProps={{ min: 0, step: .01, dir: 'ltr' }} value={pickupPayments[method.id] || ''} onChange={e => setPickupPayments(v => ({ ...v, [method.id]: e.target.value }))}/></Field>)}</div></div>}</DialogContent><DialogActions><Button onClick={() => setPickupOpen(false)}>إلغاء</Button><Button variant="contained" onClick={completePickup} disabled={loading || pickupData?.items?.some(i => i.stock < i.quantity)}>{pickupData?.items?.some(i => i.stock < i.quantity) ? 'المخزون غير كافٍ' : loading ? 'جاري التسليم...' : 'تحصيل المتبقي وتسليم الحجز'}</Button></DialogActions></Dialog>
    <AppSnackbar state={toast} onClose={() => setToast(null)}/>
  </div>;
}

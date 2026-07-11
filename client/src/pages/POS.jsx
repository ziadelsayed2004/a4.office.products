import React, { useState, useEffect } from 'react';
import { useAuth } from '../app/AuthContext.jsx';
import { useLanguage } from '../i18n/config.js';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Button,
  Grid,
  Card,
  CardContent,
  TextField,
  FormControl,
  Select,
  MenuItem,
  Alert,
  Divider,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControlLabel,
  Checkbox,
  Tabs,
  Tab,
  useTheme,
  useMediaQuery
} from '@mui/material';
import {
  QrCodeScanner as ScanIcon,
  Search as SearchIcon,
  Delete as DeleteIcon,
  Payment as PaymentIcon,
  Print as PrintIcon,
  CheckCircle as CheckIcon
} from '@mui/icons-material';

export function POS() {
  const { token, user, currentShift, setCurrentShift, loadCurrentShift } = useAuth();
  const { dir } = useLanguage();
  const [activeMobileTab, setActiveMobileTab] = useState(0);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const navigate = useNavigate();
  
  // Catalog lists
  const [paymentMethodsList, setPaymentMethodsList] = useState([]);

  // Opening Shift state
  const [openingCashInput, setOpeningCashInput] = useState('1000');
  const [openShiftLoading, setOpenShiftLoading] = useState(false);
  const [openShiftError, setOpenShiftError] = useState('');

  // POS Scanner state
  const [posScanCode, setPosScanCode] = useState('');
  const [posScanError, setPosScanError] = useState('');

  // Fuzzy Search state
  const [posSearchQuery, setPosSearchQuery] = useState('');
  const [posSearchResults, setPosSearchResults] = useState([]);
  const [posSearchLoading, setPosSearchLoading] = useState(false);

  // Cart state
  const [posCart, setPosCart] = useState([]);
  const [posDiscount, setPosDiscount] = useState('0');

  // Preorder options state
  const [posPreorder, setPosPreorder] = useState(false);
  const [posPreorderName, setPosPreorderName] = useState('');
  const [posPreorderPhone, setPosPreorderPhone] = useState('');
  const [posPreorderDeposit, setPosPreorderDeposit] = useState('0');

  // Payment Modal state
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentAmounts, setPaymentAmounts] = useState({});
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [checkoutError, setCheckoutError] = useState('');
  const [checkoutSuccessData, setCheckoutSuccessData] = useState(null);

  // Preorder pickup state
  const [showPreorderPickupModal, setShowPreorderPickupModal] = useState(false);
  const [scannedPreorder, setScannedPreorder] = useState(null);
  const [preorderPickupError, setPreorderPickupError] = useState('');
  const [isPreorderPickupCheckout, setIsPreorderPickupCheckout] = useState(false);

  // Manual preorder lookup state
  const [showManualPickupLookup, setShowManualPickupLookup] = useState(false);
  const [pickupSearchQuery, setPickupSearchQuery] = useState('');
  const [pickupSearchResults, setPickupSearchResults] = useState([]);
  const [pickupSearchLoading, setPickupSearchLoading] = useState(false);
  const [pickupSearchError, setPickupSearchError] = useState('');



  const loadPaymentMethods = async () => {
    if (!token) return;
    try {
      const res = await fetch('/api/payment-methods', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const payload = await res.json();
      if (res.status === 200) setPaymentMethodsList(payload.data || []);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    if (token) {
      loadPaymentMethods();
    }
  }, [token]); // eslint-disable-line react-hooks/exhaustive-deps

  // Derived totals
  const posSubtotal = posCart.reduce((sum, item) => sum + item.selectedPrice * item.quantity, 0);
  const discountVal = Math.round((parseFloat(posDiscount) || 0) * 100);
  const posTotal = Math.max(0, posSubtotal - discountVal);

  // Recalculate deposit required when preorder cart changes
  useEffect(() => {
    if (posPreorder && posCart.length > 0) {
      let calculatedDepositRequired = 0;
      for (const item of posCart) {
        const pct = item.product.default_preorder_deposit_pct || 50;
        calculatedDepositRequired += item.selectedPrice * item.quantity * (pct / 100);
      }
      if (posSubtotal > 0 && discountVal > 0) {
        calculatedDepositRequired = Math.round(calculatedDepositRequired * (posTotal / posSubtotal));
      }
      const depositEgp = (calculatedDepositRequired / 100).toFixed(2);
      setPosPreorderDeposit(depositEgp);
    } else if (!posPreorder) {
      setPosPreorderDeposit('0');
    }
  }, [posPreorder, posCart, posDiscount, posTotal, posSubtotal, discountVal]);

  const handleOpenShift = async (e) => {
    e.preventDefault();
    setOpenShiftError('');
    setOpenShiftLoading(true);
    try {
      const res = await fetch('/api/shifts/open', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ openingCash: parseFloat(openingCashInput) || 0 })
      });
      const payload = await res.json();
      if (res.status === 200) {
        setCurrentShift(payload.data.shift);
        setOpeningCashInput('1000');
        loadCurrentShift(token);
      } else {
        setOpenShiftError(payload.error || 'فشل فتح الوردية.');
      }
    } catch (err) {
      setOpenShiftError('حدث خطأ أثناء الاتصال بالخادم.');
    } finally {
      setOpenShiftLoading(false);
    }
  };

  const handleScanPreorder = async (preorderToken) => {
    setPosScanError('');
    setPreorderPickupError('');
    setScannedPreorder(null);
    try {
      const res = await fetch('/api/pos/preorders/scan', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ token: preorderToken })
      });
      const payload = await res.json();
      if (res.status === 200) {
        setScannedPreorder(payload.data);
        setShowPreorderPickupModal(true);
      } else {
        setPosScanError(payload.error || 'رمز الاستلام غير صحيح أو منتهي.');
      }
    } catch (err) {
      setPosScanError('حدث خطأ بالاتصال بالخادم.');
    }
  };

  const handlePreorderSearch = async (query) => {
    setPickupSearchQuery(query);
    if (!query.trim()) {
      setPickupSearchResults([]);
      return;
    }
    setPickupSearchLoading(true);
    setPickupSearchError('');
    try {
      const res = await fetch(`/api/admin/preorders?q=${encodeURIComponent(query)}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const payload = await res.json();
      if (res.status === 200) {
        setPickupSearchResults(payload.data || []);
      } else {
        setPickupSearchError(payload.error || 'فشل البحث عن الحجوزات.');
      }
    } catch (err) {
      setPickupSearchError('حدث خطأ بالاتصال بالخادم.');
    } finally {
      setPickupSearchLoading(false);
    }
  };

  const handleTokenLookup = async (tokenCode) => {
    if (!tokenCode.trim()) return;
    setPickupSearchLoading(true);
    setPickupSearchError('');
    try {
      const res = await fetch('/api/pos/preorders/scan', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ token: tokenCode.trim() })
      });
      const payload = await res.json();
      if (res.status === 200) {
        setScannedPreorder(payload.data);
        setShowManualPickupLookup(false);
        setShowPreorderPickupModal(true);
      } else {
        setPickupSearchError(payload.error || 'رمز الاستلام غير صحيح أو منتهي.');
      }
    } catch (err) {
      setPickupSearchError('حدث خطأ بالاتصال بالخادم.');
    } finally {
      setPickupSearchLoading(false);
    }
  };

  const addProductToCart = (product) => {
    const existingIndex = posCart.findIndex((item) => item.product.id === product.id);

    if (existingIndex > -1) {
      const item = posCart[existingIndex];
      const nextQty = item.quantity + 1;

      // Stock guard check (only enforce when NOT in preorder mode)
      if (!posPreorder && nextQty > product.stock) {
        setPosScanError('عذراً، لا يمكن تجاوز المخزون الفعلي المتاح للمنتج.');
        return;
      }

      const updated = [...posCart];
      updated[existingIndex].quantity = nextQty;
      setPosCart(updated);
    } else {
      // Stock guard check for new item
      if (!posPreorder && product.stock < 1) {
        setPosScanError('عذراً، المخزون الفعلي للمنتج غير متوفر (0).');
        return;
      }

      const defaultTier = product.prices && product.prices.length > 0 ? product.prices[0] : null;
      const newItem = {
        product,
        quantity: 1,
        selectedPriceTierId: defaultTier ? defaultTier.price_tier_id : null,
        selectedPrice: defaultTier ? defaultTier.price : 0
      };
      setPosCart([...posCart, newItem]);
    }
  };

  const handlePosScan = async (e) => {
    e.preventDefault();
    setPosScanError('');
    const scannedVal = posScanCode.trim();
    if (!scannedVal) return;

    if (scannedVal.startsWith('pre_')) {
      handleScanPreorder(scannedVal);
      setPosScanCode('');
      return;
    }

    try {
      const res = await fetch('/api/pos/scan-product', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ code: posScanCode.trim() })
      });
      const payload = await res.json();
      if (res.status === 200) {
        addProductToCart(payload.data);
        setPosScanCode('');
      } else {
        setPosScanError(payload.error || 'فشلت عملية مسح المنتج.');
      }
    } catch (err) {
      setPosScanError('حدث خطأ بالاتصال بالخادم.');
    }
  };

  const handlePosSearch = async (query) => {
    setPosSearchQuery(query);
    if (!query.trim()) {
      setPosSearchResults([]);
      return;
    }

    setPosSearchLoading(true);
    try {
      const res = await fetch(`/api/pos/products/search?q=${encodeURIComponent(query)}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const payload = await res.json();
      if (res.status === 200) {
        setPosSearchResults(payload.data || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setPosSearchLoading(false);
    }
  };

  const updateCartItemPriceTier = (productId, tierId) => {
    const updated = posCart.map((item) => {
      if (item.product.id === productId) {
        const foundPrice = item.product.prices.find((p) => p.price_tier_id === parseInt(tierId, 10));
        return {
          ...item,
          selectedPriceTierId: parseInt(tierId, 10),
          selectedPrice: foundPrice ? foundPrice.price : 0
        };
      }
      return item;
    });
    setPosCart(updated);
  };

  const updateCartItemQuantity = (productId, nextQty) => {
    const qty = parseInt(nextQty, 10);
    if (isNaN(qty) || qty <= 0) return;

    const item = posCart.find((i) => i.product.id === productId);
    if (!item) return;

    // Stock validation check (only check if NOT preorder)
    if (!posPreorder && qty > item.product.stock) {
      alert('لا توجد كمية كافية في المخزون للمنتج.');
      return;
    }

    const updated = posCart.map((i) => {
      if (i.product.id === productId) {
        return { ...i, quantity: qty };
      }
      return i;
    });
    setPosCart(updated);
  };

  const removeCartItem = (productId) => {
    setPosCart(posCart.filter((item) => item.product.id !== productId));
  };

  const openPaymentModal = () => {
    if (posCart.length === 0) return;

    if (posPreorder) {
      if (!posPreorderName.trim()) {
        alert('اسم العميل مطلوب لعمل الحجز المسبق.');
        return;
      }
      if (!posPreorderPhone.trim()) {
        alert('رقم هاتف العميل مطلوب لعمل الحجز المسبق.');
        return;
      }
      const depVal = parseFloat(posPreorderDeposit) || 0;
      if (depVal <= 0) {
        alert('مبلغ العربون مطلوب ويجب أن يكون أكبر من صفر.');
        return;
      }
    }

    const activeMethods = paymentMethodsList.filter((m) => m.is_active);
    const initialAmounts = {};
    if (activeMethods.length > 0) {
      const initialSum = posPreorder ? parseFloat(posPreorderDeposit) || 0 : posTotal / 100;
      initialAmounts[activeMethods[0].id] = initialSum.toString();
    }

    setPaymentAmounts(initialAmounts);
    setCheckoutError('');
    setCheckoutSuccessData(null);
    setShowPaymentModal(true);
  };

  const startPreorderPickupCheckout = () => {
    if (!scannedPreorder) return;
    setIsPreorderPickupCheckout(true);
    setShowPreorderPickupModal(false);

    const activeMethods = paymentMethodsList.filter((m) => m.is_active);
    const initialAmounts = {};
    if (activeMethods.length > 0) {
      const initialSum = scannedPreorder.preorder.remaining_amount / 100;
      initialAmounts[activeMethods[0].id] = initialSum.toString();
    }

    setPaymentAmounts(initialAmounts);
    setCheckoutError('');
    setCheckoutSuccessData(null);
    setShowPaymentModal(true);
  };

  const handleCheckoutSubmit = async (e) => {
    e.preventDefault();
    setCheckoutError('');
    setCheckoutLoading(true);

    try {
      const paymentsPayload = Object.entries(paymentAmounts)
        .map(([method, amountStr]) => {
          const val = parseFloat(amountStr) || 0;
          return {
            method,
            amount: Math.round(val * 100)
          };
        })
        .filter((p) => p.amount > 0);

      const expectedSum = isPreorderPickupCheckout
        ? scannedPreorder.preorder.remaining_amount
        : posPreorder
        ? Math.round((parseFloat(posPreorderDeposit) || 0) * 100)
        : posTotal;

      const totalPaymentsSum = paymentsPayload.reduce((sum, p) => sum + p.amount, 0);
      if (totalPaymentsSum !== expectedSum) {
        throw new Error(
          `إجمالي الدفعات (${(totalPaymentsSum / 100).toFixed(2)} ج.م) لا يتطابق مع المبلغ المطلوب (${(
            expectedSum / 100
          ).toFixed(2)} ج.م).`
        );
      }

      let res, url, body;
      if (isPreorderPickupCheckout) {
        url = `/api/pos/preorders/${scannedPreorder.preorder.id}/pickup`;
        body = {
          payments: paymentsPayload
        };
      } else {
        const itemsPayload = posCart.map((item) => ({
          product_id: item.product.id,
          quantity: item.quantity,
          price_tier_id: item.selectedPriceTierId
        }));

        if (posPreorder) {
          url = '/api/pos/preorders';
          body = {
            customerName: posPreorderName,
            customerPhone: posPreorderPhone,
            items: itemsPayload,
            discount: discountVal,
            depositPaid: expectedSum,
            pickupMethod: 'walk_in',
            payments: paymentsPayload
          };
        } else {
          url = '/api/pos/orders/checkout';
          body = {
            customerId: null,
            items: itemsPayload,
            discount: discountVal,
            payments: paymentsPayload
          };
        }
      }

      res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(body)
      });

      const payload = await res.json();
      if (res.status === 201 || res.status === 200) {
        const receiptId = payload.data.receipt_id;
        if (receiptId) {
          try {
            const rRes = await fetch(`/api/pos/receipts/${receiptId}`, {
              headers: { 'Authorization': `Bearer ${token}` }
            });
            const rPayload = await rRes.json();
            if (rRes.status === 200) {
              setReceiptDetails(rPayload.data);
            }
          } catch (rErr) {
            console.error(rErr);
          }
        }

        setCheckoutSuccessData(payload.data);
        setPosCart([]);
        setPosDiscount('0');
        setPosPreorder(false);
        setPosPreorderName('');
        setPosPreorderPhone('');
        setPosPreorderDeposit('0');
        setIsPreorderPickupCheckout(false);
        setScannedPreorder(null);
      } else {
        setCheckoutError(payload.error || 'فشلت عملية إتمام الطلب.');
      }
    } catch (err) {
      setCheckoutError(err.message || 'حدث خطأ بالخادم.');
    } finally {
      setCheckoutLoading(false);
    }
  };

  // Close shift request check
  if (currentShift && currentShift.status === 'CLOSE_REQUESTED') {
    return (
      <Box sx={{ maxWidth: 500, mx: 'auto', mt: 10, p: 4 }}>
        <Paper variant="outlined" sx={{ p: 4, textAlign: 'center' }}>
          <Typography variant="h5" sx={{ color: 'warning.main', fontWeight: 'bold', mb: 2, fontFamily: 'Cairo' }}>
            الوردية قيد مراجعة الإغلاق
          </Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary', lineHeight: 1.6, fontFamily: 'Cairo' }}>
            الوردية الحالية قيد المراجعة للإغلاق من قبل الإدارة. لا يمكن إجراء أي عمليات بيع أو حجز أو استلام جديدة حتى
            يقوم المسؤول بالموافقة على إغلاق الوردية الحالية.
          </Typography>
        </Paper>
      </Box>
    );
  }

  // Open shift prompt check
  if (!currentShift || (currentShift.status !== 'OPEN' && currentShift.status !== 'CLOSE_REQUESTED')) {
    return (
      <Box sx={{ maxWidth: 500, mx: 'auto', mt: 10, p: 4 }}>
        <Paper variant="outlined" sx={{ p: 4 }}>
          <Typography variant="h5" sx={{ fontWeight: 'bold', mb: 2, borderBottom: '1px solid', borderColor: 'divider', pb: 1, fontFamily: 'Cairo' }}>
            بدء وردية جديدة
          </Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary', mb: 3, lineHeight: 1.6, fontFamily: 'Cairo' }}>
            لا يمكن إجراء أي عمليات بيع أو حجز مسبق أو استلام بدون وردية نشطة مفتوحة حالياً للكاشير. الرجاء إدخال مبلغ عهدة
            الصندوق الابتدائية لفتح ورديتك الحالية.
          </Typography>

          {openShiftError && (
            <Alert severity="error" sx={{ mb: 2, fontFamily: 'Cairo', textAlign: 'right' }}>
              {openShiftError}
            </Alert>
          )}

          <form onSubmit={handleOpenShift}>
            <TextField
              fullWidth
              required
              type="number"
              inputProps={{ step: '0.01', min: '0' }}
              label="مبلغ عهدة البداية (بالجنيه المصري) *"
              value={openingCashInput}
              onChange={(e) => setOpeningCashInput(e.target.value)}
              disabled={openShiftLoading}
              size="small"
              sx={{ mb: 3, '& .MuiInputLabel-root': { fontFamily: 'Cairo' }, '& .MuiOutlinedInput-input': { fontFamily: 'Cairo' } }}
            />
            <Button
              fullWidth
              type="submit"
              variant="contained"
              disabled={openShiftLoading}
              sx={{ fontFamily: 'Cairo', fontWeight: 'bold' }}
            >
              {openShiftLoading ? 'جاري فتح الوردية...' : 'فتح الوردية والبدء'}
            </Button>
          </form>
        </Paper>
      </Box>
    );
  }

  return (
    <Box sx={{ width: '100%', height: { xs: 'auto', md: 'calc(100vh - 120px)' }, pb: { xs: 8, md: 0 }, position: 'relative' }}>
      {/* Mobile/Tablet Tab bar toggle */}
      <Box sx={{ display: { xs: 'block', md: 'none' }, mb: 2 }}>
        <Tabs
          value={activeMobileTab}
          onChange={(e, val) => setActiveMobileTab(val)}
          variant="fullWidth"
          sx={{ borderBottom: 1, borderColor: 'divider' }}
        >
          <Tab label="البحث والمسح" sx={{ fontFamily: 'Cairo', fontWeight: 'bold' }} />
          <Tab
            label={
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <span>السلة</span>
                <Chip
                  label={posCart.reduce((sum, item) => sum + item.quantity, 0)}
                  size="small"
                  color="primary"
                  sx={{ height: 20, fontSize: '0.75rem', fontWeight: 'bold' }}
                />
              </Box>
            }
            sx={{ fontFamily: 'Cairo', fontWeight: 'bold' }}
          />
        </Tabs>
      </Box>

      <Grid container spacing={3} sx={{ height: { xs: 'auto', md: '100%' } }}>
        {/* Left Side: Scan & Fuzzy search */}
        <Grid item xs={12} md={3} sx={{ height: { xs: 'auto', md: '100%' }, display: { xs: activeMobileTab === 0 ? 'block' : 'none', md: 'block' } }}>
          <Card variant="outlined" sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            <CardContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 1, overflowY: 'auto' }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 'bold', borderBottom: '1px solid', borderColor: 'divider', pb: 1, fontFamily: 'Cairo' }}>
                إضافة المنتجات للسلة
              </Typography>

              {/* Barcode scanner scan input */}
              <form onSubmit={handlePosScan}>
                <TextField
                  fullWidth
                  size="small"
                  label="مسح الرمز (QR أو SKU أو الباركود)"
                  placeholder="امسح الرمز أو اكتبه واضغط Enter..."
                  value={posScanCode}
                  onChange={(e) => setPosScanCode(e.target.value)}
                  InputProps={{
                    startAdornment: <ScanIcon sx={{ color: 'text.secondary', mr: 1 }} />
                  }}
                  sx={{ '& .MuiInputLabel-root': { fontFamily: 'Cairo', fontSize: '0.85rem' } }}
                />
              </form>

              {posScanError && (
                <Alert severity="error" sx={{ py: 0.5, fontFamily: 'Cairo', fontSize: '0.75rem', textAlign: 'right' }}>
                  {posScanError}
                </Alert>
              )}

              {/* Fuzzy Search */}
              <TextField
                fullWidth
                size="small"
                label="البحث اليدوي بالاسم"
                placeholder="اكتب اسم المنتج للبحث..."
                value={posSearchQuery}
                onChange={(e) => handlePosSearch(e.target.value)}
                InputProps={{
                  startAdornment: <SearchIcon sx={{ color: 'text.secondary', mr: 1 }} />
                }}
                sx={{ '& .MuiInputLabel-root': { fontFamily: 'Cairo', fontSize: '0.85rem' } }}
              />

              {/* Suggestions results listing */}
              <Box sx={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 1 }}>
                {posSearchLoading ? (
                  <Typography variant="body2" sx={{ textAlign: 'center', color: 'text.secondary', py: 2, fontFamily: 'Cairo' }}>
                    جاري البحث...
                  </Typography>
                ) : posSearchResults.length > 0 ? (
                  posSearchResults.map((p) => (
                    <Paper
                      key={p.id}
                      onClick={() => {
                        addProductToCart(p);
                        setPosSearchResults([]);
                        setPosSearchQuery('');
                      }}
                      sx={{
                        p: 1.5,
                        cursor: 'pointer',
                        '&:hover': { bgcolor: 'action.hover' }
                      }}
                      variant="outlined"
                    >
                      <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                        {p.name}
                      </Typography>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 0.5, fontSize: '0.7rem', color: 'text.secondary' }}>
                        <span>SKU: {p.sku}</span>
                        <span>
                          المخزون:{' '}
                          <strong style={{ color: p.stock > 0 ? '#34c759' : '#ff3b30' }}>
                            {p.stock}
                          </strong>
                        </span>
                      </Box>
                    </Paper>
                  ))
                ) : posSearchQuery ? (
                  <Typography variant="body2" sx={{ textAlign: 'center', color: 'text.secondary', py: 2, fontFamily: 'Cairo' }}>
                    لا توجد نتائج مطابقة.
                  </Typography>
                ) : (
                  <Typography variant="caption" sx={{ textAlign: 'center', color: 'text.secondary', py: 2, fontFamily: 'Cairo' }}>
                    استخدم البحث بالاسم أو الرمز لإضافة منتجات.
                  </Typography>
                )}
              </Box>

              {/* Manual Preorder Pickup Action */}
              <Box sx={{ mt: 'auto', pt: 1, borderTop: '1px solid', borderColor: 'divider' }}>
                <Button
                  fullWidth
                  variant="outlined"
                  color="secondary"
                  onClick={() => {
                    setPickupSearchQuery('');
                    setPickupSearchResults([]);
                    setPickupSearchError('');
                    setShowManualPickupLookup(true);
                  }}
                  sx={{ fontFamily: 'Cairo', fontWeight: 'bold' }}
                >
                  استلام حجز مسبق (Pickup)
                </Button>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Center: Cart Grid List */}
        <Grid item xs={12} md={6} sx={{ height: { xs: 'auto', md: '100%' }, display: { xs: activeMobileTab === 1 ? 'block' : 'none', md: 'block' } }}>
          <Card variant="outlined" sx={{ height: { xs: 'auto', md: '100%' }, display: 'flex', flexDirection: 'column' }}>
            <CardContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 1, overflowY: 'auto' }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid', borderColor: 'divider', pb: 1 }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 'bold', fontFamily: 'Cairo' }}>
                  سلة المبيعات الحالية
                </Typography>
                <Button
                  size="small"
                  variant="outlined"
                  color="error"
                  startIcon={<DeleteIcon />}
                  disabled={posCart.length === 0}
                  onClick={() => setPosCart([])}
                  sx={{ fontFamily: 'Cairo' }}
                >
                  تفريغ السلة
                </Button>
              </Box>

              <TableContainer component={Paper} variant="outlined" sx={{ flex: 1, overflowY: 'auto' }}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>المنتج</TableCell>
                      <TableCell>رمز SKU</TableCell>
                      <TableCell>المخزون</TableCell>
                      <TableCell>فئة السعر</TableCell>
                      <TableCell>سعر الوحدة</TableCell>
                      <TableCell>الكمية</TableCell>
                      <TableCell>الإجمالي</TableCell>
                      <TableCell>حذف</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {posCart.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} align="center" sx={{ color: 'text.secondary', py: 4, fontFamily: 'Cairo' }}>
                          السلة فارغة. يرجى مسح المنتجات لإضافتها.
                        </TableCell>
                      </TableRow>
                    ) : (
                      posCart.map((item) => (
                        <TableRow key={item.product.id} hover>
                          <TableCell sx={{ fontWeight: 'bold' }}>
                            {item.product.name}
                            {item.product.is_book === 1 && (
                              <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>
                                كتاب تعليمي ({item.product.book_details?.school_grade || '—'} /{' '}
                                {item.product.book_details?.subject || '—'})
                              </Typography>
                            )}
                          </TableCell>
                          <TableCell><code>{item.product.sku}</code></TableCell>
                          <TableCell>
                            <Chip
                              label={item.product.stock}
                              color={item.product.stock <= item.product.low_stock_threshold ? 'error' : 'success'}
                              size="small"
                              sx={{ fontWeight: 'bold' }}
                            />
                          </TableCell>
                          <TableCell>
                            <FormControl size="small" sx={{ width: 110 }}>
                              <Select
                                value={item.selectedPriceTierId || ''}
                                onChange={(e) => updateCartItemPriceTier(item.product.id, e.target.value)}
                                sx={{ fontSize: '0.75rem' }}
                              >
                                {item.product.prices?.map((p) => (
                                  <MenuItem key={p.price_tier_id} value={p.price_tier_id}>
                                    {p.tier_name}
                                  </MenuItem>
                                ))}
                              </Select>
                            </FormControl>
                          </TableCell>
                          <TableCell>{(item.selectedPrice / 100).toFixed(2)} ج.م</TableCell>
                          <TableCell>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                              <Button size="small" sx={{ minWidth: 24, px: 0.5 }} onClick={() => updateCartItemQuantity(item.product.id, item.quantity - 1)}>-</Button>
                              <TextField
                                type="number"
                                value={item.quantity}
                                onChange={(e) => updateCartItemQuantity(item.product.id, parseInt(e.target.value, 10) || 1)}
                                inputProps={{ min: 1, style: { textAlign: 'center', padding: '4px 0', width: 40 } }}
                                size="small"
                              />
                              <Button size="small" sx={{ minWidth: 24, px: 0.5 }} onClick={() => updateCartItemQuantity(item.product.id, item.quantity + 1)}>+</Button>
                            </Box>
                          </TableCell>
                          <TableCell sx={{ fontWeight: 'bold' }}>
                            {((item.selectedPrice * item.quantity) / 100).toFixed(2)} ج.م
                          </TableCell>
                          <TableCell>
                            <Button size="small" color="error" onClick={() => removeCartItem(item.product.id)}>
                              حذف
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            </CardContent>
          </Card>
        </Grid>

        {/* Right Side: Totals and Preorder checkout settings */}
        <Grid item xs={12} md={3} sx={{ height: { xs: 'auto', md: '100%' }, display: { xs: activeMobileTab === 1 ? 'block' : 'none', md: 'block' } }}>
          <Card variant="outlined" sx={{ height: { xs: 'auto', md: '100%' }, display: 'flex', flexDirection: 'column' }}>
            <CardContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 1, overflowY: 'auto' }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 'bold', borderBottom: '1px solid', borderColor: 'divider', pb: 1, fontFamily: 'Cairo' }}>
                ملخص الحساب والدفع
              </Typography>

              <Paper sx={{ p: 2, bgcolor: 'action.hover' }} variant="outlined">
                <Box sx={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', mb: 1.5 }}>
                  <span>المجموع الفرعي:</span>
                  <strong>{(posSubtotal / 100).toFixed(2)} ج.م</strong>
                </Box>

                <TextField
                  fullWidth
                  type="number"
                  inputProps={{ step: '0.01', min: '0' }}
                  label="قيمة الخصم للفاتورة (ج.م)"
                  value={posDiscount}
                  onChange={(e) => setPosDiscount(e.target.value)}
                  size="small"
                  sx={{ mb: 2, '& .MuiInputLabel-root': { fontFamily: 'Cairo' }, '& .MuiOutlinedInput-input': { fontFamily: 'Cairo' } }}
                />

                <Divider sx={{ my: 1 }} />
                <Box sx={{ display: 'flex', justifyContent: 'space-between', fontSize: '1rem', fontWeight: 'bold', color: 'success.main' }}>
                  <span>الإجمالي الصافي:</span>
                  <span>{(posTotal / 100).toFixed(2)} ج.م</span>
                </Box>
              </Paper>

              {/* Preorders switch config */}
              <Box sx={{ mt: 1, pt: 1, borderTop: '1px solid', borderColor: 'divider' }}>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={posPreorder}
                      onChange={(e) => {
                        setPosPreorder(e.target.checked);
                        if (!e.target.checked) {
                          const updated = posCart.map((item) => {
                            if (item.quantity > item.product.stock) {
                              return { ...item, quantity: item.product.stock };
                            }
                            return item;
                          });
                          setPosCart(updated);
                        }
                      }}
                    />
                  }
                  label="حجز مسبق للعميل (Preorder)"
                  sx={{ '& .MuiFormControlLabel-label': { fontFamily: 'Cairo', fontWeight: 'bold', fontSize: '0.85rem' } }}
                />

                {posPreorder && (
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1.5, p: 2, bgcolor: 'action.hover', borderRadius: 1 }}>
                    <TextField
                      required
                      fullWidth
                      label="اسم العميل الكامل *"
                      value={posPreorderName}
                      onChange={(e) => setPosPreorderName(e.target.value)}
                      size="small"
                      sx={{ '& .MuiInputLabel-root': { fontFamily: 'Cairo' }, '& .MuiOutlinedInput-input': { fontFamily: 'Cairo' } }}
                    />
                    <TextField
                      required
                      fullWidth
                      label="رقم الهاتف *"
                      value={posPreorderPhone}
                      onChange={(e) => setPosPreorderPhone(e.target.value)}
                      size="small"
                      sx={{ '& .MuiInputLabel-root': { fontFamily: 'Cairo' }, '& .MuiOutlinedInput-input': { fontFamily: 'Cairo' } }}
                    />
                    <TextField
                      required
                      fullWidth
                      type="number"
                      inputProps={{ step: '0.01', min: '0' }}
                      label="مبلغ العربون المدفوع (ج.م) *"
                      value={posPreorderDeposit}
                      onChange={(e) => setPosPreorderDeposit(e.target.value)}
                      size="small"
                      sx={{ '& .MuiInputLabel-root': { fontFamily: 'Cairo' }, '& .MuiOutlinedInput-input': { fontFamily: 'Cairo' } }}
                    />
                  </Box>
                )}
              </Box>

              {/* Checkout Button */}
              <Box sx={{ flex: 1, display: 'flex', alignItems: 'flex-end', mt: 3 }}>
                <Button
                  fullWidth
                  variant="contained"
                  startIcon={<PaymentIcon />}
                  disabled={posCart.length === 0}
                  onClick={openPaymentModal}
                  sx={{ py: 1.5, fontFamily: 'Cairo', fontWeight: 'bold' }}
                >
                  {posPreorder ? 'حفظ الحجز وطباعة الإيصال' : 'إتمام البيع والدفع'}
                </Button>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Sticky mobile action bar when cart has items and search is active */}
      {posCart.length > 0 && activeMobileTab === 0 && (
        <Paper
          elevation={10}
          sx={{
            position: 'fixed',
            bottom: 0,
            left: 0,
            right: 0,
            p: 2,
            zIndex: 1000,
            display: { xs: 'flex', md: 'none' },
            justifyContent: 'space-between',
            alignItems: 'center',
            borderTop: '1px solid',
            borderColor: 'divider',
            backgroundColor: 'background.paper'
          }}
        >
          <Box sx={{ textAlign: dir === 'rtl' ? 'right' : 'left' }}>
            <Typography variant="caption" sx={{ color: 'text.secondary', fontFamily: 'Cairo', display: 'block' }}>
              إجمالي السلة الصافي ({posCart.reduce((sum, item) => sum + item.quantity, 0)} قطعة):
            </Typography>
            <Typography variant="subtitle1" sx={{ fontWeight: 'bold', color: 'success.main', fontFamily: 'Cairo' }}>
              {(posTotal / 100).toFixed(2)} ج.م
            </Typography>
          </Box>
          <Button
            variant="contained"
            size="medium"
            onClick={() => setActiveMobileTab(1)}
            sx={{ fontFamily: 'Cairo', fontWeight: 'bold', px: 3, height: 44 }}
          >
            عرض السلة والدفع
          </Button>
        </Paper>
      )}

      {/* Payment Split & Checkout Result Dialog */}
      <Dialog
        open={showPaymentModal}
        onClose={() => !checkoutLoading && !checkoutSuccessData && setShowPaymentModal(false)}
        maxWidth="xs"
        fullWidth
        fullScreen={isMobile}
      >
        <DialogTitle sx={{ fontFamily: 'Cairo', fontWeight: 'bold', textAlign: 'right' }}>
          {checkoutSuccessData
            ? 'عملية ناجحة'
            : isPreorderPickupCheckout
            ? 'استلام الحجز ودفع المتبقي'
            : posPreorder
            ? 'تسجيل عربون الحجز وطباعة الإيصال'
            : 'إتمام الدفع وتسجيل الفاتورة'}
        </DialogTitle>
        {checkoutSuccessData ? (
          <DialogContent sx={{ textAlign: 'center', py: 3 }}>
            <CheckIcon color="success" sx={{ fontSize: 60, mb: 2 }} />
            <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 2, fontFamily: 'Cairo' }}>
              {checkoutSuccessData.preorder_id
                ? 'تم استلام وتأكيد الحجز بنجاح!'
                : checkoutSuccessData.preorder_number
                ? 'تم تسجيل الحجز بنجاح!'
                : 'تمت عملية البيع بنجاح!'}
            </Typography>

            <Paper variant="outlined" sx={{ p: 2, mb: 3, textAlign: 'right', display: 'flex', flexDirection: 'column', gap: 1, fontSize: '0.85rem' }}>
              {checkoutSuccessData.preorder_id ? (
                <>
                  <div>رقم الفاتورة: <strong>{checkoutSuccessData.invoice_number}</strong></div>
                  <div>رقم الإيصال: <strong>{checkoutSuccessData.receipt_number}</strong></div>
                  <Typography variant="body2" sx={{ color: 'success.main', fontWeight: 'bold', mt: 1, fontFamily: 'Cairo' }}>
                    تم تسليم الحجز ودفع كامل المبلغ المتبقي بنجاح.
                  </Typography>
                </>
              ) : checkoutSuccessData.preorder_number ? (
                <>
                  <div>رقم الحجز: <strong>{checkoutSuccessData.preorder_number}</strong></div>
                  <div>رقم الإيصال: <strong>{checkoutSuccessData.receipt_number}</strong></div>
                  <div>اسم العميل: <strong>{checkoutSuccessData.customer_name}</strong></div>
                  <div>المجموع الكلي: <strong>{(checkoutSuccessData.total_amount / 100).toFixed(2)} ج.م</strong></div>
                  <div>عربون مدفوع: <strong style={{ color: 'success.main' }}>{(checkoutSuccessData.deposit_paid / 100).toFixed(2)} ج.م</strong></div>
                  <div>متبقي للاستلام: <strong>{(checkoutSuccessData.remaining_amount / 100).toFixed(2)} ج.م</strong></div>
                </>
              ) : (
                <>
                  <div>رقم الفاتورة: <strong>{checkoutSuccessData.invoice_number}</strong></div>
                  <div>رقم الإيصال: <strong>{checkoutSuccessData.receipt_number}</strong></div>
                  <div>المجموع الفرعي: <strong>{(checkoutSuccessData.subtotal / 100).toFixed(2)} ج.م</strong></div>
                  {checkoutSuccessData.discount > 0 && <div>الخصم: <strong>{(checkoutSuccessData.discount / 100).toFixed(2)} ج.م</strong></div>}
                  <Divider sx={{ my: 0.5 }} />
                  <div>الإجمالي الصافي: <strong style={{ color: '#34c759' }}>{(checkoutSuccessData.total / 100).toFixed(2)} ج.م</strong></div>
                </>
              )}
            </Paper>

            <DialogActions sx={{ px: 0, pb: 0, justifyContent: 'stretch' }}>
              <Button
                fullWidth
                variant="contained"
                startIcon={<PrintIcon />}
                onClick={() => {
                  setShowPaymentModal(false);
                  // Redirect to receipts search tab and print
                  navigate(`/receipts?code=${checkoutSuccessData.receipt_number}`);
                  setCheckoutSuccessData(null);
                }}
                sx={{ fontFamily: 'Cairo' }}
              >
                طباعة الإيصال
              </Button>
              <Button
                fullWidth
                variant="outlined"
                onClick={() => {
                  setShowPaymentModal(false);
                  setCheckoutSuccessData(null);
                }}
                sx={{ fontFamily: 'Cairo' }}
              >
                إغلاق
              </Button>
            </DialogActions>
          </DialogContent>
        ) : (
          <form onSubmit={handleCheckoutSubmit}>
            <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {checkoutError && (
                <Alert severity="error" sx={{ fontFamily: 'Cairo', textAlign: 'right' }}>
                  {checkoutError}
                </Alert>
              )}

              <Paper variant="outlined" sx={{ p: 2, bgcolor: 'action.hover', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography variant="body2" sx={{ fontFamily: 'Cairo' }}>
                  {posPreorder ? 'مبلغ العربون المطلوب:' : 'المجموع المطلوب:'}
                </Typography>
                <Typography variant="subtitle1" sx={{ fontWeight: 'bold', color: 'success.main' }}>
                  {posPreorder ? (parseFloat(posPreorderDeposit) || 0).toFixed(2) : (posTotal / 100).toFixed(2)} ج.م
                </Typography>
              </Paper>

              <Typography variant="caption" sx={{ color: 'text.secondary', fontFamily: 'Cairo', fontWeight: 'bold' }}>
                توزيع مبالغ الدفع حسب الطريقة:
              </Typography>

              {paymentMethodsList.filter((m) => m.is_active).map((method) => (
                <Grid container spacing={2} alignItems="center" key={method.id}>
                  <Grid item xs={6}>
                    <Typography variant="body2" sx={{ fontSize: '0.8rem', fontFamily: 'Cairo' }}>
                      {method.name_ar}
                    </Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <TextField
                      fullWidth
                      size="small"
                      type="number"
                      inputProps={{ step: '0.01', min: '0' }}
                      placeholder="0.00"
                      value={paymentAmounts[method.id] || ''}
                      onChange={(e) =>
                        setPaymentAmounts({
                          ...paymentAmounts,
                          [method.id]: e.target.value
                        })
                      }
                    />
                  </Grid>
                </Grid>
              ))}
            </DialogContent>
            <DialogActions sx={{ px: 3, pb: 2 }}>
              <Button type="button" onClick={() => setShowPaymentModal(false)} disabled={checkoutLoading} sx={{ fontFamily: 'Cairo' }}>
                إلغاء
              </Button>
              <Button type="submit" variant="contained" disabled={checkoutLoading} sx={{ fontFamily: 'Cairo' }}>
                {checkoutLoading ? 'جاري تسجيل الفاتورة...' : 'تأكيد ودفع'}
              </Button>
            </DialogActions>
          </form>
        )}
      </Dialog>

      {/* Preorder Pickup Scanned details modal Dialog */}
      <Dialog
        open={showPreorderPickupModal && !!scannedPreorder}
        onClose={() => setShowPreorderPickupModal(false)}
        maxWidth="xs"
        fullWidth
        fullScreen={isMobile}
      >
        <DialogTitle sx={{ fontFamily: 'Cairo', fontWeight: 'bold', textAlign: dir === 'rtl' ? 'right' : 'left' }}>
          استلام الحجز المسبق رقم {scannedPreorder?.preorder.preorder_number}
        </DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {preorderPickupError && (
            <Alert severity="error" sx={{ fontFamily: 'Cairo', textAlign: dir === 'rtl' ? 'right' : 'left' }}>
              {preorderPickupError}
            </Alert>
          )}

          {scannedPreorder && (
            <>
              <Paper variant="outlined" sx={{ p: 2, bgcolor: 'action.hover', fontSize: '0.8rem', display: 'flex', flexDirection: 'column', gap: 1 }}>
                <div>اسم العميل: <strong>{scannedPreorder.preorder.customer_name}</strong></div>
                <div>هاتف العميل LTR: <strong style={{ direction: 'ltr', display: 'inline-block' }}>{scannedPreorder.preorder.customer_phone}</strong></div>
                <div>طريقة التسليم: <strong>{scannedPreorder.preorder.pickup_method === 'walk_in' ? 'استلام من المعرض' : 'توصيل منزلي'}</strong></div>
                <div>تاريخ الحجز: <strong>{new Date(scannedPreorder.preorder.created_at).toLocaleDateString('ar-EG')}</strong></div>
              </Paper>

              <Typography variant="caption" sx={{ fontWeight: 'bold', fontFamily: 'Cairo' }}>الأصناف المحجوزة والمخزون الحالي:</Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                {scannedPreorder.items.map((item, idx) => {
                  const isStockInsufficient = (item.stock || 0) < item.quantity;
                  return (
                    <Box key={idx} sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, bgcolor: 'background.paper', p: 1, border: '1px solid', borderColor: isStockInsufficient ? 'error.main' : 'divider', borderRadius: 0.5, fontSize: '0.8rem' }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ fontWeight: 'bold' }}>{item.product_name}</span>
                        <span>{(item.total_price / 100).toFixed(2)} ج.م</span>
                      </Box>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'text.secondary' }}>
                        <span>الكمية المطلوبة: {item.quantity}</span>
                        <span>
                          المخزون الحالي:{' '}
                          <Chip
                            label={item.stock || 0}
                            color={isStockInsufficient ? 'error' : 'success'}
                            size="small"
                            sx={{ height: 18, fontSize: '0.7rem', fontWeight: 'bold' }}
                          />
                        </span>
                      </Box>
                      {isStockInsufficient && (
                        <Typography variant="caption" sx={{ color: 'error.main', fontWeight: 'bold', fontFamily: 'Cairo', display: 'block', mt: 0.5 }}>
                          ⚠️ عجز بالمخزون! لا يمكن تسليم هذا الصنف حالياً.
                        </Typography>
                      )}
                    </Box>
                  );
                })}
              </Box>

              <Divider sx={{ my: 1 }} />
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, fontSize: '0.85rem' }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>المجموع الفرعي:</span>
                  <span>{(scannedPreorder.preorder.subtotal / 100).toFixed(2)} ج.م</span>
                </Box>
                {scannedPreorder.preorder.discount > 0 && (
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>الخصم:</span>
                    <span>-{(scannedPreorder.preorder.discount / 100).toFixed(2)} ج.م</span>
                  </Box>
                )}
                <Box sx={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold' }}>
                  <span>إجمالي القيمة:</span>
                  <span>{(scannedPreorder.preorder.total_amount / 100).toFixed(2)} ج.م</span>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', color: 'success.main', fontWeight: 'bold' }}>
                  <span>العربون المدفوع:</span>
                  <span>{(scannedPreorder.preorder.deposit_paid / 100).toFixed(2)} ج.م</span>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', color: 'warning.main', fontWeight: 'bold', fontSize: '1rem', borderTop: '1px dotted', borderColor: 'divider', pt: 1, mt: 1 }}>
                  <span>المبلغ المتبقي للتحصيل:</span>
                  <span>{(scannedPreorder.preorder.remaining_amount / 100).toFixed(2)} ج.م</span>
                </Box>
              </Box>
            </>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setShowPreorderPickupModal(false)} sx={{ fontFamily: 'Cairo' }}>
            إغلاق
          </Button>
          {scannedPreorder?.preorder.status === 'PICKED_UP' ? (
            <Typography variant="body2" sx={{ color: 'success.main', fontWeight: 'bold', fontFamily: 'Cairo' }}>تم تسليم هذا الحجز مسبقاً.</Typography>
          ) : scannedPreorder?.preorder.status === 'CANCELLED' ? (
            <Typography variant="body2" sx={{ color: 'error.main', fontWeight: 'bold', fontFamily: 'Cairo' }}>هذا الحجز ملغي.</Typography>
          ) : (
            <Button
              variant="contained"
              onClick={startPreorderPickupCheckout}
              disabled={scannedPreorder?.items?.some(item => (item.stock || 0) < item.quantity)}
              sx={{ fontFamily: 'Cairo' }}
            >
              {scannedPreorder?.items?.some(item => (item.stock || 0) < item.quantity) ? 'غير متاح (عجز مخزون)' : 'الذهاب للدفع واستلام الحجز'}
            </Button>
          )}
        </DialogActions>
      </Dialog>

      {/* Manual Preorder Search / Pickup Dialog */}
      <Dialog
        open={showManualPickupLookup}
        onClose={() => setShowManualPickupLookup(false)}
        maxWidth="sm"
        fullWidth
        fullScreen={isMobile}
      >
        <DialogTitle sx={{ fontFamily: 'Cairo', fontWeight: 'bold', textAlign: dir === 'rtl' ? 'right' : 'left' }}>
          بحث واستلام حجز مسبق
        </DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
          {pickupSearchError && (
            <Alert severity="error" sx={{ fontFamily: 'Cairo', textAlign: dir === 'rtl' ? 'right' : 'left' }}>
              {pickupSearchError}
            </Alert>
          )}

          {user?.role === 'Admin' ? (
            <>
              <TextField
                fullWidth
                size="small"
                label="بحث بالاسم، الهاتف، أو رقم الحجز"
                placeholder="اكتب وابدأ البحث..."
                value={pickupSearchQuery}
                onChange={(e) => handlePreorderSearch(e.target.value)}
                InputProps={{
                  startAdornment: <SearchIcon sx={{ color: 'text.secondary', mr: 1 }} />
                }}
                sx={{
                  '& .MuiInputLabel-root': {
                    fontFamily: 'Cairo',
                    left: dir === 'rtl' ? 'auto' : 0,
                    right: dir === 'rtl' ? 24 : 'auto',
                    transformOrigin: dir === 'rtl' ? 'right' : 'left'
                  },
                  '& .MuiOutlinedInput-input': { fontFamily: 'Cairo', textAlign: dir === 'rtl' ? 'right' : 'left' }
                }}
              />
              
              <Box sx={{ mt: 1, maxHeight: 300, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 1 }}>
                {pickupSearchLoading ? (
                  <Typography variant="body2" sx={{ textAlign: 'center', py: 2, color: 'text.secondary', fontFamily: 'Cairo' }}>جاري البحث...</Typography>
                ) : pickupSearchResults.length === 0 ? (
                  <Typography variant="body2" sx={{ textAlign: 'center', py: 2, color: 'text.secondary', fontFamily: 'Cairo' }}>
                    {pickupSearchQuery ? 'لا توجد نتائج مطابقة.' : 'اكتب للبحث عن الحجوزات النشطة.'}
                  </Typography>
                ) : (
                  pickupSearchResults.map((order) => (
                    <Paper
                      key={order.id}
                      onClick={async () => {
                        setShowManualPickupLookup(false);
                        await handleScanPreorder(order.qr_pickup_token);
                      }}
                      variant="outlined"
                      sx={{ p: 2, cursor: 'pointer', '&:hover': { bgcolor: 'action.hover' } }}
                    >
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                        <Typography variant="subtitle2" sx={{ fontWeight: 'bold' }}>رقم: {order.preorder_number}</Typography>
                        <Chip
                          label={
                            order.status === 'DEPOSIT_PAID_WAITING_STOCK' ? 'بانتظار المخزون' :
                            order.status === 'READY_FOR_PICKUP' ? 'جاهز للاستلام' :
                            order.status === 'PICKED_UP' ? 'تم التسليم' :
                            order.status === 'CANCELLED' ? 'ملغي' : 'منتهي'
                          }
                          color={
                            order.status === 'DEPOSIT_PAID_WAITING_STOCK' ? 'info' :
                            order.status === 'READY_FOR_PICKUP' ? 'warning' :
                            order.status === 'PICKED_UP' ? 'success' : 'error'
                          }
                          size="small"
                          sx={{ fontFamily: 'Cairo', fontWeight: 'bold' }}
                        />
                      </Box>
                      <Typography variant="body2" sx={{ color: 'text.secondary', fontSize: '0.8rem' }}>
                        العميل: {order.customer_name} | هاتف: <code style={{ direction: 'ltr', display: 'inline-block' }}>{order.customer_phone}</code>
                      </Typography>
                      <Typography variant="body2" sx={{ color: 'warning.main', fontSize: '0.8rem', mt: 0.5, fontWeight: 'bold' }}>
                        المتبقي للتحصيل: {(order.remaining_amount / 100).toFixed(2)} ج.م
                      </Typography>
                    </Paper>
                  ))
                )}
              </Box>
            </>
          ) : (
            <>
              <Typography variant="body2" sx={{ color: 'text.secondary', mb: 1, fontFamily: 'Cairo' }}>
                أدخل رمز الاستلام الخاص بالعميل (مثال: pre_abc123) لتحميل تفاصيل الحجز:
              </Typography>
              <TextField
                fullWidth
                size="small"
                label="رمز الاستلام (Token)"
                value={pickupSearchQuery}
                onChange={(e) => setPickupSearchQuery(e.target.value)}
                sx={{
                  '& .MuiInputLabel-root': {
                    fontFamily: 'Cairo',
                    left: dir === 'rtl' ? 'auto' : 0,
                    right: dir === 'rtl' ? 24 : 'auto',
                    transformOrigin: dir === 'rtl' ? 'right' : 'left'
                  },
                  '& .MuiOutlinedInput-input': { fontFamily: 'Cairo', textAlign: dir === 'rtl' ? 'right' : 'left' }
                }}
              />
              <Button
                fullWidth
                variant="contained"
                disabled={pickupSearchLoading || !pickupSearchQuery.trim()}
                onClick={() => handleTokenLookup(pickupSearchQuery)}
                sx={{ mt: 2, fontFamily: 'Cairo' }}
              >
                {pickupSearchLoading ? 'جاري البحث بالرمز...' : 'تحميل الحجز والتحقق'}
              </Button>
            </>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setShowManualPickupLookup(false)} sx={{ fontFamily: 'Cairo' }}>
            إغلاق
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default POS;

import React, { useState, useEffect } from 'react';
import { useAuth } from '../app/AuthContext.jsx';
import { useLanguage } from '../i18n/config.js';
import PageHeader from '../components/navigation/PageHeader.jsx';
import DataTable from '../components/data-display/DataTable.jsx';
import StatusChip from '../components/data-display/StatusChip.jsx';
import ConfirmDialog from '../components/feedback/ConfirmDialog.jsx';
import FilterPanel from '../components/forms/FilterPanel.jsx';
import {
  Box,
  Typography,
  Button,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Chip,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormControlLabel,
  Checkbox,
  Grid,
  Divider,
  RadioGroup,
  Radio,
  FormLabel,
  Card,
  CardContent
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  QrCode as QrIcon,
  Settings as SettingsIcon,
  PowerSettingsNew as PowerIcon
} from '@mui/icons-material';

export function Products() {
  const { token } = useAuth();
  const { dir } = useLanguage();
  const [productsList, setProductsList] = useState([]);
  const [categoriesList, setCategoriesList] = useState([]);
  const [priceTiersList, setPriceTiersList] = useState([]);
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Dialog open states
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showAdjustDialog, setShowAdjustDialog] = useState(false);
  const [showQrDialog, setShowQrDialog] = useState(false);

  // Selected entities
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [adjustProduct, setAdjustProduct] = useState(null);
  const [qrPrintProduct, setQrPrintProduct] = useState(null);

  // Form Inputs: General Product
  const [productFormName, setProductFormName] = useState('');
  const [productFormSku, setProductFormSku] = useState('');
  const [productFormBarcode, setProductFormBarcode] = useState('');
  const [productFormCategoryId, setProductFormCategoryId] = useState('');
  const [productFormDesc, setProductFormDesc] = useState('');
  const [productFormIsActive, setProductFormIsActive] = useState(true);
  const [productFormCanBeSold, setProductFormCanBeSold] = useState(true);
  const [productFormCanBePreordered, setProductFormCanBePreordered] = useState(true);
  const [productFormPreorderDepositPct, setProductFormPreorderDepositPct] = useState(50);
  const [productFormPickupMethod, setProductFormPickupMethod] = useState('walk_in');
  const [productFormLowStockThreshold, setProductFormLowStockThreshold] = useState(5);
  const [productFormPurchaseCost, setProductFormPurchaseCost] = useState('0');
  const [productFormNotes, setProductFormNotes] = useState('');
  const [productFormIsBook, setProductFormIsBook] = useState(false);

  // Form Inputs: Book metadata
  const [bookFormType, setBookFormType] = useState('');
  const [bookFormSchoolGrade, setBookFormSchoolGrade] = useState('');
  const [bookFormSubject, setBookFormSubject] = useState('');
  const [bookFormTeacher, setBookFormTeacher] = useState('');
  const [bookFormPublisher, setBookFormPublisher] = useState('');
  const [bookFormReleaseYear, setBookFormReleaseYear] = useState('');
  const [bookFormTerm, setBookFormTerm] = useState('first');
  const [bookFormEducationalClassification, setBookFormEducationalClassification] = useState('external_book');

  // Form Inputs: Pricing Matrix
  const [productFormPrices, setProductFormPrices] = useState({});

  // Form Inputs: Adjust Stock
  const [adjustType, setAdjustType] = useState('ADD');
  const [adjustQty, setAdjustQty] = useState(1);
  const [adjustNotes, setAdjustNotes] = useState('');

  // Form Inputs: Print QR
  const [qrPrintQuantity, setQrPrintQuantity] = useState(1);
  const [qrPrintSize, setQrPrintSize] = useState('medium');
  const [qrPrintResult, setQrPrintResult] = useState(null);

  // Dialog submission feedback
  const [dialogError, setDialogError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Status Toggle Confirmation States
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [selectedProductForToggle, setSelectedProductForToggle] = useState(null);

  // Filters State
  const [filterSearch, setFilterSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterType, setFilterType] = useState('all'); // all, book, general
  const [filterStock, setFilterStock] = useState('all'); // all, low, instock, outofstock
  const [showInactive, setShowInactive] = useState(true);

  const loadProducts = async () => {
    if (!token) return;
    setLoading(true);
    setError('');
    try {
      let url = `/api/products?activeOnly=${showInactive ? 'false' : 'true'}`;
      if (filterSearch.trim()) {
        url += `&q=${encodeURIComponent(filterSearch.trim())}`;
      }
      if (filterCategory) {
        url += `&categoryId=${filterCategory}`;
      }
      const res = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const payload = await res.json();
      if (res.status === 200) {
        let results = payload.data || [];
        
        // Client-side filter for Book vs General
        if (filterType === 'book') {
          results = results.filter(p => p.is_book === 1 || p.notes?.includes('كتاب') || p.sku?.includes('AR'));
        } else if (filterType === 'general') {
          results = results.filter(p => p.is_book !== 1 && !p.notes?.includes('كتاب') && !p.sku?.includes('AR'));
        }

        // Client-side filter for Stock status
        if (filterStock === 'low') {
          results = results.filter(p => p.stock <= p.low_stock_threshold);
        } else if (filterStock === 'instock') {
          results = results.filter(p => p.stock > 0);
        } else if (filterStock === 'outofstock') {
          results = results.filter(p => p.stock <= 0);
        }

        setProductsList(results);
      } else {
        setError(payload.error || 'فشل تحميل قائمة المنتجات.');
      }
    } catch (err) {
      setError('خطأ في الاتصال بالخادم.');
    } finally {
      setLoading(false);
    }
  };

  const loadCategories = async () => {
    if (!token) return;
    try {
      const res = await fetch('/api/categories?activeOnly=false', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const payload = await res.json();
      if (res.status === 200) {
        setCategoriesList(payload.data || []);
      }
    } catch (err) {
      console.error('Failed to load categories:', err);
    }
  };

  const loadPriceTiers = async () => {
    if (!token) return;
    try {
      const res = await fetch('/api/admin/price-tiers?activeOnly=false', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const payload = await res.json();
      if (res.status === 200) {
        setPriceTiersList(payload.data || []);
      }
    } catch (err) {
      console.error('Failed to load price tiers:', err);
    }
  };

  const initData = async () => {
    setLoading(true);
    setError('');
    try {
      await Promise.all([loadProducts(), loadCategories(), loadPriceTiers()]);
    } catch (err) {
      setError('حدث خطأ أثناء تحميل البيانات من الخادم.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    initData();
  }, [token]); // eslint-disable-line react-hooks/exhaustive-deps

  // Trigger search on filter update
  const handleApplyFilters = () => {
    loadProducts();
  };

  const handleResetFilters = () => {
    setFilterSearch('');
    setFilterCategory('');
    setFilterType('all');
    setFilterStock('all');
    setShowInactive(true);
    // Reload products with empty states
    setTimeout(() => {
      loadProducts();
    }, 50);
  };

  const clearProductForm = () => {
    setProductFormName('');
    setProductFormSku('');
    setProductFormBarcode('');
    setProductFormCategoryId('');
    setProductFormDesc('');
    setProductFormIsActive(true);
    setProductFormCanBeSold(true);
    setProductFormCanBePreordered(true);
    setProductFormPreorderDepositPct(50);
    setProductFormPickupMethod('walk_in');
    setProductFormLowStockThreshold(5);
    setProductFormPurchaseCost('0');
    setProductFormNotes('');
    setProductFormIsBook(false);

    setBookFormType('');
    setBookFormSchoolGrade('');
    setBookFormSubject('');
    setBookFormTeacher('');
    setBookFormPublisher('');
    setBookFormReleaseYear('');
    setBookFormTerm('first');
    setBookFormEducationalClassification('external_book');

    setProductFormPrices({});
    setDialogError('');
    setSelectedProduct(null);
  };

  const handleOpenAddDialog = () => {
    clearProductForm();
    if (categoriesList.length > 0) {
      setProductFormCategoryId(categoriesList[0].id.toString());
    }
    setShowAddDialog(true);
  };

  const handleOpenEditDialog = async (prod) => {
    clearProductForm();
    setSelectedProduct(prod);
    setDialogError('');

    try {
      const res = await fetch(`/api/products/${prod.id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const payload = await res.json();
      if (res.status === 200) {
        const fullProd = payload.data;
        setProductFormName(fullProd.name);
        setProductFormSku(fullProd.sku);
        setProductFormBarcode(fullProd.barcode || '');
        setProductFormCategoryId(fullProd.category_id.toString());
        setProductFormDesc(fullProd.description || '');
        setProductFormIsActive(fullProd.is_active === 1);
        setProductFormCanBeSold(fullProd.can_be_sold === 1);
        setProductFormCanBePreordered(fullProd.can_be_preordered === 1);
        setProductFormPreorderDepositPct(fullProd.default_preorder_deposit_pct);
        setProductFormPickupMethod(fullProd.default_pickup_method);
        setProductFormLowStockThreshold(fullProd.low_stock_threshold);
        setProductFormPurchaseCost((fullProd.purchase_cost / 100).toString());
        setProductFormNotes(fullProd.notes || '');

        if (fullProd.book_details) {
          setProductFormIsBook(true);
          setBookFormType(fullProd.book_details.book_type || '');
          setBookFormSchoolGrade(fullProd.book_details.school_grade || '');
          setBookFormSubject(fullProd.book_details.subject || '');
          setBookFormTeacher(fullProd.book_details.teacher || '');
          setBookFormPublisher(fullProd.book_details.publisher || '');
          setBookFormReleaseYear(fullProd.book_details.release_year ? fullProd.book_details.release_year.toString() : '');
          setBookFormTerm(fullProd.book_details.term || 'first');
          setBookFormEducationalClassification(fullProd.book_details.educational_classification || 'external_book');
        } else {
          setProductFormIsBook(false);
        }

        const priceMap = {};
        if (Array.isArray(fullProd.prices)) {
          fullProd.prices.forEach((p) => {
            priceMap[p.price_tier_id] = (p.price / 100).toString();
          });
        }
        setProductFormPrices(priceMap);
        setShowEditDialog(true);
      } else {
        alert(payload.error || 'فشل تحميل تفاصيل المنتج.');
      }
    } catch (err) {
      alert('حدث خطأ بالاتصال بالخادم.');
    }
  };

  const handlePriceChange = (tierId, val) => {
    setProductFormPrices((prev) => ({
      ...prev,
      [tierId]: val
    }));
  };

  const handleCreateProductSubmit = async (e) => {
    e.preventDefault();
    setDialogError('');
    if (!productFormName || !productFormSku || !productFormCategoryId) {
      setDialogError('يرجى إدخال الحقول الإجبارية: الاسم الكامل، رمز SKU، والتصنيف.');
      return;
    }

    const payloadPrices = priceTiersList.map((t) => {
      const val = productFormPrices[t.id];
      const parsedVal = val ? parseFloat(val) : 0;
      return {
        price_tier_id: t.id,
        price: Math.round(parsedVal * 100)
      };
    });

    const parsedCost = productFormPurchaseCost ? parseFloat(productFormPurchaseCost) : 0;

    const body = {
      name: productFormName,
      sku: productFormSku,
      barcode: productFormBarcode || null,
      category_id: parseInt(productFormCategoryId, 10),
      description: productFormDesc || null,
      is_active: productFormIsActive ? 1 : 0,
      can_be_sold: productFormCanBeSold ? 1 : 0,
      can_be_preordered: productFormCanBePreordered ? 1 : 0,
      default_preorder_deposit_pct: parseInt(productFormPreorderDepositPct, 10),
      default_pickup_method: productFormPickupMethod,
      low_stock_threshold: parseInt(productFormLowStockThreshold, 10),
      purchase_cost: Math.round(parsedCost * 100),
      notes: productFormNotes || null,
      is_book: productFormIsBook ? 1 : 0,
      prices: payloadPrices,
      book_details: productFormIsBook
        ? {
            book_type: bookFormType || null,
            school_grade: bookFormSchoolGrade || null,
            subject: bookFormSubject || null,
            teacher: bookFormTeacher || null,
            publisher: bookFormPublisher || null,
            release_year: bookFormReleaseYear ? parseInt(bookFormReleaseYear, 10) : null,
            term: bookFormTerm,
            educational_classification: bookFormEducationalClassification
          }
        : null
    };

    setSubmitting(true);
    try {
      const res = await fetch('/api/admin/products', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(body)
      });
      const payload = await res.json();
      if (res.status === 201) {
        setShowAddDialog(false);
        loadProducts();
      } else {
        setDialogError(payload.error || 'فشلت عملية إنشاء المنتج.');
      }
    } catch (err) {
      setDialogError('حدث خطأ بالخادم.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditProductSubmit = async (e) => {
    e.preventDefault();
    setDialogError('');
    if (!productFormName || !productFormSku || !productFormCategoryId) {
      setDialogError('يرجى إدخال الحقول الإجبارية: الاسم الكامل، رمز SKU، والتصنيف.');
      return;
    }

    const payloadPrices = priceTiersList.map((t) => {
      const val = productFormPrices[t.id];
      const parsedVal = val ? parseFloat(val) : 0;
      return {
        price_tier_id: t.id,
        price: Math.round(parsedVal * 100)
      };
    });

    const parsedCost = productFormPurchaseCost ? parseFloat(productFormPurchaseCost) : 0;

    const body = {
      name: productFormName,
      sku: productFormSku,
      barcode: productFormBarcode || null,
      category_id: parseInt(productFormCategoryId, 10),
      description: productFormDesc || null,
      is_active: productFormIsActive ? 1 : 0,
      can_be_sold: productFormCanBeSold ? 1 : 0,
      can_be_preordered: productFormCanBePreordered ? 1 : 0,
      default_preorder_deposit_pct: parseInt(productFormPreorderDepositPct, 10),
      default_pickup_method: productFormPickupMethod,
      low_stock_threshold: parseInt(productFormLowStockThreshold, 10),
      purchase_cost: Math.round(parsedCost * 100),
      notes: productFormNotes || null,
      is_book: productFormIsBook ? 1 : 0,
      prices: payloadPrices,
      book_details: productFormIsBook
        ? {
            book_type: bookFormType || null,
            school_grade: bookFormSchoolGrade || null,
            subject: bookFormSubject || null,
            teacher: bookFormTeacher || null,
            publisher: bookFormPublisher || null,
            release_year: bookFormReleaseYear ? parseInt(bookFormReleaseYear, 10) : null,
            term: bookFormTerm,
            educational_classification: bookFormEducationalClassification
          }
        : null
    };

    setSubmitting(true);
    try {
      const res = await fetch(`/api/admin/products/${selectedProduct.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(body)
      });
      const payload = await res.json();
      if (res.status === 200) {
        setShowEditDialog(false);
        loadProducts();
      } else {
        setDialogError(payload.error || 'فشل تحديث بيانات المنتج.');
      }
    } catch (err) {
      setDialogError('حدث خطأ بالخادم.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleProductStatus = (targetProd) => {
    setSelectedProductForToggle(targetProd);
    setConfirmOpen(true);
  };

  const confirmToggleStatus = async () => {
    if (!selectedProductForToggle) return;
    const targetProd = selectedProductForToggle;
    const isCurrentlyActive = targetProd.is_active === 1;
    setConfirmOpen(false);
    try {
      const res = await fetch(`/api/admin/products/${targetProd.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ is_active: isCurrentlyActive ? 0 : 1 })
      });
      if (res.status === 200) {
        loadProducts();
      } else {
        const payload = await res.json();
        alert(payload.error || 'فشل تعديل حالة المنتج.');
      }
    } catch (err) {
      alert('خطأ في الاتصال بالخادم.');
    }
  };

  // Adjust Stock Dialog
  const handleOpenAdjustDialog = (prod) => {
    setAdjustProduct(prod);
    setAdjustType('ADD');
    setAdjustQty(1);
    setAdjustNotes('');
    setDialogError('');
    setShowAdjustDialog(true);
  };

  const handleAdjustStockSubmit = async (e) => {
    e.preventDefault();
    setDialogError('');
    setSubmitting(true);
    try {
      const res = await fetch('/api/admin/inventory/adjust', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          product_id: adjustProduct.id,
          adjustment_type: adjustType,
          quantity: adjustQty,
          notes: adjustNotes
        })
      });
      const payload = await res.json();
      if (res.status === 200) {
        setShowAdjustDialog(false);
        loadProducts();
      } else {
        setDialogError(payload.error || 'فشلت عملية تسوية المخزون.');
      }
    } catch (err) {
      setDialogError('حدث خطأ بالاتصال بالخادم.');
    } finally {
      setSubmitting(false);
    }
  };

  // Print QR Dialog
  const handleOpenQrDialog = (prod) => {
    setQrPrintProduct(prod);
    setQrPrintQuantity(1);
    setQrPrintSize('medium');
    setQrPrintResult(null);
    setDialogError('');
    setShowQrDialog(true);
  };

  const handleGenerateQrLabels = async (e) => {
    e.preventDefault();
    setDialogError('');
    setSubmitting(true);
    try {
      const res = await fetch(`/api/admin/products/${qrPrintProduct.id}/qr-labels`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          quantity: qrPrintQuantity,
          label_size: qrPrintSize
        })
      });
      const payload = await res.json();
      if (res.status === 200) {
        setQrPrintResult(payload.data);
      } else {
        setDialogError(payload.error || 'فشلت عملية تحضير الملصقات.');
      }
    } catch (err) {
      setDialogError('حدث خطأ بالخادم.');
    } finally {
      setSubmitting(false);
    }
  };

  // Mobile card view layout
  const renderMobileRecord = (p) => (
    <Card variant="outlined" sx={{ borderRadius: 1 }}>
      <CardContent sx={{ p: 2 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 'bold' }}>
            {p.name}
          </Typography>
          <StatusChip status={p.is_active} />
        </Box>
        <Typography variant="body2" sx={{ color: 'text.secondary', mb: 1, fontSize: '0.8rem' }}>
          <strong>رمز SKU: </strong><code>{p.sku}</code> | <strong>الباركود: </strong>{p.barcode || '—'}
        </Typography>
        <Typography variant="body2" sx={{ color: 'text.secondary', mb: 1, fontSize: '0.8rem' }}>
          <strong>التصنيف: </strong>{p.category_name || '—'} | <strong>النوع: </strong>
          {p.notes?.includes('كتاب') || p.sku?.includes('AR') || p.is_book === 1 ? 'كتاب تعليمي' : 'عام'}
        </Typography>
        <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2, fontSize: '0.8rem' }}>
          <strong>تكلفة الشراء: </strong>{(p.purchase_cost / 100).toFixed(2)} ج.م | 
          <strong>المخزون: </strong>
          <Chip
            label={p.stock}
            color={p.stock <= p.low_stock_threshold ? 'error' : 'success'}
            size="small"
            sx={{ fontWeight: 'bold', height: 20, px: 0.5, mx: 0.5 }}
          />
          | <strong>الحجوزات: </strong>
          <Chip label={p.open_preorders} size="small" variant="outlined" sx={{ height: 20, px: 0.5, mx: 0.5 }} />
        </Typography>
        <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
          <Button
            variant="outlined"
            size="small"
            onClick={() => handleOpenEditDialog(p)}
            startIcon={<EditIcon />}
            sx={{ fontFamily: 'Cairo' }}
          >
            تعديل
          </Button>
          <Button
            variant="outlined"
            size="small"
            onClick={() => handleOpenQrDialog(p)}
            startIcon={<QrIcon />}
            sx={{ fontFamily: 'Cairo' }}
          >
            ملصق
          </Button>
          <Button
            variant="outlined"
            size="small"
            onClick={() => handleOpenAdjustDialog(p)}
            startIcon={<SettingsIcon />}
            sx={{ fontFamily: 'Cairo' }}
          >
            تسوية
          </Button>
          <Button
            variant="outlined"
            size="small"
            color={p.is_active === 1 ? 'error' : 'success'}
            onClick={() => handleToggleProductStatus(p)}
            startIcon={<PowerIcon />}
            sx={{ fontFamily: 'Cairo' }}
          >
            {p.is_active === 1 ? 'تعطيل' : 'تفعيل'}
          </Button>
        </Box>
      </CardContent>
    </Card>
  );

  return (
    <Box>
      {/* Content Header */}
      <PageHeader
        titleKey="nav.products"
        actions={
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={handleOpenAddDialog}
            sx={{ fontFamily: 'Cairo' }}
          >
            إضافة منتج جديد
          </Button>
        }
      />

      {error && (
        <Alert severity="error" sx={{ mb: 3, fontFamily: 'Cairo', textAlign: dir === 'rtl' ? 'right' : 'left' }}>
          {error}
        </Alert>
      )}

      {/* Filter panel */}
      <FilterPanel
        onApply={handleApplyFilters}
        onReset={handleResetFilters}
        resultCount={productsList.length}
      >
        <TextField
          fullWidth
          size="small"
          label="البحث بالاسم، SKU أو الباركود"
          value={filterSearch}
          onChange={(e) => setFilterSearch(e.target.value)}
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

        <FormControl fullWidth size="small">
          <InputLabel sx={{ fontFamily: 'Cairo', transformOrigin: dir === 'rtl' ? 'right' : 'left', right: dir === 'rtl' ? 24 : 'auto' }}>تصنيف المنتج</InputLabel>
          <Select
            value={filterCategory}
            label="تصنيف المنتج"
            onChange={(e) => setFilterCategory(e.target.value)}
          >
            <MenuItem value="">الكل</MenuItem>
            {categoriesList.map((c) => (
              <MenuItem key={c.id} value={c.id.toString()}>
                {c.name}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <FormControl fullWidth size="small">
          <InputLabel sx={{ fontFamily: 'Cairo', transformOrigin: dir === 'rtl' ? 'right' : 'left', right: dir === 'rtl' ? 24 : 'auto' }}>نوع المنتج</InputLabel>
          <Select
            value={filterType}
            label="نوع المنتج"
            onChange={(e) => setFilterType(e.target.value)}
          >
            <MenuItem value="all">الكل</MenuItem>
            <MenuItem value="book">كتب خارجية ومستلزمات دراسية</MenuItem>
            <MenuItem value="general">منتجات عامة</MenuItem>
          </Select>
        </FormControl>

        <FormControl fullWidth size="small">
          <InputLabel sx={{ fontFamily: 'Cairo', transformOrigin: dir === 'rtl' ? 'right' : 'left', right: dir === 'rtl' ? 24 : 'auto' }}>حالة المخزون</InputLabel>
          <Select
            value={filterStock}
            label="حالة المخزون"
            onChange={(e) => setFilterStock(e.target.value)}
          >
            <MenuItem value="all">الكل</MenuItem>
            <MenuItem value="low">مخزون منخفض</MenuItem>
            <MenuItem value="instock">متوفر بالمخزن</MenuItem>
            <MenuItem value="outofstock">نفذ المخزون</MenuItem>
          </Select>
        </FormControl>

        <FormControlLabel
          control={
            <Checkbox
              checked={showInactive}
              onChange={(e) => setShowInactive(e.target.checked)}
            />
          }
          label="عرض المنتجات المعطلة"
          sx={{ '& .MuiFormControlLabel-label': { fontFamily: 'Cairo', fontSize: '0.85rem' } }}
        />
      </FilterPanel>

      <DataTable
        loading={loading}
        columns={[
          { id: 'name', label: 'الاسم' },
          { id: 'sku', label: 'رمز SKU', render: (p) => <code>{p.sku}</code> },
          { id: 'barcode', label: 'الباركود', render: (p) => p.barcode || '—' },
          { id: 'category', label: 'التصنيف', render: (p) => p.category_name || '—' },
          { id: 'purchase_cost', label: 'تكلفة الشراء', render: (p) => `${(p.purchase_cost / 100).toFixed(2)} ج.م` },
          {
            id: 'stock',
            label: 'المخزون الفعلي',
            render: (p) => (
              <Chip
                label={p.stock}
                color={p.stock <= p.low_stock_threshold ? 'error' : 'success'}
                size="small"
                sx={{ fontWeight: 'bold' }}
              />
            )
          },
          { id: 'preorders', label: 'الحجوزات', render: (p) => <Chip label={p.open_preorders} size="small" variant="outlined" /> },
          {
            id: 'type',
            label: 'النوع',
            render: (p) => (
              <Chip
                label={p.notes?.includes('كتاب') || p.sku?.includes('AR') || p.is_book === 1 ? 'كتاب تعليمي' : 'عام'}
                color={p.notes?.includes('كتاب') || p.sku?.includes('AR') || p.is_book === 1 ? 'primary' : 'default'}
                size="small"
              />
            )
          },
          {
            id: 'is_active',
            label: 'الحالة',
            render: (p) => <StatusChip status={p.is_active} />
          },
          {
            id: 'actions',
            label: 'العمليات',
            render: (p) => (
              <Box sx={{ display: 'flex', gap: 1 }}>
                <Button
                  variant="outlined"
                  size="small"
                  className="table-action-btn"
                  onClick={() => handleOpenEditDialog(p)}
                  startIcon={<EditIcon />}
                  sx={{ fontFamily: 'Cairo' }}
                >
                  <span className="btn-text">تعديل</span>
                </Button>
                <Button
                  variant="outlined"
                  size="small"
                  className="table-action-btn"
                  onClick={() => handleOpenQrDialog(p)}
                  startIcon={<QrIcon />}
                  sx={{ fontFamily: 'Cairo' }}
                >
                  <span className="btn-text">ملصق</span>
                </Button>
                <Button
                  variant="outlined"
                  size="small"
                  className="table-action-btn"
                  onClick={() => handleOpenAdjustDialog(p)}
                  startIcon={<SettingsIcon />}
                  sx={{ fontFamily: 'Cairo' }}
                >
                  <span className="btn-text">تسوية</span>
                </Button>
                <Button
                  variant="outlined"
                  size="small"
                  className="table-action-btn"
                  color={p.is_active === 1 ? 'error' : 'success'}
                  onClick={() => handleToggleProductStatus(p)}
                  startIcon={<PowerIcon />}
                  sx={{ fontFamily: 'Cairo' }}
                >
                  <span className="btn-text">{p.is_active === 1 ? 'تعطيل' : 'تفعيل'}</span>
                </Button>
              </Box>
            )
          }
        ]}
        rows={productsList}
        mobileRenderer={renderMobileRecord}
        emptyTitle="لا توجد منتجات مطابقة للبحث"
        emptyDescription="تأكد من كتابة اسم منتج أو باركود صحيح أو ضبط فئات الفلتر الحالية."
      />

      {/* Add / Edit Dialog Wrapper */}
      <Dialog
        open={showAddDialog || showEditDialog}
        onClose={() => !submitting && (setShowAddDialog(false) || setShowEditDialog(false))}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle sx={{ fontFamily: 'Cairo', fontWeight: 'bold', textAlign: dir === 'rtl' ? 'right' : 'left' }}>
          {showAddDialog ? 'إضافة منتج جديد للكتالوج' : 'تعديل بيانات المنتج'}
        </DialogTitle>
        <form onSubmit={showAddDialog ? handleCreateProductSubmit : handleEditProductSubmit}>
          <DialogContent>
            {dialogError && (
              <Alert severity="error" sx={{ mb: 2, fontFamily: 'Cairo', textAlign: dir === 'rtl' ? 'right' : 'left' }}>
                {dialogError}
              </Alert>
            )}
            <Grid container spacing={2}>
              {/* General Fields */}
              <Grid item xs={12} sm={6}>
                <TextField
                  required
                  fullWidth
                  label="اسم الصنف / المنتج"
                  value={productFormName}
                  onChange={(e) => setProductFormName(e.target.value)}
                  disabled={submitting}
                  size="small"
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
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  required
                  fullWidth
                  label="رمز SKU"
                  value={productFormSku}
                  onChange={(e) => setProductFormSku(e.target.value)}
                  disabled={submitting}
                  size="small"
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
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="الباركود الدولي (EAN)"
                  value={productFormBarcode}
                  onChange={(e) => setProductFormBarcode(e.target.value)}
                  disabled={submitting}
                  size="small"
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
              </Grid>
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth size="small">
                  <InputLabel sx={{ fontFamily: 'Cairo', transformOrigin: dir === 'rtl' ? 'right' : 'left', right: dir === 'rtl' ? 24 : 'auto' }}>تصنيف المنتج</InputLabel>
                  <Select
                    value={productFormCategoryId}
                    label="تصنيف المنتج"
                    onChange={(e) => setProductFormCategoryId(e.target.value)}
                    disabled={submitting}
                  >
                    {categoriesList.map((c) => (
                      <MenuItem key={c.id} value={c.id.toString()}>
                        {c.name}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>

              {/* Toggles */}
              <Grid item xs={12}>
                <Divider sx={{ my: 1 }} />
              </Grid>

              <Grid item xs={12} sm={4}>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={productFormIsActive}
                      onChange={(e) => setProductFormIsActive(e.target.checked)}
                      disabled={submitting}
                    />
                  }
                  label="المنتج نشط ومتاح في النظام"
                  sx={{ '& .MuiFormControlLabel-label': { fontFamily: 'Cairo', fontSize: '0.85rem' } }}
                />
              </Grid>
              <Grid item xs={12} sm={4}>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={productFormCanBeSold}
                      onChange={(e) => setProductFormCanBeSold(e.target.checked)}
                      disabled={submitting}
                    />
                  }
                  label="متاح للبيع المباشر الفوري"
                  sx={{ '& .MuiFormControlLabel-label': { fontFamily: 'Cairo', fontSize: '0.85rem' } }}
                />
              </Grid>
              <Grid item xs={12} sm={4}>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={productFormCanBePreordered}
                      onChange={(e) => setProductFormCanBePreordered(e.target.checked)}
                      disabled={submitting}
                    />
                  }
                  label="متاح للحجز المسبق (Pre-order)"
                  sx={{ '& .MuiFormControlLabel-label': { fontFamily: 'Cairo', fontSize: '0.85rem' } }}
                />
              </Grid>

              {productFormCanBePreordered && (
                <>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      type="number"
                      label="نسبة العربون الافتراضية (%)"
                      value={productFormPreorderDepositPct}
                      onChange={(e) => setProductFormPreorderDepositPct(e.target.value)}
                      disabled={submitting}
                      size="small"
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
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <FormControl fullWidth size="small">
                      <InputLabel sx={{ fontFamily: 'Cairo', transformOrigin: dir === 'rtl' ? 'right' : 'left', right: dir === 'rtl' ? 24 : 'auto' }}>طريقة التسليم الافتراضية</InputLabel>
                      <Select
                        value={productFormPickupMethod}
                        label="طريقة التسليم الافتراضية"
                        onChange={(e) => setProductFormPickupMethod(e.target.value)}
                        disabled={submitting}
                      >
                        <MenuItem value="walk_in">استلام من المعرض</MenuItem>
                        <MenuItem value="shipping">شحن وتوصيل منزلي</MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>
                </>
              )}

              {/* Stock Configuration & Costs */}
              <Grid item xs={12}>
                <Divider sx={{ my: 1 }} />
              </Grid>

              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  type="number"
                  label="حد التنبيه للمخزون المنخفض"
                  value={productFormLowStockThreshold}
                  onChange={(e) => setProductFormLowStockThreshold(e.target.value)}
                  disabled={submitting}
                  size="small"
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
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="تكلفة الشراء (Purchase Cost) ج.م"
                  value={productFormPurchaseCost}
                  onChange={(e) => setProductFormPurchaseCost(e.target.value)}
                  disabled={submitting}
                  size="small"
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
              </Grid>

              <Grid item xs={12}>
                <TextField
                  fullWidth
                  multiline
                  rows={2}
                  label="وصف المنتج / الملاحظات"
                  value={productFormNotes}
                  onChange={(e) => setProductFormNotes(e.target.value)}
                  disabled={submitting}
                  size="small"
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
              </Grid>

              {/* Pricing Matrix */}
              <Grid item xs={12}>
                <Typography variant="subtitle2" sx={{ fontWeight: 'bold', my: 1, fontFamily: 'Cairo', borderBottom: '1px solid', borderColor: 'divider', pb: 1 }}>
                  💰 فئات أسعار البيع المعتمدة (EGP)
                </Typography>
              </Grid>

              {priceTiersList.map((tier) => (
                <Grid item xs={12} sm={4} key={tier.id}>
                  <TextField
                    fullWidth
                    label={tier.name}
                    placeholder="0.00"
                    value={productFormPrices[tier.id] || ''}
                    onChange={(e) => handlePriceChange(tier.id, e.target.value)}
                    disabled={submitting}
                    size="small"
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
                </Grid>
              ))}

              {/* Book Details */}
              <Grid item xs={12}>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={productFormIsBook}
                      onChange={(e) => setProductFormIsBook(e.target.checked)}
                      disabled={submitting}
                    />
                  }
                  label="هذا الصنف عبارة عن كتاب تعليمي خارجي / مدرسي"
                  sx={{ '& .MuiFormControlLabel-label': { fontFamily: 'Cairo', fontWeight: 'bold' } }}
                />
              </Grid>

              {productFormIsBook && (
                <>
                  <Grid item xs={12} sm={4}>
                    <TextField
                      fullWidth
                      label="نوع الكتاب"
                      placeholder="مثال: خارجي، دليل معلم"
                      value={bookFormType}
                      onChange={(e) => setBookFormType(e.target.value)}
                      disabled={submitting}
                      size="small"
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
                  </Grid>
                  <Grid item xs={12} sm={4}>
                    <TextField
                      fullWidth
                      label="الصف الدراسي"
                      placeholder="مثال: الصف الثالث الابتدائي"
                      value={bookFormSchoolGrade}
                      onChange={(e) => setBookFormSchoolGrade(e.target.value)}
                      disabled={submitting}
                      size="small"
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
                  </Grid>
                  <Grid item xs={12} sm={4}>
                    <TextField
                      fullWidth
                      label="المادة الدراسية"
                      placeholder="مثال: الرياضيات"
                      value={bookFormSubject}
                      onChange={(e) => setBookFormSubject(e.target.value)}
                      disabled={submitting}
                      size="small"
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
                  </Grid>
                  <Grid item xs={12} sm={4}>
                    <TextField
                      fullWidth
                      label="المدرس / المؤلف"
                      placeholder="تعبأ في حالة ملازم خاصة"
                      value={bookFormTeacher}
                      onChange={(e) => setBookFormTeacher(e.target.value)}
                      disabled={submitting}
                      size="small"
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
                  </Grid>
                  <Grid item xs={12} sm={4}>
                    <TextField
                      fullWidth
                      label="دار النشر / المطبقة"
                      placeholder="مثال: الأضواء، سلاح التلميذ"
                      value={bookFormPublisher}
                      onChange={(e) => setBookFormPublisher(e.target.value)}
                      disabled={submitting}
                      size="small"
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
                  </Grid>
                  <Grid item xs={12} sm={4}>
                    <TextField
                      fullWidth
                      type="number"
                      label="سنة الإصدار"
                      placeholder="مثال: 2026"
                      value={bookFormReleaseYear}
                      onChange={(e) => setBookFormReleaseYear(e.target.value)}
                      disabled={submitting}
                      size="small"
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
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <FormControl fullWidth size="small">
                      <InputLabel sx={{ fontFamily: 'Cairo', transformOrigin: dir === 'rtl' ? 'right' : 'left', right: dir === 'rtl' ? 24 : 'auto' }}>الفصل الدراسي</InputLabel>
                      <Select
                        value={bookFormTerm}
                        label="الفصل الدراسي"
                        onChange={(e) => setBookFormTerm(e.target.value)}
                        disabled={submitting}
                      >
                        <MenuItem value="first">ترم أول (First Term)</MenuItem>
                        <MenuItem value="second">ترم ثاني (Second Term)</MenuItem>
                        <MenuItem value="full_year">عام كامل</MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <FormControl fullWidth size="small">
                      <InputLabel sx={{ fontFamily: 'Cairo', transformOrigin: dir === 'rtl' ? 'right' : 'left', right: dir === 'rtl' ? 24 : 'auto' }}>تصنيف كتاب تعليمي</InputLabel>
                      <Select
                        value={bookFormEducationalClassification}
                        label="تصنيف كتاب تعليمي"
                        onChange={(e) => setBookFormEducationalClassification(e.target.value)}
                        disabled={submitting}
                      >
                        <MenuItem value="external_book">كتب خارجية تجارية</MenuItem>
                        <MenuItem value="school_book">كتب دراسية تابعة للوزارة</MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>
                </>
              )}
            </Grid>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button onClick={() => setShowAddDialog(false) || setShowEditDialog(false)} disabled={submitting} sx={{ fontFamily: 'Cairo' }}>
              إلغاء
            </Button>
            <Button type="submit" variant="contained" disabled={submitting} sx={{ fontFamily: 'Cairo' }}>
              {showAddDialog ? 'إضافة المنتج للكتالوج' : 'حفظ التعديلات'}
            </Button>
          </DialogActions>
        </form>
      </Dialog>

      {/* Adjust Stock Dialog */}
      <Dialog open={showAdjustDialog} onClose={() => !submitting && setShowAdjustDialog(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontFamily: 'Cairo', fontWeight: 'bold', textAlign: dir === 'rtl' ? 'right' : 'left' }}>تسوية مخزون المنتج</DialogTitle>
        <form onSubmit={handleAdjustStockSubmit}>
          <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {dialogError && (
              <Alert severity="error" sx={{ mb: 1, fontFamily: 'Cairo', textAlign: dir === 'rtl' ? 'right' : 'left' }}>
                {dialogError}
              </Alert>
            )}
            <Typography variant="body2" sx={{ fontFamily: 'Cairo', fontWeight: 'bold' }}>
              المنتج الحالي: {adjustProduct?.name}
            </Typography>

            <FormControl component="fieldset">
              <FormLabel component="legend" sx={{ fontFamily: 'Cairo', fontSize: '0.85rem', textAlign: dir === 'rtl' ? 'right' : 'left' }}>نوع التسوية</FormLabel>
              <RadioGroup row value={adjustType} onChange={(e) => setAdjustType(e.target.value)}>
                <FormControlLabel value="ADD" control={<Radio />} label="إضافة مخزون (+)" sx={{ '& .MuiFormControlLabel-label': { fontFamily: 'Cairo', fontSize: '0.85rem' } }} />
                <FormControlLabel value="SUBTRACT" control={<Radio />} label="خصم مخزون (-)" sx={{ '& .MuiFormControlLabel-label': { fontFamily: 'Cairo', fontSize: '0.85rem' } }} />
              </RadioGroup>
            </FormControl>

            <TextField
              fullWidth
              type="number"
              label="الكمية"
              value={adjustQty}
              onChange={(e) => setAdjustQty(e.target.value)}
              disabled={submitting}
              size="small"
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
            <TextField
              fullWidth
              multiline
              rows={2}
              label="ملاحظات التسوية / السبب"
              value={adjustNotes}
              onChange={(e) => setAdjustNotes(e.target.value)}
              disabled={submitting}
              size="small"
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
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button onClick={() => setShowAdjustDialog(false)} disabled={submitting} sx={{ fontFamily: 'Cairo' }}>
              إلغاء
            </Button>
            <Button type="submit" variant="contained" disabled={submitting} sx={{ fontFamily: 'Cairo' }}>
              تأكيد التسوية
            </Button>
          </DialogActions>
        </form>
      </Dialog>

      {/* QR Code printing configuration dialog */}
      <Dialog open={showQrDialog} onClose={() => !submitting && setShowQrDialog(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontFamily: 'Cairo', fontWeight: 'bold', textAlign: dir === 'rtl' ? 'right' : 'left' }}>تحضير وطباعة ملصقات QR للتعريف</DialogTitle>
        <form onSubmit={handleGenerateQrLabels}>
          <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {dialogError && (
              <Alert severity="error" sx={{ mb: 1, fontFamily: 'Cairo', textAlign: dir === 'rtl' ? 'right' : 'left' }}>
                {dialogError}
              </Alert>
            )}
            <Typography variant="body2" sx={{ fontFamily: 'Cairo', fontWeight: 'bold' }}>
              اسم المنتج: {qrPrintProduct?.name}
            </Typography>

            <TextField
              fullWidth
              type="number"
              label="عدد الملصقات المطلوب طباعتها"
              value={qrPrintQuantity}
              onChange={(e) => setQrPrintQuantity(e.target.value)}
              disabled={submitting}
              size="small"
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

            <FormControl fullWidth size="small">
              <InputLabel sx={{ fontFamily: 'Cairo', transformOrigin: dir === 'rtl' ? 'right' : 'left', right: dir === 'rtl' ? 24 : 'auto' }}>مقاس ملصق الطباعة</InputLabel>
              <Select
                value={qrPrintSize}
                label="مقاس ملصق الطباعة"
                onChange={(e) => setQrPrintSize(e.target.value)}
                disabled={submitting}
              >
                <MenuItem value="small">صغير (38x25 مم)</MenuItem>
                <MenuItem value="medium">متوسط (50x25 مم)</MenuItem>
                <MenuItem value="large">كبير (80x50 مم)</MenuItem>
              </Select>
            </FormControl>

            {qrPrintResult && (
              <Box sx={{ mt: 2, p: 2, bgcolor: 'background.default', border: '1px dashed', borderColor: 'primary.main', borderRadius: 1, textAlign: 'center' }}>
                <Typography variant="subtitle2" sx={{ color: 'success.main', fontWeight: 'bold', fontFamily: 'Cairo' }}>
                  ✔ تم تحضير ملصقات الباركود بنجاح!
                </Typography>
                <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mt: 1, fontFamily: 'Cairo' }}>
                  معرف أمر الطباعة: <code>{qrPrintResult.token}</code>
                </Typography>
                <Button variant="outlined" size="small" href={`/api/admin/print-job/${qrPrintResult.token}?qty=${qrPrintQuantity}&size=${qrPrintSize}`} target="_blank" sx={{ mt: 1, fontFamily: 'Cairo' }}>
                  معاينة وطباعة الملصقات
                </Button>
              </Box>
            )}
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button onClick={() => setShowQrDialog(false)} disabled={submitting} sx={{ fontFamily: 'Cairo' }}>
              إغلاق
            </Button>
            {!qrPrintResult && (
              <Button type="submit" variant="contained" disabled={submitting} sx={{ fontFamily: 'Cairo' }}>
                تحضير وتوليد الملصقات
              </Button>
            )}
          </DialogActions>
        </form>
      </Dialog>

      {/* Confirmation dialog for product status toggle */}
      <ConfirmDialog
        open={confirmOpen}
        title="تغيير حالة المنتج"
        description={
          selectedProductForToggle?.is_active === 1
            ? `هل أنت متأكد من رغبتك في تعطيل المنتج "${selectedProductForToggle?.name}"؟ سيختفي المنتج من قائمة الكاشير والبيع المباشر.`
            : `هل أنت متأكد من رغبتك في تفعيل المنتج "${selectedProductForToggle?.name}"؟`
        }
        type="warning"
        confirmText="تأكيد"
        cancelText="إلغاء"
        onConfirm={confirmToggleStatus}
        onCancel={() => setConfirmOpen(false)}
      />
    </Box>
  );
}

export default Products;

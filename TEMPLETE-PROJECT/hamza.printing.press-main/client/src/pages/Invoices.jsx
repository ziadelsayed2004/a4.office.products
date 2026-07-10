import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { formatCurrencyEGP, formatEgyptDate, formatEgyptDateTime } from '../utils/formatters';
import { compressImageAndConvertToBase64 } from '../utils/fileCompressor';
import { useAuth } from '../app/AuthContext';
import { apiClient } from '../services/apiClient';
import { t } from '../locales/t';
import LoadingState from '../components/LoadingState';
import EmptyState from '../components/EmptyState';
import EntityDrawer from '../components/EntityDrawer';
import ConfirmDialog from '../components/ConfirmDialog';
import { FormSection } from '../components/forms/FormSection';
import { FieldGrid } from '../components/forms/FieldGrid';
import { EGYPT_GOVERNORATES } from '../constants/governorates';
import {
  Box,
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Button,
  IconButton,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Grid,
  Alert,
  Snackbar,
  InputAdornment,
  Checkbox,
  Divider,
  Tab,
  Tabs,
  Card,
  CardContent,
  Collapse,
  Autocomplete,
  Drawer
} from '@mui/material';
import {
  Edit as EditIcon,
  Add as AddIcon,
  Search as SearchIcon,
  Visibility as VisibilityIcon,
  CloudDownload as DownloadIcon,
  FilterList as FilterIcon,
  Clear as ClearIcon,
  Delete as DeleteIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Payments as PaymentsIcon,
  EventNote as EventNoteIcon,
  LocalShipping as LocalShippingIcon,
  SettingsBackupRestore as SettingsBackupRestoreIcon,
  CheckCircle as CheckCircleIcon,
  Receipt as ReceiptIcon,
  Print as PrintIcon,
  ChevronLeft as ChevronLeftIcon,
  ChevronRight as ChevronRightIcon
} from '@mui/icons-material';
import '../styles/Invoices.css';

export const Invoices = () => {
  const { hasPermission } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const kpiCardStyle = {
    p: 2,
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center'
  };

  const getRemainingCardStyle = (remainingAmount) => ({
    p: 2,
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    borderColor: remainingAmount > 0 ? 'warning.light' : 'divider'
  });

  // Primary Data States
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);

  // Metadata/Filter list options
  const [outlets, setOutlets] = useState([]);
  const [outletTypes, setOutletTypes] = useState([]);
  const [productsList, setProductsList] = useState([]);
  const [authorsList, setAuthorsList] = useState([]);
  const [categoriesList, setCategoriesList] = useState([]);

  // Pagination State
  const [limit, setLimit] = useState(25);
  const [offset, setOffset] = useState(0);

  // Filter States
  const [showFilters, setShowFilters] = useState(false);
  const [filterSearch, setFilterSearch] = useState(new URLSearchParams(window.location.search).get('search') || '');
  const [filterOutletId, setFilterOutletId] = useState('');
  const [filterOutletTypeId, setFilterOutletTypeId] = useState('');
  const [filterProductId, setFilterProductId] = useState('');
  const [filterAuthorId, setFilterAuthorId] = useState('');
  const [filterGovernorate, setFilterGovernorate] = useState('');
  const [filterPaymentStatus, setFilterPaymentStatus] = useState('');
  const [filterShippingStatus, setFilterShippingStatus] = useState('');
  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');
  const [filterHasRemaining, setFilterHasRemaining] = useState('');
  const [filterMinRemaining, setFilterMinRemaining] = useState('');
  const [filterMaxRemaining, setFilterMaxRemaining] = useState('');

  // Selection state for batch actions
  const [selectedInvoiceIds, setSelectedInvoiceIds] = useState([]);
  const [openBulkShippingModal, setOpenBulkShippingModal] = useState(false);
  const [bulkShippingStatus, setBulkShippingStatus] = useState('shipped');
  const [bulkSubmitting, setBulkSubmitting] = useState(false);

  // Toast Notification State
  const [toastMsg, setToastMsg] = useState('');
  const [toastSeverity, setToastSeverity] = useState('success');

  // Details Modal Controller
  const [openDetailsModal, setOpenDetailsModal] = useState(false);
  const [detailsInvoice, setDetailsInvoice] = useState(null);
  const [detailsTabValue, setDetailsTabValue] = useState(0);

  // Supply payment confirmation states
  const [supplyConfirmOpen, setSupplyConfirmOpen] = useState(false);
  const [paymentIdToSupply, setPaymentIdToSupply] = useState(null);

  // Form state loading
  const [scheduleLoading, setScheduleLoading] = useState(false);

  // Create/Edit Wizard Modal Controller
  const [openFormModal, setOpenFormModal] = useState(false);
  const [formMode, setFormMode] = useState('create'); // 'create' or 'edit'
  const [selectedFormInvoice, setSelectedFormInvoice] = useState(null);

  // Wizard Form Fields
  const [formOutletId, setFormOutletId] = useState('');
  const [formOutletTypeLabel, setFormOutletTypeLabel] = useState('');
  const [formDiscount, setFormDiscount] = useState(0);
  const [formShippingCost, setFormShippingCost] = useState(0);
  const [formPaymentType, setFormPaymentType] = useState('cash');
  const [formNotes, setFormNotes] = useState('');
  const [formItems, setFormItems] = useState([]); // [{ productId, productTitle, productCode, quantity, price, stock, stockPolicy, error }]
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formCollectionType, setFormCollectionType] = useState('none'); // 'none', 'partial', 'full'
  const [formCollectedAmount, setFormCollectedAmount] = useState(0);
  const [formSupplyStatus, setFormSupplyStatus] = useState('not_supplied'); // 'not_supplied', 'supplied'
  const [formCollectionNotes, setFormCollectionNotes] = useState('');
  const [formReceiptName, setFormReceiptName] = useState('');
  const [formReceiptData, setFormReceiptData] = useState('');
  const [formInvoiceNumber, setFormInvoiceNumber] = useState('');
  const [outletBalances, setOutletBalances] = useState([]);

  const [openReturnDrawer, setOpenReturnDrawer] = useState(false);
  const [returnInvoice, setReturnInvoice] = useState(null);
  const [returnQuantities, setReturnQuantities] = useState({});
  const [returnReason, setReturnReason] = useState('');
  const [returnSubmitting, setReturnSubmitting] = useState(false);

  // Toast trigger
  const showToast = (msg, severity = 'success') => {
    setToastMsg(msg);
    setToastSeverity(severity);
  };

  // Fetch initial configuration metadata (Run once)
  const fetchMetadata = async () => {
    try {
      const outletsData = await apiClient.get('/outlets?limit=500&status=active');
      setOutlets(outletsData);

      const typesData = await apiClient.get('/outlet-types?limit=100&includeDisabled=false');
      setOutletTypes(typesData);

      const authorsData = await apiClient.get('/authors?limit=500&status=active');
      setAuthorsList(authorsData);

      const catsData = await apiClient.get('/products/categories');
      setCategoriesList(catsData);

      // Prefetch products and stock levels to make lookup fast in invoice wizard
      const productsData = await apiClient.get('/products?limit=500&status=active');
      const stockData = await apiClient.get('/inventory/stock-summary?limit=500');
      const combined = productsData.map((p) => {
        const match = stockData.find((s) => s.id === p.id);
        return {
          ...p,
          stock: match ? match.stock : 0
        };
      });
      setProductsList(combined);

      try {
        const balancesData = await apiClient.get('/finance/outlets');
        setOutletBalances(balancesData);
      } catch (err) {
        console.error('Error fetching outlet balances:', err);
      }
    } catch (err) {
      console.error('Error fetching metadata:', err);
    }
  };

  // Main fetch invoices list function
  const fetchInvoices = async () => {
    setLoading(true);
    try {
      let query = `/invoices?limit=${limit}&offset=${offset}`;

      if (filterSearch) query += `&search=${encodeURIComponent(filterSearch)}`;
      if (filterOutletId) query += `&outletId=${filterOutletId}`;
      if (filterOutletTypeId) query += `&outletTypeId=${filterOutletTypeId}`;
      if (filterProductId) query += `&productId=${filterProductId}`;
      if (filterAuthorId) query += `&authorId=${filterAuthorId}`;
      if (filterGovernorate) query += `&governorate=${encodeURIComponent(filterGovernorate)}`;
      if (filterPaymentStatus) query += `&paymentStatus=${filterPaymentStatus}`;
      if (filterShippingStatus) query += `&shippingStatus=${filterShippingStatus}`;
      if (filterStartDate) query += `&startDate=${filterStartDate}`;
      if (filterEndDate) query += `&endDate=${filterEndDate}`;
      if (filterHasRemaining) query += `&hasRemaining=${filterHasRemaining}`;
      if (filterMinRemaining) query += `&minRemaining=${filterMinRemaining}`;
      if (filterMaxRemaining) query += `&maxRemaining=${filterMaxRemaining}`;

      const data = await apiClient.get(query);
      setInvoices(data);
      // Since backend doesn't return count directly, calculate totalCount dynamically
      // if rows length matches limit, there could be more. Otherwise offset + data.length
      setTotalCount(data.length < limit ? offset + data.length : offset + data.length + limit);

      // Auto-open details if search code matches exactly
      const searchParam = new URLSearchParams(window.location.search).get('search');
      if (searchParam && data && data.length > 0) {
        const exactMatch = data.find(inv => inv.invoice_number === searchParam.trim());
        if (exactMatch) {
          handleOpenDetails(exactMatch);
        }
      }
    } catch (err) {
      console.error(err);
      showToast(err.message || 'فشل تحميل الفواتير.', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Run on mount
  useEffect(() => {
    fetchMetadata();
  }, []);

  // Run on filter/pagination changes
  useEffect(() => {
    fetchInvoices();
  }, [limit, offset]);

  // Handle pagination navigation
  const handlePrevPage = () => {
    if (offset >= limit) {
      setOffset(offset - limit);
    }
  };

  const handleNextPage = () => {
    setOffset(offset + limit);
  };

  // Reset all advanced filter values
  const handleResetFilters = () => {
    setFilterSearch('');
    setFilterOutletId('');
    setFilterOutletTypeId('');
    setFilterProductId('');
    setFilterAuthorId('');
    setFilterGovernorate('');
    setFilterPaymentStatus('');
    setFilterShippingStatus('');
    setFilterStartDate('');
    setFilterEndDate('');
    setFilterHasRemaining('');
    setFilterMinRemaining('');
    setFilterMaxRemaining('');
    setOffset(0);
    showToast('تمت إعادة تعيين الفلاتر.');
    setTimeout(() => fetchInvoices(), 50);
  };

  const handleApplyFilters = () => {
    setOffset(0);
    fetchInvoices();
  };

  // Handle single and multi-selection of rows
  const handleSelectAll = (e) => {
    if (e.target.checked) {
      setSelectedInvoiceIds(invoices.map((inv) => inv.id));
    } else {
      setSelectedInvoiceIds([]);
    }
  };

  const handleSelectInvoice = (id) => {
    if (selectedInvoiceIds.includes(id)) {
      setSelectedInvoiceIds(selectedInvoiceIds.filter((x) => x !== id));
    } else {
      setSelectedInvoiceIds([...selectedInvoiceIds, id]);
    }
  };

  // Bulk update shipping status for selected invoices
  const handleBulkShippingUpdate = async () => {
    if (selectedInvoiceIds.length === 0) return;
    setBulkSubmitting(true);
    try {
      await apiClient.put('/invoices/bulk/shipping-status', {
        invoiceIds: selectedInvoiceIds,
        shippingStatus: bulkShippingStatus
      });
      showToast(`تم تحديث حالة الشحن بنجاح لـ ${selectedInvoiceIds.length} فاتورة.`);
      setSelectedInvoiceIds([]);
      setOpenBulkShippingModal(false);
      fetchInvoices();
    } catch (err) {
      console.error(err);
      showToast(err.message || 'فشل تحديث حالة الشحن للمجموعة.', 'error');
    } finally {
      setBulkSubmitting(false);
    }
  };

  // Batch Export PDF method
  const handleBatchPdfExport = async () => {
    if (selectedInvoiceIds.length === 0) return;
    try {
      showToast('جاري إنشاء ملف الـ PDF...');
      const response = await apiClient.post('/invoices/export/pdf', {
        invoiceIds: selectedInvoiceIds
      }, {
        headers: { 'Accept': 'application/pdf' }
      });

      // apiClient returns body, if it's already structured as text/data or blob, handle it
      // Since custom apiClient converts JSON or text, let's invoke a direct window download trigger for safety
      // Or we can construct standard fetch to get the binary stream properly.
      const rawResponse = await fetch('/api/invoices/export/pdf', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/pdf'
        },
        body: JSON.stringify({ invoiceIds: selectedInvoiceIds })
      });
      
      if (!rawResponse.ok) throw new Error('فشل تصدير ملف الـ PDF');
      const blob = await rawResponse.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.setAttribute('download', `تقرير_الفواتير_${Date.now()}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      showToast('تم تحميل التقرير بنجاح.');
    } catch (err) {
      console.error(err);
      showToast('حدث خطأ أثناء تصدير ملف الـ PDF.', 'error');
    }
  };

  // Single PDF Export
  const handleSinglePdfExport = async (invoiceId) => {
    try {
      showToast('جاري تحميل الفاتورة...');
      const rawResponse = await fetch('/api/invoices/export/pdf', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/pdf'
        },
        body: JSON.stringify({ invoiceIds: [invoiceId] })
      });
      
      if (!rawResponse.ok) throw new Error('فشل تصدير الفاتورة');
      const blob = await rawResponse.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.setAttribute('download', `فاتورة_${invoiceId}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      showToast('تم تحميل الفاتورة بنجاح.');
    } catch (err) {
      console.error(err);
      showToast('فشل تحميل ملف الـ PDF للفاتورة.', 'error');
    }
  };

  // Single PDF Print (Open in new window to print)
  const handleSinglePdfPrint = async (invoiceId) => {
    try {
      showToast('جاري تحضير ملف الـ PDF للطباعة...', 'info');
      const rawResponse = await fetch('/api/invoices/export/pdf', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/pdf'
        },
        body: JSON.stringify({ invoiceIds: [invoiceId] })
      });
      
      if (!rawResponse.ok) throw new Error('فشل تصدير الفاتورة للطباعة');
      const blob = await rawResponse.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const printWindow = window.open(blobUrl, '_blank');
      if (!printWindow) {
        showToast('يرجى السماح بالنوافذ المنبثقة لطباعة الفاتورة.', 'warning');
      }
    } catch (err) {
      console.error(err);
      showToast('فشل فتح ملف الـ PDF للطباعة.', 'error');
    }
  };

  // Batch PDF Print (Open in new window to print)
  const handleBatchPdfPrint = async () => {
    if (selectedInvoiceIds.length === 0) return;
    try {
      showToast('جاري تحضير ملف الـ PDF للطباعة...', 'info');
      const rawResponse = await fetch('/api/invoices/export/pdf', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/pdf'
        },
        body: JSON.stringify({ invoiceIds: selectedInvoiceIds })
      });
      
      if (!rawResponse.ok) throw new Error('فشل تصدير التقرير للطباعة');
      const blob = await rawResponse.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const printWindow = window.open(blobUrl, '_blank');
      if (!printWindow) {
        showToast('يرجى السماح بالنوافذ المنبثقة للطباعة.', 'warning');
      }
    } catch (err) {
      console.error(err);
      showToast('حدث خطأ أثناء فتح ملف الـ PDF للطباعة.', 'error');
    }
  };

  const handlePrintInvoice = (inv) => {
    if (!inv) return;
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      showToast('يرجى السماح بالنوافذ المنبثقة لطباعة الفاتورة.', 'warning');
      return;
    }

    const itemsHtml = inv.items?.map((item, idx) => {
      const billableQty = Math.max(0, item.quantity - (item.free_quantity || 0));
      return `
        <tr>
          <td style="border: 1px solid #cbd5e1; padding: 10px; text-align: center;">${idx + 1}</td>
          <td style="border: 1px solid #cbd5e1; padding: 10px; font-weight: 500;">${item.product_title}</td>
          <td style="border: 1px solid #cbd5e1; padding: 10px; text-align: center; font-family: monospace;">${item.product_code || '-'}</td>
          <td style="border: 1px solid #cbd5e1; padding: 10px; text-align: center; font-weight: bold;">${item.quantity}</td>
          <td style="border: 1px solid #cbd5e1; padding: 10px; text-align: center; color: #16a34a; font-weight: 500;">${item.free_quantity || 0}</td>
          <td style="border: 1px solid #cbd5e1; padding: 10px; text-align: center;">${billableQty}</td>
          <td style="border: 1px solid #cbd5e1; padding: 10px; text-align: left; font-family: monospace;">${formatCurrencyEGP(item.unit_price)}</td>
          <td style="border: 1px solid #cbd5e1; padding: 10px; text-align: left; font-family: monospace; font-weight: bold;">${formatCurrencyEGP(item.total_price)}</td>
        </tr>
      `;
    }).join('');

    const formattedDate = formatEgyptDateTime(inv.created_at);

    printWindow.document.write(`
      <html dir="rtl" lang="ar">
      <head>
        <title>فاتورة مبيعات - ${inv.invoice_number}</title>
        <style>
          @page { size: A4; margin: 15mm; }
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 10px; color: #1e293b; background-color: #fff; line-height: 1.5; font-size: 14px; }
          .header-container { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #0f172a; padding-bottom: 15px; margin-bottom: 25px; }
          .logo-area { text-align: right; }
          .logo-area h1 { margin: 0; font-size: 24px; color: #1e3a8a; font-weight: 800; letter-spacing: -0.5px; }
          .logo-area p { margin: 4px 0 0 0; font-size: 12px; color: #64748b; }
          .title-area { text-align: left; }
          .title-area h2 { margin: 0; font-size: 20px; color: #0f172a; font-weight: 700; }
          .title-area p { margin: 4px 0 0 0; font-size: 13px; font-family: monospace; font-weight: bold; color: #1e3a8a; }
          
          .info-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 20px; margin-bottom: 25px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 15px; }
          .info-block h4 { margin: 0 0 8px 0; font-size: 13px; color: #64748b; border-bottom: 1px solid #cbd5e1; padding-bottom: 4px; }
          .info-block p { margin: 4px 0; font-size: 14px; }
          .info-block p strong { color: #0f172a; }

          .items-table { width: 100%; border-collapse: collapse; margin-top: 15px; margin-bottom: 25px; }
          .items-table th { background-color: #f1f5f9; border: 1px solid #cbd5e1; padding: 10px; font-weight: 700; color: #334155; font-size: 13px; }
          
          .summary-container { display: flex; justify-content: space-between; align-items: flex-start; gap: 40px; margin-top: 15px; page-break-inside: avoid; }
          .notes-box { flex: 1; border: 1px dashed #cbd5e1; padding: 12px; border-radius: 6px; background-color: #fafafa; }
          .notes-box h5 { margin: 0 0 6px 0; font-size: 13px; color: #475569; }
          .notes-box p { margin: 0; font-size: 12px; color: #64748b; }
          
          .totals-table { width: 280px; border-collapse: collapse; }
          .totals-table td { padding: 8px 10px; border-bottom: 1px solid #e2e8f0; font-size: 13px; }
          .totals-table tr.grand-total td { font-weight: bold; font-size: 15px; border-bottom: 2px solid #0f172a; color: #1e3a8a; background-color: #f8fafc; }
          
          .signature-section { display: flex; justify-content: space-between; margin-top: 60px; padding: 0 20px; page-break-inside: avoid; }
          .signature-box { text-align: center; width: 200px; }
          .signature-box p { margin: 0; font-size: 13px; color: #475569; }
          .signature-line { border-top: 1px dashed #94a3b8; margin-top: 40px; }

          .footer { margin-top: 65px; text-align: center; font-size: 11px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 10px; page-break-inside: avoid; }
          
          .qr-wrapper { display: flex; flex-direction: column; align-items: center; justify-content: center; }
          .qr-wrapper img { width: 75px; height: 75px; margin-bottom: 4px; }
          .qr-wrapper span { font-size: 9px; color: #64748b; }
        </style>
      </head>
      <body>
        <div class="header-container">
          <div class="logo-area">
            <h1>مطبعة حمزة</h1>
            <p>للطباعة والنشر والتوزيع - إدارة المبيعات</p>
          </div>
          <div class="title-area">
            <h2>فاتورة مبيعات</h2>
            <p>رقم: ${inv.invoice_number}</p>
          </div>
        </div>

        <div class="info-grid">
          <div class="info-block">
            <h4>بيانات العميل / منفذ البيع</h4>
            <p><strong>الاسم:</strong> ${inv.outlet_name}</p>
            <p><strong>المحافظة:</strong> ${inv.governorate || '-'}</p>
            <p><strong>نوع الدفع المعتمد:</strong> ${
              inv.payment_status === 'paid' ? 'دفع كلي' :
              inv.payment_status === 'partially_paid' ? 'دفع جزئي' :
              inv.payment_type === 'cash' ? 'نقدي' :
              inv.payment_type === 'deferred' ? 'آجل' : inv.payment_type
            }</p>
          </div>
          <div class="info-block">
            <h4>تفاصيل الفاتورة</h4>
            <p><strong>تاريخ الإصدار:</strong> ${formattedDate}</p>
            <p><strong>حالة الدفع:</strong> ${
              inv.payment_status === 'paid' ? '<span style="color:#16a34a; font-weight:bold;">مسددة</span>' :
              inv.payment_status === 'partially_paid' ? '<span style="color:#ca8a04; font-weight:bold;">مسددة جزئياً</span>' :
              '<span style="color:#dc2626; font-weight:bold;">غير مسددة</span>'
            }</p>
            <p><strong>حالة الشحن والتسليم:</strong> ${
              inv.shipping_status === 'delivered' || inv.shipping_status === 'shipped' ? '<span style="color:#16a34a; font-weight:bold;">تم الشحن والتسليم</span>' :
              inv.shipping_status === 'partially_shipped' ? '<span style="color:#ca8a04; font-weight:bold;">شحن جزئي</span>' :
              '<span style="color:#94a3b8;">قيد الانتظار</span>'
            }</p>
          </div>
        </div>

        <table class="items-table" style="width: 100%; border-collapse: collapse; margin-top: 15px; margin-bottom: 25px;">
          <thead>
            <tr>
              <th style="background-color: #f1f5f9; border: 1px solid #cbd5e1; padding: 10px; font-weight: 700; color: #334155; font-size: 13px;">#</th>
              <th style="background-color: #f1f5f9; border: 1px solid #cbd5e1; padding: 10px; font-weight: 700; color: #334155; font-size: 13px; text-align: right;">الكتاب / الصنف</th>
              <th style="background-color: #f1f5f9; border: 1px solid #cbd5e1; padding: 10px; font-weight: 700; color: #334155; font-size: 13px;">الرمز (SKU)</th>
              <th style="background-color: #f1f5f9; border: 1px solid #cbd5e1; padding: 10px; font-weight: 700; color: #334155; font-size: 13px;">الكمية الإجمالية</th>
              <th style="background-color: #f1f5f9; border: 1px solid #cbd5e1; padding: 10px; font-weight: 700; color: #334155; font-size: 13px;">المجاني</th>
              <th style="background-color: #f1f5f9; border: 1px solid #cbd5e1; padding: 10px; font-weight: 700; color: #334155; font-size: 13px;">المدفوع</th>
              <th style="background-color: #f1f5f9; border: 1px solid #cbd5e1; padding: 10px; font-weight: 700; color: #334155; font-size: 13px; text-align: left;">سعر الوحدة</th>
              <th style="background-color: #f1f5f9; border: 1px solid #cbd5e1; padding: 10px; font-weight: 700; color: #334155; font-size: 13px; text-align: left;">الإجمالي</th>
            </tr>
          </thead>
          <tbody>
            ${itemsHtml}
          </tbody>
        </table>

        <div class="summary-container">
          <div class="notes-box">
            <h5>ملاحظات وشروط:</h5>
            <p>${inv.notes || 'لا يوجد ملاحظات إضافية.'}</p>
            <div style="margin-top: 15px; display: flex; gap: 20px; align-items: center;">
              <div class="qr-wrapper">
                <img src="https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=${encodeURIComponent(window.location.origin + '/invoices?search=' + inv.invoice_number)}" alt="Invoice QR" />
                <span>امسح للتحقق</span>
              </div>
            </div>
          </div>
          
          <table class="totals-table">
            <tr>
              <td>المجموع الفرعي:</td>
              <td style="text-align: left; font-family: monospace;">${formatCurrencyEGP(inv.subtotal || 0)}</td>
            </tr>
            <tr>
              <td style="color:#16a34a;">+ تكلفة الشحن:</td>
              <td style="text-align: left; font-family: monospace; color:#16a34a;">${formatCurrencyEGP(inv.shipping_cost || 0)}</td>
            </tr>
            <tr>
              <td style="color:#dc2626;">- الخصم المباشر:</td>
              <td style="text-align: left; font-family: monospace; color:#dc2626;">${formatCurrencyEGP(inv.discount || 0)}</td>
            </tr>
            <tr class="grand-total">
              <td>إجمالي الفاتورة:</td>
              <td style="text-align: left; font-family: monospace;">${formatCurrencyEGP(inv.total_price)}</td>
            </tr>
            <tr>
              <td style="color:#16a34a; font-weight:500;">المبلغ المسدد:</td>
              <td style="text-align: left; font-family: monospace; color:#16a34a; font-weight:500;">${formatCurrencyEGP(inv.paid_amount || 0)}</td>
            </tr>
            <tr style="border-top:1px solid #cbd5e1;">
              <td style="color:#dc2626; font-weight:bold;">المبلغ المتبقي (الذمة المالية):</td>
              <td style="text-align: left; font-family: monospace; color:#dc2626; font-weight:bold;">${formatCurrencyEGP(inv.remaining_amount || 0)}</td>
            </tr>
          </table>
        </div>

        <div class="signature-section">
          <div class="signature-box">
            <p>توقيع أمين المخزن المستلم</p>
            <div class="signature-line"></div>
          </div>
          <div class="signature-box">
            <p>توقيع العميل / المستلم</p>
            <div class="signature-line"></div>
          </div>
          <div class="signature-box">
            <p>الختم والاعتماد المالي</p>
            <div class="signature-line"></div>
          </div>
        </div>

        <div class="footer">
          مطبعة حمزة للنشر والتوزيع - نظام إدارة المستودعات والمبيعات الإلكتروني
        </div>
        <script>
          window.onload = function() { window.print(); window.close(); }
        </script>
      </body>
      </html>
    `);
    printWindow.document.close();
  };

  const handleFetchAndPrintInvoice = async (id) => {
    try {
      showToast('جاري تحميل تفاصيل الفاتورة للطباعة...', 'info');
      const data = await apiClient.get(`/invoices/${id}`);
      handlePrintInvoice(data);
    } catch (err) {
      console.error(err);
      showToast(err.message || 'فشل تحميل بيانات الفاتورة للطباعة.', 'error');
    }
  };

  // Open Details Modal and fetch full details
  const handleOpenDetails = async (invoice) => {
    setDetailsTabValue(0);
    try {
      const data = await apiClient.get(`/invoices/${invoice.id}`);
      setDetailsInvoice(data);
      setOpenDetailsModal(true);
    } catch (err) {
      console.error(err);
      showToast('فشل تحميل تفاصيل الفاتورة.', 'error');
    }
  };

  // Navigate between invoices in details drawer
  const handleNavigateInvoice = async (direction) => {
    if (!detailsInvoice || !invoices || invoices.length === 0) return;
    const currentIndex = invoices.findIndex(inv => inv.id === detailsInvoice.id);
    if (currentIndex === -1) return;

    let targetIndex = currentIndex;
    if (direction === 'next') {
      targetIndex = currentIndex + 1;
    } else if (direction === 'prev') {
      targetIndex = currentIndex - 1;
    }

    if (targetIndex >= 0 && targetIndex < invoices.length) {
      setDetailsTabValue(0);
      try {
        const targetInvoice = invoices[targetIndex];
        const data = await apiClient.get(`/invoices/${targetInvoice.id}`);
        setDetailsInvoice(data);
      } catch (err) {
        console.error(err);
        showToast('فشل تحميل الفاتورة.', 'error');
      }
    }
  };

  // Operational drawer handoffs and validations
  const handlePayHandoff = (invoice) => {
    if (!hasPermission('payments.create')) {
      showToast('ليس لديك صلاحية لتسجيل المدفوعات.', 'error');
      return;
    }
    if (invoice.remaining_amount <= 0) {
      showToast('هذه الفاتورة مدفوعة بالكامل بالفعل.', 'warning');
      return;
    }
    if (invoice.payment_status === 'cancelled') {
      showToast('لا يمكن الدفع لفاتورة ملغاة.', 'warning');
      return;
    }
    navigate(`/payments?outletId=${invoice.outlet_id}&invoiceId=${invoice.id}&action=create`);
  };

  const handleMarkPaidHandoff = (invoice) => {
    if (!hasPermission('payments.create')) {
      showToast('ليس لديك صلاحية لتسجيل المدفوعات.', 'error');
      return;
    }
    if (invoice.remaining_amount <= 0) {
      showToast('هذه الفاتورة مدفوعة بالكامل بالفعل.', 'warning');
      return;
    }
    if (invoice.payment_status === 'cancelled') {
      showToast('لا يمكن الدفع لفاتورة ملغاة.', 'warning');
      return;
    }
    navigate(`/payments?outletId=${invoice.outlet_id}&invoiceId=${invoice.id}&action=create&amount=${invoice.remaining_amount}&mode=full`);
  };

  const handleShipHandoff = (invoice) => {
    if (!hasPermission('invoices.update')) {
      showToast('ليس لديك صلاحية لتسجيل الشحنات.', 'error');
      return;
    }
    if (invoice.payment_status === 'cancelled') {
      showToast('لا يمكن تسجيل شحنة لفاتورة ملغاة.', 'warning');
      return;
    }
    navigate(`/shipments?invoiceId=${invoice.id}&action=create`);
  };

  const handleReturnClick = async (invoice) => {
    if (!hasPermission('invoices.update')) {
      showToast('ليس لديك صلاحية لتسجيل المرتجعات.', 'error');
      return;
    }
    if (invoice.payment_status === 'cancelled') {
      showToast('لا يمكن عمل مرتجع لفاتورة ملغاة.', 'warning');
      return;
    }
    if (!['shipped', 'delivered'].includes(invoice.shipping_status)) {
      showToast('لا يمكن عمل مرتجع إلا بعد شحن الفاتورة أو تسليمها (تم الشحن أو التوصيل).', 'warning');
      return;
    }
    try {
      const fullInvoice = await apiClient.get(`/invoices/${invoice.id}`);
      const hasReturnable = fullInvoice.items?.some(item => (item.remaining_returnable_quantity || 0) > 0);
      if (!hasReturnable) {
        showToast('لا توجد كتب قابلة للإرجاع في هذه الفاتورة (تم إرجاع كافة الكميات بالفعل).', 'warning');
        return;
      }
      setReturnInvoice(fullInvoice);
      const initialQtys = {};
      fullInvoice.items?.forEach(item => {
        initialQtys[item.id] = 0;
      });
      setReturnQuantities(initialQtys);
      setReturnReason('');
      setOpenReturnDrawer(true);
    } catch (err) {
      console.error(err);
      showToast('فشل تحميل تفاصيل الفاتورة لإنشاء المرتجع.', 'error');
    }
  };

  const handleOpenReturnDrawer = async (invoice) => {
    try {
      const fullInvoice = await apiClient.get(`/invoices/${invoice.id}`);
      setReturnInvoice(fullInvoice);
      // Initialize return quantities with 0 for all items
      const initialQtys = {};
      fullInvoice.items?.forEach(item => {
        initialQtys[item.id] = 0;
      });
      setReturnQuantities(initialQtys);
      setReturnReason('');
      setOpenReturnDrawer(true);
    } catch (err) {
      console.error(err);
      showToast('فشل تحميل تفاصيل الفاتورة لإنشاء المرتجع.', 'error');
    }
  };

  const handleReturnQtyChange = (itemId, val) => {
    const qty = parseInt(val, 10) || 0;
    setReturnQuantities(prev => ({
      ...prev,
      [itemId]: qty
    }));
  };

  const handleSubmitReturn = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (!returnInvoice) return;

    const itemsToReturn = [];
    let hasExceeded = false;
    let exceedsMessage = '';

    for (const item of returnInvoice.items) {
      const qty = returnQuantities[item.id] || 0;
      if (qty > 0) {
        if (qty > item.remaining_returnable_quantity) {
          hasExceeded = true;
          exceedsMessage = `الكمية المدخلة للكتاب "${item.product_title}" (${qty}) تتجاوز الكمية المتاحة للإرجاع وهي ${item.remaining_returnable_quantity}.`;
          break;
        }
        itemsToReturn.push({
          invoiceItemId: item.id,
          quantity: qty
        });
      }
    }

    if (hasExceeded) {
      showToast(exceedsMessage, 'error');
      return;
    }

    if (itemsToReturn.length === 0) {
      showToast('يرجى تحديد كمية إرجاع واحدة على الأقل أكبر من الصفر.', 'warning');
      return;
    }

    setReturnSubmitting(true);
    try {
      await apiClient.post('/returns', {
        invoiceId: returnInvoice.id,
        reason: returnReason,
        items: itemsToReturn
      });
      showToast('تم تسجيل مرتجع المبيعات بنجاح وتحديث المخزون والماليات.');
      setOpenReturnDrawer(false);
      fetchInvoices();
    } catch (err) {
      console.error(err);
      showToast(err.message || 'فشل تسجيل مرتجع المبيعات.', 'error');
    } finally {
      setReturnSubmitting(false);
    }
  };

  const handleMarkPaymentSupplied = (paymentId) => {
    setPaymentIdToSupply(paymentId);
    setSupplyConfirmOpen(true);
  };

  const executeMarkPaymentSupplied = async () => {
    if (!paymentIdToSupply) return;
    try {
      await apiClient.post(`/payments/${paymentIdToSupply}/supply`);
      showToast('تم تأكيد توريد الدفعة بنجاح.');
      
      // Refresh current details invoice to update the list of payments
      if (detailsInvoice) {
        const refreshed = await apiClient.get(`/invoices/${detailsInvoice.id}`);
        setDetailsInvoice(refreshed);
      }
      fetchInvoices();
    } catch (err) {
      console.error(err);
      showToast(err.message || 'فشل تأكيد توريد الدفعة.', 'error');
    } finally {
      setSupplyConfirmOpen(false);
      setPaymentIdToSupply(null);
    }
  };

  // Open Create Wizard Form Modal
  const handleOpenCreateModal = () => {
    setFormMode('create');
    setSelectedFormInvoice(null);
    setFormOutletId('');
    setFormOutletTypeLabel('');
    setFormDiscount(0);
    setFormShippingCost(0);
    setFormPaymentType('cash');
    setFormNotes('');
    setFormItems([]);
    setFormCollectionType('none');
    setFormCollectedAmount(0);
    setFormSupplyStatus('not_supplied');
    setFormCollectionNotes('');
    setFormReceiptName('');
    setFormReceiptData('');
    setFormInvoiceNumber('');
    apiClient.get('/system/next-code?type=invoice')
      .then(res => {
        if (res && res.code) {
          setFormInvoiceNumber(res.code);
        }
      })
      .catch(console.error);
    setOpenFormModal(true);
  };

  // Open Edit Wizard Form Modal
  const handleOpenEditModal = async (invoice) => {
    try {
      const data = await apiClient.get(`/invoices/${invoice.id}`);
      setFormMode('edit');
      setSelectedFormInvoice(data);
      setFormOutletId(data.outlet_id);
      
      const outlet = outlets.find(o => o.id === data.outlet_id);
      const outletType = outletTypes.find(t => t.id === outlet?.outlet_type_id);
      setFormOutletTypeLabel(outletType ? outletType.name : '');

      setFormDiscount(data.discount);
      setFormShippingCost(data.shipping_cost);
      setFormPaymentType(data.payment_type);
      setFormNotes(data.notes || '');
      setFormInvoiceNumber(data.invoice_number || '');

      // Load products items
      const loadedItems = data.items.map(item => {
        const prod = productsList.find(p => p.id === item.product_id);
        return {
          productId: item.product_id,
          productTitle: item.product_title,
          productCode: item.product_code,
          quantity: item.quantity,
          freeQuantity: item.free_quantity || 0,
          price: item.unit_price,
          stock: prod ? prod.stock : 9999, // default if not found
          stockPolicy: prod ? prod.stockPolicy : 'ignore',
          error: ''
        };
      });
      setFormItems(loadedItems);
      setOpenFormModal(true);
    } catch (err) {
      console.error(err);
      showToast('فشل تحميل بيانات الفاتورة للتعديل.', 'error');
    }
  };

  // Outlet selection change in Create form: resolves Outlet Type and clears products prices
  const handleFormOutletChange = (outletId) => {
    setFormOutletId(outletId);
    const outlet = outlets.find((o) => o.id === outletId);
    if (outlet) {
      const type = outletTypes.find((t) => t.id === outlet.outlet_type_id);
      setFormOutletTypeLabel(type ? type.name : '');
    } else {
      setFormOutletTypeLabel('');
    }

    // Clear resolved prices of existing items when outlet changes, so we re-resolve
    setFormItems([]);
  };

  // Add Item line in wizard
  const handleAddFormItem = () => {
    if (!formOutletId) {
      showToast('يرجى اختيار المنفذ أولاً لتحديد قائمة الأسعار.', 'warning');
      return;
    }
    setFormItems([
      ...formItems,
      {
        productId: '',
        productTitle: '',
        productCode: '',
        quantity: 1,
        freeQuantity: 0,
        price: 0,
        stock: 0,
        stockPolicy: 'ignore',
        error: ''
      }
    ]);
  };

  // Remove Item line
  const handleRemoveFormItem = (index) => {
    const updated = [...formItems];
    updated.splice(index, 1);
    setFormItems(updated);
  };

  // Product selection in item line: resolves price automatically
  const handleFormItemProductChange = async (index, productObj) => {
    const updated = [...formItems];
    if (!productObj) {
      updated[index] = {
        ...updated[index],
        productId: '',
        productTitle: '',
        productCode: '',
        price: 0,
        stock: 0,
        stockPolicy: 'ignore',
        error: ''
      };
      setFormItems(updated);
      return;
    }

    // Update row details
    updated[index].productId = productObj.id;
    updated[index].productTitle = productObj.title;
    updated[index].productCode = productObj.code;
    updated[index].stock = productObj.stock;
    updated[index].stockPolicy = productObj.stockPolicy;
    updated[index].error = '';

    // Resolve price dynamically
    try {
      const resolved = await apiClient.get(
        `/product-prices/resolve?productId=${productObj.id}&outletId=${formOutletId}`
      );
      if (resolved && resolved.price !== null) {
        updated[index].price = parseFloat(resolved.price);
        updated[index].error = '';
      } else {
        updated[index].price = 0;
        updated[index].error = 'لا يوجد سعر محدد للفئة';
      }
    } catch (err) {
      console.error(err);
      updated[index].price = 0;
      updated[index].error = 'خطأ في جلب السعر';
    }
    setFormItems(updated);
  };

  // Item quantity changed
  const handleFormItemQtyChange = (index, qty) => {
    const updated = [...formItems];
    const parsedQty = parseInt(qty, 10) || 0;
    updated[index].quantity = parsedQty;

    // Validate that freeQuantity does not exceed physical quantity
    if ((updated[index].freeQuantity || 0) > parsedQty) {
      updated[index].freeQuantity = parsedQty;
    }

    // Validate stock quantity if policy is track (disabled to allow negative inventory)
    /*
    if (updated[index].stockPolicy === 'track' && parsedQty > updated[index].stock) {
      updated[index].error = `الكمية المدخلة (${parsedQty}) تتجاوز المتوفر بالمخزن (${updated[index].stock})`;
    } else {
      // Clear stock error if it was the reason
      if (updated[index].error && updated[index].error.includes('المتوفر')) {
        updated[index].error = '';
      }
    }
    */
    if (updated[index].error && updated[index].error.includes('المتوفر')) {
      updated[index].error = '';
    }
    setFormItems(updated);
  };

  // Item free quantity changed
  const handleFormItemFreeQtyChange = (index, freeQtyVal) => {
    const updated = [...formItems];
    const parsedFreeQty = parseInt(freeQtyVal, 10) || 0;

    if (parsedFreeQty < 0) {
      updated[index].error = 'الكمية المجانية لا يمكن أن تكون سالبة';
    } else if (parsedFreeQty > updated[index].quantity) {
      updated[index].error = 'الكمية المجانية لا يمكن أن تتجاوز الكمية الإجمالية للمادة';
    } else {
      updated[index].freeQuantity = parsedFreeQty;
      // Clear free quantity error if it was the reason
      if (updated[index].error && (updated[index].error.includes('المجانية') || updated[index].error.includes('سالبة'))) {
        updated[index].error = '';
      }
    }
    setFormItems(updated);
  };

  // Calculate Subtotal and Total for form display
  const calculateFormTotals = () => {
    const subtotal = formItems.reduce((acc, curr) => {
      const billable = Math.max(0, curr.quantity - (curr.freeQuantity || 0));
      return acc + billable * curr.price;
    }, 0);
    const shipping = parseFloat(formShippingCost) || 0;
    const discount = parseFloat(formDiscount) || 0;
    const total = Math.max(0, subtotal + shipping - discount);
    return {
      subtotal: subtotal.toFixed(2),
      total: total.toFixed(2)
    };
  };

  // Form submit handler
  const handleFormSubmit = async (e) => {
    e.preventDefault();
    if (!formOutletId) {
      showToast('المنفذ مطلوب.', 'error');
      return;
    }
    if (formItems.length === 0) {
      showToast('يجب إضافة مادة واحدة على الأقل في الفاتورة.', 'error');
      return;
    }

    // Check for errors in rows
    const hasRowErrors = formItems.some((item) => item.error || !item.productId);
    if (hasRowErrors) {
      showToast('يرجى تصحيح أخطاء المواد المدرجة والتأكد من تحديد الكتب.', 'error');
      return;
    }

    const totals = calculateFormTotals();
    const subtotalVal = parseFloat(totals.subtotal) || 0;
    const finalTotal = parseFloat(totals.total) || 0;
    const discountVal = parseFloat(formDiscount) || 0;

    if (discountVal > subtotalVal) {
      showToast('قيمة الخصم المباشر لا يمكن أن تتجاوز المجموع الفرعي.', 'error');
      return;
    }

    let collectedVal = 0;
    if (formMode === 'create') {
      if (formCollectionType === 'full') {
        collectedVal = finalTotal;
      } else if (formCollectionType === 'partial') {
        collectedVal = parseFloat(formCollectedAmount) || 0;
        if (collectedVal <= 0) {
          showToast('يرجى إدخال مبلغ التحصيل للدفعة الجزئية.', 'error');
          return;
        }
        if (collectedVal > finalTotal) {
          showToast('المبلغ المحصل لا يمكن أن يتجاوز المجموع الإجمالي للفاتورة.', 'error');
          return;
        }
      }
    }

    setFormSubmitting(true);
    try {
      const payload = {
        invoiceNumber: formInvoiceNumber,
        outletId: parseInt(formOutletId, 10),
        discount: discountVal,
        shippingCost: parseFloat(formShippingCost) || 0,
        paymentType: formMode === 'create' ? (formCollectionType === 'full' ? 'cash' : 'deferred') : formPaymentType,
        notes: formNotes,
        items: formItems.map((item) => ({
          productId: item.productId,
          quantity: item.quantity,
          freeQuantity: parseInt(item.freeQuantity, 10) || 0
        }))
      };

      if (formMode === 'create') {
        payload.paymentAmount = collectedVal;
        payload.paymentSupplyStatus = formSupplyStatus;
        payload.paymentNotes = formCollectionNotes || 'تحصيل تلقائي عند إنشاء الفاتورة.';
        payload.paymentReceiptName = formReceiptName;
        payload.paymentReceiptData = formReceiptData;

        await apiClient.post('/invoices', payload);
        showToast('تم إنشاء الفاتورة وحسم الكميات وتسجيل التحصيل بنجاح.');
      } else {
        await apiClient.put(`/invoices/${selectedFormInvoice.id}`, payload);
        showToast('تم تحديث الفاتورة وتعديل حركة المخزون بنجاح.');
      }

      setOpenFormModal(false);
      fetchInvoices();
      // Reload balances to ensure UI is perfectly synced
      try {
        const balancesData = await apiClient.get('/finance/outlets');
        setOutletBalances(balancesData);
      } catch (err) {
        console.error('Error reloading balances:', err);
      }
    } catch (err) {
      console.error(err);
      showToast(err.message || 'فشل حفظ الفاتورة.', 'error');
    } finally {
      setFormSubmitting(false);
    }
  };

  // Format Helper Status mappings
  const getPaymentStatusChip = (status) => {
    switch (status) {
      case 'paid':
        return <Chip label="مسددة" color="success" size="small" />;
      case 'unpaid':
        return <Chip label="غير مسددة" color="error" size="small" />;
      case 'partially_paid':
        return <Chip label="مسددة جزئياً" color="warning" size="small" />;
      case 'overdue':
        return <Chip label="متأخرة" color="secondary" size="small" />;
      default:
        return <Chip label={status || 'غير معروف'} size="small" />;
    }
  };

  const getShippingStatusChip = (status) => {
    switch (status) {
      case 'pending':
        return <Chip label="قيد الانتظار" variant="outlined" color="warning" size="small" />;
      case 'shipped':
        return <Chip label="تم الشحن والتسليم" color="success" size="small" />;
      case 'partially_shipped':
        return <Chip label="شحن جزئي" variant="outlined" color="info" size="small" />;
      case 'delivered':
        return <Chip label="تم الشحن والتسليم" color="success" size="small" />;
      default:
        return <Chip label={status || 'غير معروف'} size="small" />;
    }
  };

  const translatePaymentType = (type) => {
    switch (type) {
      case 'cash':
        return 'نقدي';
      case 'deferred':
        return 'آجل';
      case 'installments':
        return 'أقساط';
      case 'mixed':
        return 'مختلط';
      default:
        return type;
    }
  };

  const getPaymentTypeDisplay = (row) => {
    if (row.payment_status === 'paid') {
      return <Chip label="دفع كلي" variant="outlined" color="success" size="small" sx={{ fontWeight: 500 }} />;
    }
    if (row.payment_status === 'partially_paid') {
      return <Chip label="دفع جزئي" variant="outlined" color="warning" size="small" sx={{ fontWeight: 500 }} />;
    }
    const label = translatePaymentType(row.payment_type);
    return <Chip label={label} variant="outlined" color="default" size="small" sx={{ fontWeight: 500 }} />;
  };

  const formTotals = calculateFormTotals();
  const selectedOutlet = outlets.find(o => o.id === formOutletId);
  const selectedOutletBalance = outletBalances.find(b => b.id === formOutletId);

  return (
    <Box sx={{ p: 1 }}>
      {/* Title & Top Action Bar */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5" sx={{ fontWeight: 'bold', color: 'primary.main' }}>
          إدارة فواتير المبيعات
        </Typography>

        <Box sx={{ display: 'flex', gap: 1.5 }}>
          {selectedInvoiceIds.length > 0 && hasPermission('invoices.update') && (
            <Button
              variant="outlined"
              color="warning"
              startIcon={<LocalShippingIcon />}
              onClick={() => setOpenBulkShippingModal(true)}
            >
              تحديث حالة الشحن ({selectedInvoiceIds.length})
            </Button>
          )}

          {selectedInvoiceIds.length > 0 && hasPermission('invoices.export') && (
            <>
              <Button
                variant="outlined"
                color="secondary"
                startIcon={<DownloadIcon />}
                onClick={handleBatchPdfExport}
              >
                تصدير المحددة ({selectedInvoiceIds.length}) PDF
              </Button>
              <Button
                variant="outlined"
                color="primary"
                startIcon={<PrintIcon />}
                onClick={handleBatchPdfPrint}
              >
                طباعة المحددة ({selectedInvoiceIds.length}) PDF
              </Button>
            </>
          )}

          {hasPermission('invoices.create') && (
            <Button
              variant="contained"
              color="primary"
              startIcon={<AddIcon />}
              onClick={handleOpenCreateModal}
            >
              إنشاء فاتورة جديدة
            </Button>
          )}
        </Box>
      </Box>

      {/* Expandable Search & Filter Panel */}
      <Card sx={{ mb: 3 }}>
        <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              cursor: 'pointer'
            }}
            onClick={() => setShowFilters(!showFilters)}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <FilterIcon color="action" />
              <Typography variant="subtitle1" sx={{ fontWeight: 'bold' }}>
                خيارات البحث المتقدم والتصفية
              </Typography>
            </Box>
            <IconButton size="small">
              {showFilters ? <ExpandLessIcon /> : <ExpandMoreIcon />}
            </IconButton>
          </Box>

          <Collapse in={showFilters} sx={{ mt: 2 }}>
            <Divider sx={{ my: 1.5 }} />
            <Grid container spacing={2} className="filter-grid">
              {/* Row 1: Search (3), Outlet (3), Outlet Type (2), Governorate (2), Payment Status (2) */}
              <Grid item xs={12} sm={6} md={3}>
                <TextField
                  fullWidth
                  label="رقم الفاتورة، المنفذ، الملاحظات"
                  size="small"
                  value={filterSearch}
                  onChange={(e) => setFilterSearch(e.target.value)}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <SearchIcon size="small" />
                      </InputAdornment>
                    )
                  }}
                />
              </Grid>

              <Grid item xs={12} sm={6} md={3}>
                <FormControl fullWidth size="small">
                  <InputLabel id="filter-outlet-select-label">المنفذ</InputLabel>
                  <Select
                    labelId="filter-outlet-select-label"
                    value={filterOutletId}
                    onChange={(e) => setFilterOutletId(e.target.value)}
                    label="المنفذ"
                  >
                    <MenuItem value="">الكل</MenuItem>
                    {outlets.map((o) => (
                      <MenuItem key={o.id} value={o.id}>
                        {o.name}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>

              <Grid item xs={12} sm={6} md={2}>
                <FormControl fullWidth size="small">
                  <InputLabel id="filter-outlet-type-select-label">فئة المنفذ</InputLabel>
                  <Select
                    labelId="filter-outlet-type-select-label"
                    value={filterOutletTypeId}
                    onChange={(e) => setFilterOutletTypeId(e.target.value)}
                    label="فئة المنفذ"
                  >
                    <MenuItem value="">الكل</MenuItem>
                    {outletTypes.map((ot) => (
                      <MenuItem key={ot.id} value={ot.id}>
                        {ot.name}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>

              <Grid item xs={12} sm={6} md={2}>
                <FormControl fullWidth size="small">
                  <InputLabel id="filter-governorate-select-label">المحافظة</InputLabel>
                  <Select
                    labelId="filter-governorate-select-label"
                    value={filterGovernorate}
                    onChange={(e) => setFilterGovernorate(e.target.value)}
                    label="المحافظة"
                  >
                    <MenuItem value="">الكل</MenuItem>
                    {EGYPT_GOVERNORATES.map((gov) => (
                      <MenuItem key={gov} value={gov}>
                        {gov}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>

              <Grid item xs={12} sm={6} md={2}>
                <FormControl fullWidth size="small">
                  <InputLabel id="filter-payment-status-select-label">حالة الدفع</InputLabel>
                  <Select
                    labelId="filter-payment-status-select-label"
                    value={filterPaymentStatus}
                    onChange={(e) => setFilterPaymentStatus(e.target.value)}
                    label="حالة الدفع"
                  >
                    <MenuItem value="">الكل</MenuItem>
                    <MenuItem value="paid">مسددة</MenuItem>
                    <MenuItem value="unpaid">غير مسددة</MenuItem>
                    <MenuItem value="partially_paid">مسددة جزئياً</MenuItem>
                    <MenuItem value="overdue">متأخرة</MenuItem>
                  </Select>
                </FormControl>
              </Grid>

              {/* Row 2: Has Remaining (2), Shipping Status (2), Min Remaining (2), Max Remaining (2), Start Date (2), End Date (2) */}
              <Grid item xs={12} sm={6} md={2}>
                <FormControl fullWidth size="small">
                  <InputLabel id="filter-remaining-select-label">حالة المتبقي</InputLabel>
                  <Select
                    labelId="filter-remaining-select-label"
                    value={filterHasRemaining}
                    onChange={(e) => setFilterHasRemaining(e.target.value)}
                    label="حالة المتبقي"
                  >
                    <MenuItem value="">الكل</MenuItem>
                    <MenuItem value="yes">يوجد متبقي ذمة مالية</MenuItem>
                    <MenuItem value="no">مسددة بالكامل</MenuItem>
                  </Select>
                </FormControl>
              </Grid>

              <Grid item xs={12} sm={6} md={2}>
                <FormControl fullWidth size="small">
                  <InputLabel id="filter-shipping-status-select-label">حالة الشحن</InputLabel>
                  <Select
                    labelId="filter-shipping-status-select-label"
                    value={filterShippingStatus}
                    onChange={(e) => setFilterShippingStatus(e.target.value)}
                    label="حالة الشحن"
                  >
                    <MenuItem value="">الكل</MenuItem>
                    <MenuItem value="pending">قيد الانتظار</MenuItem>
                    <MenuItem value="partially_shipped">شحن جزئي</MenuItem>
                    <MenuItem value="delivered">تم الشحن والتسليم</MenuItem>
                  </Select>
                </FormControl>
              </Grid>

              <Grid item xs={12} sm={6} md={2}>
                <TextField
                  fullWidth
                  label="أدنى متبقي"
                  size="small"
                  type="number"
                  value={filterMinRemaining}
                  onChange={(e) => setFilterMinRemaining(e.target.value)}
                />
              </Grid>

              <Grid item xs={12} sm={6} md={2}>
                <TextField
                  fullWidth
                  label="أقصى متبقي"
                  size="small"
                  type="number"
                  value={filterMaxRemaining}
                  onChange={(e) => setFilterMaxRemaining(e.target.value)}
                />
              </Grid>

              <Grid item xs={12} sm={6} md={2}>
                <TextField
                  fullWidth
                  label="من تاريخ"
                  size="small"
                  type="date"
                  InputLabelProps={{ shrink: true }}
                  InputProps={{ notched: true }}
                  value={filterStartDate}
                  onChange={(e) => setFilterStartDate(e.target.value)}
                />
              </Grid>

              <Grid item xs={12} sm={6} md={2}>
                <TextField
                  fullWidth
                  label="إلى تاريخ"
                  size="small"
                  type="date"
                  InputLabelProps={{ shrink: true }}
                  InputProps={{ notched: true }}
                  value={filterEndDate}
                  onChange={(e) => setFilterEndDate(e.target.value)}
                />
              </Grid>

              {/* Row 3: Book (6), Author (6) */}
              <Grid item xs={12} sm={6} md={6}>
                <Autocomplete
                  fullWidth
                  options={productsList}
                  getOptionLabel={(option) => `(${option.code}) ${option.title}`}
                  size="small"
                  onChange={(e, val) => setFilterProductId(val ? val.id : '')}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label="تصفية بحسب الكتاب"
                    />
                  )}
                />
              </Grid>

              <Grid item xs={12} sm={6} md={6}>
                <Autocomplete
                  fullWidth
                  options={authorsList}
                  getOptionLabel={(option) => option.name}
                  size="small"
                  onChange={(e, val) => setFilterAuthorId(val ? val.id : '')}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label="تصفية بحسب المؤلف"
                    />
                  )}
                />
              </Grid>
            </Grid>

            {/* Filter Action Buttons */}
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1.5, mt: 2.5 }}>
              <Button
                variant="outlined"
                color="inherit"
                startIcon={<ClearIcon />}
                onClick={handleResetFilters}
              >
                إلغاء التصفية
              </Button>
              <Button
                variant="contained"
                color="secondary"
                startIcon={<FilterIcon />}
                onClick={handleApplyFilters}
              >
                تطبيق الفلاتر
              </Button>
            </Box>
          </Collapse>
        </CardContent>
      </Card>

      {/* Main Table Card */}
      <Paper className="main-table-paper">
        {loading ? (
          <LoadingState message="جاري تحميل قائمة الفواتير وحساب المبالغ المتبقية..." />
        ) : invoices.length === 0 ? (
          <EmptyState
            title="لا يوجد فواتير"
            description="لم يتم العثور على فواتير تطابق معايير البحث والخيارات المحددة."
          />
        ) : (
          <TableContainer className="scrollable-table-container" sx={{ maxHeight: 600 }}>
            <Table stickyHeader size="small">
              <TableHead>
                <TableRow>
                  <TableCell padding="checkbox">
                    <Checkbox
                      indeterminate={
                        selectedInvoiceIds.length > 0 &&
                        selectedInvoiceIds.length < invoices.length
                      }
                      checked={
                        invoices.length > 0 && selectedInvoiceIds.length === invoices.length
                      }
                      onChange={handleSelectAll}
                    />
                  </TableCell>
                  <TableCell sx={{ fontWeight: 'bold' }}>رقم الفاتورة</TableCell>
                  <TableCell sx={{ fontWeight: 'bold' }}>التاريخ</TableCell>
                  <TableCell sx={{ fontWeight: 'bold' }}>المنفذ</TableCell>
                  <TableCell sx={{ fontWeight: 'bold' }}>نوع الدفع</TableCell>
                  <TableCell sx={{ fontWeight: 'bold' }}>حالة الدفع</TableCell>
                  <TableCell sx={{ fontWeight: 'bold' }}>حالة الشحن</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 'bold' }}>
                    المجموع
                  </TableCell>
                  <TableCell align="right" sx={{ fontWeight: 'bold' }}>
                    المسدد / المتبقي
                  </TableCell>
                  <TableCell align="center" sx={{ fontWeight: 'bold', minWidth: 150 }}>
                    خيارات
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {invoices.map((row) => {
                  const isSelected = selectedInvoiceIds.includes(row.id);
                  return (
                    <TableRow key={row.id} hover selected={isSelected}>
                      <TableCell padding="checkbox">
                        <Checkbox
                          checked={isSelected}
                          onChange={() => handleSelectInvoice(row.id)}
                        />
                      </TableCell>
                      <TableCell sx={{ fontFamily: 'monospace', fontWeight: 600 }}>
                        {row.invoice_number}
                      </TableCell>
                      <TableCell>
                        {formatEgyptDate(row.created_at)}
                      </TableCell>
                      <TableCell>{row.outlet_name}</TableCell>
                      <TableCell>{getPaymentTypeDisplay(row)}</TableCell>
                      <TableCell>{getPaymentStatusChip(row.payment_status)}</TableCell>
                      <TableCell>{getShippingStatusChip(row.shipping_status)}</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 'bold', color: 'primary.dark' }}>
                        {formatCurrencyEGP(row.total_price)}
                      </TableCell>
                      <TableCell align="right">
                        <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                          <Typography variant="body2" sx={{ color: 'success.main', fontWeight: 500 }}>
                            {formatCurrencyEGP(row.paid_amount || 0)}
                          </Typography>
                          <Typography variant="caption" sx={{ color: 'error.main', fontWeight: 500 }}>
                            {formatCurrencyEGP(row.remaining_amount || 0)} متبقي
                          </Typography>
                        </Box>
                      </TableCell>
                      <TableCell align="center">
                        <IconButton
                          color="primary"
                          title="عرض التفاصيل الكاملة"
                          onClick={() => handleOpenDetails(row)}
                        >
                          <VisibilityIcon size="small" />
                        </IconButton>

                        {row.payment_status !== 'cancelled' && row.remaining_amount > 0 && (
                          <IconButton
                            color="success"
                            title="تسجيل دفع (Pay)"
                            onClick={() => handlePayHandoff(row)}
                          >
                            <PaymentsIcon size="small" />
                          </IconButton>
                        )}

                        {row.payment_status !== 'cancelled' && row.remaining_amount > 0 && (
                          <IconButton
                            color="success"
                            title="تعليم كمدفوعة كلياً"
                            onClick={() => handleMarkPaidHandoff(row)}
                          >
                            <CheckCircleIcon size="small" />
                          </IconButton>
                        )}

                        {row.payment_status !== 'cancelled' && (
                          <IconButton
                            color="warning"
                            title="تحديث حالة الشحن"
                            onClick={() => handleShipHandoff(row)}
                          >
                            <LocalShippingIcon size="small" />
                          </IconButton>
                        )}

                        {row.payment_status !== 'cancelled' && (
                          <IconButton
                            color="secondary"
                            title="إنشاء مرتجع (Return)"
                            onClick={() => handleReturnClick(row)}
                          >
                            <SettingsBackupRestoreIcon size="small" />
                          </IconButton>
                        )}

                        {hasPermission('invoices.update') && (
                          <IconButton
                            color="info"
                            title="تعديل الفاتورة"
                            onClick={() => handleOpenEditModal(row)}
                          >
                            <EditIcon size="small" />
                          </IconButton>
                        )}

                        {hasPermission('invoices.export') && (
                          <IconButton
                            color="inherit"
                            title="تحميل فاتورة PDF"
                            onClick={() => handleSinglePdfExport(row.id)}
                          >
                            <DownloadIcon size="small" />
                          </IconButton>
                        )}

                        {hasPermission('invoices.view') && (
                          <IconButton
                            color="primary"
                            title="طباعة الفاتورة"
                            onClick={() => handleFetchAndPrintInvoice(row.id)}
                          >
                            <PrintIcon size="small" />
                          </IconButton>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        )}

        {/* Custom Table Pagination */}
        <Box
          sx={{
            p: 2,
            display: 'flex',
            flexDirection: { xs: 'column', sm: 'row' },
            gap: { xs: 2, sm: 0 },
            justifyContent: 'space-between',
            alignItems: 'center',
            borderTop: '1px solid rgba(224, 224, 224, 1)'
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="body2" color="textSecondary">
              عدد الفواتير المعروضة بالصفحة:
            </Typography>
            <Select
              size="small"
              value={limit}
              onChange={(e) => {
                setLimit(e.target.value);
                setOffset(0);
              }}
              sx={{ minWidth: 70 }}
            >
              <MenuItem value={10}>10</MenuItem>
              <MenuItem value={25}>25</MenuItem>
              <MenuItem value={50}>50</MenuItem>
              <MenuItem value={100}>100</MenuItem>
            </Select>
          </Box>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Button size="small" disabled={offset === 0} onClick={handlePrevPage}>
              السابق
            </Button>
            <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
              السجلات ({offset + 1} - {offset + invoices.length})
            </Typography>
            <Button size="small" disabled={invoices.length < limit} onClick={handleNextPage}>
              التالي
            </Button>
          </Box>
        </Box>
      </Paper>

      {/* --- modal details view --- */}
      <EntityDrawer
        open={openDetailsModal}
        onClose={() => setOpenDetailsModal(false)}
        title={
          detailsInvoice ? (() => {
            const currentIndex = invoices.findIndex(inv => inv.id === detailsInvoice.id);
            const hasPrevInvoice = currentIndex > 0;
            const hasNextInvoice = currentIndex !== -1 && currentIndex < invoices.length - 1;
            return (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, width: '100%' }}>
                <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
                  عرض تفاصيل الفاتورة: {detailsInvoice.invoice_number}
                </Typography>
                {invoices.length > 1 && currentIndex !== -1 && (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mr: 'auto', ml: 2 }}>
                    <IconButton 
                      size="small" 
                      disabled={!hasPrevInvoice} 
                      onClick={() => handleNavigateInvoice('prev')}
                      title="الفاتورة السابقة"
                    >
                      <ChevronRightIcon />
                    </IconButton>
                    <Typography variant="body2" sx={{ minWidth: 50, textAlign: 'center', fontWeight: 'medium', color: 'text.secondary' }}>
                      {currentIndex + 1} / {invoices.length}
                    </Typography>
                    <IconButton 
                      size="small" 
                      disabled={!hasNextInvoice} 
                      onClick={() => handleNavigateInvoice('next')}
                      title="الفاتورة التالية"
                    >
                      <ChevronLeftIcon />
                    </IconButton>
                  </Box>
                )}
              </Box>
            );
          })() : ''
        }
        size="full"
        actions={
          detailsInvoice && (
            <>
              {detailsInvoice.payment_status !== 'cancelled' && detailsInvoice.remaining_amount > 0 && (
                <Button
                  variant="contained"
                  color="success"
                  startIcon={<PaymentsIcon />}
                  onClick={() => {
                    setOpenDetailsModal(false);
                    handlePayHandoff(detailsInvoice);
                  }}
                >
                  تسجيل دفع
                </Button>
              )}

              {detailsInvoice.payment_status !== 'cancelled' && detailsInvoice.remaining_amount > 0 && (
                <Button
                  variant="contained"
                  color="success"
                  startIcon={<CheckCircleIcon />}
                  onClick={() => {
                    setOpenDetailsModal(false);
                    handleMarkPaidHandoff(detailsInvoice);
                  }}
                >
                  إغلاق كمدفوع كلياً
                </Button>
              )}

              {detailsInvoice.payment_status !== 'cancelled' && (
                <Button
                  variant="contained"
                  color="warning"
                  startIcon={<LocalShippingIcon />}
                  onClick={() => {
                    setOpenDetailsModal(false);
                    handleShipHandoff(detailsInvoice);
                  }}
                >
                  تحديث حالة الشحن
                </Button>
              )}

              {detailsInvoice.payment_status !== 'cancelled' && (
                <Button
                  variant="contained"
                  color="secondary"
                  startIcon={<SettingsBackupRestoreIcon />}
                  onClick={() => {
                    setOpenDetailsModal(false);
                    handleReturnClick(detailsInvoice);
                  }}
                >
                  إنشاء مرتجع (Return)
                </Button>
              )}

              {hasPermission('invoices.export') && (
                <>
                  <Button
                    variant="outlined"
                    color="secondary"
                    startIcon={<DownloadIcon />}
                    onClick={() => handleSinglePdfExport(detailsInvoice.id)}
                  >
                    تنزيل PDF
                  </Button>
                  <Button
                    variant="outlined"
                    color="info"
                    startIcon={<PrintIcon />}
                    onClick={() => handleSinglePdfPrint(detailsInvoice.id)}
                  >
                    معاينة وطباعة PDF
                  </Button>
                </>
              )}

              {hasPermission('invoices.view') && (
                <Button
                  variant="outlined"
                  color="primary"
                  startIcon={<PrintIcon />}
                  onClick={() => handlePrintInvoice(detailsInvoice)}
                >
                  طباعة الفاتورة
                </Button>
              )}

              <Button onClick={() => setOpenDetailsModal(false)} variant="contained" color="inherit">
                إغلاق
              </Button>
            </>
          )
        }
      >
        {detailsInvoice && (
          <Box sx={{ flexGrow: 1, pr: 1, pl: 1 }}>
              {/* Responsive summary KPI cards */}
              <Grid container spacing={2} sx={{ mb: 3 }}>
                <Grid item xs={12} sm={6} md={2.4}>
                  <Card variant="outlined" sx={kpiCardStyle}>
                    <Typography variant="caption" color="textSecondary" sx={{ fontWeight: 500 }}>العميل / المنفذ</Typography>
                    <Typography variant="subtitle1" sx={{ fontWeight: 'bold', mt: 0.5 }}>{detailsInvoice.outlet_name}</Typography>
                    <Typography variant="caption" color="textSecondary" sx={{ mt: 0.5 }}>
                      المحافظة: {detailsInvoice.governorate || '-'}
                    </Typography>
                  </Card>
                </Grid>
                <Grid item xs={12} sm={6} md={2.4}>
                  <Card variant="outlined" sx={getRemainingCardStyle(detailsInvoice.remaining_amount)}>
                    <Typography variant="caption" color="textSecondary" sx={{ fontWeight: 500 }}>المبلغ المتبقي (ذمة)</Typography>
                    <Typography variant="subtitle1" sx={{ fontWeight: 'bold', color: detailsInvoice.remaining_amount > 0 ? 'error.main' : 'success.main', mt: 0.5 }}>
                      {formatCurrencyEGP(detailsInvoice.remaining_amount)}
                    </Typography>
                    <Typography variant="caption" color="textSecondary" sx={{ mt: 0.5 }}>
                      المدفوع: {formatCurrencyEGP(detailsInvoice.paid_amount)}
                    </Typography>
                  </Card>
                </Grid>
                <Grid item xs={12} sm={6} md={2.4}>
                  <Card variant="outlined" sx={kpiCardStyle}>
                    <Typography variant="caption" color="textSecondary" sx={{ fontWeight: 500 }}>الشحن والتوزيع</Typography>
                    <Box sx={{ mt: 0.5 }}>
                      {getShippingStatusChip(detailsInvoice.shipping_status)}
                    </Box>
                    <Typography variant="caption" color="textSecondary" sx={{ mt: 1 }}>
                      طريقة الدفع: {
                        detailsInvoice.payment_status === 'paid' ? 'دفع كلي' :
                        detailsInvoice.payment_status === 'partially_paid' ? 'دفع جزئي' :
                        translatePaymentType(detailsInvoice.payment_type)
                      }
                    </Typography>
                  </Card>
                </Grid>
                <Grid item xs={12} sm={6} md={2.4}>
                  <Card variant="outlined" sx={kpiCardStyle}>
                    <Typography variant="caption" color="textSecondary" sx={{ fontWeight: 500 }}>القيمة الإجمالية للفاتورة</Typography>
                    <Typography variant="subtitle1" sx={{ fontWeight: 'bold', color: 'primary.main', mt: 0.5 }}>
                      {formatCurrencyEGP(detailsInvoice.total_price)}
                    </Typography>
                    <Typography variant="caption" color="textSecondary" sx={{ mt: 0.5 }}>
                      تاريخ الفاتورة: {formatEgyptDateTime(detailsInvoice.created_at)}
                    </Typography>
                  </Card>
                </Grid>
                <Grid item xs={12} sm={6} md={2.4}>
                  <Card variant="outlined" sx={{ ...kpiCardStyle, alignItems: 'center', p: 1, height: '100%' }}>
                    <Typography variant="caption" color="textSecondary" sx={{ fontWeight: 500, mb: 0.5 }}>{t('system.qrCode')}</Typography>
                    <img 
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=${encodeURIComponent(window.location.origin + '/invoices?search=' + detailsInvoice.invoice_number)}`} 
                      alt="Invoice QR Code"
                      className="invoice-qr-code"
                    />
                    <Typography variant="caption" color="textSecondary" sx={{ mt: 0.5, fontSize: '0.65rem' }}>{t('system.scanToViewInvoice')}</Typography>
                  </Card>
                </Grid>
              </Grid>

              {/* Additional notes/conditions section */}
              {detailsInvoice.notes && (
                <Alert severity="info" variant="outlined" icon={false} sx={{ mb: 3 }}>
                  <Typography variant="caption" color="textSecondary" display="block">ملاحظات وشروط إضافية:</Typography>
                  <Typography variant="body2">{detailsInvoice.notes}</Typography>
                </Alert>
              )}

              {/* Items Table */}
              <Box sx={{ mb: 4 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mb: 1.5 }}>أصناف ومواد الفاتورة:</Typography>
                <TableContainer className="scrollable-table-container" component={Paper} variant="outlined">
                  <Table size="small">
                    <TableHead sx={{ backgroundColor: (theme) => theme.palette.mode === 'dark' ? '#2d2f31' : '#f8fafc' }}>
                      <TableRow>
                        <TableCell sx={{ fontWeight: 'bold' }}>اسم الكتاب</TableCell>
                        <TableCell align="center" sx={{ fontWeight: 'bold' }}>الإجمالي المطلوب</TableCell>
                        <TableCell align="center" sx={{ fontWeight: 'bold' }}>المدفوع</TableCell>
                        <TableCell align="center" sx={{ fontWeight: 'bold' }}>المجاني</TableCell>
                        <TableCell align="center" sx={{ fontWeight: 'bold' }}>المشحون</TableCell>
                        <TableCell align="center" sx={{ fontWeight: 'bold' }}>المرتجع</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 'bold' }}>سعر الوحدة</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 'bold' }}>الإجمالي</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {detailsInvoice.items?.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell>{item.product_title}</TableCell>
                          <TableCell align="center" sx={{ fontWeight: 'bold' }}>{item.quantity}</TableCell>
                          <TableCell align="center">{item.quantity - (item.free_quantity || 0)}</TableCell>
                          <TableCell align="center" sx={{ color: item.free_quantity > 0 ? 'success.main' : 'text.secondary', fontWeight: item.free_quantity > 0 ? 'bold' : 'normal' }}>
                            {item.free_quantity || 0}
                          </TableCell>
                          <TableCell align="center">
                            <Chip
                              label={item.shipped_quantity || 0}
                              size="small"
                              color={item.shipped_quantity >= item.quantity ? 'success' : item.shipped_quantity > 0 ? 'warning' : 'default'}
                            />
                          </TableCell>
                          <TableCell align="center" sx={{ color: item.returned_quantity > 0 ? 'error.main' : 'text.secondary' }}>
                            {item.returned_quantity || 0}
                          </TableCell>
                          <TableCell align="right">{formatCurrencyEGP(item.unit_price)}</TableCell>
                          <TableCell align="right" sx={{ fontWeight: 'bold' }}>{formatCurrencyEGP(item.total_price)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Box>

              {/* Totals Section */}
              <Box sx={{ width: '100%', mb: 4, border: '1px solid', borderColor: 'divider', borderRadius: '8px', p: 2.5, backgroundColor: (theme) => theme.palette.mode === 'dark' ? '#1e1e1e' : '#f8fafc' }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                  <Typography variant="body2" color="text.secondary">المجموع الفرعي:</Typography>
                  <Typography variant="body2" sx={{ fontWeight: 'bold' }}>{formatCurrencyEGP(detailsInvoice.subtotal || 0)}</Typography>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                  <Typography variant="body2" color="text.secondary">تكلفة الشحن:</Typography>
                  <Typography variant="body2" sx={{ fontWeight: 'bold', color: 'primary.main' }}>+{formatCurrencyEGP(detailsInvoice.shipping_cost || 0)}</Typography>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                  <Typography variant="body2" color="text.secondary">الخصم الممنوح:</Typography>
                  <Typography variant="body2" sx={{ color: 'error.main', fontWeight: 'bold' }}>
                    -{formatCurrencyEGP(detailsInvoice.discount || 0)}
                  </Typography>
                </Box>
                <Divider sx={{ my: 1.5 }} />
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                  <Typography variant="subtitle1" sx={{ fontWeight: 'bold' }}>المجموع النهائي:</Typography>
                  <Typography variant="subtitle1" sx={{ fontWeight: 'bold', color: 'primary.main' }}>
                    {formatCurrencyEGP(detailsInvoice.total_price)}
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1, color: 'success.main' }}>
                  <Typography variant="body2" sx={{ fontWeight: 'bold' }}>المجموع المسدد:</Typography>
                  <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                    {formatCurrencyEGP(detailsInvoice.paid_amount || 0)}
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1, color: 'error.main' }}>
                  <Typography variant="body2" sx={{ fontWeight: 'bold' }}>المبلغ المتبقي:</Typography>
                  <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                    {formatCurrencyEGP(detailsInvoice.remaining_amount || 0)}
                  </Typography>
                </Box>
              </Box>

              <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
                <Tabs value={detailsTabValue} onChange={(e, val) => setDetailsTabValue(val)}>
                  <Tab label="سجل التحصيلات والمدفوعات" icon={<PaymentsIcon />} iconPosition="start" />
                  <Tab label="شحنات التوصيل" icon={<LocalShippingIcon />} iconPosition="start" />
                  <Tab label="مرتجع المبيعات" icon={<SettingsBackupRestoreIcon />} iconPosition="start" />
                  <Tab label="سجل حالات الفاتورة" icon={<EventNoteIcon />} iconPosition="start" />
                </Tabs>
              </Box>

              {/* TAB 0: Payments */}
              {detailsTabValue === 0 && (
                <Box>
                  {detailsInvoice.payments && detailsInvoice.payments.length > 0 ? (
                    <TableContainer className="scrollable-table-container" component={Paper}>
                      <Table size="small">
                        <TableHead sx={{ backgroundColor: '#f8fafc' }}>
                          <TableRow>
                            <TableCell sx={{ fontWeight: 'bold' }}>رقم العملية</TableCell>
                            <TableCell sx={{ fontWeight: 'bold' }}>تاريخ السداد</TableCell>
                            <TableCell sx={{ fontWeight: 'bold' }}>طريقة السداد</TableCell>
                            <TableCell align="right" sx={{ fontWeight: 'bold' }}>القيمة</TableCell>
                            <TableCell sx={{ fontWeight: 'bold' }}>حالة التوريد</TableCell>
                            <TableCell sx={{ fontWeight: 'bold' }}>سجلت بواسطة</TableCell>
                            <TableCell sx={{ fontWeight: 'bold' }}>ملاحظات</TableCell>
                            <TableCell align="center" sx={{ fontWeight: 'bold' }}>إجراءات</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {detailsInvoice.payments.map((p) => (
                            <TableRow key={p.id}>
                              <TableCell sx={{ fontFamily: 'monospace' }}>{p.receipt_number || p.id}</TableCell>
                              <TableCell>{formatEgyptDate(p.payment_date)}</TableCell>
                              <TableCell>{translatePaymentType(p.payment_type)}</TableCell>
                              <TableCell align="right" sx={{ fontWeight: 'bold', color: 'success.main' }}>
                                {formatCurrencyEGP(p.amount)}
                              </TableCell>
                              <TableCell>
                                {p.supply_status === 'supplied' ? (
                                  <Chip label="مورد" color="success" size="small" variant="outlined" />
                                ) : (
                                  <Chip label="غير مورد" color="warning" size="small" variant="outlined" />
                                )}
                              </TableCell>
                              <TableCell>{p.user_full_name || 'غير معروف'}</TableCell>
                              <TableCell>{p.notes}</TableCell>
                              <TableCell align="center">
                                {p.supply_status === 'not_supplied' && hasPermission('payments.mark_supplied') && (
                                  <Button
                                    variant="contained"
                                    color="success"
                                    size="small"
                                    onClick={() => handleMarkPaymentSupplied(p.id)}
                                  >
                                    تأكيد التوريد
                                  </Button>
                                )}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  ) : (
                    <Typography variant="body2" sx={{ color: 'text.secondary', p: 2, textAlign: 'center' }}>
                      لا يوجد دفعات مسددة مسجلة لهذه الفاتورة حتى الآن.
                    </Typography>
                  )}
                </Box>
              )}

              {/* TAB 1: Shipments */}
              {detailsTabValue === 1 && (
                <Box>
                  {detailsInvoice.shipments && detailsInvoice.shipments.length > 0 ? (
                    <TableContainer className="scrollable-table-container" component={Paper}>
                      <Table size="small">
                        <TableHead sx={{ backgroundColor: '#f8fafc' }}>
                          <TableRow>
                            <TableCell sx={{ fontWeight: 'bold' }}>رقم الشحنة</TableCell>
                            <TableCell sx={{ fontWeight: 'bold' }}>تاريخ الشحن</TableCell>
                            <TableCell sx={{ fontWeight: 'bold' }}>شركة الشحن</TableCell>
                            <TableCell sx={{ fontWeight: 'bold' }}>رقم التتبع</TableCell>
                            <TableCell sx={{ fontWeight: 'bold' }}>الحالة</TableCell>
                            <TableCell sx={{ fontWeight: 'bold' }}>بواسطة</TableCell>
                            <TableCell sx={{ fontWeight: 'bold' }}>الأصناف المشحونة</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {detailsInvoice.shipments.map((s) => (
                            <TableRow key={s.id}>
                              <TableCell sx={{ fontFamily: 'monospace' }}>{s.shipment_number}</TableCell>
                              <TableCell>{formatEgyptDateTime(s.created_at)}</TableCell>
                              <TableCell>{s.shipping_carrier || 'غير محدد'}</TableCell>
                              <TableCell sx={{ fontFamily: 'monospace' }}>{s.tracking_number || '-'}</TableCell>
                              <TableCell>
                                {getShippingStatusChip(s.status)}
                              </TableCell>
                              <TableCell>{s.user_full_name || 'غير معروف'}</TableCell>
                              <TableCell>
                                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                                  {s.items?.map((item) => (
                                    <Typography key={item.id} variant="caption" display="block">
                                      - {item.product_title}: <strong>{item.quantity}</strong>
                                    </Typography>
                                  ))}
                                </Box>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  ) : (
                    <Typography variant="body2" sx={{ color: 'text.secondary', p: 2, textAlign: 'center' }}>
                      لا يوجد شحنات مسجلة لهذه الفاتورة حتى الآن.
                    </Typography>
                  )}
                </Box>
              )}

              {/* TAB 2: Returns */}
              {detailsTabValue === 2 && (
                <Box>
                  {detailsInvoice.returns && detailsInvoice.returns.length > 0 ? (
                    <TableContainer className="scrollable-table-container" component={Paper}>
                      <Table size="small">
                        <TableHead sx={{ backgroundColor: '#f8fafc' }}>
                          <TableRow>
                            <TableCell sx={{ fontWeight: 'bold' }}>رقم المرتجع</TableCell>
                            <TableCell sx={{ fontWeight: 'bold' }}>تاريخ المرتجع</TableCell>
                            <TableCell sx={{ fontWeight: 'bold' }}>قيمة المرتجع</TableCell>
                            <TableCell sx={{ fontWeight: 'bold' }}>السبب / الملاحظة</TableCell>
                            <TableCell sx={{ fontWeight: 'bold' }}>الحالة</TableCell>
                            <TableCell sx={{ fontWeight: 'bold' }}>بواسطة</TableCell>
                            <TableCell sx={{ fontWeight: 'bold' }}>الأصناف المرتجعة</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {detailsInvoice.returns.map((r) => (
                            <TableRow key={r.id}>
                              <TableCell sx={{ fontFamily: 'monospace' }}>{r.return_number}</TableCell>
                              <TableCell>{formatEgyptDateTime(r.created_at)}</TableCell>
                              <TableCell sx={{ fontWeight: 'bold', color: 'error.main' }}>
                                {formatCurrencyEGP(r.return_value || 0)}
                              </TableCell>
                              <TableCell>{r.reason || '-'}</TableCell>
                              <TableCell>
                                <Chip
                                  label={r.status === 'completed' ? 'مكتمل' : r.status === 'cancelled' ? 'ملغي' : r.status}
                                  color={r.status === 'completed' ? 'success' : r.status === 'cancelled' ? 'error' : 'default'}
                                  size="small"
                                  variant="outlined"
                                />
                              </TableCell>
                              <TableCell>{r.user_full_name || 'غير معروف'}</TableCell>
                              <TableCell>
                                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                                  {r.items?.map((item) => (
                                    <Typography key={item.id} variant="caption" display="block">
                                      - {item.product_title}: <strong>{item.quantity}</strong>
                                    </Typography>
                                  ))}
                                </Box>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  ) : (
                    <Typography variant="body2" sx={{ color: 'text.secondary', p: 2, textAlign: 'center' }}>
                      لا يوجد مرتجعات مسجلة لهذه الفاتورة حتى الآن.
                    </Typography>
                  )}
                </Box>
              )}

              {/* TAB 3: Status History */}
              {detailsTabValue === 3 && (
                <Box>
                  <TableContainer className="scrollable-table-container" component={Paper}>
                    <Table size="small">
                      <TableHead sx={{ backgroundColor: '#f8fafc' }}>
                        <TableRow>
                          <TableCell sx={{ fontWeight: 'bold' }}>تاريخ الحركة</TableCell>
                          <TableCell sx={{ fontWeight: 'bold' }}>النوع</TableCell>
                          <TableCell sx={{ fontWeight: 'bold' }}>الحالة السابقة</TableCell>
                          <TableCell sx={{ fontWeight: 'bold' }}>الحالة الجديدة</TableCell>
                          <TableCell sx={{ fontWeight: 'bold' }}>بواسطة</TableCell>
                          <TableCell sx={{ fontWeight: 'bold' }}>السبب / الملاحظة</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {detailsInvoice.history.map((h) => (
                          <TableRow key={h.id}>
                            <TableCell>{formatEgyptDateTime(h.created_at)}</TableCell>
                            <TableCell>
                              {h.status_type === 'payment' ? 'دفع مالية' : 'توصيل شحن'}
                            </TableCell>
                            <TableCell>{h.status_type === 'payment' ? getPaymentStatusChip(h.old_status) : getShippingStatusChip(h.old_status)}</TableCell>
                            <TableCell>{h.status_type === 'payment' ? getPaymentStatusChip(h.new_status) : getShippingStatusChip(h.new_status)}</TableCell>
                            <TableCell>{h.user_full_name || 'غير معروف'}</TableCell>
                            <TableCell>{h.notes}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </Box>
              )}
          </Box>
        )}
      </EntityDrawer>

      {/* --- wizard creation / edit invoice modal --- */}
      {/* --- wizard creation / edit invoice Drawer --- */}
      <EntityDrawer
        open={openFormModal}
        onClose={() => !formSubmitting && setOpenFormModal(false)}
        title={formMode === 'create' ? 'إنشاء فاتورة مبيعات جديدة' : 'تعديل فاتورة مبيعات'}
        size="large"
        loading={formSubmitting}
        actions={
          <>
            <Button onClick={() => setOpenFormModal(false)} variant="outlined" color="inherit" disabled={formSubmitting}>
              إلغاء
            </Button>
            <Button
              variant="contained"
              color="primary"
              type="submit"
              form="invoice-editor-form"
              disabled={formSubmitting}
            >
              {formSubmitting ? 'جاري الحفظ والتحقق من الكميات...' : 'حفظ وتأكيد الفاتورة'}
            </Button>
          </>
        }
      >
        <form onSubmit={handleFormSubmit} id="invoice-editor-form">
          <FormSection title="بيانات العميل والفاتورة">
            <FieldGrid columns={2}>
              <TextField
                required
                fullWidth
                size="small"
                label={t('system.invoiceNumber')}
                value={formInvoiceNumber}
                inputProps={{ className: 'ltr-value', readOnly: true }}
                disabled={true}
              />

              {/* Outlet select */}
              <FormControl fullWidth size="small" required>
                <InputLabel id="form-outlet-select-label">المنفذ / العميل</InputLabel>
                <Select
                  labelId="form-outlet-select-label"
                  value={formOutletId}
                  onChange={(e) => handleFormOutletChange(e.target.value)}
                  label="المنفذ / العميل"
                  disabled={formMode === 'edit'} // Lock outlet on edit
                >
                  {outlets.map((o) => (
                    <MenuItem key={o.id} value={o.id}>
                      {o.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              {/* Payment Status (Only on creation) */}
              {formMode === 'create' ? (
                <FormControl fullWidth size="small" required>
                  <InputLabel id="form-collection-select-label">حالة الدفع عند الإنشاء</InputLabel>
                  <Select
                    labelId="form-collection-select-label"
                    value={formCollectionType}
                    onChange={(e) => {
                      const val = e.target.value;
                      setFormCollectionType(val);
                      if (val === 'none') {
                        setFormCollectedAmount(0);
                      } else if (val === 'full') {
                        setFormCollectedAmount(parseFloat(formTotals.total) || 0);
                      }
                    }}
                    label="حالة الدفع عند الإنشاء"
                  >
                    <MenuItem value="none">مؤجل كلياً (Fully Deferred)</MenuItem>
                    <MenuItem value="partial">مدفوع جزئياً (Partially Paid)</MenuItem>
                    <MenuItem value="full">مدفوع كلياً (Fully Paid)</MenuItem>
                  </Select>
                </FormControl>
              ) : (
                <TextField
                  fullWidth
                  label="نوع الدفع"
                  size="small"
                  disabled
                  value={translatePaymentType(formPaymentType)}
                />
              )}

              {/* Discount */}
              <TextField
                fullWidth
                label="الخصم المباشر الممنوح"
                size="small"
                type="number"
                inputProps={{ step: '0.01', min: '0' }}
                value={formDiscount}
                onChange={(e) => setFormDiscount(Math.max(0, parseFloat(e.target.value) || 0))}
                InputProps={{
                  endAdornment: <InputAdornment position="end">ج.م</InputAdornment>
                }}
              />

              {/* Shipping Cost */}
              <TextField
                fullWidth
                label="تكلفة وأجور الشحن والتوصيل"
                size="small"
                type="number"
                inputProps={{ step: '0.01', min: '0' }}
                value={formShippingCost}
                onChange={(e) => setFormShippingCost(Math.max(0, parseFloat(e.target.value) || 0))}
                InputProps={{
                  endAdornment: <InputAdornment position="end">ج.م</InputAdornment>
                }}
              />
            </FieldGrid>

            {/* Notes */}
            <Box sx={{ mt: 2 }}>
              <TextField
                fullWidth
                label="ملاحظات وتفاصيل الفاتورة"
                size="small"
                multiline
                rows={2}
                value={formNotes}
                onChange={(e) => setFormNotes(e.target.value)}
              />
            </Box>

            {selectedOutlet && (
              <Paper variant="outlined" sx={{ p: 2, mt: 2, backgroundColor: (theme) => theme.palette.mode === 'dark' ? '#1e1e1e' : '#f8fafc', borderColor: (theme) => theme.palette.mode === 'dark' ? 'primary.dark' : 'primary.light' }}>
                <Grid container spacing={2}>
                  <Grid item xs={6} sm={3}>
                    <Typography variant="caption" color="textSecondary" display="block">فئة المنفذ</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 'bold' }}>{formOutletTypeLabel || 'غير محددة'}</Typography>
                  </Grid>
                  <Grid item xs={6} sm={3}>
                    <Typography variant="caption" color="textSecondary" display="block">المحافظة</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 'bold' }}>{selectedOutlet.governorate || '-'}</Typography>
                  </Grid>
                  <Grid item xs={6} sm={3}>
                    <Typography variant="caption" color="textSecondary" display="block">الهاتف</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 'bold' }}>{selectedOutlet.phone || '-'}</Typography>
                  </Grid>
                  <Grid item xs={6} sm={3}>
                    <Typography variant="caption" color="textSecondary" display="block">الحد الائتماني</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 'bold' }}>{formatCurrencyEGP(selectedOutlet.credit_limit || 0)}</Typography>
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <Typography variant="caption" color="textSecondary" display="block">تفاصيل العنوان</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 'bold' }}>{selectedOutlet.address_details || '-'}</Typography>
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <Typography variant="caption" color="textSecondary" display="block">المديونية (الرصيد المعلق الحالي)</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 'bold', color: (selectedOutletBalance?.pending_balance || 0) > 0 ? 'warning.main' : 'success.main' }}>
                      {formatCurrencyEGP(selectedOutletBalance?.pending_balance || 0)}
                    </Typography>
                  </Grid>
                  {selectedOutlet.credit_limit > 0 && (selectedOutletBalance?.pending_balance || 0) > selectedOutlet.credit_limit && (
                    <Grid item xs={12}>
                      <Alert severity="warning" sx={{ mt: 1 }}>
                        تنبيه: مديونية هذا العميل تتجاوز الحد الائتماني المسموح به!
                      </Alert>
                    </Grid>
                  )}
                </Grid>
              </Paper>
            )}

            {formMode === 'create' && formCollectionType !== 'none' && (
              <Paper variant="outlined" sx={{ p: 2, mt: 2, backgroundColor: (theme) => theme.palette.mode === 'dark' ? '#1e1e1e' : '#f8fafc', borderColor: (theme) => theme.palette.mode === 'dark' ? 'secondary.dark' : 'secondary.light' }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mb: 2, color: (theme) => theme.palette.mode === 'dark' ? 'secondary.light' : 'secondary.dark' }}>
                  تفاصيل تحصيل النقدية عند الإنشاء
                </Typography>
                <Grid container spacing={2}>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      required
                      label="المبلغ المحصل"
                      size="small"
                      type="number"
                      disabled={formCollectionType === 'full'}
                      inputProps={{ step: '0.01', min: '0.01' }}
                      value={formCollectionType === 'full' ? formTotals.total : formCollectedAmount}
                      onChange={(e) => setFormCollectedAmount(Math.max(0, parseFloat(e.target.value) || 0))}
                      InputProps={{
                        endAdornment: <InputAdornment position="end">ج.م</InputAdornment>
                      }}
                    />
                  </Grid>

                  <Grid item xs={12} sm={6}>
                    <FormControl fullWidth size="small" required>
                      <InputLabel id="form-supply-status-select-label">حالة توريد النقدية</InputLabel>
                      <Select
                        labelId="form-supply-status-select-label"
                        value={formSupplyStatus}
                        onChange={(e) => setFormSupplyStatus(e.target.value)}
                        label="حالة توريد النقدية"
                      >
                        <MenuItem value="not_supplied">مدفوع فقط (في الخزينة الفرعية)</MenuItem>
                        <MenuItem value="supplied">مدفوع وتم توريده (إلى خزينة الشركة)</MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>

                  <Grid item xs={12}>
                    <TextField
                      fullWidth
                      label="ملاحظات عملية التحصيل"
                      size="small"
                      value={formCollectionNotes}
                      onChange={(e) => setFormCollectionNotes(e.target.value)}
                    />
                  </Grid>

                  <Grid item xs={12}>
                    <Box className="receipt-upload-container">
                      <input
                        hidden
                        accept="image/*,application/pdf"
                        id="invoice-payment-receipt-upload"
                        type="file"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            try {
                              const result = await compressImageAndConvertToBase64(file);
                              setFormReceiptName(result.name);
                              setFormReceiptData(result.data);
                            } catch (err) {
                              console.error('Error processing file:', err);
                              setToastMsg('حدث خطأ أثناء معالجة الملف المرفوع.');
                              setToastSeverity('error');
                            }
                          }
                        }}
                      />
                      <label htmlFor="invoice-payment-receipt-upload">
                        <Button
                          variant="outlined"
                          component="span"
                          color="secondary"
                          startIcon={<ReceiptIcon />}
                          sx={{ fontWeight: 'bold' }}
                        >
                          {formReceiptName ? `تغيير مستند الإيصال: ${formReceiptName}` : 'رفع إيصال / مستند الدفع'}
                        </Button>
                      </label>
                      {formReceiptName && (
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 'bold' }}>
                            الملف المحدد: {formReceiptName}
                          </Typography>
                          <IconButton
                            size="small"
                            color="error"
                            onClick={() => {
                              setFormReceiptName('');
                              setFormReceiptData('');
                            }}
                          >
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </Box>
                      )}
                    </Box>
                  </Grid>
                </Grid>
              </Paper>
            )}
          </FormSection>

          <FormSection title="المواد والكتب المباعة">
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
              <Button
                variant="outlined"
                color="secondary"
                size="small"
                startIcon={<AddIcon />}
                onClick={handleAddFormItem}
              >
                إضافة مادة للفاتورة
              </Button>
            </Box>

            {formItems.length === 0 ? (
              <Alert severity="info" sx={{ mb: 2 }}>
                لم يتم إضافة أي كتاب في الفاتورة حتى الآن. انقر على "إضافة مادة للفاتورة" للبدء.
              </Alert>
            ) : (
              formItems.map((item, index) => {
                const prod = productsList.find((p) => p.id === item.productId);
                return (
                  <Paper
                    key={index}
                    variant="outlined"
                    className="invoice-item-card"
                  >
                    {/* Row 1: Book selection (40%), spacer (5%), & Unit Price (40%) */}
                    <Box className="invoice-item-row">
                      <Box className="invoice-item-field">
                        <Autocomplete
                          options={productsList}
                          getOptionLabel={(option) => `(${option.code}) ${option.title}`}
                          size="small"
                          disabled={!formOutletId}
                          value={prod || null}
                          onChange={(e, val) => handleFormItemProductChange(index, val)}
                          renderInput={(params) => <TextField {...params} required label="الكتاب" />}
                        />
                      </Box>
                      <Box className="invoice-item-spacer" />
                      <Box className="invoice-item-field">
                        <TextField
                          fullWidth
                          label="السعر للوحدة"
                          size="small"
                          disabled
                          value={item.price ? formatCurrencyEGP(item.price) : '0.00 ج.م'}
                        />
                      </Box>
                    </Box>

                    {/* Row 2: Quantity (40%), spacer (5%), & Free Quantity (40%) */}
                    <Box className="invoice-item-row">
                      <Box className="invoice-item-field">
                        <TextField
                          fullWidth
                          label="الكمية الإجمالية"
                          size="small"
                          type="number"
                          required
                          inputProps={{ min: '1' }}
                          value={item.quantity}
                          onChange={(e) => handleFormItemQtyChange(index, e.target.value)}
                        />
                      </Box>
                      <Box className="invoice-item-spacer" />
                      <Box className="invoice-item-field">
                        <TextField
                          fullWidth
                          label="الكمية المجانية"
                          size="small"
                          type="number"
                          inputProps={{ min: '0', max: item.quantity }}
                          value={item.freeQuantity || 0}
                          onChange={(e) => handleFormItemFreeQtyChange(index, e.target.value)}
                        />
                      </Box>
                    </Box>

                    {/* Footer: Line Total and Remove Button */}
                    <Box className="invoice-item-footer">
                      <Typography variant="body2" sx={{ fontWeight: 'bold', color: 'text.secondary' }}>
                        إجمالي السطر: <Typography component="span" sx={{ color: 'text.primary', fontWeight: 'bold' }}>{formatCurrencyEGP((item.quantity - (item.freeQuantity || 0)) * item.price)}</Typography>
                      </Typography>
                      <IconButton color="error" size="small" onClick={() => handleRemoveFormItem(index)}>
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Box>

                    {/* Stock info & Price/Stock Error indicator */}
                    {(item.productId || item.error) && (
                      <Box className="invoice-item-stock-error">
                        {item.productId && (
                          <Typography variant="caption" sx={{ color: item.stockPolicy === 'track' && item.stock <= 0 ? 'error.main' : 'text.secondary', fontWeight: 500 }}>
                            المتوفر في المخزن: {item.stock} {item.stockPolicy === 'ignore' && '(مخزون لا حصر له)'}
                          </Typography>
                        )}
                        {item.error && (
                          <Typography variant="caption" sx={{ color: 'error.main', fontWeight: 'bold' }}>
                            {item.error}
                          </Typography>
                        )}
                      </Box>
                    )}
                  </Paper>
                );
              })
            )}

            {/* Subtotal / Final total calculation board (Full Width layout - Minimal UI class-bound) */}
            {formItems.length > 0 && (
              <Box sx={{ mt: 3 }}>
                <Paper
                  variant="outlined"
                  className="invoice-summary-card"
                >
                  <Box className="invoice-summary-card-content">
                    {/* Breakdown section */}
                    <Box className="invoice-summary-breakdown">
                      <Box className="invoice-summary-row">
                        <Typography variant="body2" color="textSecondary">
                          المجموع الفرعي (قبل الخصم والشحن):
                        </Typography>
                        <Typography variant="body2" sx={{ fontWeight: 'bold', color: 'text.primary' }}>
                          {formTotals.subtotal} ج.م
                        </Typography>
                      </Box>
                      <Divider sx={{ borderStyle: 'dashed' }} />
                      <Box className="invoice-summary-row">
                        <Typography variant="body2" color="textSecondary">
                          الشحن والتوصيل:
                        </Typography>
                        <Typography variant="body2" sx={{ fontWeight: 'bold', color: 'text.primary' }}>
                          +{formatCurrencyEGP(formShippingCost || 0)}
                        </Typography>
                      </Box>
                      <Divider sx={{ borderStyle: 'dashed' }} />
                      <Box className="invoice-summary-row">
                        <Typography variant="body2" color="textSecondary">
                          الخصم المطبق:
                        </Typography>
                        <Typography variant="body2" sx={{ fontWeight: 'bold', color: 'text.primary' }}>
                          -{formatCurrencyEGP(formDiscount || 0)}
                        </Typography>
                      </Box>
                    </Box>

                    {/* Grand Total Callout section */}
                    <Box className="invoice-summary-callout">
                      <Typography variant="caption" className="invoice-summary-callout-label">
                        المجموع الإجمالي النهائي
                      </Typography>
                      <Typography variant="h5" className="invoice-summary-callout-value">
                        {formTotals.total} ج.م
                      </Typography>
                    </Box>
                  </Box>
                </Paper>
              </Box>
            )}
          </FormSection>
        </form>
      </EntityDrawer>



      {/* --- إنشاء مرتجع Drawer --- */}
      <EntityDrawer
        open={openReturnDrawer}
        onClose={() => !returnSubmitting && setOpenReturnDrawer(false)}
        title="إنشاء مرتجع مبيعات جديد"
        subtitle={returnInvoice ? `للفاتورة رقم: ${returnInvoice.invoice_number}` : ''}
        size="medium"
        loading={returnSubmitting}
        actions={
          <>
            <Button
              variant="outlined"
              color="inherit"
              onClick={() => setOpenReturnDrawer(false)}
              disabled={returnSubmitting}
            >
              إلغاء
            </Button>
            <Button
              variant="contained"
              color="secondary"
              type="submit"
              form="create-return-form"
              disabled={returnSubmitting}
            >
              {returnSubmitting ? 'جاري الحفظ...' : 'تأكيد وإرجاع للمخزن'}
            </Button>
          </>
        }
      >
        {returnInvoice && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSubmitReturn();
            }}
            id="create-return-form"
          >
            <FormSection title="أصناف وكميات الفاتورة القابلة للإرجاع">
              <Alert severity="warning" sx={{ mb: 2, fontWeight: 'bold' }}>
                تنبيه: عند إتمام المرتجع، سيتم إرجاع الكتب إلى المخزن تلقائياً. 
                لا يمكن إعادة شحن هذه الكميات المرتجعة على نفس هذه الفاتورة مرة أخرى. 
                لإعادة شحنها للعميل، يجب إنشاء فاتورة جديدة ومستقلة.
              </Alert>
              <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 1.5 }}>
                <Button
                  size="small"
                  variant="outlined"
                  color="secondary"
                  onClick={() => {
                    const allQtys = {};
                    returnInvoice.items?.forEach(item => {
                      allQtys[item.id] = item.remaining_returnable_quantity;
                    });
                    setReturnQuantities(allQtys);
                  }}
                >
                  إرجاع كافة الكميات المتبقية (مرتجع كامل)
                </Button>
              </Box>
              <TableContainer className="scrollable-table-container" component={Paper} variant="outlined">
                <Table size="small">
                  <TableHead sx={{ backgroundColor: '#f8fafc' }}>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 'bold' }}>اسم الكتاب</TableCell>
                      <TableCell align="center" sx={{ fontWeight: 'bold' }}>المباع</TableCell>
                      <TableCell align="center" sx={{ fontWeight: 'bold' }}>المسترجع سابقاً</TableCell>
                      <TableCell align="center" sx={{ fontWeight: 'bold' }}>الكمية المتاحة للاسترجاع</TableCell>
                      <TableCell align="center" sx={{ fontWeight: 'bold', minWidth: 100 }}>كمية المرتجع الحالية</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {returnInvoice.items?.map((item) => {
                      const maxQty = item.remaining_returnable_quantity;
                      const currentVal = returnQuantities[item.id] || 0;
                      return (
                        <TableRow key={item.id}>
                          <TableCell>{item.product_title}</TableCell>
                          <TableCell align="center">{item.quantity}</TableCell>
                          <TableCell align="center">{item.quantity - maxQty}</TableCell>
                          <TableCell align="center" sx={{ fontWeight: 'bold', color: maxQty > 0 ? 'warning.main' : 'success.main' }}>{maxQty}</TableCell>
                          <TableCell align="center">
                            <TextField
                              size="small"
                              type="number"
                              value={currentVal}
                              onChange={(e) => handleReturnQtyChange(item.id, e.target.value)}
                              inputProps={{ min: 0, max: maxQty }}
                              disabled={maxQty <= 0 || returnSubmitting}
                              sx={{ width: 80 }}
                            />
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </TableContainer>

              <TextField
                fullWidth
                label="سبب المرتجع / ملاحظات"
                value={returnReason}
                onChange={(e) => setReturnReason(e.target.value)}
                placeholder="يرجى كتابة سبب المرتجع هنا..."
                multiline
                rows={3}
                disabled={returnSubmitting}
                sx={{ mt: 2 }}
                InputLabelProps={{ shrink: true }}
              />
            </FormSection>
          </form>
        )}
      </EntityDrawer>

      {/* Supply Payment Confirmation Dialog */}
      <ConfirmDialog
        open={supplyConfirmOpen}
        onClose={() => setSupplyConfirmOpen(false)}
        onConfirm={executeMarkPaymentSupplied}
        title="تأكيد توريد الدفعة"
        message="هل أنت متأكد من تأكيد توريد هذه الدفعة للخزينة؟"
        severity="warning"
        confirmText="تأكيد التوريد"
      />

      {/* Bulk Shipping Status Dialog */}
      <Dialog
        open={openBulkShippingModal}
        onClose={() => setOpenBulkShippingModal(false)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle sx={{ fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: 1 }}>
          <LocalShippingIcon color="primary" />
          {selectedInvoiceIds.length === 1 ? 'تحديث حالة الشحن للفاتورة' : `تحديث حالة الشحن لـ (${selectedInvoiceIds.length}) فواتير`}
        </DialogTitle>
        <DialogContent dividers>
          <FormControl fullWidth size="small" sx={{ mt: 1 }}>
            <InputLabel id="bulk-shipping-status-label">حالة الشحن الجديدة</InputLabel>
            <Select
              labelId="bulk-shipping-status-label"
              value={bulkShippingStatus}
              onChange={(e) => setBulkShippingStatus(e.target.value)}
              label="حالة الشحن الجديدة"
            >
              <MenuItem value="pending">قيد الانتظار</MenuItem>
              <MenuItem value="delivered">تم الشحن والتسليم</MenuItem>
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setOpenBulkShippingModal(false)} color="inherit" disabled={bulkSubmitting}>
            إلغاء
          </Button>
          <Button
            onClick={handleBulkShippingUpdate}
            variant="contained"
            color="primary"
            disabled={bulkSubmitting}
            startIcon={<LocalShippingIcon />}
          >
            {bulkSubmitting ? 'جاري التحديث...' : 'تحديث الحالة'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar Alert Toast */}
      <Snackbar
        open={!!toastMsg}
        autoHideDuration={4000}
        onClose={() => setToastMsg('')}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
      >
        <Alert onClose={() => setToastMsg('')} severity={toastSeverity} sx={{ width: '100%' }}>
          {toastMsg}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default Invoices;

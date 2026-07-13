import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Button,
  Checkbox,
  FormControlLabel,
  IconButton,
  MenuItem,
  Switch,
  TextField,
  Tooltip,
} from '@mui/material';
import {
  AddRounded,
  DeleteRounded,
  EditRounded,
  PrintRounded,
  RefreshRounded,
} from '@mui/icons-material';
import { api } from '../services/apiClient.js';
import { printProductLabelsInFrame } from '../services/printService.js';
import { PageHeader } from '../components/PageHeader.jsx';
import { DataTable } from '../components/DataTable.jsx';
import { FilterPanel } from '../components/FilterPanel.jsx';
import { EntityDrawer } from '../components/EntityDrawer.jsx';
import { Field } from '../components/forms/Field.jsx';
import { FieldGrid } from '../components/forms/FieldGrid.jsx';
import { FormSection } from '../components/forms/FormSection.jsx';
import { LoadingState } from '../components/LoadingState.jsx';
import { AppSnackbar } from '../components/AppSnackbar.jsx';
import { StatusChip } from '../components/StatusChip.jsx';
import { money, number } from '../utils/formatters.js';
import { parsePiasters, piastersToInput } from '../utils/money.js';
import { productLabelSizeFromDimensions } from '../utils/productLabelPrintSizing.js';
import { ConfirmDialog } from '../components/ConfirmDialog.jsx';
import '../styles/Products.css';

const STOCK_ONLY = 'STOCK_ONLY';
const PREORDER_WHEN_OUT = 'STOCK_WITH_PREORDER_WHEN_OUT_OF_STOCK';
const INITIAL_FILTERS = Object.freeze({
  q: '',
  categoryId: '',
  stock: 'all',
  policy: 'all',
  active: 'all',
});

function newForm(categoryId = '') {
  return {
    name: '',
    sku: '',
    barcode: '',
    categoryId,
    description: '',
    isActive: true,
    availabilityPolicy: STOCK_ONLY,
    initialStock: '0',
    lowStockThreshold: '5',
    purchaseCost: '0.00',
    defaultPreorderDepositPct: '50',
    defaultPickupMethod: 'walk_in',
    preorderInstructions: '',
    notes: '',
    isBook: false,
    bookType: '',
    schoolGrade: '',
    subject: '',
    teacher: '',
    publisher: '',
    releaseYear: '',
    term: 'first',
    educationalClassification: 'external_book',
    prices: {},
    unlinkPriceTierIds: [],
  };
}

function policyLabel(policy) {
  return policy === PREORDER_WHEN_OUT ? 'بيع من المخزون ثم حجز عند النفاد' : 'بيع من المخزون فقط';
}

export default function Products() {
  const [rows, setRows] = useState([]);
  const [categories, setCategories] = useState([]);
  const [tiers, setTiers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filters, setFilters] = useState(INITIAL_FILTERS);
  const [drawer, setDrawer] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(newForm());
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);
  const [qrProduct, setQrProduct] = useState(null);
  const [qrForm, setQrForm] = useState({ quantity: 1, label_size: 'medium' });
  const [labelDefaults, setLabelDefaults] = useState({ quantity: 1, label_size: 'medium' });
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const loadSequence = useRef(0);

  const loadRefs = async () => {
    const [categoryResponse, tierResponse, settingsResponse] = await Promise.all([
      api.get('/api/categories?activeOnly=false'),
      api.get('/api/admin/price-tiers?activeOnly=false'),
      api.get('/api/admin/printer-settings').catch(() => ({ data: {} })),
    ]);
    setCategories(categoryResponse.data || []);
    setTiers(tierResponse.data || []);
    const settings = settingsResponse.data || {};
    const nextDefaults = {
      quantity: Math.min(500, Math.max(1, Number.parseInt(settings.qr_label_count, 10) || 1)),
      label_size: productLabelSizeFromDimensions(
        settings.qr_printer_width,
        settings.qr_printer_height
      ),
    };
    setLabelDefaults(nextDefaults);
    setQrForm(nextDefaults);
  };

  const load = async (nextFilters = filters) => {
    const requestId = ++loadSequence.current;
    setLoading(true);
    try {
      const query = new URLSearchParams({ activeOnly: 'false' });
      if (nextFilters.q) query.set('q', nextFilters.q);
      if (nextFilters.categoryId) query.set('categoryId', nextFilters.categoryId);
      if (nextFilters.policy !== 'all') query.set('availabilityPolicy', nextFilters.policy);
      let products = (await api.get(`/api/products?${query}`)).data || [];
      if (nextFilters.stock === 'low')
        products = products.filter(
          (product) => product.stockOnHand > 0 && product.stockOnHand <= product.low_stock_threshold
        );
      if (nextFilters.stock === 'out')
        products = products.filter((product) => product.stockOnHand === 0);
      if (nextFilters.stock === 'available')
        products = products.filter((product) => product.stockOnHand > 0);
      if (nextFilters.active === 'active')
        products = products.filter((product) => product.is_active === 1);
      if (nextFilters.active === 'inactive')
        products = products.filter((product) => product.is_active !== 1);
      if (requestId !== loadSequence.current) return;
      setRows(products);
      setError('');
    } catch (loadError) {
      if (requestId === loadSequence.current) setError(loadError.message);
    } finally {
      if (requestId === loadSequence.current) setLoading(false);
    }
  };

  useEffect(() => {
    loadRefs().catch((loadError) => setError(loadError.message));
    load(INITIAL_FILTERS);
    return () => {
      loadSequence.current += 1;
    };
  }, []);

  const openNew = () => {
    setEditing(null);
    setForm(newForm(categories[0]?.id || ''));
    setDrawer(true);
  };

  const openEdit = async (row) => {
    setSaving(true);
    try {
      const product = (await api.get(`/api/products/${row.id}`)).data;
      const prices = {};
      (product.prices || []).forEach((price) => {
        if (price.price !== null) prices[price.price_tier_id] = piastersToInput(price.price);
      });
      setEditing(product);
      setForm({
        name: product.name || '',
        sku: product.sku || '',
        barcode: product.barcode || '',
        categoryId: product.category_id || '',
        description: product.description || '',
        isActive: Boolean(product.is_active),
        availabilityPolicy: product.availabilityPolicy || STOCK_ONLY,
        initialStock: String(product.stockOnHand || 0),
        lowStockThreshold: String(product.low_stock_threshold ?? 5),
        purchaseCost: piastersToInput(product.purchase_cost),
        defaultPreorderDepositPct: String(product.defaultPreorderDepositPct ?? 50),
        defaultPickupMethod: product.defaultPickupMethod || 'walk_in',
        preorderInstructions: product.preorderInstructions || '',
        notes: product.notes || '',
        isBook: Boolean(product.book_details),
        bookType: product.book_details?.book_type || '',
        schoolGrade: product.book_details?.school_grade || '',
        subject: product.book_details?.subject || '',
        teacher: product.book_details?.teacher || '',
        publisher: product.book_details?.publisher || '',
        releaseYear: product.book_details?.release_year || '',
        term: product.book_details?.term || 'first',
        educationalClassification:
          product.book_details?.educational_classification || 'external_book',
        prices,
        unlinkPriceTierIds: [],
      });
      setDrawer(true);
    } catch (loadError) {
      setToast({ severity: 'error', message: loadError.message });
    } finally {
      setSaving(false);
    }
  };

  const buildPayload = () => ({
    name: form.name.trim(),
    sku: form.sku.trim(),
    barcode: form.barcode.trim() || null,
    categoryId: Number(form.categoryId),
    description: form.description.trim() || null,
    isActive: Boolean(form.isActive),
    availabilityPolicy: form.availabilityPolicy,
    ...(editing ? {} : { initialStock: Number(form.initialStock) }),
    lowStockThreshold: Number(form.lowStockThreshold),
    purchaseCost: parsePiasters(form.purchaseCost),
    ...(form.availabilityPolicy === PREORDER_WHEN_OUT
      ? {
          defaultPreorderDepositPct: Number(form.defaultPreorderDepositPct),
          defaultPickupMethod: form.defaultPickupMethod,
          preorderInstructions: form.preorderInstructions.trim() || null,
        }
      : {}),
    notes: form.notes.trim() || null,
    isBook: form.isBook,
    bookDetails: form.isBook
      ? {
          book_type: form.bookType || null,
          school_grade: form.schoolGrade || null,
          subject: form.subject || null,
          teacher: form.teacher || null,
          publisher: form.publisher || null,
          release_year: form.releaseYear ? Number(form.releaseYear) : null,
          term: form.term,
          educational_classification: form.educationalClassification,
        }
      : null,
    prices: tiers
      .filter((tier) => tier.is_active === 1)
      .map((tier) => ({
        priceTierId: tier.id,
        price: parsePiasters(form.prices[tier.id]),
      })),
    unlinkPriceTierIds: form.unlinkPriceTierIds,
  });

  const save = async () => {
    const activeTiers = tiers.filter((tier) => tier.is_active === 1);
    if (!form.name.trim() || !form.sku.trim() || !form.categoryId || !form.availabilityPolicy) {
      setToast({ severity: 'error', message: 'الاسم وSKU والتصنيف وسياسة التوفر حقول مطلوبة.' });
      return;
    }
    if (!editing && (!/^\d+$/.test(form.initialStock) || Number(form.initialStock) < 0)) {
      setToast({
        severity: 'error',
        message: 'الرصيد الافتتاحي يجب أن يكون عدداً صحيحاً غير سالب.',
      });
      return;
    }
    if (activeTiers.some((tier) => !String(form.prices[tier.id] ?? '').trim())) {
      setToast({ severity: 'error', message: 'أدخل سعراً لكل فئة سعر نشطة.' });
      return;
    }
    setSaving(true);
    try {
      const payload = buildPayload();
      if (editing) await api.patch(`/api/admin/products/${editing.id}`, payload);
      else await api.post('/api/admin/products', payload);
      setToast({ message: editing ? 'تم تحديث المنتج.' : 'تم إنشاء المنتج.' });
      setDrawer(false);
      await load();
    } catch (saveError) {
      setToast({ severity: 'error', message: saveError.message });
    } finally {
      setSaving(false);
    }
  };

  const printQr = async () => {
    setSaving(true);
    try {
      const result = (await api.post(`/api/admin/products/${qrProduct.id}/qr-labels`, qrForm)).data;
      setQrProduct(null);
      await printProductLabelsInFrame({
        productId: result.product.id,
        token: result.token,
        quantity: result.quantity,
        size: result.label_size,
      });
      setToast({ message: 'تم تسجيل طلب الملصقات وفتح مستند الطباعة المعزول.' });
    } catch (printError) {
      setToast({ severity: 'error', message: printError.message });
    } finally {
      setSaving(false);
    }
  };

  const removeProduct = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.delete(`/api/admin/products/${deleteTarget.id}`);
      setToast({ message: 'تم حذف المنتج غير المستخدم نهائيًا.' });
      setDeleteTarget(null);
      await load(filters);
    } catch (deleteError) {
      setToast({
        severity: 'error',
        message:
          deleteError.code === 'PRODUCT_IN_USE'
            ? 'للمنتج سجل بيع أو حجز أو مخزون أو مرتجع؛ يمكن تعطيله فقط.'
            : deleteError.message,
      });
    } finally {
      setDeleting(false);
    }
  };

  const openLabelPrint = (product) => {
    setQrForm(labelDefaults);
    setQrProduct(product);
  };

  const columns = useMemo(
    () => [
      {
        key: 'name',
        label: 'اسم المنتج',
        render: (row) => (
          <div>
            <strong>{row.name}</strong>
            <div className="a4-muted a4-ltr a4-product-sku">{row.sku}</div>
          </div>
        ),
      },
      { key: 'category_name', label: 'التصنيف' },
      {
        key: 'stockOnHand',
        label: 'المخزون الفعلي',
        render: (row) => <strong>{number(row.stockOnHand)}</strong>,
      },
      {
        key: 'openPreorderQuantity',
        label: 'كمية الحجز المفتوح',
        render: (row) => number(row.openPreorderQuantity),
      },
      {
        key: 'availabilityPolicy',
        label: 'سياسة التوفر',
        render: (row) => policyLabel(row.availabilityPolicy),
      },
      {
        key: 'eligibility',
        label: 'المتاح الآن',
        render: (row) => (row.canSellNow ? 'بيع' : row.canPreorderNow ? 'حجز مسبق' : 'غير متاح'),
      },
      { key: 'purchase_cost', label: 'تكلفة الشراء', render: (row) => money(row.purchase_cost) },
      {
        key: 'status',
        label: 'الحالة',
        render: (row) => (
          <StatusChip
            status={row.is_active ? 'active' : 'inactive'}
            label={row.is_active ? 'نشط' : 'معطل'}
          />
        ),
      },
      {
        key: 'dependencies',
        label: 'السجل المرتبط',
        render: (row) => {
          const counts = row.dependency_counts || {};
          const total = Object.values(counts).reduce((sum, value) => sum + Number(value || 0), 0);
          return total;
        },
      },
      {
        key: 'actions',
        label: 'الإجراءات',
        render: (row) => (
          <div className="table-actions">
            <Tooltip title="تعديل">
              <IconButton size="small" onClick={() => openEdit(row)}>
                <EditRounded fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title="طباعة رمز المنتج">
              <IconButton size="small" onClick={() => openLabelPrint(row)}>
                <PrintRounded fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip
              title={row.can_delete === false ? 'للمنتج سجل تشغيلي؛ عطّله بدل الحذف' : 'حذف نهائي'}
            >
              <span>
                <IconButton
                  size="small"
                  color="error"
                  disabled={row.can_delete === false}
                  onClick={() => setDeleteTarget(row)}
                >
                  <DeleteRounded fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
          </div>
        ),
      },
    ],
    [labelDefaults]
  );

  return (
    <div className="a4-page">
      <PageHeader
        title="المنتجات"
        description="إدارة المخزون الفعلي وسياسة البيع أو الحجز عند النفاد."
        actions={
          <>
            <Button variant="outlined" startIcon={<RefreshRounded />} onClick={() => load(filters)}>
              تحديث
            </Button>
            <Button variant="contained" startIcon={<AddRounded />} onClick={openNew}>
              منتج جديد
            </Button>
          </>
        }
      />
      <FilterPanel
        resultCount={rows.length}
        onApply={() => load(filters)}
        onReset={() => {
          setFilters(INITIAL_FILTERS);
          load(INITIAL_FILTERS);
        }}
      >
        <Field label="البحث">
          <TextField
            value={filters.q}
            onChange={(event) => setFilters((value) => ({ ...value, q: event.target.value }))}
          />
        </Field>
        <Field label="التصنيف">
          <TextField
            select
            value={filters.categoryId}
            onChange={(event) =>
              setFilters((value) => ({ ...value, categoryId: event.target.value }))
            }
          >
            <MenuItem value="">الكل</MenuItem>
            {categories.map((category) => (
              <MenuItem key={category.id} value={category.id}>
                {category.name}
              </MenuItem>
            ))}
          </TextField>
        </Field>
        <Field label="سياسة التوفر">
          <TextField
            select
            value={filters.policy}
            onChange={(event) => setFilters((value) => ({ ...value, policy: event.target.value }))}
          >
            <MenuItem value="all">الكل</MenuItem>
            <MenuItem value={STOCK_ONLY}>{policyLabel(STOCK_ONLY)}</MenuItem>
            <MenuItem value={PREORDER_WHEN_OUT}>{policyLabel(PREORDER_WHEN_OUT)}</MenuItem>
          </TextField>
        </Field>
        <Field label="حالة المخزون">
          <TextField
            select
            value={filters.stock}
            onChange={(event) => setFilters((value) => ({ ...value, stock: event.target.value }))}
          >
            <MenuItem value="all">الكل</MenuItem>
            <MenuItem value="available">متوفر</MenuItem>
            <MenuItem value="low">منخفض</MenuItem>
            <MenuItem value="out">نفد</MenuItem>
          </TextField>
        </Field>
        <Field label="حالة المنتج">
          <TextField
            select
            value={filters.active}
            onChange={(event) => setFilters((value) => ({ ...value, active: event.target.value }))}
          >
            <MenuItem value="all">الكل</MenuItem>
            <MenuItem value="active">نشط</MenuItem>
            <MenuItem value="inactive">معطل</MenuItem>
          </TextField>
        </Field>
      </FilterPanel>
      {error && <Alert severity="error">{error}</Alert>}
      {rows.some((row) => row.can_be_sold === 0) && (
        <Alert severity="warning">
          توجد منتجات قديمة بسياسة غير مدعومة. راجع سجل مشكلات الترحيل قبل تعديلها.
        </Alert>
      )}
      <section className="a4-page-section">
        {loading ? (
          <LoadingState />
        ) : (
          <DataTable columns={columns} rows={rows} mobilePrimary={(row) => row.name} />
        )}
      </section>

      <EntityDrawer
        wide
        open={drawer}
        title={editing ? 'تعديل المنتج' : 'إضافة منتج'}
        onClose={() => setDrawer(false)}
        onSubmit={save}
        loading={saving}
      >
        <FormSection title="البيانات الأساسية">
          <FieldGrid>
            <Field label="اسم المنتج" required>
              <TextField
                value={form.name}
                onChange={(event) => setForm((value) => ({ ...value, name: event.target.value }))}
              />
            </Field>
            <Field label="رمز SKU" required ltr>
              <TextField
                value={form.sku}
                onChange={(event) => setForm((value) => ({ ...value, sku: event.target.value }))}
              />
            </Field>
            <Field label="الباركود" ltr>
              <TextField
                value={form.barcode}
                onChange={(event) =>
                  setForm((value) => ({ ...value, barcode: event.target.value }))
                }
              />
            </Field>
            <Field label="التصنيف" required>
              <TextField
                select
                value={form.categoryId}
                onChange={(event) =>
                  setForm((value) => ({ ...value, categoryId: event.target.value }))
                }
              >
                {categories.map((category) => (
                  <MenuItem key={category.id} value={category.id}>
                    {category.name}
                  </MenuItem>
                ))}
              </TextField>
            </Field>
            <Field className="full" label="الوصف">
              <TextField
                multiline
                minRows={2}
                value={form.description}
                onChange={(event) =>
                  setForm((value) => ({ ...value, description: event.target.value }))
                }
              />
            </Field>
            <Field className="full" label="حالة المنتج">
              <FormControlLabel
                control={
                  <Switch
                    checked={form.isActive}
                    onChange={(event) =>
                      setForm((value) => ({ ...value, isActive: event.target.checked }))
                    }
                  />
                }
                label="نشط"
              />
            </Field>
          </FieldGrid>
        </FormSection>

        <FormSection title="سياسة التوفر">
          <FieldGrid>
            <Field className="full" label="سياسة البيع والحجز" required>
              <TextField
                select
                value={form.availabilityPolicy}
                onChange={(event) =>
                  setForm((value) => ({ ...value, availabilityPolicy: event.target.value }))
                }
              >
                <MenuItem value={STOCK_ONLY}>{policyLabel(STOCK_ONLY)}</MenuItem>
                <MenuItem value={PREORDER_WHEN_OUT}>{policyLabel(PREORDER_WHEN_OUT)}</MenuItem>
              </TextField>
            </Field>
            {!editing && (
              <Field label="الرصيد الافتتاحي" required>
                <TextField
                  type="number"
                  value={form.initialStock}
                  onChange={(event) =>
                    setForm((value) => ({ ...value, initialStock: event.target.value }))
                  }
                  slotProps={{ htmlInput: { min: 0, step: 1 } }}
                />
              </Field>
            )}
            {editing && (
              <Field label="المخزون الفعلي الحالي">
                <TextField value={number(editing.stockOnHand)} disabled />
              </Field>
            )}
            <Field label="حد تنبيه المخزون" required>
              <TextField
                type="number"
                value={form.lowStockThreshold}
                onChange={(event) =>
                  setForm((value) => ({ ...value, lowStockThreshold: event.target.value }))
                }
                slotProps={{ htmlInput: { min: 0, step: 1 } }}
              />
            </Field>
            <Field label="تكلفة الشراء">
              <TextField
                value={form.purchaseCost}
                onChange={(event) =>
                  setForm((value) => ({ ...value, purchaseCost: event.target.value }))
                }
              />
            </Field>
          </FieldGrid>
          {form.availabilityPolicy === PREORDER_WHEN_OUT && (
            <FieldGrid>
              <Field label="نسبة العربون الافتراضية" required>
                <TextField
                  type="number"
                  value={form.defaultPreorderDepositPct}
                  onChange={(event) =>
                    setForm((value) => ({
                      ...value,
                      defaultPreorderDepositPct: event.target.value,
                    }))
                  }
                  slotProps={{ htmlInput: { min: 0, max: 100, step: 1 } }}
                />
              </Field>
              <Field label="طريقة الاستلام الافتراضية" required>
                <TextField
                  select
                  value={form.defaultPickupMethod}
                  onChange={(event) =>
                    setForm((value) => ({ ...value, defaultPickupMethod: event.target.value }))
                  }
                >
                  <MenuItem value="walk_in">استلام من المكتبة</MenuItem>
                  <MenuItem value="delivery">توصيل</MenuItem>
                </TextField>
              </Field>
              <Field className="full" label="تعليمات الحجز">
                <TextField
                  multiline
                  minRows={2}
                  value={form.preorderInstructions}
                  onChange={(event) =>
                    setForm((value) => ({ ...value, preorderInstructions: event.target.value }))
                  }
                />
              </Field>
            </FieldGrid>
          )}
          {editing &&
            editing.openPreorderQuantity > 0 &&
            form.availabilityPolicy === STOCK_ONLY && (
              <Alert severity="warning">لن يسمح الخادم بالحفظ ما دامت هناك كمية حجز مفتوحة.</Alert>
            )}
        </FormSection>

        <FormSection title="فئات الأسعار" description="كل فئة سعر نشطة مطلوبة.">
          <FieldGrid>
            {tiers
              .filter((tier) => tier.is_active === 1)
              .map((tier) => (
                <Field key={tier.id} label={tier.name} required>
                  <TextField
                    value={form.prices[tier.id] ?? ''}
                    onChange={(event) =>
                      setForm((value) => ({
                        ...value,
                        prices: { ...value.prices, [tier.id]: event.target.value },
                      }))
                    }
                  />
                </Field>
              ))}
          </FieldGrid>
          {editing?.prices?.some((price) => price.is_active !== 1 && price.price !== null) && (
            <div className="product-inactive-prices">
              <Alert severity="info">
                روابط فئات السعر غير النشطة محفوظة ولا تُحذف تلقائيًا. اختر فقط ما تريد فكه صراحةً.
              </Alert>
              {editing.prices
                .filter((price) => price.is_active !== 1 && price.price !== null)
                .map((price) => (
                  <FormControlLabel
                    key={price.price_tier_id}
                    control={
                      <Checkbox
                        checked={form.unlinkPriceTierIds.includes(price.price_tier_id)}
                        onChange={(event) =>
                          setForm((value) => ({
                            ...value,
                            unlinkPriceTierIds: event.target.checked
                              ? [...value.unlinkPriceTierIds, price.price_tier_id]
                              : value.unlinkPriceTierIds.filter(
                                  (tierId) => tierId !== price.price_tier_id
                                ),
                          }))
                        }
                      />
                    }
                    label={`فك رابط ${price.price_tier_name} (${money(price.price)})`}
                  />
                ))}
            </div>
          )}
        </FormSection>

        <FormSection title="بيانات الكتاب الاختيارية">
          <FormControlLabel
            control={
              <Checkbox
                checked={form.isBook}
                onChange={(event) =>
                  setForm((value) => ({ ...value, isBook: event.target.checked }))
                }
              />
            }
            label="هذا المنتج كتاب أو مادة تعليمية"
          />
          {form.isBook && (
            <FieldGrid>
              <Field label="نوع الكتاب">
                <TextField
                  value={form.bookType}
                  onChange={(event) =>
                    setForm((value) => ({ ...value, bookType: event.target.value }))
                  }
                />
              </Field>
              <Field label="الصف الدراسي">
                <TextField
                  value={form.schoolGrade}
                  onChange={(event) =>
                    setForm((value) => ({ ...value, schoolGrade: event.target.value }))
                  }
                />
              </Field>
              <Field label="المادة">
                <TextField
                  value={form.subject}
                  onChange={(event) =>
                    setForm((value) => ({ ...value, subject: event.target.value }))
                  }
                />
              </Field>
              <Field label="المدرس">
                <TextField
                  value={form.teacher}
                  onChange={(event) =>
                    setForm((value) => ({ ...value, teacher: event.target.value }))
                  }
                />
              </Field>
              <Field label="دار النشر">
                <TextField
                  value={form.publisher}
                  onChange={(event) =>
                    setForm((value) => ({ ...value, publisher: event.target.value }))
                  }
                />
              </Field>
              <Field label="سنة الإصدار">
                <TextField
                  type="number"
                  value={form.releaseYear}
                  onChange={(event) =>
                    setForm((value) => ({ ...value, releaseYear: event.target.value }))
                  }
                />
              </Field>
              <Field label="الترم">
                <TextField
                  select
                  value={form.term}
                  onChange={(event) => setForm((value) => ({ ...value, term: event.target.value }))}
                >
                  <MenuItem value="first">الأول</MenuItem>
                  <MenuItem value="second">الثاني</MenuItem>
                </TextField>
              </Field>
              <Field label="التصنيف التعليمي">
                <TextField
                  select
                  value={form.educationalClassification}
                  onChange={(event) =>
                    setForm((value) => ({
                      ...value,
                      educationalClassification: event.target.value,
                    }))
                  }
                >
                  <MenuItem value="external_book">كتاب خارجي</MenuItem>
                  <MenuItem value="school_book">كتاب مدرسي</MenuItem>
                  <MenuItem value="booklet">مذكرة</MenuItem>
                  <MenuItem value="notes">ملازم</MenuItem>
                </TextField>
              </Field>
            </FieldGrid>
          )}
        </FormSection>
        <FormSection title="ملاحظات داخلية">
          <Field>
            <TextField
              multiline
              minRows={3}
              value={form.notes}
              onChange={(event) => setForm((value) => ({ ...value, notes: event.target.value }))}
            />
          </Field>
        </FormSection>
      </EntityDrawer>
      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="حذف المنتج نهائيًا"
        description={`سيُحذف «${deleteTarget?.name || ''}» وأسعاره ورموز QR الخاصة به فقط إذا لم يدخل مطلقًا في بيع أو حجز أو حركة مخزون أو مرتجع. وإلا سيظل محفوظًا ويمكن تعطيله.`}
        confirmLabel="حذف المنتج"
        danger
        loading={deleting}
        onClose={() => setDeleteTarget(null)}
        onConfirm={removeProduct}
      />

      <EntityDrawer
        open={Boolean(qrProduct)}
        title="طباعة ملصقات المنتج"
        subtitle={qrProduct?.name}
        onClose={() => setQrProduct(null)}
        onSubmit={printQr}
        submitLabel="فتح مستند الطباعة"
        loading={saving}
      >
        <FieldGrid>
          <Field label="عدد الملصقات" required>
            <TextField
              type="number"
              value={qrForm.quantity}
              onChange={(event) =>
                setQrForm((value) => ({ ...value, quantity: Number(event.target.value) }))
              }
              slotProps={{ htmlInput: { min: 1, max: 500 } }}
            />
          </Field>
          <Field label="مقاس الملصق">
            <TextField
              select
              value={qrForm.label_size}
              onChange={(event) =>
                setQrForm((value) => ({ ...value, label_size: event.target.value }))
              }
            >
              <MenuItem value="small">صغير 38×25 مم</MenuItem>
              <MenuItem value="medium">متوسط 50×25 مم</MenuItem>
              <MenuItem value="large">كبير 80×50 مم</MenuItem>
            </TextField>
          </Field>
        </FieldGrid>
      </EntityDrawer>
      <AppSnackbar state={toast} onClose={() => setToast(null)} />
    </div>
  );
}

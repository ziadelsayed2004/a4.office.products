import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Button, MenuItem, Pagination, TextField } from '@mui/material';
import { AddBoxRounded, RefreshRounded } from '@mui/icons-material';
import { api } from '../services/apiClient.js';
import { PageHeader } from '../components/PageHeader.jsx';
import { DataTable } from '../components/DataTable.jsx';
import { FilterPanel } from '../components/FilterPanel.jsx';
import { EntityDrawer } from '../components/EntityDrawer.jsx';
import { Field } from '../components/forms/Field.jsx';
import { FieldGrid } from '../components/forms/FieldGrid.jsx';
import { LoadingState } from '../components/LoadingState.jsx';
import { AppSnackbar } from '../components/AppSnackbar.jsx';
import { dateTime, number } from '../utils/formatters.js';
import { createIdempotencyKey } from '../utils/money.js';
import '../styles/Inventory.css';

const PAGE_SIZE = 50;
const INITIAL_FILTERS = Object.freeze({
  productId: '',
  transactionType: '',
  startDate: '',
  endDate: '',
});
const INITIAL_FORM = Object.freeze({
  product_id: '',
  adjustment_type: 'ADD',
  quantity: 1,
  notes: '',
});
const txLabels = {
  INITIAL: 'رصيد افتتاحي',
  STOCK_IN: 'توريد',
  ADD: 'إضافة',
  REMOVE: 'خصم',
  ADJUSTMENT_ADD: 'تسوية إضافة',
  ADJUSTMENT_SUB: 'تسوية خصم',
  SALE: 'بيع',
  PREORDER_PICKUP: 'استلام حجز',
  RETURN: 'مرتجع',
  DAMAGE: 'تالف',
  ADJUSTMENT: 'تسوية',
};

function inventoryQuery(filters, page) {
  const query = new URLSearchParams({
    limit: String(PAGE_SIZE),
    offset: String((page - 1) * PAGE_SIZE),
  });
  for (const [key, value] of Object.entries(filters)) {
    if (value) query.set(key, value);
  }
  return query;
}

export default function Inventory() {
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filters, setFilters] = useState(INITIAL_FILTERS);
  const [drawer, setDrawer] = useState(false);
  const [form, setForm] = useState(INITIAL_FORM);
  const [requestKey, setRequestKey] = useState(() => createIdempotencyKey('inventory-adjustment'));
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);
  const loadSequence = useRef(0);

  const loadProducts = async () => {
    try {
      setProducts((await api.get('/api/products?activeOnly=false')).data || []);
    } catch {
      // The ledger request surfaces the page-level failure.
    }
  };

  const load = async (nextFilters = filters, nextPage = page) => {
    const requestId = ++loadSequence.current;
    setLoading(true);
    try {
      const payload =
        (await api.get(`/api/admin/inventory?${inventoryQuery(nextFilters, nextPage)}`)).data || {};
      if (requestId !== loadSequence.current) return;
      const ledger = Array.isArray(payload) ? payload : payload.ledger || payload.rows || [];
      setRows(ledger);
      setTotal(Number(payload.total ?? payload.pagination?.total ?? ledger.length));
      setError('');
    } catch (loadError) {
      if (requestId === loadSequence.current) setError(loadError.message);
    } finally {
      if (requestId === loadSequence.current) setLoading(false);
    }
  };

  useEffect(() => {
    loadProducts();
    load(INITIAL_FILTERS, 1);
    return () => {
      loadSequence.current += 1;
    };
  }, []);

  const applyFilters = () => {
    setPage(1);
    load(filters, 1);
  };

  const resetFilters = () => {
    setFilters(INITIAL_FILTERS);
    setPage(1);
    load(INITIAL_FILTERS, 1);
  };

  const changePage = (_event, nextPage) => {
    setPage(nextPage);
    load(filters, nextPage);
  };

  const openAdjustment = () => {
    setForm(INITIAL_FORM);
    setRequestKey(createIdempotencyKey('inventory-adjustment'));
    setDrawer(true);
  };

  const save = async () => {
    if (!form.product_id || !Number(form.quantity)) {
      setToast({ severity: 'error', message: 'اختر المنتج وأدخل كمية صحيحة.' });
      return;
    }
    setSaving(true);
    try {
      await api.post(
        '/api/admin/inventory/adjust',
        {
          ...form,
          product_id: Number(form.product_id),
          quantity: Number(form.quantity),
        },
        { headers: { 'Idempotency-Key': requestKey } }
      );
      setToast({ message: 'تمت تسوية المخزون بنجاح.' });
      setDrawer(false);
      setForm(INITIAL_FORM);
      setPage(1);
      await Promise.all([load(filters, 1), loadProducts()]);
    } catch (saveError) {
      setToast({ severity: 'error', message: saveError.message });
    } finally {
      setSaving(false);
    }
  };

  const columns = useMemo(
    () => [
      { key: 'created_at', label: 'التاريخ', render: (row) => dateTime(row.created_at) },
      {
        key: 'product_name',
        label: 'المنتج',
        render: (row) =>
          row.product_name ||
          products.find((product) => product.id === row.product_id)?.name ||
          `#${row.product_id}`,
      },
      {
        key: 'transaction_type',
        label: 'نوع الحركة',
        render: (row) => txLabels[row.transaction_type] || row.transaction_type,
      },
      {
        key: 'quantity',
        label: 'الكمية',
        render: (row) => {
          const quantity = Number(row.quantity ?? row.quantity_changed ?? 0);
          const className =
            quantity < 0 ? 'inventory-quantity-negative' : 'inventory-quantity-positive';
          return (
            <strong className={className}>
              {quantity > 0 ? '+' : ''}
              {number(quantity)}
            </strong>
          );
        },
      },
      { key: 'before_quantity', label: 'قبل', render: (row) => number(row.before_quantity) },
      { key: 'after_quantity', label: 'بعد', render: (row) => number(row.after_quantity) },
      {
        key: 'user_name',
        label: 'المستخدم',
        render: (row) => row.user_name || row.username || '—',
      },
      { key: 'notes', label: 'ملاحظات', render: (row) => row.notes || '—' },
    ],
    [products]
  );

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="a4-page">
      <PageHeader
        title="المخزون"
        description="دفتر كامل لكل حركة مخزون مع منع الرصيد السالب وربط الحركة بالمستخدم."
        actions={
          <>
            <Button
              variant="outlined"
              startIcon={<RefreshRounded />}
              onClick={() => load(filters, page)}
            >
              تحديث
            </Button>
            <Button variant="contained" startIcon={<AddBoxRounded />} onClick={openAdjustment}>
              تسوية مخزون
            </Button>
          </>
        }
      />
      <FilterPanel resultCount={total} onApply={applyFilters} onReset={resetFilters}>
        <Field label="المنتج">
          <TextField
            select
            value={filters.productId}
            onChange={(event) =>
              setFilters((value) => ({ ...value, productId: event.target.value }))
            }
          >
            <MenuItem value="">الكل</MenuItem>
            {products.map((product) => (
              <MenuItem key={product.id} value={product.id}>
                {product.name}
              </MenuItem>
            ))}
          </TextField>
        </Field>
        <Field label="نوع الحركة">
          <TextField
            select
            value={filters.transactionType}
            onChange={(event) =>
              setFilters((value) => ({ ...value, transactionType: event.target.value }))
            }
          >
            <MenuItem value="">الكل</MenuItem>
            {Object.entries(txLabels).map(([key, label]) => (
              <MenuItem key={key} value={key}>
                {label}
              </MenuItem>
            ))}
          </TextField>
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
          <DataTable
            columns={columns}
            rows={rows}
            mobilePrimary={(row) => row.product_name || `منتج #${row.product_id}`}
          />
        )}
        {!loading && total > PAGE_SIZE && (
          <div className="data-pagination">
            <Pagination count={pageCount} page={page} onChange={changePage} color="primary" />
            <span>{total} حركة</span>
          </div>
        )}
      </section>
      <EntityDrawer
        open={drawer}
        title="تسوية المخزون"
        subtitle="تسجل كل تسوية في دفتر المخزون وسجل العمليات."
        onClose={() => setDrawer(false)}
        onSubmit={save}
        loading={saving}
      >
        <FieldGrid>
          <Field className="form-grid__span-full" label="المنتج" required>
            <TextField
              select
              value={form.product_id}
              onChange={(event) =>
                setForm((value) => ({ ...value, product_id: event.target.value }))
              }
            >
              <MenuItem value="">اختر المنتج</MenuItem>
              {products.map((product) => (
                <MenuItem key={product.id} value={product.id}>
                  {product.name} — المتاح {number(product.stockOnHand ?? product.stock)}
                </MenuItem>
              ))}
            </TextField>
          </Field>
          <Field label="نوع التسوية" required>
            <TextField
              select
              value={form.adjustment_type}
              onChange={(event) =>
                setForm((value) => ({ ...value, adjustment_type: event.target.value }))
              }
            >
              <MenuItem value="ADD">إضافة كمية</MenuItem>
              <MenuItem value="SUB">خصم كمية</MenuItem>
              <MenuItem value="STOCK_IN">توريد مخزون</MenuItem>
            </TextField>
          </Field>
          <Field label="الكمية" required>
            <TextField
              type="number"
              slotProps={{ htmlInput: { min: 1 } }}
              value={form.quantity}
              onChange={(event) => setForm((value) => ({ ...value, quantity: event.target.value }))}
            />
          </Field>
          <Field className="form-grid__span-full" label="سبب التسوية" required>
            <TextField
              multiline
              minRows={3}
              value={form.notes}
              onChange={(event) => setForm((value) => ({ ...value, notes: event.target.value }))}
              placeholder="اكتب سبباً واضحاً للتسوية"
            />
          </Field>
        </FieldGrid>
      </EntityDrawer>
      <AppSnackbar state={toast} onClose={() => setToast(null)} />
    </div>
  );
}

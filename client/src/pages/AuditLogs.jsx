import { useEffect, useRef, useState } from 'react';
import { Alert, Button, Pagination, TextField } from '@mui/material';
import { RefreshRounded } from '@mui/icons-material';
import { api } from '../services/apiClient.js';
import { PageHeader } from '../components/PageHeader.jsx';
import { DataTable } from '../components/DataTable.jsx';
import { FilterPanel } from '../components/FilterPanel.jsx';
import { Field } from '../components/forms/Field.jsx';
import { LoadingState } from '../components/LoadingState.jsx';
import { dateTime } from '../utils/formatters.js';
import '../styles/AuditLogs.css';

const PAGE_SIZE = 50;
const INITIAL_FILTERS = Object.freeze({
  actionType: '',
  entityType: '',
  startDate: '',
  endDate: '',
});

function auditQuery(filters, page) {
  const query = new URLSearchParams({
    limit: String(PAGE_SIZE),
    offset: String((page - 1) * PAGE_SIZE),
  });
  for (const [key, value] of Object.entries(filters)) {
    if (value) query.set(key, value);
  }
  return query;
}

export default function AuditLogs() {
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filters, setFilters] = useState(INITIAL_FILTERS);
  const loadSequence = useRef(0);

  const load = async (nextFilters = filters, nextPage = page) => {
    const requestId = ++loadSequence.current;
    setLoading(true);
    try {
      const payload =
        (await api.get(`/api/admin/audit-logs?${auditQuery(nextFilters, nextPage)}`)).data || {};
      if (requestId !== loadSequence.current) return;
      setRows(payload.logs || []);
      setTotal(Number(payload.pagination?.total || 0));
      setError('');
    } catch (loadError) {
      if (requestId === loadSequence.current) setError(loadError.message);
    } finally {
      if (requestId === loadSequence.current) setLoading(false);
    }
  };

  useEffect(() => {
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

  const columns = [
    { key: 'created_at', label: 'التاريخ والوقت', render: (row) => dateTime(row.created_at) },
    {
      key: 'user_name',
      label: 'المستخدم',
      render: (row) => row.user_name || row.username || `#${row.user_id}`,
    },
    { key: 'action_type', label: 'نوع العملية' },
    { key: 'entity_type', label: 'الكيان' },
    { key: 'entity_id', label: 'رقم السجل' },
    {
      key: 'notes',
      label: 'التفاصيل',
      render: (row) => <span className="a4-wrap-cell">{row.notes || '—'}</span>,
    },
  ];

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="a4-page">
      <PageHeader
        title="سجل العمليات"
        description="سجل غير قابل للحذف لكل العمليات الحساسة المالية والإدارية."
        actions={
          <Button
            variant="outlined"
            startIcon={<RefreshRounded />}
            onClick={() => load(filters, page)}
          >
            تحديث
          </Button>
        }
      />
      <FilterPanel resultCount={total} onApply={applyFilters} onReset={resetFilters}>
        <Field label="نوع العملية">
          <TextField
            value={filters.actionType}
            onChange={(event) =>
              setFilters((value) => ({ ...value, actionType: event.target.value }))
            }
            placeholder="مثال: PRODUCT_UPDATE"
          />
        </Field>
        <Field label="نوع الكيان">
          <TextField
            value={filters.entityType}
            onChange={(event) =>
              setFilters((value) => ({ ...value, entityType: event.target.value }))
            }
            placeholder="مثال: products"
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
          <DataTable columns={columns} rows={rows} mobilePrimary={(row) => row.action_type} />
        )}
        {!loading && total > PAGE_SIZE && (
          <div className="data-pagination">
            <Pagination count={pageCount} page={page} onChange={changePage} color="primary" />
            <span>{total} عملية</span>
          </div>
        )}
      </section>
    </div>
  );
}

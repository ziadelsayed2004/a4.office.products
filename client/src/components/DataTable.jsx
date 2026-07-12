import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
} from '@mui/material';
import { EmptyState } from './EmptyState.jsx';
import './DataTable.css';

function getCellContent(column, row, index, mobile = false) {
  if (mobile && column.mobileRender) return column.mobileRender(row, index);
  if (column.render) return column.render(row, index);
  return row[column.key] ?? '—';
}

export function DataTable({
  columns,
  rows = [],
  rowKey = 'id',
  emptyTitle,
  emptyDescription,
  mobilePrimary,
}) {
  if (!rows.length) {
    return (
      <div className="data-table-empty">
        <EmptyState title={emptyTitle} description={emptyDescription} />
      </div>
    );
  }

  const actionColumn = columns.find((column) => column.key === 'actions');

  return (
    <>
      <TableContainer className="desktop-table" dir="rtl">
        <Table size="small" aria-label="جدول البيانات">
          <TableHead>
            <TableRow>
              {columns.map((column) => (
                <TableCell
                  key={column.key}
                  align={column.align || 'right'}
                  sx={column.width ? { width: column.width } : undefined}
                >
                  {column.label}
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((row, index) => (
              <TableRow hover key={row[rowKey] ?? index}>
                {columns.map((column) => (
                  <TableCell key={column.key} align={column.align || 'right'}>
                    {getCellContent(column, row, index)}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      <div className="mobile-record-list">
        {rows.map((row, index) => (
          <article className="mobile-record-card" key={row[rowKey] ?? index}>
            <div className="mobile-record-card__head">
              <strong>
                {mobilePrimary
                  ? mobilePrimary(row)
                  : row.name || row.title || `سجل ${index + 1}`}
              </strong>
              {actionColumn?.render?.(row, index)}
            </div>
            <div className="mobile-record-card__grid">
              {columns
                .filter((column) => column.key !== 'actions')
                .slice(0, 6)
                .map((column) => (
                  <div className="mobile-record-card__item" key={column.key}>
                    <span>{column.label}</span>
                    <strong>{getCellContent(column, row, index, true)}</strong>
                  </div>
                ))}
            </div>
          </article>
        ))}
      </div>
    </>
  );
}

export default DataTable;

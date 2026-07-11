import { Table, TableBody, TableCell, TableContainer, TableHead, TableRow } from '@mui/material';
import { EmptyState } from '../feedback/EmptyState.jsx';

export function DataTable({ columns, rows = [], rowKey = 'id', emptyTitle, emptyDescription, mobilePrimary }) {
  if (!rows.length) return <div className="data-table-empty"><EmptyState title={emptyTitle} description={emptyDescription}/></div>;
  return <>
    <TableContainer className="desktop-table"><Table size="small"><TableHead><TableRow>{columns.map((col) => <TableCell key={col.key} align={col.align || 'right'} sx={col.width ? { width: col.width } : undefined}>{col.label}</TableCell>)}</TableRow></TableHead><TableBody>{rows.map((row, index) => <TableRow hover key={row[rowKey] ?? index}>{columns.map((col) => <TableCell key={col.key} align={col.align || 'right'}>{col.render ? col.render(row, index) : row[col.key] ?? '—'}</TableCell>)}</TableRow>)}</TableBody></Table></TableContainer>
    <div className="mobile-record-list">{rows.map((row, index) => <article className="mobile-record-card" key={row[rowKey] ?? index}><div className="mobile-record-card__head"><strong>{mobilePrimary ? mobilePrimary(row) : row.name || row.title || `سجل ${index + 1}`}</strong>{columns.find(c => c.key === 'actions')?.render?.(row, index)}</div><div className="mobile-record-card__grid">{columns.filter(c => c.key !== 'actions').slice(0, 6).map((col) => <div className="mobile-record-card__item" key={col.key}><span>{col.label}</span><strong>{col.mobileRender ? col.mobileRender(row,index) : col.render ? col.render(row,index) : row[col.key] ?? '—'}</strong></div>)}</div></article>)}</div>
  </>;
}

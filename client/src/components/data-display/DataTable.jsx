import React from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  TablePagination,
  Box
} from '@mui/material';
import LoadingState from '../feedback/LoadingState.jsx';
import EmptyState from '../feedback/EmptyState.jsx';
import { useLanguage } from '../../i18n/config.js';

export const DataTable = ({
  columns,
  rows,
  loading = false,
  emptyTitle,
  emptyDescription,
  pagination,
  rowActions,
  mobileRenderer,
  ...props
}) => {
  const { t, dir } = useLanguage();

  if (loading) {
    return <LoadingState type="table" cols={columns.length} />;
  }

  if (!rows || rows.length === 0) {
    return <EmptyState title={emptyTitle} description={emptyDescription} />;
  }

  return (
    <Box sx={{ width: '100%' }}>
      {/* Mobile Card Grid representation if mobileRenderer is provided */}
      {mobileRenderer && (
        <Box sx={{ display: { xs: 'flex', md: 'none' }, flexDirection: 'column', gap: 1.5, mb: 2 }}>
          {rows.map((row, idx) => (
            <Box key={row.id || idx}>
              {mobileRenderer(row)}
            </Box>
          ))}
        </Box>
      )}

      {/* Responsive Desktop Table container */}
      <TableContainer
        component={Paper}
        variant="outlined"
        sx={{
          display: mobileRenderer ? { xs: 'none', md: 'block' } : 'block',
          width: '100%',
          overflowX: 'auto',
          borderRadius: 1,
          borderColor: 'divider',
          mb: 1
        }}
      >
        <Table size="small" {...props}>
          <TableHead>
            <TableRow sx={{ backgroundColor: 'background.default' }}>
              {columns.map((col) => (
                <TableCell
                  key={col.id}
                  align={col.align || (dir === 'rtl' ? 'right' : 'left')}
                  sx={{
                    fontWeight: 700,
                    fontFamily: 'Cairo',
                    color: 'text.secondary',
                    fontSize: '0.8rem',
                    py: 1.5
                  }}
                >
                  {col.label}
                </TableCell>
              ))}
              {rowActions && (
                <TableCell
                  align="center"
                  sx={{
                    fontWeight: 700,
                    fontFamily: 'Cairo',
                    color: 'text.secondary',
                    fontSize: '0.8rem',
                    py: 1.5
                  }}
                >
                  {t('common.actions')}
                </TableCell>
              )}
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((row, rIdx) => (
              <TableRow key={row.id || rIdx} hover sx={{ '&:last-child td, &:last-child th': { border: 0 } }}>
                {columns.map((col) => {
                  const cellValue = row[col.id];
                  return (
                    <TableCell
                      key={col.id}
                      align={col.align || (dir === 'rtl' ? 'right' : 'left')}
                      sx={{
                        fontFamily: 'Cairo',
                        fontSize: '0.825rem',
                        py: 1.25
                      }}
                    >
                      {col.render ? col.render(row) : cellValue}
                    </TableCell>
                  );
                })}
                {rowActions && (
                  <TableCell align="center" sx={{ py: 1 }}>
                    <Box sx={{ display: 'flex', gap: 1, justifyContent: 'center', alignItems: 'center' }}>
                      {rowActions(row)}
                    </Box>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      {pagination && (
        <TablePagination
          component="div"
          rowsPerPageOptions={[5, 10, 25, 50]}
          labelRowsPerPage="سجل لكل صفحة:"
          labelDisplayedRows={({ from, to, count }) => `${from}-${to} من ${count}`}
          sx={{
            fontFamily: 'Cairo',
            fontSize: '0.8rem',
            borderTop: 'none',
            '& .MuiTablePagination-toolbar': {
              flexDirection: dir === 'rtl' ? 'row-reverse' : 'row'
            }
          }}
          {...pagination}
        />
      )}
    </Box>
  );
};

export default DataTable;

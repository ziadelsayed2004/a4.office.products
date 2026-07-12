import { Children, cloneElement, isValidElement, useState } from 'react';
import { Button, Collapse, IconButton, Tooltip } from '@mui/material';
import { ExpandLess, ExpandMore, FilterAltRounded, RestartAltRounded, SearchRounded } from '@mui/icons-material';
import { Field } from './Field.jsx';

export function FilterPanel({ children, onApply, onReset, resultCount, defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen);
  const compactChildren = Children.map(children, (child) => (
    isValidElement(child) && child.type === Field
      ? cloneElement(child, { density: child.props.density || 'compact' })
      : child
  ));

  return (
    <section className={`filter-panel ${open ? 'is-open' : ''}`}>
      <header className="filter-panel__head">
        <div className="filter-panel__title">
          <FilterAltRounded fontSize="small" />
          <span>خيارات التصفية والبحث</span>
          {resultCount !== undefined && <span className="filter-panel__count">تم العثور على {resultCount} سجل</span>}
        </div>
        <Tooltip title={open ? 'طي الفلاتر' : 'عرض الفلاتر'}>
          <IconButton size="small" onClick={() => setOpen((value) => !value)} aria-expanded={open}>
            {open ? <ExpandLess /> : <ExpandMore />}
          </IconButton>
        </Tooltip>
      </header>
      <Collapse in={open}>
        <div className="filter-panel__body">
          <div className="a4-filter-grid">
            {compactChildren}
            <div className="filter-panel__actions">
              <Button variant="contained" startIcon={<SearchRounded />} onClick={onApply}>تطبيق</Button>
              <Button variant="outlined" startIcon={<RestartAltRounded />} onClick={onReset}>إعادة ضبط</Button>
            </div>
          </div>
        </div>
      </Collapse>
    </section>
  );
}

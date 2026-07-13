import { Children, cloneElement, isValidElement, useId, useState } from 'react';
import { Button, Collapse, IconButton, Tooltip } from '@mui/material';
import {
  ExpandLess,
  ExpandMore,
  FilterAltRounded,
  RestartAltRounded,
  SearchRounded,
} from '@mui/icons-material';
import { Field } from './forms/Field.jsx';
import './FilterPanel.css';

export function FilterPanel({ children, onApply, onReset, resultCount, defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen);
  const panelId = `filter-panel-${useId().replace(/:/g, '')}`;
  const compactChildren = Children.map(children, (child) =>
    isValidElement(child) && child.type === Field
      ? cloneElement(child, { density: child.props.density || 'compact' })
      : child
  );

  return (
    <section className={`filter-panel ${open ? 'is-open' : ''}`}>
      <header className="filter-panel__head">
        <div className="filter-panel__title">
          <FilterAltRounded fontSize="small" aria-hidden="true" />
          <span>خيارات التصفية والبحث</span>
          {resultCount !== undefined && (
            <span className="filter-panel__count">تم العثور على {resultCount} سجل</span>
          )}
        </div>
        <Tooltip title={open ? 'طي الفلاتر' : 'عرض الفلاتر'}>
          <IconButton
            type="button"
            size="small"
            onClick={() => setOpen((value) => !value)}
            aria-expanded={open}
            aria-controls={panelId}
            aria-label={open ? 'طي خيارات التصفية' : 'عرض خيارات التصفية'}
          >
            {open ? <ExpandLess /> : <ExpandMore />}
          </IconButton>
        </Tooltip>
      </header>
      <Collapse in={open}>
        <div id={panelId} className="filter-panel__body">
          <div className="a4-filter-grid">
            {compactChildren}
            <div className="filter-panel__actions">
              <Button
                type="button"
                variant="contained"
                startIcon={<SearchRounded />}
                onClick={onApply}
              >
                تطبيق
              </Button>
              <Button
                type="button"
                variant="outlined"
                startIcon={<RestartAltRounded />}
                onClick={onReset}
              >
                إعادة ضبط
              </Button>
            </div>
          </div>
        </div>
      </Collapse>
    </section>
  );
}

export default FilterPanel;

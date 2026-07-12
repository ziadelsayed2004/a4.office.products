import { useId } from 'react';
import { Button, Drawer, IconButton, LinearProgress } from '@mui/material';
import { CloseRounded, SaveRounded } from '@mui/icons-material';
import './EntityDrawer.css';

export function EntityDrawer({
  open,
  title,
  subtitle,
  children,
  onClose,
  onSubmit,
  submitLabel = 'حفظ',
  loading = false,
  wide = false,
}) {
  const instanceId = useId().replace(/:/g, '');
  const titleId = `entity-drawer-title-${instanceId}`;
  const subtitleId = `entity-drawer-subtitle-${instanceId}`;
  const sizeClass = wide ? 'entity-drawer__paper--wide' : 'entity-drawer__paper--default';

  return (
    <Drawer
      className="entity-drawer"
      // MUI mirrors horizontal anchors under RTL; "left" is the physical right edge here.
      anchor="left"
      open={open}
      onClose={loading ? undefined : onClose}
      slotProps={{
        paper: {
          className: `entity-drawer__paper ${sizeClass}`,
          'aria-labelledby': titleId,
          'aria-describedby': subtitle ? subtitleId : undefined,
          'aria-busy': loading || undefined,
        },
      }}
    >
      <header className="entity-drawer__header">
        <div className="entity-drawer__title">
          <strong id={titleId}>{title}</strong>
          {subtitle && <span id={subtitleId}>{subtitle}</span>}
        </div>
        <IconButton
          type="button"
          className="entity-drawer__close"
          aria-label="إغلاق النافذة"
          onClick={onClose}
          disabled={loading}
        >
          <CloseRounded />
        </IconButton>
      </header>

      {loading && (
        <LinearProgress
          className="entity-drawer__progress"
          aria-label="جاري تنفيذ العملية"
        />
      )}

      <div className="entity-drawer__body">{children}</div>

      <footer className="entity-drawer__footer">
        <Button type="button" variant="outlined" onClick={onClose} disabled={loading}>
          إلغاء
        </Button>
        {onSubmit && (
          <Button
            type="button"
            variant="contained"
            startIcon={<SaveRounded />}
            onClick={onSubmit}
            disabled={loading}
          >
            {loading ? 'جاري الحفظ...' : submitLabel}
          </Button>
        )}
      </footer>
    </Drawer>
  );
}

export default EntityDrawer;

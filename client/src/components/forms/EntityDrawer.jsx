import { Button, Drawer, IconButton } from '@mui/material';
import { CloseRounded, SaveRounded } from '@mui/icons-material';

export function EntityDrawer({ open, title, subtitle, children, onClose, onSubmit, submitLabel = 'حفظ', loading = false, wide = false }) {
  return <Drawer className="entity-drawer" anchor="left" open={open} onClose={loading ? undefined : onClose} slotProps={wide ? { paper: { sx: { width: 'min(820px, 100vw) !important' } } } : undefined}>
    <header className="entity-drawer__header"><div className="entity-drawer__title"><strong>{title}</strong>{subtitle && <span>{subtitle}</span>}</div><IconButton onClick={onClose} disabled={loading}><CloseRounded/></IconButton></header>
    <div className="entity-drawer__body">{children}</div>
    <footer className="entity-drawer__footer"><Button variant="outlined" onClick={onClose} disabled={loading}>إلغاء</Button>{onSubmit && <Button variant="contained" startIcon={<SaveRounded/>} onClick={onSubmit} disabled={loading}>{loading ? 'جاري الحفظ...' : submitLabel}</Button>}</footer>
  </Drawer>;
}

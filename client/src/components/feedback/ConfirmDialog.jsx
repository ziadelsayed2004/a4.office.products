import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';

export function ConfirmDialog({
  open,
  title = 'تأكيد الإجراء',
  description,
  confirmLabel = 'تأكيد',
  cancelLabel = 'إلغاء',
  danger = false,
  loading = false,
  onConfirm,
  onClose,
}) {
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down('sm'));

  return (
    <Dialog open={open} onClose={loading ? undefined : onClose} fullScreen={fullScreen} fullWidth maxWidth="xs">
      <DialogTitle>{title}</DialogTitle>
      <DialogContent dividers>
        {typeof description === 'string'
          ? <Typography color="text.secondary">{description}</Typography>
          : description}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={loading}>{cancelLabel}</Button>
        <Button variant="contained" color={danger ? 'error' : 'primary'} onClick={onConfirm} disabled={loading}>
          {loading ? 'جاري التنفيذ...' : confirmLabel}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

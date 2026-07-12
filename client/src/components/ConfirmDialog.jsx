import { useId } from 'react';
import {
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Typography,
} from '@mui/material';
import './ConfirmDialog.css';

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
  const instanceId = useId().replace(/:/g, '');
  const titleId = `confirm-dialog-title-${instanceId}`;
  const descriptionId = `confirm-dialog-description-${instanceId}`;

  return (
    <Dialog
      open={open}
      onClose={loading ? undefined : onClose}
      disableEscapeKeyDown={loading}
      fullWidth
      maxWidth={false}
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
      slotProps={{
        paper: {
          className: 'confirm-dialog',
          'aria-busy': loading || undefined,
        },
      }}
    >
      <DialogTitle id={titleId} className="confirm-dialog__title">
        {title}
      </DialogTitle>
      <DialogContent id={descriptionId} className="confirm-dialog__content">
        {typeof description === 'string'
          ? <Typography color="text.secondary">{description}</Typography>
          : description}
      </DialogContent>
      <DialogActions className="confirm-dialog__actions">
        <Button type="button" variant="outlined" onClick={onClose} disabled={loading}>
          {cancelLabel}
        </Button>
        <Button
          type="button"
          variant="contained"
          color={danger ? 'error' : 'primary'}
          onClick={onConfirm}
          disabled={loading}
          autoFocus={!loading}
        >
          {loading && <CircularProgress className="confirm-dialog__progress" size={16} color="inherit" />}
          {loading ? 'جاري التنفيذ...' : confirmLabel}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default ConfirmDialog;

import React from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, Typography, Box } from '@mui/material';
import { useLanguage } from '../../i18n/config.js';

export const ConfirmDialog = ({
  open,
  onClose,
  onConfirm,
  title,
  message,
  confirmText,
  cancelText,
  severity = 'primary'
}) => {
  const { t, dir } = useLanguage();

  const getButtonColor = () => {
    if (severity === 'error') return 'error';
    if (severity === 'warning') return 'warning';
    if (severity === 'success') return 'success';
    return 'primary';
  };

  const resolvedConfirmText = confirmText || t('common.confirm');
  const resolvedCancelText = cancelText || t('common.cancel');

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="xs"
      sx={{
        '& .MuiPaper-root': {
          borderRadius: 1,
          p: 1
        }
      }}
    >
      <DialogTitle sx={{ fontFamily: 'Cairo', fontWeight: 700, fontSize: '1.1rem', pb: 1, textAlign: dir === 'rtl' ? 'right' : 'left' }}>
        {title}
      </DialogTitle>
      <DialogContent sx={{ pb: 2 }}>
        <Typography variant="body2" sx={{ fontFamily: 'Cairo', color: 'text.secondary', textAlign: dir === 'rtl' ? 'right' : 'left' }}>
          {message}
        </Typography>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2, gap: 1, justifyContent: dir === 'rtl' ? 'flex-start' : 'flex-end' }}>
        <Button onClick={onClose} variant="outlined" color="inherit" sx={{ fontFamily: 'Cairo', fontSize: '0.85rem' }}>
          {resolvedCancelText}
        </Button>
        <Button onClick={onConfirm} variant="contained" color={getButtonColor()} autoFocus sx={{ fontFamily: 'Cairo', fontSize: '0.85rem' }}>
          {resolvedConfirmText}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ConfirmDialog;

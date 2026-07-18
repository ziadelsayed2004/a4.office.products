import { Alert, IconButton, Snackbar, Tooltip } from '@mui/material';
import { CloseRounded } from '@mui/icons-material';
import './AppSnackbar.css';

export function AppSnackbar({ state, onClose }) {
  const closeSnackbar = (event, reason) => {
    if (reason === 'clickaway') return;
    onClose?.(event, reason);
  };

  return (
    <Snackbar
      className="app-snackbar"
      open={Boolean(state?.message)}
      autoHideDuration={3500}
      onClose={closeSnackbar}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
    >
      <Alert
        className="app-snackbar__alert"
        severity={state?.severity || 'success'}
        variant="filled"
        action={
          <Tooltip title="إغلاق" placement="top">
            <IconButton
              className="app-snackbar__close"
              size="small"
              color="inherit"
              onClick={closeSnackbar}
              aria-label="إغلاق التنبيه"
            >
              <CloseRounded fontSize="small" />
            </IconButton>
          </Tooltip>
        }
      >
        <span className="app-snackbar__message">{state?.message}</span>
      </Alert>
    </Snackbar>
  );
}

export default AppSnackbar;

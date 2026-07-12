import { Alert, Snackbar } from '@mui/material';
import './AppSnackbar.css';

export function AppSnackbar({ state, onClose }) {
  return (
    <Snackbar
      className="app-snackbar"
      open={Boolean(state?.message)}
      autoHideDuration={3500}
      onClose={onClose}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
    >
      <Alert
        className="app-snackbar__alert"
        onClose={onClose}
        severity={state?.severity || 'success'}
        variant="filled"
      >
        {state?.message}
      </Alert>
    </Snackbar>
  );
}

export default AppSnackbar;

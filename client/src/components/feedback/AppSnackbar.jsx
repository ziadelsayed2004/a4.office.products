import { Alert, Snackbar } from '@mui/material';
export function AppSnackbar({ state, onClose }) { return <Snackbar open={Boolean(state?.message)} autoHideDuration={3500} onClose={onClose} anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}><Alert onClose={onClose} severity={state?.severity || 'success'} variant="filled">{state?.message}</Alert></Snackbar>; }

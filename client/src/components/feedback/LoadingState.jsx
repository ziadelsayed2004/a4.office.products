import { CircularProgress, Stack, Typography } from '@mui/material';

export function LoadingState({ label = 'جاري تحميل البيانات...' }) {
  return (
    <div className="loading-state" role="status" aria-live="polite">
      <Stack spacing={1.5} sx={{ alignItems: 'center' }}>
        <CircularProgress size={30} />
        <Typography variant="body2" color="text.secondary">{label}</Typography>
      </Stack>
    </div>
  );
}

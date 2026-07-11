import { CircularProgress, Stack, Typography } from '@mui/material';
export function LoadingState({ label = 'جاري تحميل البيانات...' }) { return <div className="loading-state"><Stack alignItems="center" spacing={1.5}><CircularProgress size={30}/><Typography variant="body2" color="text.secondary">{label}</Typography></Stack></div>; }

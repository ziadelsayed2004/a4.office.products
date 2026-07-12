import { CircularProgress } from '@mui/material';
import './LoadingState.css';

export function LoadingState({ label = 'جاري تحميل البيانات...' }) {
  return (
    <div className="loading-state" role="status" aria-live="polite">
      <CircularProgress className="loading-state__progress" size={30} />
      <span className="loading-state__label">{label}</span>
    </div>
  );
}

export default LoadingState;

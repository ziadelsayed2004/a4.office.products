import { Chip } from '@mui/material';
import { statusLabel } from '../utils/formatters.js';
import './StatusChip.css';

const colors = {
  OPEN: 'success',
  CLOSED: 'default',
  PENDING_ADMIN_REVIEW: 'warning',
  DEPOSIT_PAID_WAITING_STOCK: 'warning',
  READY_FOR_PICKUP: 'info',
  PICKED_UP: 'success',
  CANCELLED: 'error',
  EXPIRED: 'default',
  active: 'success',
  inactive: 'default',
  warning: 'warning',
};

export function StatusChip({ status, label }) {
  return (
    <Chip
      className="status-chip"
      size="small"
      variant="outlined"
      color={colors[status] || 'default'}
      label={label || statusLabel(status)}
    />
  );
}

export default StatusChip;

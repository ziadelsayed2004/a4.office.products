import React from 'react';
import { Chip } from '@mui/material';
import { useLanguage } from '../../i18n/config.js';

export const StatusChip = ({ status, size = 'small', ...props }) => {
  const { t } = useLanguage();

  // Normalize status value
  const val = String(status).toUpperCase();

  let label = status;
  let color = 'default';

  if (val === '1' || val === 'ACTIVE' || val === 'OPEN' || val === 'SUCCESS' || val === 'PAID') {
    label = val === '1' || val === 'ACTIVE' ? t('common.active') : val === 'OPEN' ? 'مفتوحة' : val === 'PAID' ? 'مدفوع' : t('common.success');
    color = 'success';
  } else if (val === '0' || val === 'DISABLED' || val === 'INACTIVE' || val === 'CLOSED' || val === 'CANCELLED' || val === 'UNPAID') {
    label = val === '0' || val === 'DISABLED' || val === 'INACTIVE' ? t('common.disabled') : val === 'CLOSED' ? 'مغلقة' : val === 'CANCELLED' ? 'ملغي' : 'غير مدفوع';
    color = 'error';
  } else if (val === 'PENDING' || val === 'CLOSE_REQUESTED' || val === 'PARTIALLY_PAID') {
    label = val === 'PENDING' ? 'معلق' : val === 'CLOSE_REQUESTED' ? 'بانتظار الإغلاق' : 'مدفوع جزئياً';
    color = 'warning';
  }

  return (
    <Chip
      label={label}
      color={color}
      size={size}
      sx={{
        fontFamily: 'Cairo',
        fontWeight: 'bold',
        fontSize: '0.75rem',
        borderRadius: '4px' // Sharp subtle border radius
      }}
      {...props}
    />
  );
};

export default StatusChip;

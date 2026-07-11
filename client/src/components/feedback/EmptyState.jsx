import React from 'react';
import { Box, Typography, Button, Paper } from '@mui/material';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import './EmptyState.css';

export const EmptyState = ({
  title = 'لا توجد بيانات',
  description = 'لم نتمكن من العثور على أي سجلات مطابقة للبحث أو الفرز الحالي.',
  icon = <InfoOutlinedIcon className="empty-state__icon" />,
  actionLabel,
  onAction,
}) => {
  return (
    <Paper
      elevation={0}
      className="empty-state"
      sx={{
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: 1,
        p: 4,
        textAlign: 'center',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'background.paper',
        minHeight: '200px'
      }}
    >
      <Box className="empty-state__icon-container" sx={{ color: 'text.secondary', mb: 1.5 }}>
        {icon}
      </Box>
      <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 0.5, fontFamily: 'Cairo' }}>
        {title}
      </Typography>
      <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2, fontFamily: 'Cairo', maxWidth: '360px' }}>
        {description}
      </Typography>
      {actionLabel && onAction && (
        <Button
          variant="contained"
          onClick={onAction}
          sx={{ fontFamily: 'Cairo' }}
        >
          {actionLabel}
        </Button>
      )}
    </Paper>
  );
};

export default EmptyState;

import React from 'react';
import { Paper, Box, Typography } from '@mui/material';
import { useLanguage } from '../../i18n/config.js';

export const KpiCard = ({
  title,
  titleKey,
  value,
  secondaryText,
  icon,
  iconBgColor = 'primary.main',
  loading = false
}) => {
  const { t, dir } = useLanguage();

  const renderedTitle = titleKey ? t(titleKey) : title;

  return (
    <Paper
      variant="outlined"
      sx={{
        p: 2,
        borderRadius: 1,
        borderColor: 'divider',
        backgroundColor: 'background.paper',
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        justifyContent: 'center',
        position: 'relative',
        overflow: 'hidden'
      }}
    >
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
        <Typography
          variant="subtitle2"
          sx={{
            color: 'text.secondary',
            fontWeight: 500,
            fontSize: '0.8rem',
            fontFamily: 'Cairo',
            lineHeight: 1.4
          }}
        >
          {renderedTitle}
        </Typography>

        {icon && (
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 36,
              height: 36,
              borderRadius: '4px',
              backgroundColor: iconBgColor,
              color: 'white',
              opacity: 0.9,
              flexShrink: 0
            }}
          >
            {icon}
          </Box>
        )}
      </Box>

      <Typography
        variant="h4"
        sx={{
          fontWeight: 700,
          color: 'text.primary',
          fontSize: { xs: '1.5rem', md: '1.75rem' },
          fontFamily: 'Cairo',
          my: 0.5,
          textAlign: dir === 'rtl' ? 'right' : 'left'
        }}
      >
        {value}
      </Typography>

      {secondaryText && (
        <Typography
          variant="caption"
          sx={{
            color: 'text.secondary',
            fontSize: '0.75rem',
            fontFamily: 'Cairo',
            display: 'block',
            textAlign: dir === 'rtl' ? 'right' : 'left'
          }}
        >
          {secondaryText}
        </Typography>
      )}
    </Paper>
  );
};

export default KpiCard;

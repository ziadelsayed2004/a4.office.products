import React from 'react';
import { Box, Typography } from '@mui/material';
import Breadcrumbs from './Breadcrumbs.jsx';
import { useLanguage } from '../../i18n/config.js';

export const PageHeader = ({
  title,
  titleKey,
  description,
  descriptionKey,
  actions,
  status,
  showBreadcrumbs = true
}) => {
  const { t, dir } = useLanguage();

  const renderedTitle = titleKey ? t(titleKey) : title;
  const renderedDescription = descriptionKey ? t(descriptionKey) : description;

  return (
    <Box sx={{ mb: 3, width: '100%' }}>
      {showBreadcrumbs && <Breadcrumbs />}

      <Box
        sx={{
          display: 'flex',
          flexDirection: { xs: 'column', sm: 'row' },
          justifyContent: 'space-between',
          alignItems: { xs: 'flex-start', sm: 'center' },
          gap: 2,
          mt: 1
        }}
      >
        <Box sx={{ textAlign: dir === 'rtl' ? 'right' : 'left' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
            <Typography
              variant="h5"
              component="h1"
              sx={{
                fontWeight: 700,
                color: 'text.primary',
                fontFamily: 'Cairo',
                fontSize: { xs: '1.25rem', md: '1.5rem' }
              }}
            >
              {renderedTitle}
            </Typography>
            {status}
          </Box>
          {renderedDescription && (
            <Typography
              variant="body2"
              sx={{
                color: 'text.secondary',
                mt: 0.5,
                fontFamily: 'Cairo',
                fontSize: '0.825rem'
              }}
            >
              {renderedDescription}
            </Typography>
          )}
        </Box>

        {actions && (
          <Box
            sx={{
              display: 'flex',
              gap: 1.5,
              alignItems: 'center',
              width: { xs: '100%', sm: 'auto' },
              justifyContent: { xs: 'stretch', sm: 'flex-end' },
              '& > button': {
                width: { xs: '100%', sm: 'auto' }
              }
            }}
          >
            {actions}
          </Box>
        )}
      </Box>
    </Box>
  );
};

export default PageHeader;

import React from 'react';
import { Box, Skeleton, CircularProgress, Typography } from '@mui/material';

export const LoadingState = ({
  type = 'table', // 'table' | 'cards' | 'spinner'
  rows = 5,
  cols = 4,
  message = 'جاري تحميل البيانات...'
}) => {
  if (type === 'spinner') {
    return (
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          p: 5,
          minHeight: '200px'
        }}
      >
        <CircularProgress sx={{ mb: 2 }} />
        <Typography variant="body2" sx={{ color: 'text.secondary', fontFamily: 'Cairo' }}>
          {message}
        </Typography>
      </Box>
    );
  }

  if (type === 'cards') {
    return (
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 2, width: '100%' }}>
        {Array.from(new Array(rows)).map((_, idx) => (
          <Box
            key={idx}
            sx={{
              p: 2,
              border: '1px solid',
              borderColor: 'divider',
              borderRadius: 1,
              backgroundColor: 'background.paper'
            }}
          >
            <Skeleton variant="text" sx={{ fontSize: '1rem', width: '60%', mb: 1 }} />
            <Skeleton variant="rectangular" height={32} sx={{ width: '40%', mb: 1 }} />
            <Skeleton variant="text" sx={{ fontSize: '0.75rem', width: '80%' }} />
          </Box>
        ))}
      </Box>
    );
  }

  // 'table' skeleton format
  return (
    <Box sx={{ width: '100%' }}>
      <Skeleton variant="rectangular" height={40} sx={{ width: '100%', mb: 1, borderRadius: 0.5 }} />
      {Array.from(new Array(rows)).map((_, rIdx) => (
        <Box
          key={rIdx}
          sx={{
            display: 'flex',
            gap: 2,
            mb: 1,
            py: 1,
            borderBottom: '1px solid',
            borderColor: 'divider'
          }}
        >
          {Array.from(new Array(cols)).map((_, cIdx) => (
            <Skeleton
              key={cIdx}
              variant="text"
              sx={{ flexGrow: 1, height: 28, width: cIdx === 0 ? '20%' : 'auto' }}
            />
          ))}
        </Box>
      ))}
    </Box>
  );
};

export default LoadingState;

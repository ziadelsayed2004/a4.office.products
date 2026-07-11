import React, { useState } from 'react';
import { Box, Button, Collapse, Typography, Card } from '@mui/material';
import FilterAltIcon from '@mui/icons-material/FilterAlt';
import FilterAltOffIcon from '@mui/icons-material/FilterAltOff';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import { useLanguage } from '../../i18n/config.js';

export const FilterPanel = ({
  onApply,
  onReset,
  children,
  resultCount,
  defaultExpanded = true
}) => {
  const { t } = useLanguage();
  const [expanded, setExpanded] = useState(defaultExpanded);

  return (
    <Card
      variant="outlined"
      sx={{
        p: 2,
        mb: 3,
        borderRadius: 1,
        borderColor: 'divider',
        backgroundColor: 'background.paper',
        width: '100%'
      }}
    >
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          cursor: 'pointer',
          userSelect: 'none'
        }}
        onClick={() => setExpanded(!expanded)}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <FilterAltIcon sx={{ color: 'text.secondary', fontSize: 20 }} />
          <Typography variant="subtitle2" sx={{ fontWeight: 600, fontFamily: 'Cairo', fontSize: '0.85rem' }}>
            خيارات التصفية والبحث
          </Typography>
          {resultCount !== undefined && (
            <Typography
              variant="caption"
              sx={{
                px: 1,
                py: 0.25,
                backgroundColor: 'action.hover',
                borderRadius: '4px',
                color: 'text.secondary',
                fontWeight: 600,
                fontSize: '0.75rem',
                fontFamily: 'Cairo'
              }}
            >
              تم العثور على {resultCount} سجل
            </Typography>
          )}
        </Box>
        {expanded ? <KeyboardArrowUpIcon /> : <KeyboardArrowDownIcon />}
      </Box>

      <Collapse in={expanded} timeout="auto" unmountOnExit>
        <Box sx={{ mt: 2 }}>
          {/* Inner filters layout grid */}
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: {
                xs: '1fr',
                sm: 'repeat(2, 1fr)',
                md: 'repeat(3, 1fr)',
                lg: 'repeat(4, 1fr)'
              },
              gap: 2,
              mb: 2
            }}
          >
            {children}
          </Box>

          <Box sx={{ display: 'flex', gap: 1.5, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
            {onReset && (
              <Button
                variant="outlined"
                color="secondary"
                size="small"
                onClick={onReset}
                startIcon={<FilterAltOffIcon />}
                sx={{ fontFamily: 'Cairo', fontSize: '0.8rem', minHeight: 36 }}
              >
                إعادة ضبط
              </Button>
            )}
            {onApply && (
              <Button
                variant="contained"
                size="small"
                onClick={onApply}
                startIcon={<FilterAltIcon />}
                sx={{ fontFamily: 'Cairo', fontSize: '0.8rem', minHeight: 36 }}
              >
                تطبيق الفلتر
              </Button>
            )}
          </Box>
        </Box>
      </Collapse>
    </Card>
  );
};

export default FilterPanel;

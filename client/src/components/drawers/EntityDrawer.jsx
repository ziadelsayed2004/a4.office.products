import React from 'react';
import { Drawer, Box, Typography, IconButton, LinearProgress, Alert } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { useLanguage } from '../../i18n/config.js';
import './EntityDrawer.css';

export const EntityDrawer = ({
  open,
  onClose,
  title,
  subtitle,
  size = 'medium', // 'small', 'medium', 'large', 'xlarge'
  loading = false,
  error = null,
  actions = null,
  anchor,
  children,
  className = ''
}) => {
  const { dir } = useLanguage();

  const defaultAnchor = dir === 'rtl' ? 'left' : 'right';
  const resolvedAnchor = anchor || defaultAnchor;

  return (
    <Drawer
      anchor={resolvedAnchor}
      open={open}
      onClose={onClose}
      slotProps={{
        paper: {
          className: `entity-drawer-paper entity-drawer-paper--${size} ${className}`,
          sx: {
            direction: dir,
            // Slide transition matching locale directions
            borderRight: resolvedAnchor === 'left' ? '1px solid' : 'none',
            borderLeft: resolvedAnchor === 'right' ? '1px solid' : 'none',
            borderColor: 'divider'
          }
        }
      }}
    >
      {/* Header */}
      <Box className="entity-drawer__header">
        <Box className="entity-drawer__header-text" sx={{ textAlign: dir === 'rtl' ? 'right' : 'left' }}>
          <Typography variant="h6" className="entity-drawer__title" sx={{ fontFamily: 'Cairo', fontWeight: 700 }}>
            {title}
          </Typography>
          {subtitle && (
            <Typography variant="caption" className="entity-drawer__subtitle" sx={{ fontFamily: 'Cairo', display: 'block', mt: 0.5 }}>
              {subtitle}
            </Typography>
          )}
        </Box>
        <IconButton onClick={onClose} size="small" className="entity-drawer__close-btn">
          <CloseIcon fontSize="small" />
        </IconButton>
      </Box>

      {/* Loading progress bar */}
      {loading && <LinearProgress color="primary" sx={{ height: 3, flexShrink: 0 }} />}

      {/* Content wrapper */}
      <Box className="entity-drawer__content">
        {error && (
          <Alert severity="error" sx={{ mb: 3, borderRadius: 1, fontFamily: 'Cairo' }}>
            {error}
          </Alert>
        )}
        {children}
      </Box>

      {/* Sticky footer actions */}
      {actions && (
        <Box className="entity-drawer__actions" sx={{ justifyContent: dir === 'rtl' ? 'flex-start' : 'flex-end', gap: 1.5 }}>
          {actions}
        </Box>
      )}
    </Drawer>
  );
};

export default EntityDrawer;

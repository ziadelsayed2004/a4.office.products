import React, { createContext, useContext, useState, useMemo, useEffect } from 'react';
import { createTheme, ThemeProvider } from '@mui/material/styles';
import rtlPlugin from 'stylis-plugin-rtl';
import { CacheProvider } from '@emotion/react';
import createCache from '@emotion/cache';
import { prefixer } from 'stylis';
import CssBaseline from '@mui/material/CssBaseline';
import './ThemeConfig.css';

// Create Emotion cache for RTL
const cacheRtl = createCache({
  key: 'muirtl',
  stylisPlugins: [prefixer, rtlPlugin],
  prepend: true,
});

export const ColorModeContext = createContext({
  toggleColorMode: () => { },
  mode: 'light'
});

export const useColorMode = () => useContext(ColorModeContext);

export const ThemeConfig = ({ children }) => {
  const [mode, setMode] = useState(() => {
    const savedMode = localStorage.getItem('themeMode');
    if (savedMode) return savedMode;
    const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    return systemPrefersDark ? 'dark' : 'light';
  });

  useEffect(() => {
    localStorage.setItem('themeMode', mode);
    document.documentElement.setAttribute('data-theme', mode);
  }, [mode]);

  const colorMode = useMemo(
    () => ({
      mode,
      toggleColorMode: () => {
        setMode((prevMode) => (prevMode === 'light' ? 'dark' : 'light'));
      },
    }),
    [mode]
  );

  const theme = useMemo(
    () =>
      createTheme({
        direction: 'rtl',
        palette: {
          mode,
          ...(mode === 'light'
            ? {
              // ── Light Mode: A4 POS Royal & Navy Blue Theme ──
              primary: {
                main: '#0f5fa6',     // Royal Blue from circle
                light: '#4287f5',
                dark: '#003d73',
                contrastText: '#ffffff',
              },
              secondary: {
                main: '#001c3d',     // Navy Blue from A letter
                light: '#1a365d',
                dark: '#000f21',
                contrastText: '#ffffff',
              },
              background: {
                default: '#f8f9fa',
                paper: '#ffffff',
              },
              text: {
                primary: '#111827',
                secondary: '#4b5563',
              },
              divider: '#e5e7eb',
            }
            : {
              // ── Dark Mode: Premium Blue & Navy Dark Theme ──
              primary: {
                main: '#3b82f6',     // Lighter blue for visibility
                light: '#60a5fa',
                dark: '#1d4ed8',
                contrastText: '#111827',
              },
              secondary: {
                main: '#9ca3af',
                light: '#d1d5db',
                dark: '#1f2937',
                contrastText: '#ffffff',
              },
              background: {
                default: '#0f172a',
                paper: '#1e293b',
              },
              text: {
                primary: '#f9fafb',
                secondary: '#9ca3af',
              },
              divider: '#334155',
            }),
        },
        typography: {
          fontFamily: [
            'Cairo',
            'Segoe UI',
            'Tahoma',
            'Geneva',
            'Verdana',
            'sans-serif',
          ].join(','),
          h1: { fontSize: '2rem', fontWeight: 800 },
          h2: { fontSize: '1.75rem', fontWeight: 700 },
          h3: { fontSize: '1.5rem', fontWeight: 700 },
          h4: { fontSize: '1.25rem', fontWeight: 600 },
          h5: { fontSize: '1.1rem', fontWeight: 600 },
          h6: { fontSize: '0.95rem', fontWeight: 600 },
          subtitle1: { fontSize: '0.9rem', fontWeight: 500 },
          subtitle2: { fontSize: '0.8rem', fontWeight: 600 },
          body1: { fontSize: '0.875rem' },
          body2: { fontSize: '0.775rem' },
          button: { textTransform: 'none', fontWeight: 600, fontSize: '0.825rem' },
        },
        shape: {
          borderRadius: 8,
        },
        components: {
          MuiCssBaseline: {
            styleOverrides: {
              body: {
                fontFamily: 'Cairo, Segoe UI, sans-serif',
              },
            },
          },
          MuiInputBase: {
            styleOverrides: {
              input: {
                textAlign: 'right',
                direction: 'rtl',
                '&.ltr-value': {
                  textAlign: 'left',
                  direction: 'ltr',
                },
              },
            },
          },
          MuiOutlinedInput: {
            styleOverrides: {
              root: {
                borderRadius: 8,
              },
            },
          },
          MuiFormLabel: {
            styleOverrides: {
              root: {
                fontFamily: 'Cairo, Segoe UI, sans-serif',
              },
            },
          },
          MuiMenuItem: {
            styleOverrides: {
              root: {
                fontFamily: 'Cairo, Segoe UI, sans-serif',
                fontSize: '0.85rem',
                fontWeight: 500,
              },
            },
          },
          MuiButton: {
            styleOverrides: {
              root: {
                borderRadius: 8,
                boxShadow: 'none',
                fontWeight: 600,
                textTransform: 'none',
                padding: '6px 16px',
                transition: 'all 0.15s ease',
                '&:hover': {
                  boxShadow: 'none',
                  backgroundColor: mode === 'light' ? 'rgba(137, 44, 220, 0.04)' : 'rgba(183, 98, 255, 0.08)',
                },
              },
              contained: {
                '&:hover': {
                  boxShadow: 'none',
                  backgroundColor: mode === 'light' ? '#6f22b8' : '#d094ff',
                },
              },
              outlined: {
                borderWidth: '1px',
                borderColor: mode === 'light' ? '#dee2e6' : '#2d2d34',
                padding: '5px 15px',
                color: mode === 'light' ? '#892cdc' : '#b762ff',
                '&:hover': {
                  borderWidth: '1px',
                  borderColor: mode === 'light' ? '#892cdc' : '#b762ff',
                  backgroundColor: mode === 'light' ? 'rgba(137, 44, 220, 0.04)' : 'rgba(183, 98, 255, 0.08)',
                },
              },
            },
          },
          MuiPaper: {
            styleOverrides: {
              root: {
                borderRadius: 8,
                backgroundImage: 'none',
              },
            },
          },
          MuiCard: {
            styleOverrides: {
              root: {
                borderRadius: 8,
                backgroundImage: 'none',
                border: mode === 'light' ? '1px solid #dee2e6' : '1px solid #2d2d34',
                boxShadow: 'none',
              },
            },
          },
          MuiAppBar: {
            styleOverrides: {
              root: {
                backgroundColor: mode === 'light' ? '#ffffff' : '#1a1a1e',
                color: mode === 'light' ? '#212529' : '#f8f9fa',
                borderBottom: mode === 'light' ? '1px solid #dee2e6' : '1px solid #2d2d34',
                boxShadow: 'none',
                borderRadius: 0,
              },
            },
          },
          MuiDrawer: {
            styleOverrides: {
              paper: {
                backgroundColor: mode === 'light' ? '#ffffff' : '#1a1a1e',
                borderRight: 'none',
                borderLeft: 'none',
                borderRadius: 0,
              },
            },
          },
          MuiListItemButton: {
            styleOverrides: {
              root: {
                borderRadius: 100,
                margin: '2px 8px',
                padding: '8px 16px',
                '&.Mui-selected': {
                  backgroundColor: mode === 'light' ? 'rgba(15, 95, 166, 0.08)' : 'rgba(59, 130, 246, 0.12)',
                  color: mode === 'light' ? '#0f5fa6' : '#3b82f6',
                  fontWeight: 700,
                  '&:hover': {
                    backgroundColor: mode === 'light' ? 'rgba(15, 95, 166, 0.12)' : 'rgba(59, 130, 246, 0.16)',
                  },
                  '& .MuiListItemIcon-root': {
                    color: mode === 'light' ? '#0f5fa6' : '#3b82f6',
                  },
                },
              },
            },
          },
          MuiChip: {
            styleOverrides: {
              root: {
                borderRadius: 4,
                fontWeight: 600,
                fontSize: '0.75rem',
                backgroundColor: mode === 'light' ? '#f1f3f4' : '#2d2d34',
                color: mode === 'light' ? '#2d2d34' : '#cbd5e0',
              },
            },
          },
          MuiTooltip: {
            styleOverrides: {
              tooltip: {
                borderRadius: 4,
                fontSize: '0.8rem',
                backgroundColor: mode === 'light' ? '#212529' : '#f8f9fa',
                color: mode === 'light' ? '#ffffff' : '#212529',
              },
            },
          },
          MuiDialog: {
            styleOverrides: {
              paper: {
                borderRadius: 8,
                padding: 12,
                boxShadow: mode === 'light'
                  ? '0 24px 38px 3px rgba(0,0,0,0.14), 0 9px 46px 8px rgba(0,0,0,0.12), 0 11px 15px -7px rgba(0,0,0,0.2)'
                  : '0 24px 38px 3px rgba(0,0,0,0.5), 0 9px 46px 8px rgba(0,0,0,0.4), 0 11px 15px -7px rgba(0,0,0,0.6)',
              },
            },
          },
          MuiTableContainer: {
            styleOverrides: {
              root: {
                borderRadius: 8,
                border: mode === 'light' ? '1px solid #dee2e6' : '1px solid #2d2d34',
                overflow: 'hidden',
                boxShadow: 'none',
              },
            },
          },
          MuiTableHead: {
            styleOverrides: {
              root: {
                backgroundColor: mode === 'light' ? '#f8f9fa' : '#2d2d34',
                '& .MuiTableCell-root': {
                  fontWeight: 700,
                  fontSize: '0.8rem',
                  color: mode === 'light' ? '#212529' : '#f8f9fa',
                  borderBottom: mode === 'light' ? '2px solid #dee2e6' : '2px solid #2d2d34',
                },
              },
            },
          },
          MuiTableCell: {
            styleOverrides: {
              root: {
                padding: '10px 16px',
                fontSize: '0.85rem',
                borderBottom: mode === 'light' ? '1px solid #dee2e6' : '1px solid #2d2d34',
              },
            },
          },
          MuiTabs: {
            styleOverrides: {
              root: {
                minHeight: 40,
                borderBottom: mode === 'light' ? '1px solid #dee2e6' : '1px solid #2d2d34',
              },
              indicator: {
                height: 3,
                backgroundColor: mode === 'light' ? '#0f5fa6' : '#3b82f6',
              },
            },
          },
          MuiTab: {
            styleOverrides: {
              root: {
                fontWeight: 600,
                fontSize: '0.85rem',
                textTransform: 'none',
                minHeight: 40,
                color: mode === 'light' ? '#4b5563' : '#9ca3af',
                '&.Mui-selected': {
                  color: mode === 'light' ? '#0f5fa6' : '#3b82f6',
                },
              },
            },
          },
        },
      }),
    [mode]
  );

  return (
    <CacheProvider value={cacheRtl}>
      <ColorModeContext.Provider value={colorMode}>
        <ThemeProvider theme={theme}>
          <CssBaseline />
          <div dir="rtl" className="theme-root">
            {children}
          </div>
        </ThemeProvider>
      </ColorModeContext.Provider>
    </CacheProvider>
  );
};

export default ThemeConfig;

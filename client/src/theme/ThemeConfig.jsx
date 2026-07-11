import React, { createContext, useContext, useState, useMemo, useEffect } from 'react';
import { createTheme, ThemeProvider } from '@mui/material/styles';
import rtlPlugin from 'stylis-plugin-rtl';
import { CacheProvider } from '@emotion/react';
import createCache from '@emotion/cache';
import { prefixer } from 'stylis';
import CssBaseline from '@mui/material/CssBaseline';
import { useLanguage } from '../i18n/config.js';
import './ThemeConfig.css';

// Create Emotion cache for RTL
const cacheRtl = createCache({
  key: 'muirtl',
  stylisPlugins: [prefixer, rtlPlugin],
  prepend: true,
});

// Create Emotion cache for LTR
const cacheLtr = createCache({
  key: 'muiltr',
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

  const { dir } = useLanguage();

  const theme = useMemo(
    () =>
      createTheme({
        direction: dir,
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
          borderRadius: 4,
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
                borderRadius: 4,
                '& fieldset': {
                  borderColor: mode === 'light' ? '#e5e7eb' : '#334155',
                },
                '&:hover fieldset': {
                  borderColor: mode === 'light' ? '#9ca3af' : '#4b5563',
                },
                '&.Mui-focused fieldset': {
                  borderColor: mode === 'light' ? '#0f5fa6' : '#3b82f6',
                  borderWidth: '2px',
                },
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
                borderRadius: 4,
                boxShadow: 'none',
                fontWeight: 600,
                textTransform: 'none',
                padding: '6px 16px',
                transition: 'all 0.15s ease',
                '&:hover': {
                  boxShadow: 'none',
                  backgroundColor: mode === 'light' ? 'rgba(15, 95, 166, 0.04)' : 'rgba(59, 130, 246, 0.08)',
                },
              },
              contained: {
                '&:hover': {
                  boxShadow: 'none',
                  backgroundColor: mode === 'light' ? '#003d73' : '#1d4ed8',
                },
              },
              outlined: {
                borderWidth: '1px',
                borderColor: mode === 'light' ? '#e5e7eb' : '#334155',
                padding: '5px 15px',
                color: mode === 'light' ? '#0f5fa6' : '#3b82f6',
                '&:hover': {
                  borderWidth: '1px',
                  borderColor: mode === 'light' ? '#0f5fa6' : '#3b82f6',
                  backgroundColor: mode === 'light' ? 'rgba(15, 95, 166, 0.04)' : 'rgba(59, 130, 246, 0.08)',
                },
              },
            },
          },
          MuiPaper: {
            styleOverrides: {
              root: {
                borderRadius: 4,
                backgroundImage: 'none',
              },
            },
          },
          MuiCard: {
            styleOverrides: {
              root: {
                borderRadius: 4,
                backgroundImage: 'none',
                border: mode === 'light' ? '1px solid #e5e7eb' : '1px solid #334155',
                boxShadow: 'none',
              },
            },
          },
          MuiAppBar: {
            styleOverrides: {
              root: {
                backgroundColor: mode === 'light' ? '#ffffff' : '#1e293b',
                color: mode === 'light' ? '#111827' : '#f9fafb',
                borderBottom: mode === 'light' ? '1px solid #e5e7eb' : '1px solid #334155',
                boxShadow: 'none',
                borderRadius: 0,
              },
            },
          },
          MuiDrawer: {
            styleOverrides: {
              paper: {
                backgroundColor: mode === 'light' ? '#ffffff' : '#1e293b',
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
                backgroundColor: mode === 'light' ? '#f3f4f6' : '#334155',
                color: mode === 'light' ? '#374151' : '#d1d5db',
              },
            },
          },
          MuiTooltip: {
            styleOverrides: {
              tooltip: {
                borderRadius: 4,
                fontSize: '0.8rem',
                backgroundColor: mode === 'light' ? '#111827' : '#f9fafb',
                color: mode === 'light' ? '#ffffff' : '#111827',
              },
            },
          },
          MuiDialog: {
            styleOverrides: {
              paper: {
                borderRadius: 4,
                padding: 4,
                boxShadow: mode === 'light'
                  ? '0 24px 38px 3px rgba(0,0,0,0.06), 0 9px 46px 8px rgba(0,0,0,0.04), 0 11px 15px -7px rgba(0,0,0,0.1)'
                  : '0 24px 38px 3px rgba(0,0,0,0.4), 0 9px 46px 8px rgba(0,0,0,0.3), 0 11px 15px -7px rgba(0,0,0,0.5)',
              },
            },
          },
          MuiDialogTitle: {
            styleOverrides: {
              root: {
                fontFamily: 'Cairo, Segoe UI, sans-serif',
                fontWeight: 700,
                fontSize: '1.15rem',
                textAlign: 'right',
                padding: '16px 24px 8px 24px',
                color: mode === 'light' ? '#111827' : '#f9fafb',
              },
            },
          },
          MuiDialogContent: {
            styleOverrides: {
              root: {
                padding: '16px 24px 20px 24px',
                fontFamily: 'Cairo, Segoe UI, sans-serif',
              },
            },
          },
          MuiDialogActions: {
            styleOverrides: {
              root: {
                padding: '8px 24px 16px 24px',
                gap: '8px',
                '& .MuiButton-root': {
                  borderRadius: 4,
                  fontFamily: 'Cairo, Segoe UI, sans-serif',
                  fontWeight: 600,
                  fontSize: '0.825rem',
                },
              },
            },
          },
          MuiTableContainer: {
            styleOverrides: {
              root: {
                borderRadius: 4,
                border: mode === 'light' ? '1px solid #e5e7eb' : '1px solid #334155',
                overflow: 'auto',
                boxShadow: 'none',
              },
            },
          },
          MuiTableHead: {
            styleOverrides: {
              root: {
                backgroundColor: mode === 'light' ? '#f9fafb' : '#1e293b',
                '& .MuiTableCell-root': {
                  fontWeight: 700,
                  fontSize: '0.8rem',
                  color: mode === 'light' ? '#111827' : '#f9fafb',
                  borderBottom: mode === 'light' ? '2px solid #e5e7eb' : '2px solid #334155',
                  textAlign: 'right',
                },
              },
            },
          },
          MuiTableCell: {
            styleOverrides: {
              root: {
                padding: '10px 16px',
                fontSize: '0.85rem',
                borderBottom: mode === 'light' ? '1px solid #e5e7eb' : '1px solid #334155',
                whiteSpace: 'nowrap',
                textAlign: 'right',
              },
            },
          },
          MuiTabs: {
            styleOverrides: {
              root: {
                minHeight: 40,
                borderBottom: mode === 'light' ? '1px solid #e5e7eb' : '1px solid #334155',
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
    [mode, dir]
  );

  return (
    <CacheProvider value={dir === 'rtl' ? cacheRtl : cacheLtr}>
      <ColorModeContext.Provider value={colorMode}>
        <ThemeProvider theme={theme}>
          <CssBaseline />
          <div dir={dir} className="theme-root">
            {children}
          </div>
        </ThemeProvider>
      </ColorModeContext.Provider>
    </CacheProvider>
  );
};

export default ThemeConfig;

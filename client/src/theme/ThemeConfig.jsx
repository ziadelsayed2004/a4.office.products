import { createContext, useCallback, useContext, useLayoutEffect, useMemo, useState } from 'react';
import { CacheProvider } from '@emotion/react';
import createCache from '@emotion/cache';
import CssBaseline from '@mui/material/CssBaseline';
import { alpha, createTheme, ThemeProvider } from '@mui/material/styles';
import { prefixer } from 'stylis';
import rtlPlugin from 'stylis-plugin-rtl';
import { APP_CONFIG } from '../config/appConfig.js';
import './ThemeConfig.css';

export const COLOR_MODE_STORAGE_KEY = APP_CONFIG.storageKeys.colorMode;

// Keep one cache instance for the lifetime of the application. Recreating it on
// render changes style insertion order and can make RTL field notches flicker.
export const rtlCache = createCache({
  key: 'muirtl',
  stylisPlugins: [prefixer, rtlPlugin],
  prepend: true,
});

const noop = () => {};

export const ColorModeContext = createContext({
  mode: 'light',
  toggleColorMode: noop,
  toggleMode: noop,
});

export function useColorMode() {
  return useContext(ColorModeContext);
}

// Compatibility hook for callers that have not moved to useColorMode yet.
export const useAppTheme = useColorMode;

const fontFamily = "Cairo, Inter, Roboto, 'Segoe UI', Tahoma, Arial, sans-serif";

const palettes = {
  light: {
    background: '#f8f9fa',
    surface: '#ffffff',
    surfaceElevated: '#ffffff',
    surfaceAlt: '#f1f3f4',
    text: '#202124',
    textMuted: '#5f6368',
    border: '#dadce0',
    borderStrong: '#bdc1c6',
    primary: '#0f5fa6',
    primaryHover: '#0b4d88',
    primarySoft: '#e8f2fb',
    success: '#188038',
    warning: '#e37400',
    danger: '#d93025',
    fieldDisabled: '#f1f3f4',
    shadowSm: '0 1px 2px rgba(32, 33, 36, 0.08)',
    shadowMd: '0 8px 24px rgba(32, 33, 36, 0.10)',
  },
  dark: {
    background: '#121212',
    surface: '#1e1e1e',
    surfaceElevated: '#242424',
    surfaceAlt: '#2a2a2a',
    text: '#e8eaed',
    textMuted: '#9aa0a6',
    border: '#3c4043',
    borderStrong: '#5f6368',
    primary: '#8ab4f8',
    primaryHover: '#aecbfa',
    primarySoft: 'rgba(138, 180, 248, 0.12)',
    success: '#81c995',
    warning: '#fdd663',
    danger: '#f28b82',
    fieldDisabled: '#252525',
    shadowSm: '0 1px 2px rgba(0, 0, 0, 0.30)',
    shadowMd: '0 10px 30px rgba(0, 0, 0, 0.32)',
  },
};

function getInitialMode() {
  if (typeof window === 'undefined') return 'light';

  try {
    const storedMode = window.localStorage.getItem(COLOR_MODE_STORAGE_KEY);
    if (storedMode === 'light' || storedMode === 'dark') return storedMode;
  } catch {
    // Storage can be unavailable in locked-down browsers; system mode still works.
  }

  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function buildTheme(mode, colors) {
  return createTheme({
    direction: 'rtl',
    palette: {
      mode,
      primary: {
        main: colors.primary,
        dark: colors.primaryHover,
        contrastText: mode === 'light' ? '#ffffff' : '#202124',
      },
      secondary: { main: colors.textMuted },
      background: { default: colors.background, paper: colors.surface },
      text: { primary: colors.text, secondary: colors.textMuted },
      divider: colors.border,
      success: { main: colors.success },
      warning: { main: colors.warning },
      error: { main: colors.danger },
      info: { main: colors.primary },
      action: {
        hover: alpha(colors.primary, mode === 'light' ? 0.05 : 0.08),
        selected: alpha(colors.primary, mode === 'light' ? 0.1 : 0.14),
        disabledBackground: colors.fieldDisabled,
      },
    },
    typography: {
      fontFamily,
      h1: { fontWeight: 700 },
      h2: { fontWeight: 700 },
      h3: { fontWeight: 600 },
      h4: { fontWeight: 600 },
      h5: { fontWeight: 600 },
      h6: { fontWeight: 600 },
      subtitle1: { fontWeight: 500 },
      subtitle2: { fontWeight: 600 },
      button: { fontWeight: 600, textTransform: 'none' },
    },
    shape: { borderRadius: 4 },
    components: {
      MuiCssBaseline: {
        styleOverrides: {
          html: { direction: 'rtl' },
          body: {
            direction: 'rtl',
            textAlign: 'right',
            backgroundColor: colors.background,
            color: colors.text,
            fontFamily,
          },
          '::selection': { backgroundColor: alpha(colors.primary, 0.24) },
        },
      },
      MuiTypography: {
        styleOverrides: { root: { direction: 'rtl', textAlign: 'inherit' } },
      },
      MuiTextField: {
        defaultProps: { fullWidth: true, variant: 'outlined', size: 'small' },
      },
      MuiFormControl: {
        defaultProps: { fullWidth: true },
        styleOverrides: { root: { minWidth: 0 } },
      },
      MuiInputBase: {
        styleOverrides: {
          root: { width: '100%', minWidth: 0, fontFamily },
          input: {
            minWidth: 0,
            direction: 'rtl',
            textAlign: 'right',
            color: colors.text,
            '&[dir="ltr"], &.ltr-value, &.a4-ltr-value': {
              direction: 'rtl',
              textAlign: 'right',
              unicodeBidi: 'plaintext',
            },
          },
        },
      },
      MuiOutlinedInput: {
        styleOverrides: {
          root: {
            minHeight: 40,
            minWidth: 0,
            borderRadius: 4,
            backgroundColor: colors.surface,
            boxShadow: 'none',
            transition: 'background-color 160ms ease',
            '& fieldset': {
              borderColor: colors.border,
              transition: 'border-color 160ms ease, border-width 160ms ease',
            },
            '&:hover fieldset': { borderColor: colors.borderStrong },
            '&.Mui-focused': { boxShadow: 'none' },
            '&.Mui-focused fieldset': { borderColor: colors.primary, borderWidth: 2 },
            '&.Mui-error fieldset': { borderColor: colors.danger },
            '&.Mui-disabled': { backgroundColor: colors.fieldDisabled },
            '&.MuiInputBase-multiline': { alignItems: 'flex-start' },
          },
          input: { minWidth: 0, padding: '8px 14px' },
          notchedOutline: { textAlign: 'right' },
        },
      },
      MuiInputLabel: {
        styleOverrides: {
          root: {
            direction: 'rtl',
            maxWidth: 'calc(100% - 34px)',
            color: colors.textMuted,
            fontFamily,
            fontWeight: 500,
            transition:
              'color 160ms ease, transform 180ms cubic-bezier(0.4, 0, 0.2, 1), max-width 180ms ease',
            '&.Mui-focused': { color: colors.primary, fontWeight: 600 },
            '&.Mui-error': { color: colors.danger },
          },
          asterisk: { color: colors.danger, marginInlineStart: 3 },
        },
      },
      MuiFormLabel: {
        styleOverrides: {
          root: {
            direction: 'rtl',
            textAlign: 'right',
            fontFamily,
            color: colors.text,
            fontWeight: 600,
          },
          asterisk: { color: colors.danger, marginInlineStart: 3 },
        },
      },
      MuiFormHelperText: {
        styleOverrides: {
          root: {
            direction: 'rtl',
            textAlign: 'right',
            margin: '5px 2px 0',
            color: colors.textMuted,
            fontFamily,
            fontSize: '0.72rem',
            lineHeight: 1.55,
          },
        },
      },
      MuiSelect: {
        styleOverrides: {
          select: {
            direction: 'rtl',
            textAlign: 'right',
            display: 'flex',
            alignItems: 'center',
            minWidth: 0,
          },
        },
      },
      MuiInputAdornment: {
        styleOverrides: {
          root: {
            color: colors.textMuted,
            flexShrink: 0,
            '& .MuiSvgIcon-root': { fontSize: '1.2rem' },
          },
        },
      },
      MuiButton: {
        defaultProps: { disableElevation: true },
        styleOverrides: {
          root: {
            borderRadius: 4,
            padding: '6px 16px',
            gap: 8,
            boxShadow: 'none',
            textTransform: 'none',
            transition: 'background-color 150ms ease, border-color 150ms ease, color 150ms ease',
            '&:hover': { boxShadow: 'none' },
          },
          startIcon: { margin: 0, display: 'inline-flex' },
          endIcon: { margin: 0, display: 'inline-flex' },
          contained: { boxShadow: 'none', '&:hover': { boxShadow: 'none' } },
          containedPrimary: {
            backgroundColor: colors.primary,
            '&:hover': { backgroundColor: colors.primaryHover },
          },
          outlined: {
            borderColor: colors.border,
            color: colors.primary,
            '&:hover': {
              borderColor: colors.primary,
              backgroundColor: alpha(colors.primary, mode === 'light' ? 0.04 : 0.08),
            },
          },
        },
      },
      MuiIconButton: {
        styleOverrides: {
          root: {
            borderRadius: '50%',
            transition: 'background-color 150ms ease, color 150ms ease',
          },
        },
      },
      MuiPaper: {
        styleOverrides: {
          root: { backgroundImage: 'none' },
          outlined: { borderColor: colors.border },
        },
      },
      MuiCard: {
        styleOverrides: {
          root: {
            borderRadius: 4,
            backgroundImage: 'none',
            border: `1px solid ${colors.border}`,
            boxShadow: 'none',
          },
        },
      },
      MuiAppBar: {
        styleOverrides: {
          root: {
            borderRadius: 0,
            backgroundColor: colors.surface,
            color: colors.text,
            borderBottom: `1px solid ${colors.border}`,
            boxShadow: 'none',
          },
        },
      },
      MuiDrawer: {
        styleOverrides: {
          paper: {
            direction: 'rtl',
            textAlign: 'right',
            backgroundColor: colors.surface,
            backgroundImage: 'none',
            borderRadius: 0,
          },
        },
      },
      MuiDialog: {
        styleOverrides: {
          paper: {
            direction: 'rtl',
            textAlign: 'right',
            borderRadius: 6,
            border: `1px solid ${colors.border}`,
            backgroundColor: colors.surface,
            backgroundImage: 'none',
            boxShadow: colors.shadowMd,
          },
        },
      },
      MuiDialogTitle: {
        styleOverrides: { root: { direction: 'rtl', textAlign: 'right', fontWeight: 700 } },
      },
      MuiDialogContent: {
        styleOverrides: { root: { direction: 'rtl', textAlign: 'right' } },
      },
      MuiDialogActions: {
        styleOverrides: { root: { direction: 'rtl', justifyContent: 'flex-start', gap: 8 } },
      },
      MuiMenu: {
        styleOverrides: {
          paper: {
            direction: 'rtl',
            border: `1px solid ${colors.border}`,
            borderRadius: 4,
            boxShadow: colors.shadowMd,
          },
          list: { paddingBlock: 5 },
        },
      },
      MuiMenuItem: {
        styleOverrides: {
          root: {
            direction: 'rtl',
            textAlign: 'right',
            justifyContent: 'flex-start',
            minHeight: 40,
            marginInline: 4,
            borderRadius: 4,
            fontFamily,
            fontSize: '0.84rem',
            gap: 8,
            '&.Mui-selected': {
              backgroundColor: colors.primarySoft,
              color: colors.primary,
              fontWeight: 700,
            },
          },
        },
      },
      MuiListItemButton: {
        styleOverrides: {
          root: {
            direction: 'rtl',
            textAlign: 'right',
            borderRadius: 100,
            margin: '2px 8px',
            padding: '8px 16px',
            '&.Mui-selected': {
              backgroundColor: colors.primarySoft,
              color: colors.primary,
              fontWeight: 700,
            },
          },
        },
      },
      MuiTableContainer: {
        styleOverrides: {
          root: {
            borderRadius: 4,
            border: `1px solid ${colors.border}`,
            boxShadow: 'none',
            overflowX: 'auto',
          },
        },
      },
      MuiTableHead: {
        styleOverrides: {
          root: {
            backgroundColor: colors.surfaceAlt,
            '& .MuiTableCell-root': {
              color: colors.text,
              fontWeight: 700,
              borderBottom: `2px solid ${colors.border}`,
            },
          },
        },
      },
      MuiTableCell: {
        styleOverrides: {
          root: {
            direction: 'rtl',
            textAlign: 'right',
            borderColor: colors.border,
            padding: '10px 16px',
            fontSize: '0.85rem',
          },
          head: { fontSize: '0.8rem', whiteSpace: 'nowrap' },
        },
      },
      MuiChip: {
        styleOverrides: {
          root: { height: 28, borderRadius: 4, fontWeight: 600, fontSize: '0.75rem' },
        },
      },
      MuiAlert: {
        styleOverrides: {
          root: { direction: 'rtl', textAlign: 'right', borderRadius: 4, alignItems: 'center' },
          message: { width: '100%', textAlign: 'right' },
        },
      },
      MuiTooltip: {
        styleOverrides: {
          tooltip: {
            fontFamily,
            borderRadius: 4,
            fontSize: '0.74rem',
            backgroundColor: colors.text,
            color: colors.surface,
          },
        },
      },
      MuiTabs: {
        styleOverrides: {
          root: { minHeight: 40, borderBottom: `1px solid ${colors.border}` },
          indicator: { height: 3, borderRadius: 3 },
        },
      },
      MuiTab: {
        styleOverrides: {
          root: { minHeight: 40, fontWeight: 600, fontSize: '0.85rem', textTransform: 'none' },
        },
      },
    },
    // Non-MUI semantic tokens are exposed for the few dynamic styles that
    // cannot be expressed through the global CSS variables.
    app: colors,
    a4: colors,
  });
}

export function ThemeConfig({ children }) {
  const [mode, setMode] = useState(getInitialMode);
  const colors = palettes[mode];

  useLayoutEffect(() => {
    try {
      window.localStorage.setItem(COLOR_MODE_STORAGE_KEY, mode);
    } catch {
      // The selected mode still applies for the current session.
    }

    document.documentElement.lang = 'ar';
    document.documentElement.dir = 'rtl';
    document.documentElement.dataset.theme = mode;
    document.body.dir = 'rtl';
  }, [mode]);

  const toggleColorMode = useCallback(() => {
    setMode((currentMode) => (currentMode === 'light' ? 'dark' : 'light'));
  }, []);

  const colorMode = useMemo(
    () => ({
      mode,
      toggleColorMode,
      toggleMode: toggleColorMode,
    }),
    [mode, toggleColorMode]
  );

  const theme = useMemo(() => buildTheme(mode, colors), [colors, mode]);

  return (
    <CacheProvider value={rtlCache}>
      <ColorModeContext.Provider value={colorMode}>
        <ThemeProvider theme={theme}>
          <CssBaseline />
          <div className="theme-root" dir="rtl">
            {children}
          </div>
        </ThemeProvider>
      </ColorModeContext.Provider>
    </CacheProvider>
  );
}

// Compatibility component for the old application import during migration.
export const AppTheme = ThemeConfig;

export default ThemeConfig;

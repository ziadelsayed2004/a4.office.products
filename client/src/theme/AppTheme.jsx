import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { alpha, createTheme, CssBaseline, ThemeProvider } from '@mui/material';
import { CacheProvider } from '@emotion/react';
import createCache from '@emotion/cache';
import rtlPlugin from 'stylis-plugin-rtl';
import { prefixer } from 'stylis';

const rtlCache = createCache({
  key: 'muirtl',
  stylisPlugins: [prefixer, rtlPlugin],
  prepend: true,
});

const ModeContext = createContext(null);
export const useAppTheme = () => useContext(ModeContext);

const fontFamily = "Cairo, 'Segoe UI', Tahoma, Arial, sans-serif";

const palettes = {
  light: {
    background: '#f8f9fa',
    paper: '#ffffff',
    elevated: '#ffffff',
    alt: '#f1f3f4',
    text: '#202124',
    muted: '#5f6368',
    border: '#dadce0',
    borderStrong: '#bdc1c6',
    primary: '#0f5fa6',
    primaryHover: '#0b4d88',
    primarySoft: '#e8f2fb',
    success: '#188038',
    warning: '#e37400',
    error: '#d93025',
  },
  dark: {
    background: '#121212',
    paper: '#1e1e1e',
    elevated: '#242424',
    alt: '#2a2a2a',
    text: '#e8eaed',
    muted: '#9aa0a6',
    border: '#3c4043',
    borderStrong: '#5f6368',
    primary: '#8ab4f8',
    primaryHover: '#aecbfa',
    primarySoft: 'rgba(138, 180, 248, 0.12)',
    success: '#81c995',
    warning: '#fdd663',
    error: '#f28b82',
  },
};

function initialMode() {
  const stored = localStorage.getItem('a4_color_mode');
  if (stored === 'light' || stored === 'dark') return stored;
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function AppTheme({ children }) {
  const [mode, setMode] = useState(initialMode);
  const colors = palettes[mode];

  useEffect(() => {
    localStorage.setItem('a4_color_mode', mode);
    document.documentElement.lang = 'ar';
    document.documentElement.dir = 'rtl';
    document.documentElement.dataset.theme = mode;
    document.documentElement.style.colorScheme = mode;
    document.body.dir = 'rtl';
  }, [mode]);

  const modeValue = useMemo(() => ({
    mode,
    toggleMode: () => setMode((value) => (value === 'light' ? 'dark' : 'light')),
  }), [mode]);

  const theme = useMemo(() => createTheme({
    direction: 'rtl',
    palette: {
      mode,
      primary: { main: colors.primary, dark: colors.primaryHover, contrastText: mode === 'light' ? '#fff' : '#202124' },
      secondary: { main: colors.muted },
      background: { default: colors.background, paper: colors.paper },
      text: { primary: colors.text, secondary: colors.muted },
      divider: colors.border,
      success: { main: colors.success },
      warning: { main: colors.warning },
      error: { main: colors.error },
      info: { main: colors.primary },
      action: {
        hover: alpha(colors.primary, mode === 'light' ? 0.05 : 0.08),
        selected: alpha(colors.primary, mode === 'light' ? 0.1 : 0.14),
        disabledBackground: mode === 'light' ? '#f1f3f4' : '#252525',
      },
    },
    typography: {
      fontFamily,
      h1: { fontWeight: 700, fontSize: 'clamp(1.45rem, 2vw, 1.85rem)', lineHeight: 1.45 },
      h2: { fontWeight: 700, fontSize: '1.35rem', lineHeight: 1.5 },
      h3: { fontWeight: 700, fontSize: '1.18rem', lineHeight: 1.55 },
      h4: { fontWeight: 700, fontSize: '1.08rem', lineHeight: 1.55 },
      h5: { fontWeight: 700, fontSize: '1rem', lineHeight: 1.6 },
      h6: { fontWeight: 700, fontSize: '0.92rem', lineHeight: 1.6 },
      subtitle1: { fontWeight: 600 },
      subtitle2: { fontWeight: 600 },
      body1: { fontSize: '0.9rem', lineHeight: 1.8 },
      body2: { fontSize: '0.82rem', lineHeight: 1.75 },
      caption: { fontSize: '0.72rem', lineHeight: 1.6 },
      button: { fontWeight: 600, fontSize: '0.82rem', textTransform: 'none' },
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
        styleOverrides: {
          root: { direction: 'rtl', textAlign: 'inherit' },
        },
      },
      MuiTextField: {
        defaultProps: {
          fullWidth: true,
          variant: 'outlined',
          size: 'medium',
        },
      },
      MuiFormControl: {
        defaultProps: { fullWidth: true },
        styleOverrides: { root: { minWidth: 0 } },
      },
      MuiInputBase: {
        styleOverrides: {
          root: { width: '100%', minWidth: 0, fontFamily },
          input: {
            direction: 'rtl',
            textAlign: 'right',
            minWidth: 0,
            color: colors.text,
            '&[dir="ltr"]': {
              direction: 'ltr',
              textAlign: 'left',
              unicodeBidi: 'plaintext',
            },
          },
        },
      },
      MuiOutlinedInput: {
        styleOverrides: {
          root: {
            borderRadius: 4,
            backgroundColor: colors.paper,
            transition: 'background-color 160ms ease, box-shadow 180ms ease',
            '& fieldset': {
              borderColor: colors.border,
              transition: 'border-color 160ms ease, border-width 160ms ease',
            },
            '&:hover fieldset': { borderColor: colors.borderStrong },
            '&.Mui-focused': { boxShadow: `0 0 0 3px ${alpha(colors.primary, mode === 'light' ? 0.14 : 0.18)}` },
            '&.Mui-focused fieldset': { borderColor: colors.primary, borderWidth: 2 },
            '&.Mui-error fieldset': { borderColor: colors.error },
            '&.Mui-disabled': { backgroundColor: mode === 'light' ? '#f1f3f4' : '#252525' },
          },
          input: { minWidth: 0 },
          multiline: { alignItems: 'flex-start' },
          notchedOutline: { textAlign: 'right' },
        },
      },
      MuiInputLabel: {
        styleOverrides: {
          root: {
            direction: 'rtl',
            maxWidth: 'calc(100% - 34px)',
            color: colors.muted,
            fontFamily,
            fontWeight: 500,
            transition: 'color 160ms ease, transform 180ms cubic-bezier(0.4, 0, 0.2, 1), max-width 180ms ease',
            '&.Mui-focused': { color: colors.primary, fontWeight: 600 },
            '&.Mui-error': { color: colors.error },
          },
          asterisk: { color: colors.error, marginInlineStart: 3 },
        },
      },
      MuiFormLabel: {
        styleOverrides: {
          root: { direction: 'rtl', textAlign: 'right', fontFamily, color: colors.text, fontWeight: 600 },
          asterisk: { color: colors.error, marginInlineStart: 3 },
        },
      },
      MuiFormHelperText: {
        styleOverrides: {
          root: {
            direction: 'rtl',
            textAlign: 'right',
            margin: '5px 2px 0',
            color: colors.muted,
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
            color: colors.muted,
            flexShrink: 0,
            '& .MuiSvgIcon-root': { fontSize: '1.2rem' },
          },
        },
      },
      MuiButton: {
        defaultProps: { disableElevation: true },
        styleOverrides: {
          root: {
            minHeight: 40,
            borderRadius: 4,
            padding: '7px 16px',
            gap: 8,
            boxShadow: 'none',
            textTransform: 'none',
            transition: 'background-color 150ms ease, border-color 150ms ease, color 150ms ease',
            '&:hover': { boxShadow: 'none' },
          },
          startIcon: { margin: 0, display: 'inline-flex' },
          endIcon: { margin: 0, display: 'inline-flex' },
          containedPrimary: {
            backgroundColor: colors.primary,
            '&:hover': { backgroundColor: colors.primaryHover },
          },
          outlined: {
            borderColor: colors.border,
            color: colors.primary,
            '&:hover': { borderColor: colors.primary, backgroundColor: alpha(colors.primary, mode === 'light' ? 0.04 : 0.08) },
          },
        },
      },
      MuiIconButton: {
        styleOverrides: {
          root: { borderRadius: 4, transition: 'background-color 150ms ease, color 150ms ease' },
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
          root: { borderRadius: 4, backgroundImage: 'none', border: `1px solid ${colors.border}`, boxShadow: 'none' },
        },
      },
      MuiAppBar: {
        styleOverrides: {
          root: { borderRadius: 0, backgroundColor: colors.paper, color: colors.text, borderBottom: `1px solid ${colors.border}`, boxShadow: 'none' },
        },
      },
      MuiDrawer: {
        styleOverrides: {
          paper: { direction: 'rtl', textAlign: 'right', backgroundColor: colors.paper, backgroundImage: 'none', borderRadius: 0 },
        },
      },
      MuiDialog: {
        styleOverrides: {
          paper: { direction: 'rtl', textAlign: 'right', borderRadius: 4, border: `1px solid ${colors.border}`, backgroundColor: colors.paper },
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
          paper: { direction: 'rtl', border: `1px solid ${colors.border}`, borderRadius: 4, boxShadow: '0 10px 30px rgba(32, 33, 36, 0.16)' },
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
            '&.Mui-selected': { backgroundColor: colors.primarySoft, color: colors.primary, fontWeight: 700 },
          },
        },
      },
      MuiListItemButton: {
        styleOverrides: {
          root: {
            direction: 'rtl',
            textAlign: 'right',
            borderRadius: 100,
            '&.Mui-selected': { backgroundColor: colors.primarySoft, color: colors.primary, fontWeight: 700 },
          },
        },
      },
      MuiTableContainer: {
        styleOverrides: { root: { borderRadius: 4, boxShadow: 'none', overflowX: 'auto' } },
      },
      MuiTableHead: {
        styleOverrides: {
          root: {
            backgroundColor: colors.alt,
            '& .MuiTableCell-root': { color: colors.text, fontWeight: 700, borderBottom: `2px solid ${colors.border}` },
          },
        },
      },
      MuiTableCell: {
        styleOverrides: {
          root: { direction: 'rtl', textAlign: 'right', borderColor: colors.border, padding: '11px 16px', fontSize: '0.84rem' },
          head: { fontSize: '0.82rem', whiteSpace: 'nowrap' },
        },
      },
      MuiChip: {
        styleOverrides: {
          root: { height: 28, borderRadius: 4, fontWeight: 600, fontSize: '0.74rem' },
        },
      },
      MuiAlert: {
        styleOverrides: {
          root: { direction: 'rtl', textAlign: 'right', borderRadius: 4, alignItems: 'center' },
          message: { width: '100%', textAlign: 'right' },
        },
      },
      MuiTooltip: {
        styleOverrides: { tooltip: { fontFamily, borderRadius: 4, fontSize: '0.74rem' } },
      },
      MuiTab: {
        styleOverrides: { root: { minHeight: 42, fontWeight: 600, textTransform: 'none' } },
      },
      MuiTabs: {
        styleOverrides: { root: { minHeight: 42 }, indicator: { height: 3, borderRadius: 3 } },
      },
    },
    a4: colors,
  }), [colors, mode]);

  return (
    <CacheProvider value={rtlCache}>
      <ModeContext.Provider value={modeValue}>
        <ThemeProvider theme={theme}>
          <CssBaseline />
          {children}
        </ThemeProvider>
      </ModeContext.Provider>
    </CacheProvider>
  );
}

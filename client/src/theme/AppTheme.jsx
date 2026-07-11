import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { CacheProvider } from '@emotion/react';
import createCache from '@emotion/cache';
import { prefixer } from 'stylis';
import rtlPlugin from 'stylis-plugin-rtl';
import { alpha, createTheme, CssBaseline, ThemeProvider } from '@mui/material';

// Safely extract the plugin function across different ESM/CommonJS wrapper formats
const rtlPluginFunc = (rtlPlugin && rtlPlugin.default) ? (rtlPlugin.default.default || rtlPlugin.default) : rtlPlugin;

const rtlCache = createCache({
  key: 'artl',
  stylisPlugins: [prefixer, rtlPluginFunc],
  prepend: true,
});

const ModeContext = createContext(null);
export const useAppTheme = () => useContext(ModeContext);

const tokens = {
  light: {
    bg: '#f5f7fb',
    paper: '#ffffff',
    elevated: '#ffffff',
    alt: '#f8fafc',
    text: '#172033',
    muted: '#687386',
    border: '#dce3ec',
    strong: '#8795a8',
    primary: '#0f5fa6',
    primaryDark: '#073d73',
    primarySoft: '#e8f2fb',
    navy: '#072846',
  },
  dark: {
    bg: '#0d1520',
    paper: '#14202e',
    elevated: '#182637',
    alt: '#101b28',
    text: '#eef5ff',
    muted: '#9cacc0',
    border: '#2b3b4e',
    strong: '#6d8197',
    primary: '#70b4f5',
    primaryDark: '#3d8bd1',
    primarySoft: 'rgba(112,180,245,.13)',
    navy: '#d8eaff',
  },
};

export function AppTheme({ children }) {
  const [mode, setMode] = useState(() => localStorage.getItem('a4_color_mode') || 'light');

  useEffect(() => {
    localStorage.setItem('a4_color_mode', mode);
    document.documentElement.lang = 'ar';
    document.documentElement.dir = 'rtl';
    document.documentElement.dataset.theme = mode;
    document.documentElement.style.colorScheme = mode;
  }, [mode]);

  const value = useMemo(
    () => ({ mode, toggleMode: () => setMode((current) => current === 'light' ? 'dark' : 'light') }),
    [mode],
  );

  const c = tokens[mode];
  const theme = useMemo(() => createTheme({
    direction: 'rtl',
    palette: {
      mode,
      primary: { main: c.primary, dark: c.primaryDark, contrastText: '#fff' },
      secondary: { main: c.navy },
      background: { default: c.bg, paper: c.paper },
      text: { primary: c.text, secondary: c.muted },
      divider: c.border,
      success: { main: '#238653' },
      warning: { main: '#c87900' },
      error: { main: '#d64242' },
      info: { main: c.primary },
      action: { hover: alpha(c.primary, .065), selected: alpha(c.primary, .12) },
    },
    typography: {
      fontFamily: 'Cairo, "Segoe UI", Tahoma, Arial, sans-serif',
      h1: { fontWeight: 800, fontSize: 'clamp(1.35rem, 2vw, 1.75rem)', lineHeight: 1.45 },
      h2: { fontWeight: 800, fontSize: '1.35rem', lineHeight: 1.5 },
      h3: { fontWeight: 750, fontSize: '1.15rem' },
      h4: { fontWeight: 750, fontSize: '1.05rem' },
      h5: { fontWeight: 700, fontSize: '.98rem' },
      h6: { fontWeight: 700, fontSize: '.9rem' },
      body1: { fontSize: '.89rem', lineHeight: 1.8 },
      body2: { fontSize: '.8rem', lineHeight: 1.75 },
      caption: { fontSize: '.72rem' },
      button: { fontWeight: 700, fontSize: '.8rem', textTransform: 'none' },
    },
    shape: { borderRadius: 8 },
    components: {
      MuiCssBaseline: {
        styleOverrides: {
          body: { direction: 'rtl', background: c.bg },
          '::selection': { background: alpha(c.primary, .2) },
        },
      },
      MuiTextField: {
        defaultProps: {
          fullWidth: true,
          size: 'small',
          variant: 'outlined',
        },
      },
      MuiFormControl: {
        defaultProps: { size: 'small' },
      },
      MuiInputBase: {
        styleOverrides: {
          root: {
            width: '100%',
            fontFamily: 'Cairo, "Segoe UI", Tahoma, Arial, sans-serif',
          },
          input: {
            direction: 'rtl',
            textAlign: 'right',
            fontSize: '.84rem',
            lineHeight: 1.6,
            '&[dir="ltr"]': {
              direction: 'ltr',
              textAlign: 'left',
              unicodeBidi: 'plaintext',
            },
            '&::placeholder': {
              color: c.muted,
              opacity: .82,
            },
          },
        },
      },
      MuiOutlinedInput: {
        styleOverrides: {
          root: {
            minHeight: 44,
            borderRadius: 5,
            backgroundColor: c.paper,
            transition: 'background-color 160ms ease, box-shadow 180ms ease, transform 180ms ease',
            '& .MuiOutlinedInput-notchedOutline': {
              borderColor: c.border,
              textAlign: 'right',
              transition: 'border-color 160ms ease, border-width 160ms ease',
            },
            '&:hover .MuiOutlinedInput-notchedOutline': {
              borderColor: c.strong,
            },
            '&.Mui-focused': {
              boxShadow: `0 0 0 3px ${alpha(c.primary, mode === 'light' ? .10 : .16)}`,
            },
            '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
              borderColor: c.primary,
              borderWidth: 2,
            },
            '&.Mui-error .MuiOutlinedInput-notchedOutline': {
              borderColor: '#d64242',
            },
            '&.Mui-disabled': {
              backgroundColor: c.alt,
            },
          },
          input: {
            padding: '10px 14px',
            minWidth: 0,
            textAlign: 'right',
          },
          inputSizeSmall: {
            padding: '10px 14px',
          },
          multiline: {
            minHeight: 'auto',
            padding: '10px 14px',
          },
          notchedOutline: {
            textAlign: 'right',
          },
        },
      },
      MuiInputLabel: {
        styleOverrides: {
          root: {
            direction: 'rtl',
            textAlign: 'right',
            transformOrigin: 'top right',
            color: c.muted,
            fontFamily: 'Cairo, "Segoe UI", Tahoma, Arial, sans-serif',
            fontSize: '.84rem',
            fontWeight: 600,
            letterSpacing: 0,
            lineHeight: 1.4,
            transition: 'color 160ms ease, transform 180ms cubic-bezier(.4,0,.2,1), max-width 180ms ease',
            '&.Mui-focused': {
              color: c.primary,
              fontWeight: 700,
            },
            '&.Mui-error': {
              color: '#d64242',
            },
            '&.Mui-disabled': {
              color: c.muted,
            },
          },
          asterisk: {
            color: '#d64242',
            marginInlineStart: 3,
          },
        },
      },
      MuiFormLabel: {
        styleOverrides: {
          root: {
            direction: 'rtl',
            textAlign: 'right',
            color: c.text,
            fontFamily: 'Cairo, "Segoe UI", Tahoma, Arial, sans-serif',
            fontWeight: 700,
            fontSize: '.78rem',
            lineHeight: 1.45,
          },
          asterisk: {
            color: '#d64242',
            marginInlineStart: 3,
          },
        },
      },
      MuiFormHelperText: {
        styleOverrides: {
          root: {
            direction: 'rtl',
            textAlign: 'right',
            marginInline: 2,
            fontFamily: 'Cairo, "Segoe UI", Tahoma, Arial, sans-serif',
            fontSize: '.68rem',
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
            minHeight: 'unset',
            paddingInlineStart: '14px !important',
            paddingInlineEnd: '40px !important',
          },
          icon: {
            right: 'auto',
            left: 10,
            color: c.muted,
            transition: 'transform 180ms ease, color 160ms ease',
          },
        },
      },
      MuiInputAdornment: {
        styleOverrides: {
          root: {
            color: c.muted,
            '& .MuiSvgIcon-root': { fontSize: '1.15rem' },
          },
        },
      },
      MuiMenu: {
        styleOverrides: {
          paper: {
            direction: 'rtl',
            border: `1px solid ${c.border}`,
            borderRadius: 7,
            boxShadow: '0 16px 40px rgba(3,20,40,.16)',
          },
          list: {
            paddingBlock: 5,
          },
        },
      },
      MuiMenuItem: {
        styleOverrides: {
          root: {
            direction: 'rtl',
            textAlign: 'right',
            justifyContent: 'flex-start',
            minHeight: 40,
            fontFamily: 'Cairo, "Segoe UI", Tahoma, Arial, sans-serif',
            fontSize: '.82rem',
            borderRadius: 4,
            marginInline: 5,
            '&.Mui-selected': {
              backgroundColor: alpha(c.primary, .11),
              color: c.primary,
              fontWeight: 700,
            },
          },
        },
      },
      MuiPaper: {
        styleOverrides: {
          root: { backgroundImage: 'none' },
          outlined: { borderColor: c.border },
        },
      },
      MuiCard: {
        styleOverrides: {
          root: { backgroundImage: 'none', boxShadow: 'none', border: `1px solid ${c.border}` },
        },
      },
      MuiButton: {
        defaultProps: { disableElevation: true },
        styleOverrides: {
          root: { minHeight: 40, borderRadius: 7, paddingInline: 16 },
          containedPrimary: { backgroundColor: c.primary, '&:hover': { backgroundColor: c.primaryDark } },
          outlined: { borderColor: c.border, '&:hover': { borderColor: c.primary, background: alpha(c.primary, .04) } },
        },
      },
      MuiIconButton: { styleOverrides: { root: { borderRadius: 7 } } },
      MuiTableContainer: {
        styleOverrides: {
          root: { border: `1px solid ${c.border}`, borderRadius: 9, boxShadow: 'none', overflowX: 'auto' },
        },
      },
      MuiTableHead: { styleOverrides: { root: { background: c.alt } } },
      MuiTableCell: {
        styleOverrides: {
          root: { textAlign: 'right', borderColor: c.border, padding: '11px 13px', fontSize: '.78rem', whiteSpace: 'nowrap' },
          head: { fontWeight: 800, color: c.muted },
        },
      },
      MuiDialog: {
        styleOverrides: {
          paper: { borderRadius: 12, border: `1px solid ${c.border}`, background: c.paper },
        },
      },
      MuiDrawer: { styleOverrides: { paper: { background: c.paper, backgroundImage: 'none' } } },
      MuiChip: { styleOverrides: { root: { height: 28, borderRadius: 6, fontWeight: 700, fontSize: '.72rem' } } },
      MuiAlert: { styleOverrides: { root: { borderRadius: 8, alignItems: 'center' } } },
      MuiTooltip: { styleOverrides: { tooltip: { fontFamily: 'Cairo, sans-serif', borderRadius: 6, fontSize: '.72rem' } } },
      MuiCheckbox: { styleOverrides: { root: { padding: 7 } } },
      MuiTabs: { styleOverrides: { root: { minHeight: 44 }, indicator: { height: 3, borderRadius: 3 } } },
      MuiTab: { styleOverrides: { root: { minHeight: 44, fontWeight: 700, textTransform: 'none' } } },
    },
    a4: c,
  }), [mode, c]);

  return (
    <CacheProvider value={rtlCache}>
      <ModeContext.Provider value={value}>
        <ThemeProvider theme={theme}>
          <CssBaseline />
          {children}
        </ThemeProvider>
      </ModeContext.Provider>
    </CacheProvider>
  );
}

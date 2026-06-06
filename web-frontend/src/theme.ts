import { createTheme } from '@mui/material/styles';

/**
 * Single app-wide theme: neutral light surfaces, indigo accent, soft shadows,
 * rounded corners, no shouty uppercase buttons. Components use this + sx — no
 * one-off CSS.
 */
export const theme = createTheme({
  palette: {
    mode: 'light',
    primary: { main: '#4f46e5', light: '#6366f1', dark: '#4338ca' },
    secondary: { main: '#0d9488' },
    success: { main: '#16a34a' },
    warning: { main: '#d97706' },
    error: { main: '#dc2626' },
    background: { default: '#f6f7f9', paper: '#ffffff' },
    text: { primary: '#1f2937', secondary: '#6b7280' },
    divider: '#e5e7eb',
  },
  typography: {
    fontFamily: 'Inter, Roboto, system-ui, -apple-system, sans-serif',
    h4: { fontWeight: 700, letterSpacing: '-0.02em' },
    h5: { fontWeight: 700, letterSpacing: '-0.01em' },
    h6: { fontWeight: 600 },
    subtitle2: { fontWeight: 600 },
    button: { fontWeight: 600 },
  },
  shape: { borderRadius: 12 },
  components: {
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: { root: { textTransform: 'none', borderRadius: 10 } },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          border: '1px solid #ececf1',
          boxShadow: '0 1px 2px rgba(16,24,40,0.04), 0 1px 3px rgba(16,24,40,0.06)',
        },
      },
    },
    MuiPaper: { styleOverrides: { root: { backgroundImage: 'none' } } },
    MuiAppBar: {
      styleOverrides: {
        root: {
          backgroundColor: '#ffffff',
          color: '#1f2937',
          boxShadow: 'none',
          borderBottom: '1px solid #e5e7eb',
        },
      },
    },
  },
});

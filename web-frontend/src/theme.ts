import { createTheme } from '@mui/material/styles';

/** Single source of truth for palette/typography/shape — used app-wide, no one-off styles. */
export const theme = createTheme({
  palette: {
    mode: 'light',
    primary: { main: '#3949ab' },
    secondary: { main: '#00897b' },
    background: { default: '#f4f5f7' },
  },
  typography: {
    fontFamily: 'Inter, Roboto, system-ui, sans-serif',
    h5: { fontWeight: 600 },
    h6: { fontWeight: 600 },
  },
  shape: { borderRadius: 10 },
  components: {
    MuiButton: { defaultProps: { disableElevation: true } },
  },
});

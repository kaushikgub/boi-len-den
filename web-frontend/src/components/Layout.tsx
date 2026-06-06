import { ReactNode } from 'react';
import { AppBar, Box, Button, Container, Stack, Toolbar, Typography } from '@mui/material';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

/** App shell: top bar with nav + the current user, and a centered content container. */
export function Layout({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
      <AppBar position="static" color="primary">
        <Toolbar>
          <Typography variant="h6" component={RouterLink} to="/" sx={{ color: 'inherit', textDecoration: 'none', flexGrow: 0, mr: 4 }}>
            📚 boi-len-den
          </Typography>
          <Stack direction="row" spacing={1} sx={{ flexGrow: 1 }}>
            <Button color="inherit" component={RouterLink} to="/">
              Catalog
            </Button>
            <Button color="inherit" component={RouterLink} to="/rentals">
              My Rentals
            </Button>
          </Stack>
          {user && (
            <Stack direction="row" spacing={2} alignItems="center">
              <Typography variant="body2">{user.email}</Typography>
              <Button
                color="inherit"
                variant="outlined"
                size="small"
                onClick={async () => {
                  await logout();
                  navigate('/login');
                }}
              >
                Logout
              </Button>
            </Stack>
          )}
        </Toolbar>
      </AppBar>
      <Container maxWidth="md" sx={{ py: 4 }}>
        {children}
      </Container>
    </Box>
  );
}

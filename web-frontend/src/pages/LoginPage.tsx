import { FormEvent, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AxiosError } from 'axios';
import { Alert, Box, Button, Link, Stack, TextField, Typography } from '@mui/material';
import { useAuth } from '../auth/AuthContext';

export function LoginPage() {
  const { login, register } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: { pathname: string } })?.from?.pathname ?? '/';

  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await (mode === 'login' ? login(email, password) : register(email, password));
      navigate(from, { replace: true });
    } catch (err) {
      const ax = err as AxiosError<{ message?: string }>;
      setError(ax.response?.data?.message ?? 'Something went wrong');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      {/* Brand panel */}
      <Box
        sx={{
          flex: 1,
          display: { xs: 'none', md: 'flex' },
          flexDirection: 'column',
          justifyContent: 'center',
          p: 8,
          color: '#fff',
          background: 'linear-gradient(135deg, #4f46e5, #0d9488)',
        }}
      >
        <Typography variant="h3" sx={{ fontWeight: 800, letterSpacing: '-0.03em' }}>
          📚 boi-len-den
        </Typography>
        <Typography variant="h6" sx={{ fontWeight: 400, mt: 2, maxWidth: 420, opacity: 0.9 }}>
          Browse the library, rent a book, return it when you're done. Simple.
        </Typography>
      </Box>

      {/* Form panel */}
      <Box
        sx={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          p: { xs: 3, md: 6 },
          bgcolor: 'background.paper',
        }}
      >
        <Box sx={{ width: '100%', maxWidth: 380 }}>
          <Typography variant="h5" gutterBottom>
            {mode === 'login' ? 'Welcome back' : 'Create your account'}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            {mode === 'login' ? 'Sign in to rent books.' : 'It only takes a moment.'}
          </Typography>
          <form onSubmit={onSubmit}>
            <Stack spacing={2}>
              {error && <Alert severity="error">{error}</Alert>}
              <TextField
                label="Email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                fullWidth
                autoFocus
              />
              <TextField
                label="Password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                fullWidth
                helperText={mode === 'register' ? 'At least 8 characters' : undefined}
              />
              <Button type="submit" variant="contained" size="large" disabled={busy}>
                {busy ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Create account'}
              </Button>
              <Typography variant="body2" align="center" color="text.secondary">
                {mode === 'login' ? "No account? " : 'Have an account? '}
                <Link
                  component="button"
                  type="button"
                  onClick={() => {
                    setMode(mode === 'login' ? 'register' : 'login');
                    setError(null);
                  }}
                >
                  {mode === 'login' ? 'Register' : 'Sign in'}
                </Link>
              </Typography>
            </Stack>
          </form>
        </Box>
      </Box>
    </Box>
  );
}

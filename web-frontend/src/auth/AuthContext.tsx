import { createContext, useContext, useEffect, useMemo, useRef, useState, ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import * as authApi from '../api/auth';
import { setAccessToken, setOnAuthFailure } from '../api/client';
import { Role, User } from '../api/types';

type Status = 'loading' | 'authed' | 'anon';

interface AuthContextValue {
  user: User | null;
  status: Status;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  hasRole: (...roles: Role[]) => boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [status, setStatus] = useState<Status>('loading');
  const queryClient = useQueryClient();
  // Guard against StrictMode's double-effect: a single-use refresh token must be
  // rotated only once, or the second call 401s and falsely logs the user out.
  const bootstrapped = useRef(false);

  // On load the in-memory access token is gone (by design), but the HttpOnly
  // refresh cookie may still be valid — try once to silently restore the session.
  useEffect(() => {
    if (bootstrapped.current) return;
    bootstrapped.current = true;
    let active = true;
    authApi
      .refresh()
      .then((res) => {
        if (!active) return;
        setAccessToken(res.accessToken);
        setUser(res.user);
        setStatus('authed');
      })
      .catch(() => active && setStatus('anon'));
    return () => {
      active = false;
    };
  }, []);

  // When the interceptor's refresh ultimately fails, drop to anonymous.
  useEffect(() => {
    setOnAuthFailure(() => {
      setAccessToken(null);
      setUser(null);
      setStatus('anon');
      queryClient.clear();
    });
  }, [queryClient]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      status,
      hasRole: (...roles: Role[]) => !!user && roles.some((r) => user.roles.includes(r)),
      login: async (email, password) => {
        const res = await authApi.login(email, password);
        setAccessToken(res.accessToken);
        setUser(res.user);
        setStatus('authed');
      },
      register: async (email, password) => {
        const res = await authApi.register(email, password);
        setAccessToken(res.accessToken);
        setUser(res.user);
        setStatus('authed');
      },
      logout: async () => {
        try {
          await authApi.logout();
        } finally {
          setAccessToken(null);
          setUser(null);
          setStatus('anon');
          queryClient.clear();
        }
      },
    }),
    [user, status, queryClient],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

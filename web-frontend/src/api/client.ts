import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';

/**
 * The single Axios instance. ALL network code goes through here — components never
 * call axios directly.
 *
 * - Access token lives in memory only (this module variable), never localStorage,
 *   to limit XSS exposure. The refresh token is an HttpOnly cookie the JS can't read.
 * - Request interceptor attaches the bearer token + a per-request correlation id.
 * - Response interceptor catches 401 once, runs a single-flight refresh, retries the
 *   original request, and on repeated failure clears auth and notifies the app.
 */
let accessToken: string | null = null;
let onAuthFailure: (() => void) | null = null;

export function setAccessToken(token: string | null): void {
  accessToken = token;
}
export function getAccessToken(): string | null {
  return accessToken;
}
export function setOnAuthFailure(handler: () => void): void {
  onAuthFailure = handler;
}

export const api = axios.create({
  baseURL: '/api',
  withCredentials: true, // send the HttpOnly refresh cookie on /auth/refresh
});

api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  if (accessToken) config.headers.Authorization = `Bearer ${accessToken}`;
  config.headers['x-correlation-id'] = crypto.randomUUID();
  return config;
});

// Single-flight refresh: many 401s in flight share one refresh round-trip.
let refreshing: Promise<string> | null = null;

async function refreshAccessToken(): Promise<string> {
  // Use bare axios (not `api`) so this call skips the interceptors below.
  const res = await axios.post('/api/auth/refresh', {}, { withCredentials: true });
  const token = res.data.accessToken as string;
  setAccessToken(token);
  return token;
}

api.interceptors.response.use(
  (res) => res,
  async (error: AxiosError) => {
    const original = error.config as (InternalAxiosRequestConfig & { _retry?: boolean }) | undefined;
    const isAuthCall = original?.url?.includes('/auth/');

    if (error.response?.status === 401 && original && !original._retry && !isAuthCall) {
      original._retry = true;
      try {
        refreshing = refreshing ?? refreshAccessToken();
        const token = await refreshing;
        original.headers.Authorization = `Bearer ${token}`;
        return api(original);
      } catch (refreshErr) {
        setAccessToken(null);
        onAuthFailure?.();
        return Promise.reject(refreshErr);
      } finally {
        refreshing = null;
      }
    }
    return Promise.reject(error);
  },
);

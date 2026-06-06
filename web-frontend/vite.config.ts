import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// The frontend talks to the gateway through this dev proxy, so the browser sees
// everything as same-origin: the HttpOnly refresh cookie and the silent-refresh
// flow work without CORS, mirroring how the SPA sits behind an ingress in prod.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
});

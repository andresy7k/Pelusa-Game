import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Phase 5: proxy /api al backend local para evitar CORS en dev.
// VITE_PROXY_TARGET permite apuntar a otro backend (Playwright usa el de perfil e2e en :8081).
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': process.env.VITE_PROXY_TARGET ?? 'http://localhost:8080',
    },
  },
});

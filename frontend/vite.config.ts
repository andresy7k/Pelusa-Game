import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Cabeceras de seguridad del sitio estático. En producción las pone Render
// (render.yaml → pelusa-frontend.headers, mismos valores); acá se repiten en
// `vite preview` para poder probar el build con la misma política en local.
//
// CSP: solo código propio, estilos propios + Google Fonts, imágenes propias o
// generadas (data:/blob:, las texturas 3D se pintan en canvas) y conexiones a
// la propia web o al backend en Render. Nada de iframes ni <object>.
export const SECURITY_HEADERS: Record<string, string> = {
  'Content-Security-Policy': [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data: blob:",
    "connect-src 'self' https://*.onrender.com",
    "worker-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join('; '),
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=()',
  'Cross-Origin-Opener-Policy': 'same-origin',
};

// Phase 5: proxy /api al backend local para evitar CORS en dev.
// VITE_PROXY_TARGET permite apuntar a otro backend (Playwright usa el de perfil e2e en :8081).
const apiProxy = { '/api': process.env.VITE_PROXY_TARGET ?? 'http://localhost:8080' };

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: apiProxy,
  },
  preview: {
    headers: SECURITY_HEADERS,
    proxy: apiProxy,
  },
});

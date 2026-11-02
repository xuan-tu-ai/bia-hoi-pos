import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Khi phát triển, /api và /socket.io được chuyển tới backend (apps/api) ở cổng 3000.
// Khi build cho máy khác trong LAN: VITE_API_URL=http://<ip máy chủ>:3000 pnpm build
const API = process.env.API_ORIGIN ?? 'http://127.0.0.1:3000';

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
    proxy: {
      '/api': { target: API, changeOrigin: true, rewrite: (p) => p.replace(/^\/api/, '') },
      '/socket.io': { target: API, ws: true },
    },
  },
  preview: {
    host: true,
    port: 4173,
    proxy: {
      '/api': { target: API, changeOrigin: true, rewrite: (p) => p.replace(/^\/api/, '') },
      '/socket.io': { target: API, ws: true },
    },
  },
});

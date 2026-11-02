import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// App quầy chạy dưới /quay/ (cùng máy chủ web với Web quản trị khi triển khai bằng Docker).
// Khi phát triển, /api và /socket.io được chuyển tới backend ở cổng 3000.
const API = process.env.API_ORIGIN ?? 'http://127.0.0.1:3000';
const proxy = {
  '/api': { target: API, changeOrigin: true, rewrite: (p: string) => p.replace(/^\/api/, '') },
  '/socket.io': { target: API, ws: true },
};

export default defineConfig({
  base: '/quay/',
  plugins: [react()],
  server: { host: true, port: 5174, proxy },
  preview: { host: true, port: 4174, proxy },
});

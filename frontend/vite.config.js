import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

const root = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
  esbuild: {
    jsx: 'automatic'
  },
  build: {
    rollupOptions: {
      input: {
        index: `${root}index.html`,
        dashboard: `${root}dashboard.html`
      }
    }
  }
});
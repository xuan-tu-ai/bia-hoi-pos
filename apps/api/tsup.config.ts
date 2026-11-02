import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/server.ts'],
  format: ['esm'],
  target: 'node22',
  platform: 'node',
  clean: true,
  // packages/shared xuất mã nguồn TypeScript nên phải gói thẳng vào bản build.
  noExternal: ['@biahoi/shared'],
});

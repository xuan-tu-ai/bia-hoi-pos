import { defineConfig } from '@playwright/test';

// Kiểm thử đầu-cuối App quầy trên màn 1366×768 (SRS FR-02). Cần backend có dữ liệu demo và App quầy đang chạy:
//   docker compose up -d   (App quầy ở http://127.0.0.1:8080/quay/), hoặc
//   pnpm --filter @biahoi/counter dev   (http://127.0.0.1:5174/quay/)
export default defineConfig({
  testDir: 'e2e',
  globalSetup: './e2e/global-setup.ts',
  workers: 1,
  fullyParallel: false,
  timeout: 45_000,
  expect: { timeout: 8_000 },
  reporter: [['list']],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://127.0.0.1:5174',
    channel: process.env.E2E_CHANNEL ?? 'chrome',
    locale: 'vi-VN',
    timezoneId: 'Asia/Ho_Chi_Minh',
    viewport: { width: 1366, height: 768 },
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
});

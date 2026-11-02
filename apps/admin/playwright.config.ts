import { defineConfig } from '@playwright/test';

// Kiểm thử đầu-cuối Web quản trị. Cần backend có dữ liệu demo và web đang chạy:
//   docker compose up -d            (backend + web ở cổng 8080), hoặc
//   pnpm --filter @biahoi/api dev  +  pnpm --filter @biahoi/admin dev   (web ở cổng 5173)
// Dùng Chrome cài sẵn trên máy (channel 'chrome'), không cần tải trình duyệt của Playwright.
export default defineConfig({
  testDir: 'e2e',
  globalSetup: './e2e/global-setup.ts',
  // Các test ghi vào cùng một CSDL nên chạy lần lượt
  workers: 1,
  fullyParallel: false,
  timeout: 30_000,
  expect: { timeout: 8_000 },
  reporter: [['list']],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://127.0.0.1:5173',
    channel: process.env.E2E_CHANNEL ?? 'chrome',
    locale: 'vi-VN',
    timezoneId: 'Asia/Ho_Chi_Minh',
    viewport: { width: 1440, height: 900 },
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'desktop', testIgnore: /phone\.spec\.ts/ },
    { name: 'phone', testMatch: /phone\.spec\.ts/, use: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } },
  ],
});

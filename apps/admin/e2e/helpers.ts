import path from 'node:path';
import { test as base, expect, type Page } from '@playwright/test';

export const ownerState = path.resolve(import.meta.dirname, '.auth/owner.json');
export const managerState = path.resolve(import.meta.dirname, '.auth/manager.json');

/** Mặc định đăng nhập là chủ quán; tự đồng ý các hộp confirm() và trả lời prompt() bằng `promptAnswer`. */
export const test = base.extend<{ promptAnswer: { value: string } }>({
  storageState: ownerState,
  // auto: luôn bật, kể cả test không dùng tới promptAnswer (để confirm() không chặn test)
  promptAnswer: [
    async ({ page }, use) => {
      const answer = { value: '' };
      page.on('dialog', (d) => void d.accept(d.type() === 'prompt' ? answer.value : undefined));
      await use(answer);
    },
    { auto: true },
  ],
});

export { expect };

/** Chuỗi khác nhau mỗi lần chạy, để test không đụng dữ liệu của lần trước. */
export const uniq = (prefix: string) => `${prefix} ${Date.now().toString(36).slice(-5)}`;

export async function openScreen(page: Page, path: string, title: string) {
  await page.goto(path);
  await expect(page.getByRole('heading', { level: 1, name: title })).toBeVisible();
}

export function dialog(page: Page, title: string) {
  return page.getByRole('dialog', { name: title });
}

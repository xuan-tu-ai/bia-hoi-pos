// Giao diện tối cho máy quầy: đổi ở màn khóa hoặc thanh trên, lưu trên máy, tải lại vẫn giữ.
import { expect, test } from '@playwright/test';
import { login } from './helpers';

test('đổi giao diện tối ở màn khóa và thanh trên, tải lại vẫn giữ', async ({ page }) => {
  await page.goto('/quay/');
  const html = page.locator('html');
  await expect(html).toHaveAttribute('data-theme', 'light');
  await page.getByRole('button', { name: 'Giao diện tối' }).click();
  await expect(html).toHaveAttribute('data-theme', 'dark');

  await login(page);
  await expect(html).toHaveAttribute('data-theme', 'dark');
  await page.reload();
  await expect(html).toHaveAttribute('data-theme', 'dark');
  // màu nền thật sự đổi, không chỉ thuộc tính
  expect(await page.locator('.sheet').evaluate((el) => getComputedStyle(el).backgroundColor)).toBe('rgb(24, 23, 22)');

  await page.getByRole('button', { name: 'Giao diện sáng' }).click();
  await expect(html).toHaveAttribute('data-theme', 'light');
});

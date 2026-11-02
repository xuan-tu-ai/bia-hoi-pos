// Giao diện tối của Web quản trị: nút ở cuối thanh bên, lưu trên máy, biểu đồ vẽ lại theo màu mới.
import { expect, openScreen, test } from './helpers';

test('đổi giao diện tối, tải lại vẫn giữ, rồi đổi về sáng', async ({ page }) => {
  await openScreen(page, '/', 'Hôm nay');
  const html = page.locator('html');
  await expect(html).toHaveAttribute('data-theme', 'light');
  await page.getByRole('button', { name: 'Giao diện tối' }).click();
  await expect(html).toHaveAttribute('data-theme', 'dark');
  expect(await page.locator('body').evaluate((el) => getComputedStyle(el).backgroundColor)).toBe('rgb(14, 13, 12)');

  await page.reload();
  await expect(html).toHaveAttribute('data-theme', 'dark');
  await page.getByRole('button', { name: 'Giao diện sáng' }).click();
  await expect(html).toHaveAttribute('data-theme', 'light');
});

// PWA chủ quán trên điện thoại (390px): menu gập, bảng thành danh sách hai dòng.
import { expect, openScreen, test } from './helpers';

test('điều hướng bằng menu toàn màn hình', async ({ page }) => {
  await openScreen(page, '/', 'Hôm nay');
  const nav = page.getByRole('navigation', { name: 'Điều hướng chính' });
  await expect(nav).not.toBeInViewport();
  await page.getByRole('button', { name: 'Mở menu' }).click();
  await expect(nav).toBeInViewport();
  await nav.getByRole('link', { name: 'Hao hụt keg' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Hao hụt keg' })).toBeVisible();
  await expect(nav).not.toBeInViewport();
});

test('nhật ký hủy/giảm hiện danh sách hai dòng, không có bảng tràn ngang', async ({ page }) => {
  await openScreen(page, '/nhat-ky-huy', 'Nhật ký hủy/giảm');
  await expect(page.locator('table')).toHaveCount(0);
  await expect(page.locator('.row.two-line').first()).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});

test('nút bấm đủ lớn để chạm (≥ 44px)', async ({ page }) => {
  await openScreen(page, '/', 'Hôm nay');
  const box = await page.getByRole('button', { name: 'Mở menu' }).boundingBox();
  expect(box!.height).toBeGreaterThanOrEqual(44);
});

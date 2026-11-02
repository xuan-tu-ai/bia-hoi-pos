// FR-13: đăng nhập web, phân quyền theo vai trò, đăng xuất.
import { expect, managerState, openScreen, test } from './helpers';

test.describe('đăng nhập', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test('sai mật khẩu báo lỗi tại chỗ; đúng thì vào màn Hôm nay', async ({ page }) => {
    await page.goto('/');
    await page.getByLabel('Email').fill('chuquan@biahoi.vn');
    await page.getByLabel('Mật khẩu').fill('sai-mat-khau');
    await page.getByRole('button', { name: 'Đăng nhập' }).click();
    await expect(page.getByRole('alert')).toContainText('không đúng');

    await page.getByLabel('Mật khẩu').fill('chuquan123');
    await page.getByRole('button', { name: 'Đăng nhập' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Hôm nay' })).toBeVisible();
  });
});

test.describe('quản lý ca', () => {
  test.use({ storageState: managerState });

  test('chỉ thấy báo cáo; mở đường dẫn quản trị bị đưa về Hôm nay', async ({ page }) => {
    await openScreen(page, '/', 'Hôm nay');
    const nav = page.getByRole('navigation', { name: 'Điều hướng chính' });
    await expect(nav.getByRole('link', { name: 'Nhật ký hủy/giảm' })).toBeVisible();
    await expect(nav.getByRole('link', { name: 'Thực đơn' })).toHaveCount(0);
    await page.goto('/nhan-vien');
    await expect(page.getByRole('heading', { level: 1, name: 'Hôm nay' })).toBeVisible();
  });

  test('không thấy phần bật thông báo đẩy (chỉ dành cho chủ quán)', async ({ page }) => {
    await openScreen(page, '/nhat-ky-huy', 'Nhật ký hủy/giảm');
    await expect(page.getByText('Thông báo trên thiết bị này')).toHaveCount(0);
  });
});

test('đăng xuất về màn đăng nhập', async ({ page }) => {
  await openScreen(page, '/', 'Hôm nay');
  await page.getByRole('button', { name: 'Đăng xuất' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Đăng nhập quản trị' })).toBeVisible();
});

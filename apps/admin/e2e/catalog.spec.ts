// FR-11 trạm in, FR-12 khu & bàn, FR-13 nhân viên.
import { dialog, expect, openScreen, test, uniq } from './helpers';

test('trạm in: thêm, sửa, xóa; trạm còn món thì không xóa được', async ({ page }) => {
  const name = uniq('Bếp hấp');
  await openScreen(page, '/tram-in', 'Trạm in');

  await page.getByRole('button', { name: 'Thêm trạm in' }).click();
  let box = dialog(page, 'Thêm trạm in');
  await box.getByLabel('Tên trạm').fill(name);
  await box.getByLabel('Tên hoặc ghi chú máy in').fill('XP-80C Hap');
  await box.getByRole('button', { name: 'Lưu' }).click();
  const row = page.getByRole('row', { name: new RegExp(name) });
  await expect(row).toContainText('XP-80C Hap');
  await expect(row).toContainText('Máy in của máy quầy');

  // Chuyển sang máy in mạng; máy in không có thật nên "In thử" phải báo lỗi rõ ràng
  await row.getByRole('button', { name: `Sửa ${name}` }).click();
  box = dialog(page, 'Sửa trạm in');
  await box.getByLabel('Cách in').selectOption({ label: 'Máy in mạng (máy chủ gửi thẳng)' });
  await box.getByLabel('Địa chỉ IP máy in').fill('127.0.0.1');
  await box.getByLabel('Cổng').fill('9');
  await box.getByRole('button', { name: 'Lưu' }).click();
  await expect(row).toContainText('Máy in mạng 127.0.0.1:9');
  await row.getByRole('button', { name: 'In thử' }).click();
  await expect(page.locator('.form-error')).toContainText('Máy in 127.0.0.1:9');

  await row.getByRole('button', { name: `Sửa ${name}` }).click();
  await dialog(page, 'Sửa trạm in').getByRole('button', { name: 'Xóa trạm' }).click();
  await expect(page.getByRole('row', { name: new RegExp(name) })).toHaveCount(0);

  await page.getByRole('row', { name: /Bếp/ }).first().getByRole('button', { name: 'Sửa Bếp' }).click();
  await expect(dialog(page, 'Sửa trạm in').getByRole('button', { name: 'Xóa trạm' })).toBeDisabled();
});

test('khu & bàn: thêm khu, thêm bàn, đổi tên, xóa bàn rồi xóa khu', async ({ page, promptAnswer }) => {
  const area = uniq('Sân thượng');
  await openScreen(page, '/khu-ban', 'Khu & bàn');

  await page.getByLabel('Tên khu mới').fill(area);
  await page.getByRole('button', { name: 'Thêm khu' }).click();
  await expect(page.getByRole('option', { name: new RegExp(area) })).toHaveAttribute('aria-selected', 'true');

  const code = `ST${Date.now().toString().slice(-3)}`;
  await page.getByLabel('Mã bàn mới').fill(code);
  await page.getByRole('button', { name: 'Thêm bàn' }).click();
  await expect(page.getByRole('row', { name: new RegExp(code) })).toContainText('Trống');
  await expect(page.locator('.tiles li', { hasText: code })).toBeVisible();

  promptAnswer.value = `${area} có mái`;
  await page.getByRole('button', { name: `Đổi tên khu ${area}` }).click();
  await expect(page.getByRole('option', { name: new RegExp(`${area} có mái`) })).toBeVisible();

  await page.getByRole('button', { name: `Xóa bàn ${code}` }).click();
  await expect(page.getByRole('row', { name: new RegExp(code) })).toHaveCount(0);
  await page.getByRole('button', { name: `Xóa khu ${area} có mái` }).click();
  await expect(page.getByRole('option', { name: new RegExp(area) })).toHaveCount(0);
});

test('khu & bàn: bàn đang có khách không xóa được', async ({ page }) => {
  await openScreen(page, '/khu-ban', 'Khu & bàn');
  const busy = page.getByRole('row', { name: /Đang ngồi|Đã in tạm tính|Lỗi in phiếu/ }).first();
  await expect(busy.getByRole('button', { name: /Xóa bàn/ })).toBeDisabled();
});

test('nhân viên: thêm, PIN trùng bị chặn, đổi vai trò, cho nghỉ', async ({ page }) => {
  const name = uniq('Đỗ Văn Mới');
  await openScreen(page, '/nhan-vien', 'Nhân viên');

  await page.getByRole('button', { name: 'Thêm nhân viên' }).click();
  let box = dialog(page, 'Thêm nhân viên');
  await box.getByLabel('Họ tên').fill(name);
  await box.getByLabel('PIN').fill('1111');
  await box.getByRole('button', { name: 'Lưu' }).click();
  await expect(box.locator('.form-error')).toContainText('PIN đã được dùng');
  const pin = String(4000 + Math.floor(Math.random() * 5000));
  await box.getByLabel('PIN').fill(pin);
  await box.getByRole('button', { name: 'Lưu' }).click();
  const row = page.getByRole('row', { name: new RegExp(name) });
  await expect(row).toContainText('Nhân viên quầy');

  await row.getByRole('button', { name: `Sửa ${name}` }).click();
  box = dialog(page, 'Sửa nhân viên');
  await box.getByLabel('Vai trò').selectOption({ label: 'Quản lý ca' });
  await box.getByLabel('Email đăng nhập web').fill(`${pin}@biahoi.vn`);
  await box.getByLabel('Mật khẩu web').fill('matkhau123');
  await box.getByText('Đang làm việc').click();
  await box.getByRole('button', { name: 'Lưu' }).click();
  await expect(row).toContainText('Quản lý ca');
  await expect(row).toContainText('Đã nghỉ');
});

test('nhân viên: chủ quán không tự khóa được tài khoản của mình', async ({ page }) => {
  await openScreen(page, '/nhan-vien', 'Nhân viên');
  await page.getByRole('row', { name: /Bạn/ }).getByRole('button', { name: /Sửa/ }).click();
  const box = dialog(page, 'Sửa nhân viên');
  await expect(box.getByLabel('Vai trò')).toBeDisabled();
  await expect(box.getByRole('checkbox')).toBeDisabled();
});

// FR-11: thực đơn và nhóm món — thêm, sửa giá, bật/tắt còn món, xóa.
import { dialog, expect, openScreen, test, uniq } from './helpers';

test('thêm, sửa giá, đánh dấu hết, rồi xóa một món', async ({ page }) => {
  const name = uniq('Ốc luộc sả');
  await openScreen(page, '/thuc-don', 'Thực đơn');

  await page.getByRole('button', { name: 'Thêm món' }).click();
  const add = dialog(page, 'Thêm món');
  await add.getByLabel('Tên món').fill(name);
  await add.getByLabel('Nhóm').selectOption({ label: 'Món khác' });
  await add.getByLabel('Giá (đ)').fill('45000');
  await add.getByLabel('Trạm in').selectOption({ label: 'Bếp' });
  await add.getByRole('button', { name: 'Lưu' }).click();
  await expect(add).toBeHidden();

  const row = page.getByRole('row', { name: new RegExp(name) });
  await expect(row).toContainText('45.000');
  await expect(row).toContainText('Bếp');

  await row.getByRole('button', { name: `Sửa ${name}` }).click();
  const edit = dialog(page, 'Sửa món');
  await edit.getByLabel('Giá (đ)').fill('50000');
  await edit.getByRole('button', { name: 'Lưu' }).click();
  await expect(edit).toBeHidden();
  await expect(row).toContainText('50.000');

  await row.getByRole('checkbox').uncheck();
  await expect(row).toContainText('Hết');

  await row.getByRole('button', { name: `Sửa ${name}` }).click();
  await dialog(page, 'Sửa món').getByRole('button', { name: 'Xóa món' }).click();
  await expect(page.getByRole('row', { name: new RegExp(name) })).toHaveCount(0);
});

test('thêm món bia hơi phải chọn thể tích và vòi', async ({ page }) => {
  const name = uniq('Bia hơi vại 1L');
  await openScreen(page, '/thuc-don', 'Thực đơn');
  await page.getByRole('button', { name: 'Thêm món' }).click();
  const add = dialog(page, 'Thêm món');
  await add.getByLabel('Tên món').fill(name);
  await add.getByLabel('Giá (đ)').fill('28000');
  await add.getByText('Món bia hơi').click();
  await add.getByLabel('Thể tích mỗi phần (lít)').fill('1');
  await add.getByLabel('Vòi mặc định').selectOption({ label: 'Vòi 1' });
  await add.getByRole('button', { name: 'Lưu' }).click();
  await expect(page.getByRole('row', { name: new RegExp(name) })).toContainText('1 L · Vòi 1');
});

test('mã tắt trùng bị từ chối với thông báo rõ', async ({ page }) => {
  await openScreen(page, '/thuc-don', 'Thực đơn');
  await page.getByRole('button', { name: 'Thêm món' }).click();
  const add = dialog(page, 'Thêm món');
  await add.getByLabel('Tên món').fill(uniq('Món trùng mã'));
  await add.getByLabel('Mã tắt').fill('b');
  await add.getByLabel('Giá (đ)').fill('10000');
  await add.getByRole('button', { name: 'Lưu' }).click();
  await expect(add.locator('.form-error')).toContainText('trùng');
});

test('nhóm món: thêm, đổi tên, xóa nhóm rỗng', async ({ page, promptAnswer }) => {
  const group = uniq('Đồ hấp');
  await openScreen(page, '/thuc-don', 'Thực đơn');
  await page.getByRole('button', { name: 'Nhóm món' }).click();
  const box = dialog(page, 'Nhóm món');
  await box.getByLabel('Tên nhóm mới').fill(group);
  await box.getByRole('button', { name: 'Thêm nhóm' }).click();
  await expect(box.getByText(group)).toBeVisible();

  promptAnswer.value = `${group} nóng`;
  await box.getByRole('button', { name: `Đổi tên ${group}` }).click();
  await expect(box.getByText(`${group} nóng`)).toBeVisible();

  await box.getByRole('button', { name: `Xóa ${group} nóng` }).click();
  await expect(box.getByText(`${group} nóng`)).toHaveCount(0);
});

test('ảnh món: chọn ảnh khi thêm món, ảnh hiện trong bảng, bỏ ảnh được', async ({ page }) => {
  const name = uniq('Ốc xào me');
  // ảnh PNG 1×1 điểm; trình duyệt thu nhỏ rồi gửi dạng JPEG
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
  await openScreen(page, '/thuc-don', 'Thực đơn');

  await page.getByRole('button', { name: 'Thêm món' }).click();
  const add = dialog(page, 'Thêm món');
  await add.getByLabel('Tên món').fill(name);
  await add.getByLabel('Nhóm').selectOption({ label: 'Món khác' });
  await add.getByLabel('Giá (đ)').fill('60000');
  await add.locator('input[type=file]').setInputFiles({ name: 'oc.png', mimeType: 'image/png', buffer: png });
  await expect(add.getByRole('img', { name: 'Ảnh món' })).toBeVisible();
  await add.getByRole('button', { name: 'Lưu' }).click();
  await expect(add).toBeHidden();

  const row = page.getByRole('row', { name: new RegExp(name) });
  const thumb = row.locator('img.thumb');
  await expect(thumb).toHaveAttribute('src', /\/uploads\/mon-\d+-[0-9a-f]{8}\.jpg$/);
  await expect.poll(() => thumb.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth)).toBeGreaterThan(0);

  await row.getByRole('button', { name: `Sửa ${name}` }).click();
  const edit = dialog(page, 'Sửa món');
  await edit.getByRole('button', { name: 'Bỏ ảnh' }).click();
  await expect(edit.getByText('Chưa có ảnh')).toBeVisible();
  await edit.getByRole('button', { name: 'Lưu' }).click();
  await expect(row.locator('img.thumb')).toHaveCount(0);

  await row.getByRole('button', { name: `Sửa ${name}` }).click();
  await dialog(page, 'Sửa món').getByRole('button', { name: 'Xóa món' }).click();
  await expect(page.getByRole('row', { name: new RegExp(name) })).toHaveCount(0);
});

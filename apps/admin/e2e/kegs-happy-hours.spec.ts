// FR-14 nhập kho keg, FR-10 thay keg, FR-15 giờ vàng.
import { dialog, expect, openScreen, test, uniq } from './helpers';

test('nhập 2 keg rồi thay keg ở Vòi 2: keg cũ chuyển "Đã hết"', async ({ page }) => {
  await openScreen(page, '/kho-keg', 'Kho keg & vòi');
  const stockTab = page.getByRole('tab', { name: /Trong kho/ });
  await expect(stockTab).toContainText(/\d/);
  const before = Number((await stockTab.textContent())!.replace(/\D/g, ''));

  await page.getByRole('button', { name: 'Nhập keg' }).click();
  const box = dialog(page, 'Nhập keg');
  await box.getByLabel('Số lượng keg').fill('2');
  await expect(box.getByText(/Tổng 2 keg/)).toBeVisible();
  await box.getByRole('button', { name: 'Nhập kho' }).click();
  await expect(stockTab).toContainText(String(before + 2));

  const tap2 = page.locator('.keg-row', { hasText: 'Vòi 2' });
  const oldKeg = (await tap2.textContent())!.match(/keg #(\d+)/)![1]!;
  await page.getByRole('button', { name: 'Thay keg Vòi 2' }).click();
  const change = dialog(page, 'Thay keg Vòi 2');
  await expect(change).toContainText(`Keg #${oldKeg} đang gắn`);
  await change.getByRole('button', { name: 'Thay keg' }).click();
  await expect(change).toBeHidden();
  await expect(tap2).not.toContainText(`keg #${oldKeg},`);
  await expect(stockTab).toContainText(String(before + 1));

  await page.getByRole('tab', { name: /Đã hết/ }).click();
  await expect(page.getByRole('row', { name: new RegExp(`Keg #${oldKeg}\\b`) })).toBeVisible();
});

test('giờ vàng: thêm khung cuối tuần, sửa giờ, tắt, rồi xóa', async ({ page }) => {
  const name = uniq('Giờ vàng cuối tuần');
  await openScreen(page, '/gio-vang', 'Giờ vàng');

  await page.getByRole('button', { name: 'Thêm khung giờ' }).click();
  let box = dialog(page, 'Thêm khung giờ vàng');
  await box.getByLabel('Tên khung').fill(name);
  for (const d of ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN']) await box.getByRole('button', { name: d, exact: true }).click();
  await box.getByLabel('Bắt đầu').fill('21:00');
  await box.getByLabel('Kết thúc').fill('23:00');
  await box.getByLabel('Món', { exact: true }).selectOption({ label: 'Bia hơi cốc 0,5L — giá thường 15.000 đ' });
  await box.getByLabel('Giá giờ vàng').fill('13000');
  await box.getByRole('button', { name: 'Lưu' }).click();

  const row = page.getByRole('row', { name: new RegExp(name) });
  await expect(row).toContainText('T7, CN');
  await expect(row).toContainText('21:00–23:00');
  await expect(row).toContainText('13.000');
  await expect(page.locator('.week-row', { hasText: 'T7' }).locator('.week-span')).toContainText('21:00–23:00');

  await row.getByRole('button', { name: `Sửa ${name}` }).click();
  box = dialog(page, 'Sửa khung giờ vàng');
  await box.getByLabel('Kết thúc').fill('23:30');
  await box.getByRole('button', { name: 'Lưu' }).click();
  await expect(row).toContainText('21:00–23:30');

  await row.getByRole('checkbox', { name: `Bật ${name}` }).uncheck();
  await expect(page.locator('.week-row', { hasText: 'T7' }).locator('.week-span.off')).toBeVisible();

  await row.getByRole('button', { name: `Sửa ${name}` }).click();
  await dialog(page, 'Sửa khung giờ vàng').getByRole('button', { name: 'Xóa khung' }).click();
  await expect(page.getByRole('row', { name: new RegExp(name) })).toHaveCount(0);
});

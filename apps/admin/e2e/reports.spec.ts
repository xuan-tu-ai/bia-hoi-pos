// FR-16..FR-19, FR-09: các màn báo cáo hiển thị số liệu từ dữ liệu demo.
import { expect, openScreen, test } from './helpers';

test('Hôm nay: đã thu, bàn đang ngồi, vòi bia, keg vừa hết', async ({ page }) => {
  await openScreen(page, '/', 'Hôm nay');
  await expect(page.locator('.kpi.lead .kpi-value')).toContainText('đ');
  await expect(page.getByText(/\/80/)).toBeVisible();
  await expect(page.locator('.keg-strip li')).toHaveCount(2);
  await expect(page.getByRole('img', { name: /Vòi 1: đã bán/ })).toBeVisible();
  await expect(page.locator('.keg-item').first()).toContainText('Hao hụt');
});

test('Hao hụt keg: keg #1 mất 4,0 L = 8,0%, tô đỏ, tiền mất 76.000 đ', async ({ page }) => {
  await openScreen(page, '/hao-hut-keg', 'Hao hụt keg');
  const row = page.getByRole('row', { name: /Keg #1/ });
  await expect(row).toContainText('46,0');
  await expect(row).toContainText('4,0');
  await expect(row).toContainText('76.000');
  await expect(row.locator('.pill.neg')).toHaveText('8,0%');
  // Nâng ngưỡng lên 10% thì keg #1 (8%) không còn tô đỏ
  await page.getByLabel('Ngưỡng hao hụt (%)').fill('10');
  await expect(page.locator('.title-row .sub')).toContainText('vượt ngưỡng 10,0%');
  await expect(row.locator('.pill.neg')).toHaveCount(0);
});

test('Nhật ký hủy/giảm: có dòng trong 7 ngày, lọc theo lý do thu hẹp danh sách', async ({ page }) => {
  await openScreen(page, '/nhat-ky-huy', 'Nhật ký hủy/giảm');
  const rows = page.locator('tbody tr');
  await expect(rows.first()).toBeVisible();
  const all = await rows.count();
  await page.getByLabel('Lý do').selectOption({ label: 'Nhập nhầm' });
  await expect(page.locator('.title-row .sub')).toContainText(`lọc từ ${all} lần`);
  for (const reason of await page.locator('tbody tr td:nth-child(6)').allTextContents()) expect(reason).toContain('Nhập nhầm');
});

test('Bán chạy: top 10 và biểu đồ giờ; đổi sang xếp theo doanh thu', async ({ page }) => {
  await openScreen(page, '/ban-chay', 'Bán chạy & giờ cao điểm');
  await expect(page.locator('.chart ol li')).toHaveCount(10);
  await expect(page.locator('.chart ol li').first()).toContainText('Bia hơi cốc');
  await page.getByRole('button', { name: 'Doanh thu' }).click();
  await expect(page.locator('.chart ol li').first()).toContainText('đ');
  await expect(page.getByText('Giờ đông nhất')).toBeVisible();
});

test('Ca làm việc: ca đang mở và các ca đã đóng có chênh lệch', async ({ page }) => {
  await openScreen(page, '/ca', 'Ca làm việc');
  await expect(page.getByText('Đang mở').first()).toBeVisible();
  await expect(page.locator('tbody tr')).not.toHaveCount(0);
  await expect(page.locator('.title-row .sub')).toContainText('ca');
});

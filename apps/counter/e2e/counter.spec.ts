// App quầy, FR-01 đến FR-10, chạy như nhân viên quầy thật trên màn 1366×768.
import { expect, test, type Page } from '@playwright/test';
import { addItem, emptyTables, goArea, login, openTable, priceOf, sendRound, tile, totalOf, typePin, vnd } from './helpers';

const printed = (page: Page) => page.evaluate(() => (window as unknown as { __printed?: string[] }).__printed ?? []);

test.describe('FR-01 đăng nhập PIN', () => {
  test('PIN sai báo số lần còn lại; đúng thì vào sơ đồ; "Đổi người" về màn khóa', async ({ page }) => {
    await page.goto('/quay/');
    await expect(page.getByRole('heading', { level: 1, name: 'Nhập PIN để vào quầy' })).toBeVisible();
    await typePin(page, '0000');
    await expect(page.getByRole('alert')).toContainText('còn 4 lần thử');
    await typePin(page, '1111');
    await expect(page.getByRole('tablist', { name: 'Khu' }).getByRole('tab')).toHaveCount(3);
    await expect(page.getByText('Lê Văn Quầy')).toBeVisible();

    await page.getByRole('button', { name: 'Đổi người' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Nhập PIN để vào quầy' })).toBeVisible();
    await typePin(page, '2222');
    await expect(page.getByText('Phạm Thị Thu Ngân')).toBeVisible();
  });
});

test('FR-02/FR-03: mở bàn trên máy A, máy B thấy trong vòng 3 giây', async ({ browser }) => {
  const a = await (await browser.newContext({ viewport: { width: 1366, height: 768 } })).newPage();
  const b = await (await browser.newContext({ viewport: { width: 1366, height: 768 } })).newPage();
  await login(a, '1111');
  await login(b, '2222');
  const [code] = await emptyTables(a, 'Sân');
  await goArea(b, 'Sân');
  await expect(tile(b, code!)).toHaveAttribute('aria-label', /Trống/);

  await openTable(a, 'Sân', code!, 4);
  await expect(tile(b, code!)).toHaveAttribute('aria-label', /Đang ngồi/, { timeout: 3_000 });

  // Máy B chạm vào bàn đó: vào đúng phiên đã mở, không mở phiên thứ hai
  await tile(b, code!).click();
  await expect(b.getByRole('heading', { level: 1, name: `Bàn ${code}` })).toBeVisible();
  await expect(b.getByText(/4 khách/)).toBeVisible();
  await a.context().close();
  await b.context().close();
});

test('FR-04 → FR-08: gọi món, lỗi in, hủy có duyệt, tạm tính, chuyển, gộp, thanh toán tiền mặt', async ({ page }) => {
  await login(page);
  const [first, second, third] = await emptyTables(page, 'Trong nhà');
  await openTable(page, 'Trong nhà', first!, 2);

  // FR-04: mã tắt + Enter, chạm món, tăng số lượng, gửi & in theo trạm
  await page.getByLabel('Tìm món').fill('b');
  await page.getByLabel('Tìm món').press('Enter');
  await page.getByLabel('Tìm món').fill('');
  await addItem(page, 'Sườn nướng');
  await page.getByRole('button', { name: 'Thêm Bia hơi cốc 0,5L' }).click();
  const cup = await priceOf(page, 'Bia hơi cốc 0,5L');
  const ribs = await priceOf(page, 'Sườn nướng');
  await sendRound(page);
  await expect(page.getByRole('status')).toContainText('2 phiếu');
  expect(await printed(page)).toContain(`Phiếu bàn ${first}`);
  await expect.poll(() => totalOf(page)).toBe(2 * cup + ribs);

  // Máy in hỏng: báo lỗi in → bàn đỏ, có nút In lại
  await page.getByRole('button', { name: 'Phiếu không ra? Báo lỗi in' }).click();
  await expect(page.getByRole('button', { name: 'Lỗi in · In lại' })).toBeVisible();
  await page.getByRole('button', { name: 'Lỗi in · In lại' }).click();
  await expect(page.getByRole('status')).toContainText('Đã in lại');
  await expect(page.getByRole('button', { name: 'Lỗi in · In lại' })).toHaveCount(0);

  // FR-06: hủy Sườn nướng — PIN nhân viên bị từ chối, PIN quản lý thì được
  await page.getByRole('button', { name: /^Sườn nướng, 1 phần/ }).click();
  const adjust = page.getByRole('dialog', { name: 'Sườn nướng ×1' });
  await expect(adjust.getByRole('button', { name: 'Xin duyệt' })).toBeDisabled();
  await adjust.getByRole('button', { name: 'Bếp hết món' }).click();
  await adjust.getByRole('button', { name: 'Xin duyệt' }).click();
  const approve = page.getByRole('dialog', { name: 'Quản lý ca duyệt' });
  await expect(approve).toContainText('Hủy 1 Sườn nướng');
  for (const d of '1111') await approve.getByRole('button', { name: d, exact: true }).click();
  await approve.getByRole('button', { name: 'Duyệt' }).click();
  await expect(approve.getByRole('alert')).toContainText('không thuộc Quản lý ca');
  for (const d of '8888') await approve.getByRole('button', { name: d, exact: true }).click();
  await approve.getByRole('button', { name: 'Duyệt' }).click();
  await expect(approve).toBeHidden();
  await expect(page.getByText(/Hủy 1 · Bếp hết món · Lê Văn Quầy, duyệt: Trần Thị Quản Lý/)).toBeVisible();
  await expect.poll(() => totalOf(page)).toBe(2 * cup);
  // gửi, in lại, phiếu báo hủy xuống bếp
  expect((await printed(page)).filter((t) => t === `Phiếu bàn ${first}`).length).toBeGreaterThanOrEqual(3);

  // FR-07: tạm tính → bàn vàng, vẫn gọi thêm được
  await page.getByRole('button', { name: 'Tạm tính' }).click();
  await expect(page.getByRole('status')).toContainText('tạm tính — lần in 1');
  await expect(page.locator('.status-chip')).toHaveText('Đã in tạm tính');

  // FR-05: chuyển sang bàn trống
  await page.getByRole('button', { name: 'Chuyển' }).click();
  await page.getByRole('dialog').getByRole('button', { name: new RegExp(`^Bàn ${second},`) }).click();
  await expect(page.getByRole('heading', { level: 1, name: `Bàn ${second}` })).toBeVisible();
  await expect(page.getByRole('status')).toContainText(`Đã chuyển sang bàn ${second}`);
  const moved = await totalOf(page);

  // FR-05: mở bàn thứ ba, gọi món, gộp vào bàn vừa chuyển → tổng = tổng hai phiên
  await page.getByRole('button', { name: 'Sơ đồ bàn' }).first().click();
  await openTable(page, 'Trong nhà', third!);
  await addItem(page, 'Lạc rang');
  await sendRound(page);
  const peanuts = await totalOf(page);
  await page.getByRole('button', { name: 'Gộp' }).click();
  await page.getByRole('dialog').getByRole('button', { name: new RegExp(`^Bàn ${second},`) }).click();
  await expect(page.getByRole('heading', { level: 1, name: `Bàn ${second}` })).toBeVisible();
  await expect.poll(() => totalOf(page)).toBe(moved + peanuts);

  // FR-08: tiền mặt, khách đưa 500.000 → tiền thừa; hoàn tất → bàn về trống
  await page.getByRole('button', { name: 'Thanh toán' }).click();
  await expect(page.locator('.due .value')).toContainText(vnd(moved + peanuts));
  await expect(page.getByRole('button', { name: 'Hoàn tất & in hóa đơn' })).toBeDisabled();
  await page.getByRole('button', { name: '500.000', exact: true }).click();
  await expect(page.locator('.change')).toContainText(vnd(500_000 - moved - peanuts));
  await page.getByRole('button', { name: 'Hoàn tất & in hóa đơn' }).click();
  await expect(page.getByText(`Đã thanh toán bàn ${second}`)).toBeVisible();
  await goArea(page, 'Trong nhà');
  for (const code of [first, second, third]) await expect(tile(page, code!)).toHaveAttribute('aria-label', /Trống/);
});

test('FR-08: chuyển khoản VietQR phải xác nhận đã nhận tiền; giảm giá hóa đơn cần PIN quản lý', async ({ page }) => {
  await login(page);
  const [code] = await emptyTables(page, 'Tầng 2');
  await openTable(page, 'Tầng 2', code!);
  await addItem(page, 'Lẩu riêu cua');
  await sendRound(page);
  await page.getByRole('button', { name: 'Thanh toán' }).click();

  await page.getByRole('button', { name: 'Giảm giá cả hóa đơn' }).click();
  const disc = page.getByRole('dialog', { name: 'Giảm giá cả hóa đơn' });
  await disc.getByRole('button', { name: 'Khác', exact: true }).click();
  await expect(disc.getByRole('button', { name: 'Xin duyệt' })).toBeDisabled(); // "Khác" cần ghi chú
  await disc.getByLabel(/Ghi chú/).fill('Khách quen');
  await disc.getByRole('button', { name: 'Xin duyệt' }).click();
  const approve = page.getByRole('dialog', { name: 'Quản lý ca duyệt' });
  for (const d of '8888') await approve.getByRole('button', { name: d, exact: true }).click();
  await approve.getByRole('button', { name: 'Duyệt' }).click();
  await expect(page.getByText('Giảm giá hóa đơn (Khách quen)')).toBeVisible();
  await expect(page.locator('.due .value')).toContainText(vnd(225_000));

  await page.getByRole('button', { name: 'Chuyển khoản', exact: true }).click();
  const qr = page.getByRole('img', { name: /Mã VietQR chuyển 225\.000 đồng, nội dung BH\d{6}/ });
  await expect(qr.locator('svg')).toBeVisible();
  const done = page.getByRole('button', { name: 'Hoàn tất & in hóa đơn' });
  await expect(done).toBeDisabled();
  await page.getByRole('checkbox', { name: 'Đã nhận tiền chuyển khoản' }).check();
  await done.click();
  await expect(page.getByText(`Đã thanh toán bàn ${code}: 225.000 đ`)).toBeVisible();
});

test('FR-10: thay keg ở Vòi 2, keg cũ ra khỏi vòi', async ({ page }) => {
  await login(page);
  await page.getByRole('link', { name: 'Vòi bia' }).click();
  const card = page.locator('.tap-card', { hasText: 'Vòi 2' });
  await expect(card).toContainText('Keg #');
  const before = (await card.innerText()).match(/Keg #(\d+)/)![1];
  await card.getByRole('button', { name: 'Thay keg' }).click();
  const dialog = page.getByRole('dialog', { name: 'Thay keg Vòi 2' });
  await expect(dialog).toContainText(`Keg #${before}`);
  await dialog.getByRole('button', { name: 'Gắn keg đã chọn' }).click();
  await expect(dialog).toBeHidden();
  await expect(card).not.toContainText(`Keg #${before} ·`);
  await expect(card).toContainText('0,0');
});

test('FR-09: đóng ca cần PIN quản lý, in báo cáo; rồi mở ca mới', async ({ page }) => {
  await login(page);
  await page.getByRole('link', { name: 'Ca' }).click();
  await expect(page.getByRole('heading', { level: 1, name: /Ca đang mở/ })).toBeVisible();
  await page.getByRole('button', { name: 'Đóng ca' }).click();
  const dialog = page.getByRole('dialog', { name: 'Đóng ca' });
  await dialog.getByLabel('Tiền mặt đếm được trong két (đ)').fill('1500000');
  await expect(dialog).toContainText('chênh lệch');
  await dialog.getByRole('button', { name: 'Quản lý ca xác nhận' }).click();
  for (const d of '8888') await dialog.getByRole('button', { name: d, exact: true }).click();
  await dialog.getByRole('button', { name: 'Xác nhận đóng ca' }).click();
  await expect(page.getByText(/Đã đóng ca, Trần Thị Quản Lý xác nhận/)).toBeVisible();
  expect(await printed(page)).toContain('Báo cáo đóng ca');

  await expect(page.getByRole('heading', { level: 1, name: 'Chưa mở ca' })).toBeVisible();
  await page.getByRole('button', { name: '1.000.000', exact: true }).click();
  await page.getByRole('button', { name: 'Mở ca' }).click();
  await expect(page.getByRole('heading', { level: 1, name: /Ca đang mở/ })).toBeVisible();
});

// Đồng bộ giữa các máy quầy ngoài sơ đồ bàn (FR-02, FR-08): màn thanh toán cập nhật khi máy khác gọi thêm món,
// và dải báo khi máy quầy mất kết nối máy chủ.
import { expect, test } from '@playwright/test';
import { addItem, emptyTables, login, openTable, sendRound, tile } from './helpers';

test('FR-08: đang thanh toán ở máy A, máy B gọi thêm món thì số phải trả của A đổi ngay', async ({ browser }) => {
  const a = await (await browser.newContext({ viewport: { width: 1366, height: 768 } })).newPage();
  const b = await (await browser.newContext({ viewport: { width: 1366, height: 768 } })).newPage();
  await login(a);
  await login(b, '2222');
  const [code] = await emptyTables(a, 'Sân');
  await openTable(a, 'Sân', code!);
  await addItem(a, 'Bia hơi cốc 0,5L');
  await sendRound(a);
  await a.getByRole('button', { name: 'Thanh toán' }).click();
  const due = a.locator('.due .value');
  const before = Number((await due.innerText()).replace(/\D/g, ''));

  await b.getByRole('tablist', { name: 'Khu' }).getByRole('tab', { name: /^Sân/ }).click();
  await tile(b, code!).click();
  await addItem(b, 'Lạc rang');
  await sendRound(b);

  await expect(a.getByRole('alert')).toContainText('số phải trả đổi', { timeout: 3_000 });
  await expect.poll(async () => Number((await due.innerText()).replace(/\D/g, ''))).toBeGreaterThan(before);
  await a.getByRole('button', { name: 'Đã hiểu' }).click();
  await expect(a.getByRole('alert')).toHaveCount(0);
  await a.context().close();
  await b.context().close();
});

test('mất mạng thì hiện dải "Mất kết nối máy chủ", có mạng lại thì tự ẩn', async ({ page, context }) => {
  await login(page);
  await expect(page.getByRole('alert')).toHaveCount(0);
  await context.setOffline(true);
  await expect(page.getByRole('alert')).toContainText('Mất kết nối máy chủ', { timeout: 6_000 });
  await context.setOffline(false);
  await expect(page.getByRole('alert')).toHaveCount(0, { timeout: 15_000 });
});

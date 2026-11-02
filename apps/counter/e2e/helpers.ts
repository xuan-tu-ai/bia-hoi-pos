import { expect, type Page } from '@playwright/test';

/** Gõ PIN trên bàn phím cảm ứng của màn khóa. */
export async function typePin(page: Page, pin: string, submit = 'Vào quầy') {
  for (const d of pin) await page.getByRole('button', { name: d, exact: true }).click();
  await page.getByRole('button', { name: submit }).click();
}

export async function login(page: Page, pin = '1111') {
  await page.goto('/quay/');
  await typePin(page, pin);
  await expect(page.getByRole('tablist', { name: 'Khu' })).toBeVisible();
}

export async function goArea(page: Page, name: string) {
  await page.getByRole('tablist', { name: 'Khu' }).getByRole('tab', { name: new RegExp(`^${name}`) }).click();
}

export const tile = (page: Page, code: string) => page.getByRole('button', { name: new RegExp(`^Bàn ${code},`) });

/** Mở một bàn trống trên sơ đồ và vào màn bàn. */
export async function openTable(page: Page, area: string, code: string, guests?: number) {
  await goArea(page, area);
  await tile(page, code).click();
  const dialog = page.getByRole('dialog', { name: `Mở bàn ${code}` });
  if (guests) await dialog.getByRole('button', { name: String(guests), exact: true }).click();
  await dialog.getByRole('button', { name: 'Mở bàn' }).click();
  await expect(page.getByRole('heading', { level: 1, name: `Bàn ${code}` })).toBeVisible();
}

export async function addItem(page: Page, name: string) {
  await page.getByRole('button', { name: new RegExp(`^${name}, `) }).click();
}

export async function sendRound(page: Page) {
  await page.getByRole('button', { name: /^Gửi & in phiếu/ }).click();
  await expect(page.getByRole('status')).toContainText('Đã gửi in');
}

/** Giá đang hiện trên nút món (có thể là giá giờ vàng). */
export async function priceOf(page: Page, name: string): Promise<number> {
  const label = await page.getByRole('button', { name: new RegExp(`^${name}, `) }).getAttribute('aria-label');
  return Number(label!.match(/, ([\d.]+) đồng/)![1]!.replace(/\./g, ''));
}

export async function totalOf(page: Page): Promise<number> {
  const text = await page.locator('.tab-total .value').innerText();
  return Number(text.replace(/\D/g, ''));
}

export const vnd = (n: number) => n.toLocaleString('vi-VN');

/** Mã các bàn đang trống trong một khu (dữ liệu seed mở bàn ngẫu nhiên). */
export async function emptyTables(page: Page, area: string): Promise<string[]> {
  await goArea(page, area);
  await expect(page.locator('.table-grid .table-tile').first()).toBeVisible();
  const labels = await page.locator('.table-grid .table-tile').evaluateAll((els) => els.map((e) => e.getAttribute('aria-label') ?? ''));
  return labels.filter((l) => l.endsWith(', Trống')).map((l) => l.match(/^Bàn (\S+),/)![1]!);
}

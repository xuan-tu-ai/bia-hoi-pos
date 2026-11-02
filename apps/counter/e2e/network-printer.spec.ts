// In qua máy in mạng từ App quầy (FR-04, NFR-08): phiếu bếp do máy chủ gửi thẳng tới máy in nhiệt LAN.
// Máy in là một máy chủ TCP giả trong test. Backend chạy trong Docker thì nó gọi máy in qua host.docker.internal.
import net from 'node:net';
import { expect, test } from '@playwright/test';
import { addItem, emptyTables, login, openTable, sendRound, tile } from './helpers';

const PORT = Number(process.env.E2E_PRINTER_PORT ?? 9105);
const HOST = process.env.E2E_PRINTER_HOST ?? ((process.env.E2E_BASE_URL ?? '').includes(':8080') ? 'host.docker.internal' : '127.0.0.1');

let printer: net.Server | null = null;
let jobs = 0;
const startPrinter = () =>
  new Promise<void>((resolve) => {
    printer = net.createServer((s) => {
      s.on('data', () => {});
      s.on('end', () => jobs++);
    });
    printer.listen(PORT, '0.0.0.0', () => resolve());
  });
const stopPrinter = () => new Promise<void>((resolve) => (printer ? printer.close(() => resolve()) : resolve()));

async function ownerApi(baseURL: string) {
  const res = await fetch(`${baseURL}/api/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: 'chuquan@biahoi.vn', password: 'chuquan123' }),
  });
  const { token } = (await res.json()) as { token: string };
  return (path: string, method = 'GET', body?: unknown) =>
    fetch(`${baseURL}/api${path}`, {
      method,
      headers: { authorization: `Bearer ${token}`, ...(body ? { 'content-type': 'application/json' } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    }).then((r) => r.json());
}

test('trạm Bếp dùng máy in mạng: in thẳng; máy in tắt thì bàn đỏ, bật lại rồi In lại', async ({ page, baseURL }) => {
  const api = await ownerApi(baseURL!);
  const stations = (await api('/print-stations')) as { id: number; name: string }[];
  const kitchen = stations.find((s) => s.name === 'Bếp')!;
  await api(`/print-stations/${kitchen.id}`, 'PATCH', { connection: 'NETWORK', host: HOST, port: PORT });
  await startPrinter();
  try {
    await login(page);
    const [code] = await emptyTables(page, 'Sân');
    await openTable(page, 'Sân', code!);

    // Món bếp đi qua máy in mạng, bia vẫn in ở máy quầy
    await addItem(page, 'Sườn nướng');
    await addItem(page, 'Bia hơi cốc 0,5L');
    await sendRound(page);
    await expect(page.getByRole('status')).toContainText('Bếp: đã in');
    await expect(page.getByRole('status')).toContainText('Quầy rót bia: in ở máy quầy');
    expect(jobs).toBe(1);

    // Máy in bếp tắt: lượt vẫn lưu, bàn đỏ ngay, thông báo có nút In lại
    await stopPrinter();
    await addItem(page, 'Mực nướng');
    await page.getByRole('button', { name: /^Gửi & in phiếu/ }).click();
    await expect(page.getByRole('status')).toContainText('Bếp: Máy in');
    await expect(page.locator('.status-chip')).toHaveText('Lỗi in phiếu');
    await expect(page.getByRole('button', { name: 'Lỗi in · In lại' })).toBeVisible();

    // Bật lại máy in, bấm In lại → hết đỏ
    await startPrinter();
    await page.getByRole('button', { name: 'Lỗi in · In lại' }).click();
    await expect(page.getByRole('button', { name: 'Lỗi in · In lại' })).toHaveCount(0);
    expect(jobs).toBe(2);
    await page.getByRole('button', { name: 'Sơ đồ bàn' }).first().click();
    await expect(tile(page, code!)).toHaveAttribute('aria-label', /Đang ngồi/);
  } finally {
    await stopPrinter();
    await api(`/print-stations/${kitchen.id}`, 'PATCH', { connection: 'BROWSER', host: null });
  }
});

import { mockLogin } from './auth.ts';
import { getStoredSession } from '../lib/storage.ts';
import { posService, MENU } from './tabs.ts';
import type { ReportKegLoss, ReportSummary, ReportTopItems, ReportVoid } from '../types/index.ts';

const adminResources = new Set([
  'menu',
  'menu-groups',
  'menu-items',
  'kitchen-stations',
  'areas',
  'tables',
  'staff',
  'kegs',
  'happy-hours',
  'taps',
  'shifts'
]);

const reportSummary: ReportSummary = {
  revenue: 12840000,
  openAmount: 6420000,
  occupiedTables: 25,
  totalTables: 80,
  bills: 42
};

const kegLoss: ReportKegLoss = {
  threshold: 5,
  totalLossLiters: 6.5,
  totalLossAmount: 195000,
  kegs: [
    { kegId: 7, code: 'KEG-0007', beerName: 'Bia hơi Hà Nội', tapName: 'Vòi 1', capacityMl: 50000, soldMl: 46000, lossMl: 4000, lossPercent: 8, tappedAt: '2026-11-18T09:00:00.000Z', emptiedAt: '2026-11-18T22:10:00.000Z', overThreshold: true },
    { kegId: 5, code: 'KEG-0005', beerName: 'Bia hơi Hải Phòng', tapName: 'Vòi 2', capacityMl: 30000, soldMl: 28800, lossMl: 1200, lossPercent: 4, tappedAt: '2026-11-17T09:20:00.000Z', emptiedAt: '2026-11-18T20:10:00.000Z', overThreshold: false }
  ]
};

const voids: ReportVoid[] = [
  { id: 1, table: 'Bàn 12', item: 'Khoai tây chiên', quantity: -1, amount: 45000, reason: 'Khách đổi ý' },
  { id: 2, table: 'Bàn 08', item: 'Mực nướng', quantity: -1, amount: 13500, reason: 'Món lỗi' }
];

const topItems: ReportTopItems[] = [
  { id: 1, name: 'Bia hơi cốc 0,5L', quantity: 1284, revenue: 19260000 },
  { id: 2, name: 'Mực nướng', quantity: 186, revenue: 25110000 },
  { id: 3, name: 'Bia hơi ca 1,5L', quantity: 430, revenue: 18060000 }
];

function parseBody(options: RequestInit) {
  return typeof options.body === 'string' ? JSON.parse(options.body) as Record<string, unknown> : {};
}

export async function mockApiRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const method = (options.method ?? 'GET').toUpperCase();
  const body = parseBody(options);
  let result: unknown;

  if (path === '/auth/login' && method === 'POST') {
    const session = await mockLogin(String(body.email ?? ''), String(body.password ?? ''));
    const roleMap = { staff: 'COUNTER', manager: 'SHIFT_MANAGER', owner: 'OWNER' } as const;
    result = {
      token: session.token,
      user: {
        id: session.user.email === 'lan@biahoi.vn' ? 2 : session.user.email === 'minh@biahoi.vn' ? 3 : session.user.email === 'hung@biahoi.vn' ? 4 : 5,
        fullName: session.user.name,
        email: session.user.email,
        role: roleMap[session.user.role]
      }
    };
  } else if (path === '/auth/me' && method === 'GET') {
    const user = getStoredSession()?.user;
    if (user) {
      const roleMap = { staff: 'COUNTER', manager: 'SHIFT_MANAGER', owner: 'OWNER' } as const;
      result = { id: user.email === 'lan@biahoi.vn' ? 2 : user.email === 'minh@biahoi.vn' ? 3 : user.email === 'hung@biahoi.vn' ? 4 : 5, fullName: user.name, email: user.email, role: roleMap[user.role] };
    } else {
      result = null;
    }
  } else if (path.startsWith('/reports/today')) {
    result = reportSummary;
  } else if (path.startsWith('/reports/keg-loss')) {
    result = kegLoss;
  } else if (path.startsWith('/reports/voids')) {
    result = voids;
  } else if (path.startsWith('/reports/top-items')) {
    result = topItems;
  } else if (path.startsWith('/reports/hourly')) {
    result = Array.from({ length: 12 }, (_, hour) => ({ hour: hour + 9, revenue: (hour + 1) * 125000 }));
  } else if (path.startsWith('/menu')) {
    result = MENU;
  } else if (path.startsWith('/areas')) {
    result = posService.getData().areas.map((area) => ({
      id: area.id,
      name: area.name,
      tables: posService.getData().tables.filter((table) => table.areaId === area.id).map((table) => ({ id: table.id, code: String(table.id) }))
    }));
  } else if (path === '/tabs/summary') {
    const tables = posService.getData().tables;
    const occupied = tables.filter((table) => table.status !== 'empty').length;
    const openAmount = tables.reduce((sum, table) => table.status !== 'empty' ? sum + table.total : sum, 0);
    result = {
      occupied,
      totalTables: tables.length,
      openAmount,
      tables: tables.map((table) => ({
        tableId: table.id,
        areaId: table.areaId,
        code: String(table.id),
        status: table.status === 'empty' ? 'EMPTY' : table.status === 'provisional' ? 'PROVISIONAL_PRINTED' : 'OCCUPIED',
        tabId: table.status === 'empty' ? undefined : 300 + table.id,
        billNo: table.billNo,
        total: table.total,
        openedAt: table.openedAt,
        guestCount: table.guestCount,
        rounds: table.rounds
      }))
    };
  } else if (adminResources.has(path.slice(1)) && method === 'GET') {
    result = [];
  } else {
    throw new Error(`Mock API route is not implemented: ${method} ${path}`);
  }

  return result as T;
}

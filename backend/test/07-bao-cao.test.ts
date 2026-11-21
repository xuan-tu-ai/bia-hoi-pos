/**
 * BE-07: báo cáo — tổng quan hôm nay (FR-16), hao hụt keg (FR-17),
 * nhật ký hủy/giảm (FR-18), món bán chạy & giờ cao điểm (FR-19).
 * Chạy sau 04–06 nên dữ liệu gồm cả seed lẫn các hóa đơn, lần hủy, lần thay keg do test trước tạo ra.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { prisma } from '../src/lib/prisma.js';
import { api, loginAll } from './helpers.js';

beforeAll(loginAll);
afterAll(() => prisma.$disconnect());

const DAY = 24 * 3600_000;
/** 0h hôm nay theo giờ Việt Nam (UTC+7). */
function vnDayStart(at = new Date()) {
  const local = new Date(at.getTime() + 7 * 3600_000);
  local.setUTCHours(0, 0, 0, 0);
  return new Date(local.getTime() - 7 * 3600_000);
}

async function timed(who: string, url: string) {
  const t0 = Date.now();
  const res = await api.get(who, url);
  return { res, ms: Date.now() - t0 };
}

describe('Phân quyền báo cáo (SRS 2.2)', () => {
  it('nhân viên quầy không xem báo cáo; quản lý ca xem hôm nay & nhật ký hủy; chủ quán xem tất cả', async () => {
    for (const url of ['/reports/today', '/reports/voids', '/reports/keg-loss', '/reports/top-items', '/reports/hourly']) {
      expect((await api.get('lan', url)).status).toBe(403);
      expect((await api.get('hoa', url)).status).toBe(200);
    }
    expect((await api.get('hung', '/reports/today')).status).toBe(200);
    expect((await api.get('hung', '/reports/voids')).status).toBe(200);
    expect((await api.get('hung', '/reports/keg-loss')).status).toBe(403);
    expect((await api.get('hung', '/reports/top-items')).status).toBe(403);
  });
});

describe('FR-16 Tổng quan hôm nay', () => {
  it('doanh thu đã thu khớp tổng các hóa đơn đã thanh toán trong ngày; bàn đang ngồi khớp sơ đồ bàn', async () => {
    const res = (await api.get('hung', '/reports/today')).body;
    const paid = await prisma.tab.findMany({
      where: { status: 'PAID', closedAt: { gte: vnDayStart() } },
      include: { rounds: { include: { lines: true } } },
    });
    const expected = paid.reduce((s, t) => s + t.rounds.flatMap((r) => r.lines).reduce((a, l) => a + l.qty * l.unitPrice, 0) - t.billDiscount, 0);
    expect(res.revenue.value).toBe(expected);
    expect(res.bills.value).toBe(paid.length);
    expect(res.paymentSplit.cash + res.paymentSplit.transfer).toBe(expected);

    const summary = (await api.get('hung', '/tabs/summary')).body;
    expect(res.occupiedTables).toMatchObject({ value: summary.occupied, total: 80 });
    expect(res.openAmount.value).toBe(summary.openAmount);
    expect(res.hourly).toHaveLength(24);
    expect(res.revenue).toHaveProperty('changePercent');
  });
});

describe('FR-17 Hao hụt keg', () => {
  it('keg 50 L bán 92 cốc 0,5 L → hao hụt 4 L = 8%, vượt ngưỡng 5%', async () => {
    const res = await api.get('hoa', '/reports/keg-loss?threshold=5');
    expect(res.status).toBe(200);
    const k = res.body.kegs.find((x: { soldMl: number; capacityMl: number }) => x.soldMl === 46000 && x.capacityMl === 50000);
    expect(k).toMatchObject({ lossMl: 4000, lossPercent: 8, overThreshold: true });
    const cups = await prisma.orderLine.aggregate({ where: { kegId: k.kegId }, _sum: { qty: true } });
    expect(cups._sum.qty).toBe(92);
    expect(res.body.totalLossLiters).toBeGreaterThanOrEqual(4);
  });

  it('keg vừa thay ra (FR-10) có trong báo cáo; đổi ngưỡng thì đổi keg tô đỏ', async () => {
    const changed = await prisma.auditLog.findFirstOrThrow({ where: { action: 'KEG_CHANGED' }, orderBy: { id: 'desc' } });
    const oldKegId = (changed.payload as { oldKegId: number }).oldKegId;
    const loose = (await api.get('hoa', '/reports/keg-loss?threshold=100')).body;
    expect(loose.kegs.some((k: { kegId: number }) => k.kegId === oldKegId)).toBe(true);
    expect(loose.kegs.every((k: { overThreshold: boolean }) => !k.overThreshold)).toBe(true);
  });
});

describe('FR-18 Nhật ký hủy/giảm', () => {
  it('mọi lần hủy/giảm món và giảm giá hóa đơn trong khoảng ngày đều có mặt', async () => {
    const from = new Date(vnDayStart().getTime() - 6 * DAY);
    const res = (await api.get('hoa', '/reports/voids')).body;
    const [lines, bills] = await Promise.all([
      prisma.orderLine.count({ where: { lineType: { in: ['VOID', 'DISCOUNT'] }, createdAt: { gte: from } } }),
      prisma.tab.count({ where: { status: 'PAID', billDiscount: { gt: 0 }, closedAt: { gte: from } } }),
    ]);
    expect(res.items.filter((i: { type: string }) => i.type !== 'BILL_DISCOUNT')).toHaveLength(lines);
    expect(res.items.filter((i: { type: string }) => i.type === 'BILL_DISCOUNT')).toHaveLength(bills);
    expect(res.count).toBe(lines + bills);

    // lần hủy khoai có PIN của Hùng ở test FR-06
    expect(res.items.some((i: { type: string; itemName: string; approvedBy: { fullName: string } | null }) =>
      i.type === 'VOID' && i.itemName === 'Khoai tây chiên' && i.approvedBy?.fullName === 'Lê Văn Hùng')).toBe(true);
  });

  it('lọc theo lý do và người duyệt', async () => {
    const hung = await prisma.staff.findUniqueOrThrow({ where: { email: 'hung@biahoi.vn' } });
    const byReason = (await api.get('hoa', '/reports/voids?reason=DEFECTIVE')).body;
    expect(byReason.items.length).toBeGreaterThan(0);
    expect(byReason.items.every((i: { reason: string }) => i.reason === 'DEFECTIVE')).toBe(true);
    const byApprover = (await api.get('hoa', `/reports/voids?approverId=${hung.id}`)).body;
    expect(byApprover.items.every((i: { approvedBy: { id: number } }) => i.approvedBy.id === hung.id)).toBe(true);
  });
});

describe('FR-19 Món bán chạy & giờ cao điểm', () => {
  it('khoảng quá 31 ngày → lỗi; ngày bắt đầu sau ngày kết thúc → lỗi', async () => {
    const bad = await api.get('hoa', '/reports/top-items?from=2026-01-01&to=2026-03-01');
    expect(bad.status).toBe(400);
    expect(bad.body.error.code).toBe('RANGE_TOO_LARGE');
    expect((await api.get('hoa', '/reports/hourly?from=2026-01-01&to=2026-03-01')).body.error.code).toBe('RANGE_TOO_LARGE');
    expect((await api.get('hoa', '/reports/top-items?from=2026-11-10&to=2026-11-01')).status).toBe(400);
  });

  it('top 10 xếp theo doanh thu giảm dần', async () => {
    const res = (await api.get('hoa', '/reports/top-items?by=revenue')).body;
    expect(res.items.length).toBeGreaterThan(0);
    expect(res.items.length).toBeLessThanOrEqual(10);
    const revenues = res.items.map((i: { revenue: number }) => i.revenue);
    expect(revenues).toEqual([...revenues].sort((a, b) => b - a));
  });

  it('doanh thu theo giờ tính theo thời điểm thanh toán; tổng khớp tiền thu trong khoảng', async () => {
    const res = (await api.get('hoa', '/reports/hourly')).body;
    expect(res.hours).toHaveLength(24);
    const from = new Date(vnDayStart().getTime() - 6 * DAY);
    const sum = await prisma.payment.aggregate({ where: { createdAt: { gte: from } }, _sum: { amount: true } });
    expect(res.hours.reduce((s: number, h: { revenue: number }) => s + h.revenue, 0)).toBe(sum._sum.amount);
  });

  it('mỗi báo cáo tải xong trong ≤ 3 giây với dữ liệu mẫu', async () => {
    for (const url of ['/reports/today', '/reports/keg-loss', '/reports/voids', '/reports/top-items', '/reports/hourly']) {
      const { res, ms } = await timed('hoa', url);
      expect(res.status).toBe(200);
      expect(ms).toBeLessThanOrEqual(3000);
    }
  });
});

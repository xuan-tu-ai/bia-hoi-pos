/**
 * Truy vấn dùng chung cho các module phiên bàn & thanh toán.
 */
import { Prisma } from '@prisma/client';
import type { Tx } from '../../lib/prisma.js';
import { conflict, notFound } from '../../lib/errors.js';
import { vnYmd } from '../../lib/time.js';

/** Khóa dòng bàn đến hết transaction — chặn hai máy cùng mở / chuyển vào một bàn (FR-03). */
export async function lockTables(tx: Tx, ids: number[]) {
  const sorted = [...new Set(ids)].sort((a, b) => a - b); // khóa theo thứ tự để tránh deadlock
  for (const id of sorted) await tx.$queryRaw`SELECT id FROM "DiningTable" WHERE id = ${id} FOR UPDATE`;
}

/** Khóa phiên bàn đến hết transaction và kiểm tra còn đang mở. */
export async function lockOpenTab(tx: Tx, tabId: number) {
  const rows = await tx.$queryRaw<{ id: number; status: string }[]>`
    SELECT id, status::text AS status FROM "Tab" WHERE id = ${tabId} FOR UPDATE`;
  if (rows.length === 0) throw notFound('Không tìm thấy phiên bàn');
  if (rows[0].status !== 'OPEN') {
    throw conflict('TAB_NOT_OPEN', rows[0].status === 'PAID' ? 'Hóa đơn đã thanh toán, không thể sửa' : 'Phiên bàn đã được gộp sang bàn khác');
  }
}

/** Σ qty × unitPrice theo từng phiên (chưa trừ giảm giá hóa đơn). */
export async function subtotalsByTab(tx: Tx, tabIds: number[]): Promise<Map<number, number>> {
  const map = new Map<number, number>();
  if (tabIds.length === 0) return map;
  const rows = await tx.$queryRaw<{ tabId: number; subtotal: bigint }[]>`
    SELECT r."tabId" AS "tabId", COALESCE(SUM(l.qty * l."unitPrice"), 0)::bigint AS subtotal
    FROM "OrderLine" l JOIN "OrderRound" r ON r.id = l."roundId"
    WHERE r."tabId" IN (${Prisma.join(tabIds)})
    GROUP BY r."tabId"`;
  for (const r of rows) map.set(r.tabId, Number(r.subtotal));
  return map;
}

export async function subtotalOf(tx: Tx, tabId: number) {
  return (await subtotalsByTab(tx, [tabId])).get(tabId) ?? 0;
}

/** Số hóa đơn: HD-<ngày mở bàn>-<id phiên 4 chữ số>, biết trước được để in vào nội dung VietQR. */
export function billNoOf(tab: { id: number; openedAt: Date }) {
  return `HD-${vnYmd(tab.openedAt)}-${String(tab.id).padStart(4, '0')}`;
}

const staffBrief = { select: { id: true, fullName: true } } as const;

export const tabDetailInclude = {
  table: { include: { area: { select: { id: true, name: true } } } },
  openedBy: staffBrief,
  rounds: {
    orderBy: { id: 'asc' },
    include: {
      createdBy: staffBrief,
      lines: {
        orderBy: { id: 'asc' },
        include: {
          menuItem: { select: { id: true, name: true, unit: true, station: { select: { id: true, name: true } } } },
          requestedBy: staffBrief,
          approvedBy: staffBrief,
        },
      },
    },
  },
  prints: { where: { kind: 'PROVISIONAL' }, orderBy: { printNo: 'desc' }, take: 1 },
} satisfies Prisma.TabInclude;

export type TabWithDetail = Prisma.TabGetPayload<{ include: typeof tabDetailInclude }>;

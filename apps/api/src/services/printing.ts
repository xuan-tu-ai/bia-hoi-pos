// Phát phiếu tới trạm in (FR-04, NFR-08). Trạm NETWORK: backend gửi thẳng tới máy in nhiệt qua mạng.
// Trạm BROWSER: trả phiếu về cho App quầy in bằng hộp thoại in (máy in mặc định của máy quầy).

import { escposJob, sendToPrinter } from '../lib/printing/escpos';
import { renderLines, type PrintLine } from '../lib/printing/render';
import { prisma } from '../lib/prisma';
import type { PrintTicket } from './tabs';

export interface DeliveredTicket extends PrintTicket {
  delivery: 'network' | 'browser';
  /** true: đã gửi tới máy in mạng; false: gửi lỗi; null: App quầy tự in */
  printed: boolean | null;
  error: string | null;
}

export function ticketLines(t: PrintTicket): PrintLine[] {
  return [
    { kind: 'text', text: t.title, size: 26, bold: true, align: 'center' },
    { kind: 'text', text: t.stationName, size: 22, align: 'center' },
    { kind: 'text', text: `Bàn ${t.tableCode}`, size: 52, bold: true, align: 'center' },
    { kind: 'text', text: `${t.areaName} · ${t.time} · ${t.staffName} · lượt #${t.roundId}`, size: 20, align: 'center' },
    { kind: 'rule' },
    ...t.lines.map((l): PrintLine => ({ kind: 'item', qty: String(l.qty), name: l.name, note: l.note })),
    ...(t.note ? ([{ kind: 'rule' }, { kind: 'text', text: `Ghi chú: ${t.note}`, size: 22 }] as PrintLine[]) : []),
    { kind: 'space', height: 8 },
  ];
}

export async function printToStation(station: { host: string | null; port: number }, lines: PrintLine[]): Promise<void> {
  if (!station.host) throw new Error('Trạm in chưa có địa chỉ IP máy in');
  await sendToPrinter(station.host, station.port, escposJob(renderLines(lines)));
}

/** Gửi các phiếu của trạm mạng (song song), đánh dấu phiếu nào App quầy phải tự in. */
export async function dispatchTickets(tickets: PrintTicket[]): Promise<DeliveredTicket[]> {
  const ids = [...new Set(tickets.map((t) => t.stationId).filter((x): x is number => x !== null))];
  const stations = new Map((await prisma.printStation.findMany({ where: { id: { in: ids } } })).map((s) => [s.id, s]));
  return Promise.all(
    tickets.map(async (t): Promise<DeliveredTicket> => {
      const station = t.stationId !== null ? stations.get(t.stationId) : undefined;
      if (station?.connection !== 'NETWORK') return { ...t, delivery: 'browser', printed: null, error: null };
      try {
        await printToStation(station, ticketLines(t));
        return { ...t, delivery: 'network', printed: true, error: null };
      } catch (e) {
        return { ...t, delivery: 'network', printed: false, error: (e as Error).message };
      }
    }),
  );
}

/**
 * Trạng thái in của lượt sau khi phát phiếu: máy in mạng lỗi → FAILED (bàn đỏ ngay);
 * mọi phiếu đều in qua mạng thành công → PRINTED; còn phiếu App quầy tự in → để App quầy báo.
 */
export function roundStatusAfter(delivered: DeliveredTicket[]): 'PRINTED' | 'FAILED' | null {
  if (delivered.some((d) => d.printed === false)) return 'FAILED';
  if (delivered.length && delivered.every((d) => d.printed === true)) return 'PRINTED';
  return null;
}

// In phiếu gọi món và hóa đơn khổ 80 mm qua hộp thoại in của trình duyệt (NFR-08 bản web).
// Nhiều phiếu (mỗi trạm một phiếu) gom thành một lần in, mỗi phiếu một trang.
// Chạy Chrome với --kiosk-printing thì in thẳng ra máy in mặc định, không hiện hộp thoại.

import { formatVnTime } from '@biahoi/shared';
import { vnd } from './format';
import type { PrintTicket, PrintedBill } from './types';

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

const PAGE_CSS = `
  @page { size: 80mm auto; margin: 3mm 4mm; }
  * { box-sizing: border-box; }
  body { margin: 0; font: 13px/1.35 "Be Vietnam Pro", Arial, sans-serif; color: #000; }
  .sheet { break-after: page; page-break-after: always; }
  .sheet:last-child { break-after: auto; page-break-after: auto; }
  h1 { font-size: 16px; margin: 0 0 2px; text-align: center; }
  h2 { font-size: 22px; margin: 4px 0; text-align: center; }
  .meta { text-align: center; font-size: 12px; }
  table { width: 100%; border-collapse: collapse; margin-top: 6px; }
  td { padding: 3px 0; vertical-align: top; }
  td.q { width: 34px; font-size: 18px; font-weight: 700; }
  td.n { text-align: right; white-space: nowrap; font-variant-numeric: tabular-nums; }
  .note { font-size: 12px; font-style: italic; }
  .sep { border-top: 1px dashed #000; margin: 6px 0; }
  .total td { font-size: 16px; font-weight: 700; }
  .center { text-align: center; }
`;

function ticketHtml(t: PrintTicket): string {
  const rows = t.lines
    .map((l) => `<tr><td class="q">${l.qty}</td><td>${esc(l.name)}${l.note ? `<div class="note">${esc(l.note)}</div>` : ''}</td></tr>`)
    .join('');
  return `<section class="sheet">
    <h1>${esc(t.title)}</h1>
    <div class="meta">${esc(t.stationName)}</div>
    <h2>Bàn ${esc(t.tableCode)}</h2>
    <div class="meta">${esc(t.areaName)} · ${esc(t.time)} · ${esc(t.staffName)} · lượt #${t.roundId}</div>
    <div class="sep"></div>
    <table>${rows}</table>
    ${t.note ? `<div class="sep"></div><div class="note">Ghi chú: ${esc(t.note)}</div>` : ''}
  </section>`;
}

export function billHtml(b: PrintedBill, shopName: string): string {
  const rows = b.rows
    .map((r) => `<tr><td>${esc(r.name)}<div class="note">${r.qty} × ${vnd(r.unitPrice)}</div></td><td class="n">${vnd(r.amount)}</td></tr>`)
    .join('');
  const adj = b.adjustments.map((a) => `<tr><td>${esc(a.label)}</td><td class="n">${vnd(a.amount)}</td></tr>`).join('');
  const pays = (b.payments ?? [])
    .map((p) => `<tr><td>${p.method === 'CASH' ? 'Tiền mặt' : 'Chuyển khoản'}${p.tendered ? ` (khách đưa ${vnd(p.tendered)})` : ''}</td><td class="n">${vnd(p.amount)}</td></tr>`)
    .join('');
  return `<section class="sheet">
    <h1>${esc(shopName)}</h1>
    <div class="meta">${esc(b.title)}</div>
    <h2>Bàn ${esc(b.tableCode)}</h2>
    <div class="meta">${esc(b.billCode)} · vào ${formatVnTime(new Date(b.openedAt))} · in ${formatVnTime(new Date(b.printedAt))}${b.guestCount ? ` · ${b.guestCount} khách` : ''}</div>
    <div class="sep"></div>
    <table>${rows}${adj}</table>
    <div class="sep"></div>
    <table><tr class="total"><td>Tổng cộng</td><td class="n">${vnd(b.total)} đ</td></tr>${pays}${
      b.change ? `<tr><td>Tiền thừa</td><td class="n">${vnd(b.change)}</td></tr>` : ''
    }</table>
    <div class="sep"></div>
    <div class="center">${b.kind === 'FINAL' ? 'Cảm ơn quý khách!' : 'Phiếu tạm tính, chưa phải hóa đơn'}</div>
  </section>`;
}

/** Ghi lại các lần in để test kiểm tra (window.__printed). */
declare global {
  interface Window {
    __printed?: string[];
  }
}

/** Khai báo @font-face của trang (font đóng gói), để khung in dùng cùng font Be Vietnam Pro. */
function fontFaces(): string {
  const rules: string[] = [];
  for (const sheet of Array.from(document.styleSheets)) {
    try {
      for (const rule of Array.from(sheet.cssRules)) if (rule instanceof CSSFontFaceRule) rules.push(rule.cssText);
    } catch {
      // stylesheet khác nguồn: bỏ qua
    }
  }
  return rules.join('\n');
}

function printHtml(body: string, title: string): Promise<void> {
  (window.__printed ??= []).push(title);
  return new Promise((resolve) => {
    const frame = document.createElement('iframe');
    frame.setAttribute('aria-hidden', 'true');
    frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden';
    document.body.appendChild(frame);
    const doc = frame.contentDocument!;
    doc.open();
    doc.write(`<!doctype html><html lang="vi"><head><meta charset="utf-8"><title>${esc(title)}</title><style>${fontFaces()}${PAGE_CSS}</style></head><body>${body}</body></html>`);
    doc.close();
    const win = frame.contentWindow!;
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      setTimeout(() => frame.remove(), 500);
      resolve();
    };
    win.addEventListener('afterprint', finish);
    // chờ font trong khung in tải xong (tối đa 1,5 giây) rồi mới in
    Promise.race([doc.fonts.ready, new Promise((r) => setTimeout(r, 1500))]).then(() => {
      try {
        win.focus();
        win.print();
      } finally {
        // print() chặn tới khi đóng hộp thoại ở hầu hết trình duyệt; phòng khi không có afterprint
        setTimeout(finish, 300);
      }
    });
  });
}

export const printTickets = (tickets: PrintTicket[]) =>
  tickets.length ? printHtml(tickets.map(ticketHtml).join(''), `Phiếu bàn ${tickets[0]!.tableCode}`) : Promise.resolve();

export const printBill = (bill: PrintedBill, shopName: string) => printHtml(billHtml(bill, shopName), `${bill.title} bàn ${bill.tableCode}`);

/** FR-09: báo cáo đóng ca in được. */
export function printShiftReport(
  r: { openedAt: string; closedAt: string; openedBy: string; closedBy: string; openingCash: number; cashTotal: number; transferTotal: number; billCount: number; expectedCash: number; countedCash: number; difference: number },
  shopName: string,
) {
  const row = (label: string, value: string) => `<tr><td>${esc(label)}</td><td class="n">${esc(value)}</td></tr>`;
  const body = `<section class="sheet">
    <h1>${esc(shopName)}</h1>
    <h2>Báo cáo đóng ca</h2>
    <div class="meta">${formatVnTime(new Date(r.openedAt))} – ${formatVnTime(new Date(r.closedAt))} · mở: ${esc(r.openedBy)} · đóng: ${esc(r.closedBy)}</div>
    <div class="sep"></div>
    <table>
      ${row('Số hóa đơn', String(r.billCount))}
      ${row('Tiền mặt thu', vnd(r.cashTotal))}
      ${row('Chuyển khoản', vnd(r.transferTotal))}
      ${row('Tổng thu', vnd(r.cashTotal + r.transferTotal))}
    </table>
    <div class="sep"></div>
    <table>
      ${row('Tiền đầu ca', vnd(r.openingCash))}
      ${row('Tiền mặt phải có', vnd(r.expectedCash))}
      ${row('Tiền mặt đếm được', vnd(r.countedCash))}
      <tr class="total"><td>Chênh lệch</td><td class="n">${r.difference > 0 ? '+' : ''}${vnd(r.difference)}</td></tr>
    </table>
  </section>`;
  return printHtml(body, 'Báo cáo đóng ca');
}

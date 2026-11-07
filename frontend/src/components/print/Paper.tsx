import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { formatDateTime, formatMoney, formatTime } from '@/lib/format';
import type { BillLine, PaymentMethod, Ticket } from '@/types';

const SHOP_NAME = 'QUÁN BIA HƠI';

/** Tờ giấy 80 mm (xem trước trên màn hình và khi in). */
export function Paper({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('paper mx-auto w-[302px] bg-white p-4 font-mono text-[13px] leading-snug text-black shadow-md ring-1 ring-stone-200', className)}>
      {children}
    </div>
  );
}

const Rule = () => <div className="my-2 border-t border-dashed border-black" />;

/** Phiếu cho khu chế biến: số bàn, giờ, nhân viên, món, số lượng, ghi chú (FR-04). */
export function KitchenTicket({ ticket, at, staffName, roundNo }: { ticket: Ticket; at: string; staffName: string; roundNo?: number }) {
  return (
    <Paper>
      <div className="text-center text-xs font-bold uppercase">{ticket.stationName}</div>
      <div className="mt-1 text-center text-3xl font-bold">BÀN {ticket.tableCode}</div>
      <div className="mt-1 flex justify-between text-xs">
        <span>{formatTime(at)}{roundNo ? ` · lượt ${roundNo}` : ''}</span>
        <span>{staffName}</span>
      </div>
      <Rule />
      <table className="w-full">
        <tbody>
          {ticket.lines.map((l, i) => (
            <tr key={i} className="align-top">
              <td className="w-10 py-0.5 text-lg font-bold">{l.qty}×</td>
              <td className="py-0.5">
                <div className="text-base font-semibold">{l.name}</div>
                {l.note && <div className="text-xs italic">» {l.note}</div>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Paper>
  );
}

type BillPaperProps = {
  title: string;
  billNo: string;
  tableCode: string;
  areaName: string;
  openedAt: string;
  lines: BillLine[];
  subtotal: number;
  discount: number;
  total: number;
  footer: ReactNode;
  payments?: { method: PaymentMethod; amount: number }[];
  paid?: number;
  change?: number;
};

/** Hóa đơn tạm tính (FR-07) và hóa đơn thanh toán (FR-08). */
export function BillPaper(p: BillPaperProps) {
  return (
    <Paper>
      <div className="text-center text-sm font-bold">{SHOP_NAME}</div>
      <div className="mt-1 text-center text-base font-bold uppercase">{p.title}</div>
      <div className="mt-2 flex justify-between text-xs">
        <span>Bàn {p.tableCode} · {p.areaName}</span>
        <span>{p.billNo}</span>
      </div>
      <div className="text-xs">Vào: {formatDateTime(p.openedAt)}</div>
      <Rule />
      <table className="w-full text-xs">
        <tbody>
          {p.lines.map((l, i) => (
            <tr key={i} className="align-top">
              <td className="py-0.5 pr-1">
                <div className="text-[13px]">{l.name}</div>
                <div className="text-[11px] text-stone-600">
                  {l.qty} × {formatMoney(l.unitPrice)}
                  {l.discount > 0 && ` (giảm ${formatMoney(l.discount)})`}
                </div>
              </td>
              <td className="whitespace-nowrap py-0.5 text-right align-bottom text-[13px]">{formatMoney(l.amount)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <Rule />
      <Row label="Cộng tiền hàng" value={formatMoney(p.subtotal)} />
      {p.discount > 0 && <Row label="Giảm giá hóa đơn" value={`−${formatMoney(p.discount)}`} />}
      <Row label="TỔNG CỘNG" value={formatMoney(p.total)} strong />
      {p.payments && (
        <>
          <Rule />
          {p.payments.map((x, i) => (
            <Row key={i} label={x.method === 'CASH' ? 'Tiền mặt' : 'Chuyển khoản'} value={formatMoney(x.amount)} />
          ))}
          {p.paid != null && <Row label="Khách đưa" value={formatMoney(p.paid)} />}
          {p.change != null && p.change > 0 && <Row label="Tiền thừa" value={formatMoney(p.change)} />}
        </>
      )}
      <Rule />
      <div className="text-center text-xs">{p.footer}</div>
    </Paper>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={cn('flex justify-between', strong ? 'mt-1 text-base font-bold' : 'text-xs')}>
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}

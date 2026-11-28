import { useEffect, useState } from 'react';
import { Modal } from '../../../components/shared/Modal.tsx';
import { formatMoney, formatTime } from '../../../lib/format.ts';
import { PrintSurface } from '../../../components/print/PrintSurface.tsx';
import { groupReceiptLines } from '../../../components/print/receiptLines.ts';
import type { DiningTable, MenuItem, OrderAdjustment, OrderLine, OrderRound, User } from '../../../types/index.ts';
import { AdjustmentDialog } from './AdjustmentDialog.tsx';
import { MoveMergeDialog } from '../move-merge/MoveMergeDialog.tsx';

type DraftLine = MenuItem & { quantity: number };
type KitchenTicket = { station: string; lines: OrderLine[] };

function getKitchenTickets(round: OrderRound): KitchenTicket[] {
  const tickets = new Map<string, OrderLine[]>();
  round.lines.forEach((line) => {
    if (line.adjustment || line.quantity <= 0) return;
    const station = line.station || 'Chưa phân khu';
    tickets.set(station, [...(tickets.get(station) ?? []), line]);
  });
  return [...tickets].map(([station, lines]) => ({ station, lines }));
}

interface TableSessionDialogProps {
  table: DiningTable;
  tables: DiningTable[];
  menuItems: MenuItem[];
  user: User;
  onClose: () => void;
  onAddRound: (lines: DraftLine[]) => Promise<OrderRound | null>;
  onProvisional: () => Promise<number | null>;
  onPayment: () => void;
  onMoveMerge: (targetId: number, merge: boolean) => void;
  onAdjustment: (adjustment: OrderAdjustment) => void;
}

const money = formatMoney;

function elapsedTime(openedAt: string | null) {
  if (!openedAt) return '';
  const minutes = Math.max(0, Math.floor((Date.now() - new Date(openedAt).getTime()) / 60000));
  return `${Math.floor(minutes / 60)}g ${minutes % 60}p`;
}

export function TableSessionDialog({ table, tables, menuItems, user, onClose, onAddRound, onProvisional, onPayment, onMoveMerge, onAdjustment }: TableSessionDialogProps) {
  const [category, setCategory] = useState('Tất cả');
  const [search, setSearch] = useState('');
  const [draft, setDraft] = useState<DraftLine[]>([]);
  const [sessionAction, setSessionAction] = useState<'transfer' | 'adjust' | ''>('');
  const [ticketRound, setTicketRound] = useState<OrderRound | null>(null);
  const [ticketToPrint, setTicketToPrint] = useState<{ round: OrderRound; ticket: KitchenTicket } | null>(null);
  const [provisionalPrint, setProvisionalPrint] = useState<{ count: number; printedAt: string } | null>(null);
  const categories = ['Tất cả', ...new Set(menuItems.map((item) => item.category))];
  const searchTerm = search.trim().toLocaleLowerCase('vi');
  const filteredMenu = menuItems.filter((item) => (category === 'Tất cả' || item.category === category)
    && `${item.name} ${item.shortcut}`.toLocaleLowerCase('vi').includes(searchTerm));
  const changeQuantity = (itemId: string, delta: number) => setDraft((lines) => {
    const existing = lines.find((line) => line.id === itemId);
    const menuItem = menuItems.find((item) => item.id === itemId);
    if (!existing && delta > 0 && menuItem) return [...lines, { ...menuItem, quantity: 1 }];
    return lines.map((line) => line.id === itemId ? { ...line, quantity: line.quantity + delta } : line).filter((line) => line.quantity > 0);
  });
  const sentLines = table.rounds.flatMap((round) => round.lines);
  const draftTotal = draft.reduce((sum, line) => sum + line.price * line.quantity, 0);
  const visibleTickets = ticketRound ? getKitchenTickets(ticketRound) : [];
  const printing = ticketToPrint !== null || provisionalPrint !== null;

  useEffect(() => {
    if (!printing) return undefined;
    const handleAfterPrint = () => {
      setTicketToPrint(null);
      setProvisionalPrint(null);
    };
    window.addEventListener('afterprint', handleAfterPrint);
    const frame = window.requestAnimationFrame(() => window.print());
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener('afterprint', handleAfterPrint);
    };
  }, [printing]);

  const printProvisional = async () => {
    const count = await onProvisional();
    if (count !== null) setProvisionalPrint({ count, printedAt: new Date().toISOString() });
  };

  return <Modal title={`Phiên bàn ${table.id}`} onClose={onClose} wide>
    <div className="session-layout">
      <section className="menu-picker" aria-label="Chọn món">
        <div className="menu-tools"><label className="search-box"><i className="icon fa-solid fa-magnifying-glass" aria-hidden="true" /><span className="sr-only">Tìm món</span><input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Tìm món hoặc mã tắt" /></label></div>
        <div className="menu-categories">{categories.map((item) => <button key={item} type="button" className={category === item ? 'is-selected' : ''} onClick={() => setCategory(item)}>{item}</button>)}</div>
        <div className="menu-items">{filteredMenu.map((item) => <button className="menu-item" key={item.id} type="button" onClick={() => changeQuantity(item.id, 1)}><span><strong>{item.name}</strong><small>{item.station}</small></span><b>{money(item.price)}<i className="icon fa-solid fa-plus" aria-hidden="true" /></b></button>)}</div>
      </section>
      <section className="session-order">
        <div className="session-meta"><span>{table.guestCount ? `${table.guestCount} khách` : 'Chưa ghi số khách'}</span><span>Đã ngồi {elapsedTime(table.openedAt)}</span></div>
        <h3>Lượt đang nhập</h3>
        {draft.length ? <div className="draft-list">{draft.map((line) => <div className="draft-line" key={line.id}><span>{line.name}<small>{money(line.price)}</small></span><div className="quantity-control"><button type="button" aria-label={`Giảm ${line.name}`} onClick={() => changeQuantity(line.id, -1)}>−</button><b>{line.quantity}</b><button type="button" aria-label={`Tăng ${line.name}`} onClick={() => changeQuantity(line.id, 1)}>+</button></div><strong>{money(line.price * line.quantity)}</strong></div>)}</div> : <p className="session-empty">Chọn món từ thực đơn để tạo lượt gọi.</p>}
        <div className="draft-total"><span>Tạm tính lượt này</span><strong>{money(draftTotal)}</strong></div>
        <button className="button-primary session-send" type="button" disabled={!draft.length} onClick={async () => {
          const round = await onAddRound(draft);
          if (round) {
            setDraft([]);
            setTicketRound(round);
          }
        }}>Gửi lượt gọi</button>
        {ticketRound && <section className="ticket-previews" aria-label="Phiếu chế biến">
          <h3>Phiếu lượt gọi · bàn {table.id}</h3>
          {visibleTickets.length ? visibleTickets.map((ticket) => <article className="kitchen-ticket-preview" key={ticket.station}>
            <header><strong>{ticket.station}</strong><span>{formatTime(ticketRound.sentAt)} · {ticketRound.staffName}</span></header>
            {ticket.lines.map((line, index) => <p key={`${line.id}-${index}`}>{line.name} × {line.quantity}{line.note && <small>Ghi chú: {line.note}</small>}</p>)}
            <button type="button" className="text-button" onClick={() => setTicketToPrint({ round: ticketRound, ticket })}>In phiếu</button>
          </article>) : <p className="session-empty">Lượt này không có món cần chế biến.</p>}
        </section>}
        <div className="sent-history"><h3>Lịch sử gọi món</h3>{table.rounds.length ? table.rounds.slice().reverse().map((round) => <article className="round-card" key={round.id}><header><strong>{formatTime(round.sentAt)}</strong><span>{round.staffName}</span></header>{round.lines.map((line) => <p key={`${round.id}-${line.id}`}>{line.name} × {line.quantity}</p>)}<button type="button" className="text-button" onClick={() => setTicketRound(round)}>In lại phiếu</button></article>) : <p className="session-empty">Chưa có lượt gọi nào.</p>}{sentLines.length > 0 && <p className="session-sent-count">{sentLines.length} dòng món đã gửi</p>}</div>
        <div className="session-actions"><button type="button" className="button-secondary" disabled={!table.total} onClick={() => { void printProvisional(); }}>In tạm tính</button><button type="button" className="button-primary" disabled={!table.total} onClick={onPayment}>Thanh toán</button></div>
        <div className="session-extra-actions"><button type="button" className="text-button" onClick={() => setSessionAction('transfer')}>Chuyển / gộp bàn</button><button type="button" className="text-button" disabled={!sentLines.length} onClick={() => setSessionAction('adjust')}>Hủy / giảm món đã gửi</button></div>
      </section>
    </div>
    {sessionAction === 'transfer' && <MoveMergeDialog table={table} tables={tables} onClose={() => setSessionAction('')} onSubmit={onMoveMerge} />}
    {sessionAction === 'adjust' && <AdjustmentDialog table={table} user={user} onClose={() => setSessionAction('')} onSubmit={(adjustment) => { onAdjustment(adjustment); setSessionAction(''); }} />}
    {ticketToPrint && <PrintSurface active={printing}>
      <KitchenTicketDocument tableId={table.id} round={ticketToPrint.round} ticket={ticketToPrint.ticket} />
    </PrintSurface>}
    {provisionalPrint && <PrintSurface active={printing}>
      <ProvisionalDocument table={table} count={provisionalPrint.count} printedAt={provisionalPrint.printedAt} />
    </PrintSurface>}
  </Modal>;
}

function KitchenTicketDocument({ tableId, round, ticket }: { tableId: number; round: OrderRound; ticket: KitchenTicket }) {
  return <article className="kitchen-ticket">
    <header><strong>PHIẾU CHẾ BIẾN</strong><strong>{ticket.station}</strong></header>
    <div className="kitchen-ticket-meta"><span>Bàn {tableId}</span><span>{formatTime(round.sentAt)}</span><span>{round.staffName}</span></div>
    <div className="kitchen-ticket-lines">{ticket.lines.map((line, index) => <div key={`${line.id}-${index}`}><strong>{line.name} × {line.quantity}</strong>{line.note && <span>Ghi chú: {line.note}</span>}</div>)}</div>
  </article>;
}

function ProvisionalDocument({ table, count, printedAt }: { table: DiningTable; count: number; printedAt: string }) {
  const lines = groupReceiptLines(table.rounds.flatMap((round) => round.lines));

  return <article className="receipt-document">
    <header className="receipt-brand">
      <strong>QUẢN LÝ QUẦY BIA</strong>
      <span>TẠM TÍNH · BÀN {table.id}</span>
    </header>
    <div className="receipt-meta">
      <div><span>Lần in</span><strong>{count}</strong></div>
      <div><span>Giờ</span><strong>{formatTime(printedAt)}</strong></div>
    </div>
    <div className="receipt-table">
      <div className="receipt-table-head" aria-hidden="true">
        <span>Tên món</span><span>SL</span><span>Thành tiền</span>
      </div>
      <div className="receipt-lines">{lines.map((line, index) => <div className="receipt-line" key={`${line.name}-${index}`}>
        <span className="receipt-item-name">{line.name}</span>
        <span className="receipt-item-quantity">{line.quantity}</span>
        <strong>{formatMoney(line.total)}</strong>
      </div>)}</div>
    </div>
    <div className="receipt-summary">
      <div className="receipt-total grand"><span>Tạm tính</span><strong>{formatMoney(table.total)}</strong></div>
    </div>
  </article>;
}

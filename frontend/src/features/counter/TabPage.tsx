import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ArrowLeft, ArrowRightLeft, Combine, CreditCard, Loader2, Minus, Plus, Printer, ReceiptText, Send, Trash2, Users } from 'lucide-react';
import { tabsApi } from '@/api/tabs';
import { apiError } from '@/api/client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ErrorBox, Loading } from '@/components/layout/Page';
import { BillPaper, KitchenTicket } from '@/components/print/Paper';
import { PrintDialog } from '@/components/print/PrintDialog';
import { REASON_LABEL, formatDuration, formatMoney, formatTime } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { MenuEntry, ProvisionalBill, TabDetail, TabLine, TabRound, Ticket } from '@/types';
import { AdjustLineDialog, type AdjustMode } from './AdjustLineDialog';
import { MenuPicker } from './MenuPicker';
import { MoveMergeDialog, type MoveMode } from './MoveMergeDialog';
import { qk, useMenu, useTab } from './queries';
import { useNow } from './useNow';

type DraftLine = { item: MenuEntry; qty: number; note: string };
type PrintJob = { title: string; tickets: Ticket[]; at: string; staffName: string; roundNo?: number };

/** Dựng lại phiếu theo khu chế biến từ một lượt đã gửi (nút "In lại phiếu"). */
function ticketsOfRound(round: TabRound, tableCode: string): Ticket[] {
  const map = new Map<number, Ticket>();
  for (const l of round.lines) {
    if (l.lineType !== 'NORMAL') continue;
    const t = map.get(l.stationId) ?? { stationId: l.stationId, stationName: l.stationName, tableCode, lines: [] };
    t.lines.push({ name: l.name, qty: l.qty, note: l.note });
    map.set(l.stationId, t);
  }
  return [...map.values()];
}

/** FR-04 → FR-07: màn phiên bàn. */
export function TabPage() {
  const tabId = Number(useParams().tabId);
  const tab = useTab(tabId);
  const menu = useMenu();
  const now = useNow();
  const qc = useQueryClient();
  const navigate = useNavigate();

  const [draft, setDraft] = useState<DraftLine[]>([]);
  const [printJob, setPrintJob] = useState<PrintJob | null>(null);
  const [bill, setBill] = useState<ProvisionalBill | null>(null);
  const [adjust, setAdjust] = useState<{ line: TabLine; mode: AdjustMode } | null>(null);
  const [moveMode, setMoveMode] = useState<MoveMode | null>(null);

  const send = useMutation({
    mutationFn: () => tabsApi.sendRound(tabId, draft.map((d) => ({ menuItemId: d.item.id, qty: d.qty, note: d.note.trim() || null }))),
    onSuccess: (res) => {
      setDraft([]);
      qc.invalidateQueries({ queryKey: qk.tab(tabId) });
      qc.invalidateQueries({ queryKey: qk.summary });
      setPrintJob({ title: `Đã gửi — ${res.tickets.length} phiếu`, tickets: res.tickets, at: res.round.createdAt, staffName: res.round.createdBy.fullName });
    },
    onError: (e) => toast.error(apiError(e).message),
  });

  const provisional = useMutation({
    mutationFn: () => tabsApi.provisional(tabId),
    onSuccess: (b) => {
      setBill(b);
      qc.invalidateQueries({ queryKey: qk.tab(tabId) });
      qc.invalidateQueries({ queryKey: qk.summary });
    },
    onError: (e) => toast.error(apiError(e).message),
  });

  if (tab.isLoading) return <Loading />;
  if (tab.isError || !tab.data) return <div className="p-6"><ErrorBox message={apiError(tab.error).message} onRetry={() => tab.refetch()} /></div>;
  const t = tab.data;
  const isOpen = t.status === 'OPEN';

  const addItem = (item: MenuEntry) =>
    setDraft((d) => {
      const i = d.findIndex((x) => x.item.id === item.id && !x.note);
      if (i >= 0) return d.map((x, j) => (j === i ? { ...x, qty: x.qty + 1 } : x));
      return [...d, { item, qty: 1, note: '' }];
    });
  const changeQty = (idx: number, delta: number) =>
    setDraft((d) => d.flatMap((x, j) => (j !== idx ? [x] : x.qty + delta <= 0 ? [] : [{ ...x, qty: x.qty + delta }])));
  const draftTotal = draft.reduce((s, d) => s + d.qty * d.item.price, 0);

  return (
    <div className="flex min-h-screen flex-col lg:h-screen">
      {/* Đầu trang: bàn, thời gian, tổng tiền, thao tác */}
      <header className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b bg-card px-4 py-3">
        <Button variant="ghost" size="icon" asChild aria-label="Về sơ đồ bàn">
          <Link to="/counter"><ArrowLeft /></Link>
        </Button>
        <div className="mr-auto">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold">Bàn {t.table.code}</h1>
            <span className="text-sm text-muted-foreground">{t.table.areaName}</span>
            {t.provisionalCount > 0 && isOpen && <Badge variant="warning">Đã in tạm tính ×{t.provisionalCount}</Badge>}
            {t.status === 'PAID' && <Badge variant="success">Đã thanh toán</Badge>}
            {t.status === 'MERGED' && <Badge variant="secondary">Đã gộp</Badge>}
          </div>
          <div className="mt-0.5 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            <span>Mở {formatTime(t.openedAt)} · {formatDuration(t.openedAt, t.closedAt ? new Date(t.closedAt) : now)}</span>
            {t.guestCount && <span className="flex items-center gap-1"><Users className="h-3.5 w-3.5" /> {t.guestCount} khách</span>}
            <span>{t.billNo}</span>
          </div>
        </div>
        <div className="text-right">
          <div className="text-xs text-muted-foreground">Tổng tiền</div>
          <div className="text-2xl font-bold tabular-nums">{formatMoney(t.total)}</div>
        </div>
        {isOpen && (
          <div className="flex w-full flex-wrap gap-2 sm:w-auto">
            <Button variant="outline" onClick={() => setMoveMode('move')}><ArrowRightLeft /> Chuyển bàn</Button>
            <Button variant="outline" onClick={() => setMoveMode('merge')}><Combine /> Gộp bàn</Button>
            <Button variant="outline" onClick={() => provisional.mutate()} disabled={provisional.isPending}>
              {provisional.isPending ? <Loader2 className="animate-spin" /> : <ReceiptText />} In tạm tính
            </Button>
            <Button onClick={() => navigate(`/counter/tabs/${tabId}/pay`)} disabled={draft.length > 0} title={draft.length ? 'Gửi hoặc bỏ lượt đang nhập trước' : undefined}>
              <CreditCard /> Thanh toán
            </Button>
          </div>
        )}
      </header>

      {t.status === 'MERGED' && t.mergedIntoId && (
        <div className="border-b bg-secondary px-4 py-2 text-sm">
          Phiên này đã gộp sang bàn khác. <Link className="font-semibold text-primary underline" to={`/counter/tabs/${t.mergedIntoId}`}>Mở phiên đích</Link>
        </div>
      )}

      <div className="grid min-h-0 flex-1 gap-4 p-4 lg:grid-cols-[minmax(0,1fr)_420px]">
        {/* Bên trái: chọn món */}
        <section className="flex min-h-[420px] flex-col lg:min-h-0">
          {menu.isLoading ? <Loading /> : <MenuPicker groups={menu.data ?? []} onPick={addItem} disabled={!isOpen} />}
        </section>

        {/* Bên phải: lượt đang nhập + lịch sử */}
        <section className="flex min-h-0 flex-col gap-4 lg:overflow-y-auto">
          {isOpen && (
            <div className="rounded-lg border-2 border-primary/30 bg-card">
              <div className="flex items-center justify-between border-b px-3 py-2">
                <h2 className="font-semibold">Lượt đang nhập</h2>
                {draft.length > 0 && (
                  <button className="text-xs text-muted-foreground hover:text-destructive" onClick={() => setDraft([])}>
                    Bỏ hết
                  </button>
                )}
              </div>
              {draft.length === 0 ? (
                <p className="px-3 py-6 text-center text-sm text-muted-foreground">Bấm món bên trái để thêm</p>
              ) : (
                <ul className="divide-y">
                  {draft.map((d, i) => (
                    <li key={`${d.item.id}-${i}`} className="grid gap-1.5 px-3 py-2">
                      <div className="flex items-center gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-medium">{d.item.name}</div>
                          <div className="text-xs text-muted-foreground">{formatMoney(d.item.price)}</div>
                        </div>
                        <Button size="icon" variant="outline" className="h-10 w-10" onClick={() => changeQty(i, -1)} aria-label="Bớt">
                          {d.qty === 1 ? <Trash2 /> : <Minus />}
                        </Button>
                        <span className="w-7 text-center text-lg font-bold tabular-nums">{d.qty}</span>
                        <Button size="icon" variant="outline" className="h-10 w-10" onClick={() => changeQty(i, 1)} aria-label="Thêm">
                          <Plus />
                        </Button>
                      </div>
                      <Input
                        value={d.note}
                        onChange={(e) => setDraft((all) => all.map((x, j) => (j === i ? { ...x, note: e.target.value } : x)))}
                        placeholder="Ghi chú (vd: ít cay)"
                        className="h-9 text-sm"
                        maxLength={200}
                      />
                    </li>
                  ))}
                </ul>
              )}
              <div className="flex items-center justify-between gap-3 border-t px-3 py-2">
                <span className="text-sm">
                  Cộng: <b className="tabular-nums">{formatMoney(draftTotal)}</b>
                </span>
                <Button size="lg" onClick={() => send.mutate()} disabled={draft.length === 0 || send.isPending}>
                  {send.isPending ? <Loader2 className="animate-spin" /> : <Send />} Gửi
                </Button>
              </div>
            </div>
          )}

          <RoundHistory
            tab={t}
            onReprint={(r, idx) =>
              setPrintJob({ title: 'In lại phiếu', tickets: ticketsOfRound(r, t.table.code), at: r.createdAt, staffName: r.createdBy.fullName, roundNo: idx + 1 })
            }
            onAdjust={isOpen ? (line, mode) => setAdjust({ line, mode }) : undefined}
          />
        </section>
      </div>

      <PrintDialog open={!!printJob} onOpenChange={(o) => !o && setPrintJob(null)} title={printJob?.title ?? ''} description="Mỗi khu chế biến một phiếu.">
        {printJob?.tickets.map((tk) => <KitchenTicket key={tk.stationId} ticket={tk} at={printJob.at} staffName={printJob.staffName} roundNo={printJob.roundNo} />)}
      </PrintDialog>

      <PrintDialog open={!!bill} onOpenChange={(o) => !o && setBill(null)} title="Hóa đơn tạm tính">
        {bill && (
          <BillPaper
            title="Phiếu tạm tính"
            {...bill}
            footer={<>Tạm tính — lần in {bill.printNo} — {formatTime(bill.printedAt)}</>}
          />
        )}
      </PrintDialog>

      <AdjustLineDialog tabId={tabId} line={adjust?.line ?? null} mode={adjust?.mode ?? 'void'} onClose={() => setAdjust(null)} />
      <MoveMergeDialog tab={t} mode={moveMode} onClose={() => setMoveMode(null)} />
    </div>
  );
}

/** Lịch sử các lượt đã gửi: giờ, người gửi, món; dòng hủy/giảm hiện đỏ dưới dòng gốc. */
function RoundHistory({ tab, onReprint, onAdjust }: { tab: TabDetail; onReprint: (r: TabRound, idx: number) => void; onAdjust?: (line: TabLine, mode: AdjustMode) => void }) {
  if (tab.rounds.length === 0) return <p className="text-center text-sm text-muted-foreground">Chưa gửi lượt nào</p>;
  return (
    <div className="flex flex-col gap-3">
      <h2 className="font-semibold">Các lượt đã gửi</h2>
      {[...tab.rounds].reverse().map((r) => {
        const idx = tab.rounds.indexOf(r);
        const adjustments = new Map<number, TabLine[]>();
        for (const l of r.lines) if (l.refLineId) adjustments.set(l.refLineId, [...(adjustments.get(l.refLineId) ?? []), l]);
        return (
          <div key={r.id} className="rounded-lg border bg-card">
            <div className="flex items-center justify-between border-b px-3 py-1.5 text-xs text-muted-foreground">
              <span>
                Lượt {idx + 1} · {formatTime(r.createdAt)} · {r.createdBy.fullName}
              </span>
              <Button variant="ghost" size="sm" className="h-8" onClick={() => onReprint(r, idx)}>
                <Printer /> In lại phiếu
              </Button>
            </div>
            <ul className="divide-y text-sm">
              {r.lines
                .filter((l) => l.lineType === 'NORMAL')
                .map((l) => {
                  const fullyVoided = (l.remainingQty ?? 0) <= 0;
                  return (
                    <li key={l.id} className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        <span className={cn('w-8 font-bold tabular-nums', fullyVoided && 'text-muted-foreground line-through')}>{l.remainingQty}×</span>
                        <div className="min-w-0 flex-1">
                          <div className={cn('truncate', fullyVoided && 'text-muted-foreground line-through')}>{l.name}</div>
                          {l.note && <div className="text-xs italic text-muted-foreground">» {l.note}</div>}
                        </div>
                        <span className="tabular-nums">{formatMoney(l.netAmount)}</span>
                        {onAdjust && !fullyVoided && (
                          <div className="flex gap-1">
                            <Button size="sm" variant="ghost" className="h-8 px-2 text-destructive hover:text-destructive" onClick={() => onAdjust(l, 'void')}>Hủy</Button>
                            <Button size="sm" variant="ghost" className="h-8 px-2" onClick={() => onAdjust(l, 'discount')}>Giảm</Button>
                          </div>
                        )}
                      </div>
                      {(adjustments.get(l.id) ?? []).map((a) => (
                        <div key={a.id} className="ml-10 mt-1 text-xs text-destructive">
                          {a.lineType === 'VOID' ? `Hủy ${-a.qty}` : 'Giảm giá'} {formatMoney(-a.amount)} · {a.reason ? REASON_LABEL[a.reason] : ''}
                          {a.note ? ` (${a.note})` : ''} · {a.requestedBy?.fullName}
                          {a.approvedBy && a.approvedBy.id !== a.requestedBy?.id ? `, duyệt: ${a.approvedBy.fullName}` : ''}
                        </div>
                      ))}
                    </li>
                  );
                })}
            </ul>
          </div>
        );
      })}
    </div>
  );
}

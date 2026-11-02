// Panel phiên bàn. FR-04 gọi món & in phiếu, FR-05 chuyển/gộp, FR-06 hủy/giảm có duyệt, FR-07 tạm tính.
// Câu hỏi của màn: "Bàn này đã gọi gì, tổng bao nhiêu, gọi thêm gì?" — tổng tạm tính là số lớn nhất.

import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { ADJUST_REASONS, ADJUST_REASON_LABELS, SOCKET_EVENTS, resolveUnitPrice, type AdjustReason, type HappyHourRule } from '@biahoi/shared';
import { ApprovalDialog } from '../components/Approval';
import { Icon } from '../components/Icon';
import { Shell } from '../components/Shell';
import { STATUS_LABEL, TableTile, seated } from '../components/TableTile';
import { Dialog, Field, Money, Toast } from '../components/ui';
import { api, errorText, imageUrl } from '../lib/api';
import { time, vnd, vndText } from '../lib/format';
import { useAction, useApi, useLive, useMinuteClock } from '../lib/hooks';
import { printBill, printTickets } from '../lib/print';
import type { HappyHour, MapArea, MapTable, MenuGroup, MenuItem, PrintTicket, PrintedBill, TabDetail, TabLine } from '../lib/types';
import { SHOP_NAME } from '../shop';

interface DraftLine {
  itemId: number;
  qty: number;
  note: string;
}

/** "Cánh gà chiên mắm" → "CG": chữ đầu của hai từ đầu, cho ô món chưa có ảnh và chưa có mã tắt. */
const initials = (name: string) =>
  name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0] ?? '')
    .join('')
    .toUpperCase();

type Adjust = { line: TabLine; mode: 'void' | 'discount' };

export function TabScreen() {
  const { tabId } = useParams();
  const id = Number(tabId);
  const navigate = useNavigate();
  const location = useLocation();
  const now = useMinuteClock();

  const tab = useApi<TabDetail>(`/tabs/${id}`);
  const groups = useApi<MenuGroup[]>('/menu-groups');
  const items = useApi<MenuItem[]>('/menu-items');
  const happy = useApi<HappyHour[]>('/happy-hours');
  // Món hết hàng ở bàn khác vẫn phải hiện ở đây, nên danh sách món tải lại với mọi bàn; phiên chỉ tải lại khi bàn này đổi
  useLive([SOCKET_EVENTS.TABLE_UPDATED], items.reload);
  useLive([SOCKET_EVENTS.TABLE_UPDATED], tab.reload, (p) => !tab.data || !p.tableIds || p.tableIds.includes(tab.data.table.id));

  const [group, setGroup] = useState<number | 'all'>('all');
  const [search, setSearch] = useState('');
  const [draft, setDraft] = useState<DraftLine[]>([]);
  const [noteFor, setNoteFor] = useState<number | null>(null);
  const [adjust, setAdjust] = useState<Adjust | null>(null);
  const [approving, setApproving] = useState<{ summary: string; run: (token: string) => Promise<string | void> } | null>(null);
  const [moveMode, setMoveMode] = useState<'move' | 'merge' | null>(null);
  const [toast, setToast] = useState<{ message: string; action?: { label: string; run: () => void } } | null>(
    (location.state as { notice?: string } | null)?.notice ? { message: (location.state as { notice: string }).notice } : null,
  );
  const send = useAction();
  const act = useAction();
  const searchRef = useRef<HTMLInputElement>(null);

  const t = tab.data;
  // Phiên đã thanh toán hoặc đã gộp ở máy khác: rời màn này
  useEffect(() => {
    if (!t) return;
    if (t.status === 'MERGED' && t.mergedIntoId) navigate(`/ban/${t.mergedIntoId}`, { replace: true, state: { notice: `Bàn ${t.table.code} đã được gộp vào bàn này.` } });
    else if (t.status === 'PAID') navigate('/', { replace: true });
  }, [t, navigate]);

  const rules: HappyHourRule[] = useMemo(
    () =>
      (happy.data ?? [])
        .filter((h) => h.active)
        .map((h) => ({ id: h.id, daysOfWeek: h.daysOfWeek, startMinute: h.startMinute, endMinute: h.endMinute, prices: new Map(h.prices.map((p) => [p.itemId, p.price])) })),
    [happy.data],
  );
  const priceOf = (item: MenuItem) => resolveUnitPrice(item.id, item.price, rules, now);
  const itemById = useMemo(() => new Map((items.data ?? []).map((i) => [i.id, i])), [items.data]);

  const shown = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (items.data ?? []).filter((i) => (group === 'all' || i.groupId === group) && (!q || i.name.toLowerCase().includes(q) || i.shortcut === q));
  }, [items.data, group, search]);

  const draftTotal = draft.reduce((s, d) => s + d.qty * (itemById.get(d.itemId) ? priceOf(itemById.get(d.itemId)!).unitPrice : 0), 0);
  const draftCount = draft.reduce((s, d) => s + d.qty, 0);

  function add(item: MenuItem) {
    if (!item.available) return;
    setDraft((d) => {
      const i = d.findIndex((x) => x.itemId === item.id && !x.note);
      if (i < 0) return [...d, { itemId: item.id, qty: 1, note: '' }];
      return d.map((x, k) => (k === i ? { ...x, qty: x.qty + 1 } : x));
    });
  }
  const change = (index: number, delta: number) => setDraft((d) => d.map((x, k) => (k === index ? { ...x, qty: x.qty + delta } : x)).filter((x) => x.qty > 0));

  // Enter trong ô tìm: mã tắt khớp đúng (vd "b") hoặc chỉ còn một món thì thêm luôn
  function onSearchKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key !== 'Enter') return;
    const q = search.trim().toLowerCase();
    const hit = (items.data ?? []).find((i) => i.shortcut === q) ?? (shown.length === 1 ? shown[0] : undefined);
    if (hit?.available) {
      add(hit);
      setSearch('');
    }
  }

  /**
   * Trạm máy in mạng đã được máy chủ in xong; ở đây chỉ in các phiếu của trạm in qua máy quầy.
   * Máy in mạng lỗi thì lượt đã đỏ sẵn và thông báo có nút In lại.
   */
  async function printRound(roundId: number, tickets: PrintTicket[], again = false) {
    const local = tickets.filter((t) => t.delivery !== 'network');
    const failed = tickets.filter((t) => t.printed === false);
    if (local.length) {
      await printTickets(local);
      if (!failed.length) await api(`/rounds/${roundId}/print-result`, { method: 'POST', body: { status: 'PRINTED' } }).catch(() => {});
    }
    tab.reload();
    const parts = tickets.map((t) => (t.printed === false ? `${t.stationName}: ${t.error}` : t.delivery === 'network' ? `${t.stationName}: đã in` : `${t.stationName}: in ở máy quầy`));
    setToast({
      message: `${again ? 'Đã in lại' : 'Đã gửi in'} ${tickets.length} phiếu. ${parts.join(' · ')}.`,
      action: failed.length
        ? { label: 'In lại', run: () => void reprint(roundId) }
        : local.length
          ? {
              label: 'Phiếu không ra? Báo lỗi in',
              run: async () => {
                await api(`/rounds/${roundId}/print-result`, { method: 'POST', body: { status: 'FAILED' } }).catch(() => {});
                setToast(null);
                tab.reload();
              },
            }
          : undefined,
    });
  }

  async function submitRound() {
    if (!draft.length) return;
    const res = await send.run(() =>
      api<{ round: { id: number }; tickets: PrintTicket[] }>(`/tabs/${id}/rounds`, {
        method: 'POST',
        body: { items: draft.map((d) => ({ itemId: d.itemId, qty: d.qty, ...(d.note ? { note: d.note } : {}) })) },
      }),
    );
    if (!res) return;
    setDraft([]);
    // FR-04: lượt đã lưu dù máy in lỗi; nhân viên báo lỗi in để bàn chuyển đỏ và có nút In lại
    await printRound(res.round.id, res.tickets);
    searchRef.current?.focus();
  }

  async function reprint(roundId: number) {
    const res = await act.run(() => api<{ tickets: PrintTicket[] }>(`/rounds/${roundId}/reprint`, { method: 'POST' }));
    if (res) await printRound(roundId, res.tickets, true);
  }

  async function provisional() {
    const bill = await act.run(() => api<PrintedBill>(`/tabs/${id}/provisional`, { method: 'POST' }));
    if (!bill) return;
    await printBill(bill, SHOP_NAME);
    tab.reload();
    setToast({ message: `Đã in ${bill.title.toLowerCase()}.` });
  }

  if (tab.error && !t) {
    return (
      <Shell top={<BackButton />}>
        <p className="form-error" role="alert">
          {tab.error.message}
        </p>
      </Shell>
    );
  }

  const rounds = t?.rounds ?? [];
  const lines = rounds.flatMap((r) => r.lines);
  const adjustmentsOf = (lineId: number) => lines.filter((l) => l.refLineId === lineId);

  return (
    <Shell
      top={
        <div className="tab-top">
          <BackButton />
          {t && (
            <>
              <h1 className="tab-title">Bàn {t.table.code}</h1>
              <span className="muted">
                {t.table.areaName} · {t.guestCount ? `${t.guestCount} khách · ` : ''}ngồi {seated(t.openedAt, now)} · {t.billCode}
              </span>
              {t.tableStatus && t.tableStatus !== 'OPEN' && <span className={`status-chip is-${t.tableStatus.toLowerCase()}`}>{STATUS_LABEL[t.tableStatus]}</span>}
            </>
          )}
        </div>
      }
    >
      <div className="order">
        {/* ---------- thực đơn ---------- */}
        <section className="menu-col" aria-label="Thực đơn">
          <div className="menu-tools">
            <label className="search">
              <Icon name="search" />
              <input
                ref={searchRef}
                className="input"
                type="search"
                placeholder="Tìm món hoặc gõ mã tắt rồi Enter (vd b)"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={onSearchKey}
                aria-label="Tìm món"
              />
            </label>
          </div>
          <nav className="group-tabs" role="tablist" aria-label="Nhóm món">
            <button role="tab" aria-selected={group === 'all'} onClick={() => setGroup('all')}>
              Tất cả
            </button>
            {groups.data?.map((g) => (
              <button role="tab" key={g.id} aria-selected={group === g.id} onClick={() => setGroup(g.id)}>
                {g.name}
              </button>
            ))}
          </nav>
          <div className="item-grid">
            {shown.map((item) => {
              const price = priceOf(item);
              return (
                <button key={item.id} type="button" className="item-btn" onClick={() => add(item)} disabled={!item.available} aria-label={`${item.name}, ${vnd(price.unitPrice)} đồng${item.available ? '' : ', đã hết'}`}>
                  {/* Món chưa có ảnh: ô nền hiện mã tắt (nhân viên nhớ mã nhanh hơn), để các nút cùng cao và lưới thẳng hàng */}
                  {item.imageFile ? (
                    <img className="item-img" src={imageUrl(item.imageFile)} alt="" loading="lazy" />
                  ) : (
                    <span className="item-img blank" aria-hidden="true">
                      {item.shortcut?.toUpperCase() ?? initials(item.name)}
                    </span>
                  )}
                  <span className="item-name">{item.name}</span>
                  <span className="item-meta">
                    {item.available ? (
                      <>
                        <span className="num">{vnd(price.unitPrice)}</span>
                        {price.happyHourId && <span className="hh">giờ vàng</span>}
                      </>
                    ) : (
                      'Hết món'
                    )}
                    {item.shortcut && <span className="sc">{item.shortcut}</span>}
                  </span>
                </button>
              );
            })}
            {items.data && shown.length === 0 && <p className="muted">Không có món nào khớp "{search}".</p>}
          </div>
        </section>

        {/* ---------- phiên bàn ---------- */}
        <section className="tab-col" aria-label="Phiên bàn">
          <div className="tab-total">
            <span className="label">Tạm tính</span>
            <span className="value">{t ? <Money value={t.total} /> : '—'}</span>
          </div>

          <div className="draft" aria-label="Lượt đang nhập">
            <h2>
              Lượt đang nhập{draftCount ? <span className="muted num"> · {draftCount} phần · {vndText(draftTotal)}</span> : null}
            </h2>
            {draft.length === 0 ? (
              <p className="muted draft-empty">Chạm món bên trái để thêm vào lượt gọi.</p>
            ) : (
              <ul className="draft-list">
                {draft.map((d, i) => {
                  const item = itemById.get(d.itemId);
                  return (
                    <li key={`${d.itemId}-${i}`}>
                      <span className="draft-name">
                        {item?.name}
                        {d.note && <span className="sub">Ghi chú: {d.note}</span>}
                      </span>
                      <button className="btn ghost icon" onClick={() => setNoteFor(i)} aria-label={`Ghi chú cho ${item?.name}`}>
                        <Icon name="note" />
                      </button>
                      <span className="stepper">
                        <button className="btn icon" onClick={() => change(i, -1)} aria-label={`Bớt ${item?.name}`}>
                          <Icon name="minus" />
                        </button>
                        <span className="num qty">{d.qty}</span>
                        <button className="btn icon" onClick={() => change(i, 1)} aria-label={`Thêm ${item?.name}`}>
                          <Icon name="plus" />
                        </button>
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
            <div className="draft-actions">
              <button className="btn ghost" onClick={() => setDraft([])} disabled={!draft.length}>
                Bỏ lượt này
              </button>
              <button className="btn primary big send" onClick={submitRound} disabled={!draft.length || send.busy}>
                {send.busy ? 'Đang gửi…' : `Gửi & in phiếu${draftCount ? ` (${draftCount})` : ''}`}
              </button>
            </div>
            {send.error && (
              <p className="form-error" role="alert">
                {send.error}
              </p>
            )}
          </div>

          <div className="rounds" aria-label="Các lượt đã gửi">
            {rounds.length === 0 && t && <p className="muted">Chưa gọi món nào.</p>}
            {[...rounds].reverse().map((r, idx) => (
              <section key={r.id} className={r.printedStatus === 'FAILED' ? 'round failed' : 'round'}>
                <header>
                  <span>
                    Lượt {rounds.length - idx} · {time(r.createdAt)} · {r.createdBy.name}
                  </span>
                  {r.printedStatus === 'FAILED' ? (
                    <button className="btn danger" onClick={() => reprint(r.id)} disabled={act.busy}>
                      <Icon name="printer" /> Lỗi in · In lại
                    </button>
                  ) : (
                    <button className="btn ghost small" onClick={() => reprint(r.id)} disabled={act.busy} aria-label={`In lại lượt ${rounds.length - idx}`}>
                      <Icon name="printer" /> In lại
                    </button>
                  )}
                </header>
                <ul>
                  {r.lines
                    .filter((l) => l.lineType === 'NORMAL')
                    .map((l) => {
                      const adj = adjustmentsOf(l.id);
                      const gone = (l.state?.remainingQty ?? l.qty) === 0;
                      return (
                        <li key={l.id}>
                          <button className={gone ? 'sent-line gone' : 'sent-line'} onClick={() => setAdjust({ line: l, mode: 'void' })} disabled={gone} aria-label={`${l.itemName}, ${l.state?.remainingQty ?? l.qty} phần — hủy hoặc giảm giá`}>
                            <span>
                              {l.itemName} <span className="num">×{l.state?.remainingQty ?? l.qty}</span>
                              {l.note && <span className="sub">{l.note}</span>}
                            </span>
                            <span className="num">{vnd(l.state?.netAmount ?? l.amount)}</span>
                          </button>
                          {adj.map((a) => (
                            <p key={a.id} className="adj">
                              {a.lineType === 'VOID' ? `Hủy ${-a.qty}` : `Giảm ${vnd(-a.amount)} đ`} · {a.reasonNote || (a.reason ? ADJUST_REASON_LABELS[a.reason] : '')} · {a.createdBy.name}, duyệt: {a.approvedBy?.name}
                            </p>
                          ))}
                        </li>
                      );
                    })}
                </ul>
              </section>
            ))}
            {t?.billDiscounts.map((d) => (
              <p key={d.id} className="adj">
                Giảm giá hóa đơn {vnd(-d.amount)} đ · {d.reasonNote || ADJUST_REASON_LABELS[d.reason]} · duyệt: {d.approvedBy.name}
              </p>
            ))}
          </div>

          <div className="tab-actions">
            <button className="btn big" onClick={provisional} disabled={!t || act.busy || t.total === 0}>
              <Icon name="printer" /> Tạm tính
            </button>
            <button className="btn big" onClick={() => setMoveMode('move')} disabled={!t}>
              <Icon name="move" /> Chuyển
            </button>
            <button className="btn big" onClick={() => setMoveMode('merge')} disabled={!t}>
              <Icon name="merge" /> Gộp
            </button>
            <button className="btn primary big" onClick={() => navigate(`/ban/${id}/thanh-toan`)} disabled={!t || draft.length > 0} title={draft.length ? 'Gửi hoặc bỏ lượt đang nhập trước' : undefined}>
              <Icon name="pay" /> Thanh toán
            </button>
          </div>
          {act.error && (
            <p className="form-error" role="alert">
              {act.error}
            </p>
          )}
        </section>
      </div>

      <NoteDialog
        open={noteFor !== null}
        name={noteFor !== null ? (itemById.get(draft[noteFor]?.itemId ?? 0)?.name ?? '') : ''}
        value={noteFor !== null ? (draft[noteFor]?.note ?? '') : ''}
        onSave={(note) => {
          setDraft((d) => d.map((x, k) => (k === noteFor ? { ...x, note } : x)));
          setNoteFor(null);
        }}
        onClose={() => setNoteFor(null)}
      />

      {adjust && (
        <AdjustDialog
          adjust={adjust}
          onClose={() => setAdjust(null)}
          onConfirm={(summary, run) => {
            setAdjust(null);
            setApproving({ summary, run });
          }}
        />
      )}

      <ApprovalDialog
        open={approving !== null}
        summary={approving?.summary ?? ''}
        onClose={() => setApproving(null)}
        onApproved={async (token) => {
          const warning = await approving!.run(token);
          setApproving(null);
          if (warning) setToast({ message: warning });
          tab.reload();
        }}
      />

      {moveMode && t && (
        <MoveDialog
          mode={moveMode}
          tab={t}
          now={now}
          onClose={() => setMoveMode(null)}
          onDone={(detail) => {
            setMoveMode(null);
            if (detail.id === id) {
              // Chuyển bàn giữ nguyên phiên (cùng đường dẫn): báo và tải lại tại chỗ
              setToast({ message: `Đã chuyển sang bàn ${detail.table.code}.` });
              tab.reload();
            } else {
              // Gộp: sang phiên đích, là một màn mới
              navigate(`/ban/${detail.id}`, { replace: true, state: { notice: `Đã gộp bàn ${t.table.code} vào bàn ${detail.table.code}.` } });
            }
          }}
        />
      )}

      {toast && <Toast message={toast.message} action={toast.action} onClose={() => setToast(null)} />}
    </Shell>
  );
}

function BackButton() {
  const navigate = useNavigate();
  return (
    <button className="btn" onClick={() => navigate('/')}>
      <Icon name="back" /> Sơ đồ bàn
    </button>
  );
}

function NoteDialog({ open, name, value, onSave, onClose }: { open: boolean; name: string; value: string; onSave: (v: string) => void; onClose: () => void }) {
  const [text, setText] = useState(value);
  useEffect(() => setText(value), [value, open]);
  const quick = ['Ít cay', 'Không hành', 'Nướng kỹ', 'Mang ra trước', 'Đá riêng'];
  return (
    <Dialog
      open={open}
      title={`Ghi chú: ${name}`}
      onClose={onClose}
      footer={
        <>
          <span className="spacer" />
          <button className="btn big" onClick={onClose}>
            Hủy
          </button>
          <button className="btn primary big" onClick={() => onSave(text.trim())}>
            Lưu ghi chú
          </button>
        </>
      }
    >
      <div className="chips">
        {quick.map((q) => (
          <button key={q} type="button" className="chip" onClick={() => setText((t) => (t ? `${t}, ${q.toLowerCase()}` : q))}>
            {q}
          </button>
        ))}
      </div>
      <Field label="Ghi chú cho bếp">
        <input className="input" maxLength={200} value={text} onChange={(e) => setText(e.target.value)} />
      </Field>
    </Dialog>
  );
}

/** FR-06: chọn hủy (số lượng) hoặc giảm giá (% / số tiền), lý do bắt buộc; sau đó mới xin PIN quản lý. */
function AdjustDialog({ adjust, onClose, onConfirm }: { adjust: Adjust; onClose: () => void; onConfirm: (summary: string, run: (token: string) => Promise<string | void>) => void }) {
  const { line } = adjust;
  const remaining = line.state?.remainingQty ?? line.qty;
  const [mode, setMode] = useState(adjust.mode);
  const [qty, setQty] = useState(1);
  const [kind, setKind] = useState<'percent' | 'amount'>('percent');
  const [value, setValue] = useState('10');
  const [reason, setReason] = useState<AdjustReason | null>(null);
  const [note, setNote] = useState('');
  const amount = mode === 'void' ? qty * line.unitPrice : kind === 'percent' ? Math.round(((line.state?.netAmount ?? line.amount) * Number(value || 0)) / 100) : Number(value || 0);
  const valid = reason !== null && (reason !== 'KHAC' || note.trim().length > 0) && (mode === 'void' ? qty >= 1 && qty <= remaining : amount > 0);

  function confirm() {
    if (!valid || !reason) return;
    const what = mode === 'void' ? `Hủy ${qty} ${line.itemName}` : `Giảm ${kind === 'percent' ? `${value}%` : vndText(Number(value))} cho ${line.itemName}`;
    const summary = `${what} (${vndText(amount)}) — lý do: ${note.trim() || ADJUST_REASON_LABELS[reason]}.`;
    onConfirm(summary, async (approvalToken) => {
      const body = { reason, ...(note.trim() ? { note: note.trim() } : {}), approvalToken };
      if (mode === 'void') {
        const res = await api<{ tickets: PrintTicket[] }>(`/lines/${line.id}/void`, { method: 'POST', body: { ...body, qty } });
        // báo hủy xuống trạm để bếp / quầy rót không làm nữa
        await printTickets(res.tickets.filter((x) => x.delivery !== 'network'));
        // Phiếu hủy không tới được máy in mạng: phải báo miệng cho bếp, nếu không món vẫn được làm
        const failed = res.tickets.filter((x) => x.printed === false);
        if (failed.length) return `Đã hủy món, nhưng phiếu hủy không in được ở ${failed.map((x) => `${x.stationName} (${x.error})`).join(', ')}. Báo trực tiếp cho trạm.`;
      } else {
        await api(`/lines/${line.id}/discount`, { method: 'POST', body: { ...body, ...(kind === 'percent' ? { percent: Number(value) } : { amount: Number(value) }) } });
      }
    });
  }

  return (
    <Dialog
      open
      title={`${line.itemName} ×${remaining}`}
      onClose={onClose}
      footer={
        <>
          <span className="muted num">{mode === 'void' ? `Trừ ${vndText(amount)}` : `Giảm ${vndText(amount)}`}</span>
          <span className="spacer" />
          <button className="btn big" onClick={onClose}>
            Đóng
          </button>
          <button className="btn primary big" onClick={confirm} disabled={!valid}>
            Xin duyệt
          </button>
        </>
      }
    >
      <div className="segmented big" role="group" aria-label="Loại điều chỉnh">
        <button type="button" aria-pressed={mode === 'void'} onClick={() => setMode('void')}>
          Hủy món
        </button>
        <button type="button" aria-pressed={mode === 'discount'} onClick={() => setMode('discount')}>
          Giảm giá
        </button>
      </div>
      {mode === 'void' ? (
        <fieldset className="field">
          <legend className="field-label">Số lượng hủy</legend>
          <span className="stepper">
            <button type="button" className="btn icon" onClick={() => setQty((q) => Math.max(1, q - 1))} aria-label="Bớt">
              <Icon name="minus" />
            </button>
            <span className="num qty">{qty}</span>
            <button type="button" className="btn icon" onClick={() => setQty((q) => Math.min(remaining, q + 1))} aria-label="Thêm">
              <Icon name="plus" />
            </button>
          </span>
        </fieldset>
      ) : (
        <div className="form-row">
          <Field label="Giảm theo">
            <select className="input" value={kind} onChange={(e) => setKind(e.target.value as 'percent' | 'amount')}>
              <option value="percent">Phần trăm</option>
              <option value="amount">Số tiền (đ)</option>
            </select>
          </Field>
          <Field label={kind === 'percent' ? 'Phần trăm' : 'Số tiền'}>
            <input className="input num" inputMode="numeric" value={value} onChange={(e) => setValue(e.target.value.replace(/\D/g, ''))} />
          </Field>
        </div>
      )}
      <fieldset className="field">
        <legend className="field-label">Lý do (bắt buộc)</legend>
        <div className="chips">
          {ADJUST_REASONS.map((r) => (
            <button key={r} type="button" className="chip" aria-pressed={reason === r} onClick={() => setReason(r)}>
              {ADJUST_REASON_LABELS[r]}
            </button>
          ))}
        </div>
      </fieldset>
      <Field label={reason === 'KHAC' ? 'Ghi chú (bắt buộc khi chọn Khác)' : 'Ghi chú'}>
        <input className="input" maxLength={200} value={note} onChange={(e) => setNote(e.target.value)} />
      </Field>
    </Dialog>
  );
}

/** FR-05: chuyển sang bàn trống, hoặc gộp vào bàn đang có khách. */
function MoveDialog({ mode, tab, now, onClose, onDone }: { mode: 'move' | 'merge'; tab: TabDetail; now: Date; onClose: () => void; onDone: (d: TabDetail) => void }) {
  const map = useApi<MapArea[]>('/areas?include=tables');
  const action = useAction();
  const [areaId, setAreaId] = useState(tab.table.areaId);
  const area = map.data?.find((a) => a.id === areaId);
  const ok = (t: MapTable) => t.id !== tab.table.id && (mode === 'move' ? !t.tab : !!t.tab);

  async function pick(t: MapTable) {
    const detail = await action.run(() => api<TabDetail>(`/tabs/${tab.id}/${mode}`, { method: 'POST', body: { tableId: t.id } }));
    if (detail) onDone(detail);
  }

  return (
    <Dialog open wide title={mode === 'move' ? `Chuyển bàn ${tab.table.code} sang bàn trống` : `Gộp bàn ${tab.table.code} vào bàn đang có khách`} onClose={onClose}>
      <nav className="area-tabs inline" role="tablist" aria-label="Khu">
        {map.data?.map((a) => (
          <button key={a.id} role="tab" aria-selected={a.id === areaId} onClick={() => setAreaId(a.id)}>
            {a.name}
          </button>
        ))}
      </nav>
      <p className="muted">{mode === 'move' ? 'Chạm một bàn trống. Toàn bộ món và tạm tính chuyển theo.' : `Chạm bàn đích. Món của bàn ${tab.table.code} nhập vào bàn đó, bàn ${tab.table.code} trở về trống.`}</p>
      <div className="table-grid picker">
        {area?.tables.map((t) => <TableTile key={t.id} table={t} now={now} onPick={pick} disabled={!ok(t) || action.busy} />)}
      </div>
      {action.error && (
        <p className="form-error" role="alert">
          {action.error}
        </p>
      )}
    </Dialog>
  );
}

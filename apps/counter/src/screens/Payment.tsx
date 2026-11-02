// FR-08 thanh toán: tiền mặt (tiền thừa), chuyển khoản VietQR (nhân viên xác nhận đã nhận), hoặc kết hợp.
// Câu hỏi của màn: "Khách trả bao nhiêu, bằng gì?" — số phải trả là số lớn nhất.

import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ADJUST_REASONS, ADJUST_REASON_LABELS, SOCKET_EVENTS, buildBillBody, type AdjustReason } from '@biahoi/shared';
import { ApprovalDialog } from '../components/Approval';
import { Icon } from '../components/Icon';
import { Shell } from '../components/Shell';
import { Dialog, Field, Money, QrCode } from '../components/ui';
import { api } from '../lib/api';
import { vnd, vndText } from '../lib/format';
import { useAction, useApi, useLive } from '../lib/hooks';
import { printBill } from '../lib/print';
import type { PrintedBill, TabDetail } from '../lib/types';
import { SHOP_NAME } from '../shop';

type Method = 'cash' | 'transfer' | 'mixed';

/** Các mệnh giá khách hay đưa: đúng số, rồi làm tròn lên 50k, 100k, 200k, 500k. */
function quickAmounts(due: number): number[] {
  const up = (step: number) => Math.ceil(due / step) * step;
  return [...new Set([due, up(50_000), up(100_000), up(200_000), up(500_000)])].filter((v) => v >= due).slice(0, 5);
}

const digits = (s: string) => Number(s.replace(/\D/g, '') || 0);

export function Payment() {
  const { tabId } = useParams();
  const id = Number(tabId);
  const navigate = useNavigate();
  const tab = useApi<TabDetail>(`/tabs/${id}`);
  // Máy khác gọi thêm món hoặc hủy món trong lúc đang thanh toán: số phải trả cập nhật ngay
  useLive([SOCKET_EVENTS.TABLE_UPDATED], tab.reload, (p) => !tab.data || !p.tableIds || p.tableIds.includes(tab.data.table.id));
  const [method, setMethod] = useState<Method>('cash');
  const [tendered, setTendered] = useState('');
  const [transferPart, setTransferPart] = useState('');
  const [received, setReceived] = useState(false);
  const [discountOpen, setDiscountOpen] = useState(false);
  const [approving, setApproving] = useState<{ summary: string; body: object } | null>(null);
  const pay = useAction();

  const t = tab.data;
  const due = t?.total ?? 0;
  const [changedFrom, setChangedFrom] = useState<number | null>(null);
  const paying = useRef(false);
  const lastDue = useRef<number | null>(null);

  // Số phải trả đổi do máy khác: báo cho nhân viên và bỏ đánh dấu "đã nhận chuyển khoản", vì mã QR cũ đã sai số tiền
  useEffect(() => {
    if (!t) return;
    if (lastDue.current !== null && lastDue.current !== t.total && !paying.current) {
      setChangedFrom(lastDue.current);
      setReceived(false);
    }
    lastDue.current = t.total;
  }, [t]);

  // Bàn đã được thanh toán hoặc gộp ở máy khác
  useEffect(() => {
    if (!t || paying.current || t.status === 'OPEN') return;
    const notice = t.status === 'PAID' ? `Bàn ${t.table.code} đã được thanh toán ở máy khác.` : `Bàn ${t.table.code} đã được gộp sang bàn khác.`;
    navigate(t.status === 'MERGED' && t.mergedIntoId ? `/ban/${t.mergedIntoId}` : '/', { replace: true, state: { notice } });
  }, [t, navigate]);
  const bill = useMemo(() => (t ? buildBillBody(t.rounds.flatMap((r) => r.lines), t.billDiscounts) : null), [t]);

  const transferAmount = method === 'transfer' ? due : method === 'mixed' ? Math.min(digits(transferPart), due) : 0;
  const cashDue = due - transferAmount;
  const cashGiven = method === 'transfer' ? 0 : tendered ? digits(tendered) : 0;
  const change = cashGiven - cashDue;
  const qr = useApi<{ payload: string; amount: number; content: string; bankBin: string; accountNo: string; accountName: string }>(
    transferAmount > 0 ? `/tabs/${id}/vietqr?amount=${transferAmount}` : null,
  );

  const cashOk = cashDue === 0 || cashGiven >= cashDue;
  const transferOk = transferAmount === 0 || received;
  const canPay = !!t && t.status === 'OPEN' && cashOk && transferOk && (method !== 'mixed' || (transferAmount > 0 && transferAmount < due));
  const missing = !cashOk ? `Khách đưa còn thiếu ${vndText(cashDue - cashGiven)}` : !transferOk ? 'Kiểm tra app ngân hàng rồi đánh dấu "Đã nhận tiền chuyển khoản"' : '';

  async function complete() {
    const payments = [
      ...(transferAmount > 0 ? [{ method: 'TRANSFER', amount: transferAmount }] : []),
      ...(cashDue > 0 ? [{ method: 'CASH', amount: cashDue, tendered: Math.max(cashGiven, cashDue) }] : []),
    ];
    paying.current = true;
    const final = await pay.run(() => api<PrintedBill>(`/tabs/${id}/pay`, { method: 'POST', body: { payments } }));
    if (!final) {
      paying.current = false;
      return;
    }
    await printBill(final, SHOP_NAME);
    navigate('/', { replace: true, state: { notice: `Đã thanh toán bàn ${final.tableCode}: ${vndText(final.total)}${final.change ? `, trả lại khách ${vndText(final.change)}` : ''}.` } });
  }

  return (
    <Shell
      top={
        <div className="tab-top">
          <button className="btn" onClick={() => navigate(`/ban/${id}`)}>
            <Icon name="back" /> Quay lại bàn
          </button>
          {t && <strong className="tab-title">Thanh toán bàn {t.table.code}</strong>}
          {t && <span className="muted">{t.billCode}</span>}
        </div>
      }
    >
      <div className="pay">
        <section className="pay-bill" aria-label="Hóa đơn">
          <h1>
            Bàn {t?.table.code} <span className="muted">· {t?.billCode}</span>
          </h1>
          <table className="bill-table">
            <tbody>
              {bill?.rows.map((r) => (
                <tr key={`${r.name}-${r.unitPrice}`}>
                  <td>
                    {r.name}
                    <span className="sub num">
                      {r.qty} × {vnd(r.unitPrice)}
                    </span>
                  </td>
                  <td className="n num">{vnd(r.amount)}</td>
                </tr>
              ))}
              {bill?.adjustments.map((a) => (
                <tr key={a.label} className="adj-row">
                  <td>{a.label}</td>
                  <td className="n num">{vnd(a.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <button className="btn" onClick={() => setDiscountOpen(true)} disabled={!t || due === 0}>
            Giảm giá cả hóa đơn
          </button>
        </section>

        <section className="pay-side" aria-label="Thu tiền">
          <div className="due">
            <span className="label">Phải trả</span>
            <span className="value">
              <Money value={due} />
            </span>
          </div>
          {changedFrom !== null && (
            <p className="pay-changed" role="alert">
              Bàn vừa thay đổi món ở máy khác: số phải trả đổi từ <span className="num">{vnd(changedFrom)}</span>. Kiểm tra lại với khách.
              <button type="button" className="btn small" onClick={() => setChangedFrom(null)}>
                Đã hiểu
              </button>
            </p>
          )}

          <div className="segmented big" role="group" aria-label="Phương thức">
            {(
              [
                ['cash', 'Tiền mặt'],
                ['transfer', 'Chuyển khoản'],
                ['mixed', 'Kết hợp'],
              ] as const
            ).map(([m, label]) => (
              <button
                key={m}
                type="button"
                aria-pressed={method === m}
                onClick={() => {
                  setMethod(m);
                  setReceived(false);
                }}
              >
                {label}
              </button>
            ))}
          </div>

          {method === 'mixed' && (
            <Field label="Phần chuyển khoản (đ)" hint="Phần còn lại thu tiền mặt">
              <input className="input big num" inputMode="numeric" value={transferPart ? vnd(digits(transferPart)) : ''} onChange={(e) => setTransferPart(e.target.value)} />
            </Field>
          )}

          {transferAmount > 0 && (
            <div className="qr-box">
              {qr.error ? (
                <p className="form-error">{qr.error.message}</p>
              ) : qr.data ? (
                <>
                  <QrCode value={qr.data.payload} label={`Mã VietQR chuyển ${vnd(qr.data.amount)} đồng, nội dung ${qr.data.content}`} />
                  <dl className="qr-info">
                    <div>
                      <dt>Số tiền</dt>
                      <dd className="num">{vndText(qr.data.amount)}</dd>
                    </div>
                    <div>
                      <dt>Nội dung</dt>
                      <dd>{qr.data.content}</dd>
                    </div>
                    <div>
                      <dt>Tài khoản</dt>
                      <dd>
                        {qr.data.accountNo}
                        {qr.data.accountName && <span className="sub">{qr.data.accountName}</span>}
                      </dd>
                    </div>
                  </dl>
                </>
              ) : (
                <span className="qr skeleton" />
              )}
              <label className="check big">
                <input type="checkbox" checked={received} onChange={(e) => setReceived(e.target.checked)} />
                <span>Đã nhận tiền chuyển khoản</span>
              </label>
            </div>
          )}

          {cashDue > 0 && (
            <div className="cash">
              <Field label={method === 'mixed' ? `Khách đưa tiền mặt (cần ${vndText(cashDue)})` : 'Khách đưa'}>
                <input className="input big num" inputMode="numeric" value={tendered ? vnd(digits(tendered)) : ''} onChange={(e) => setTendered(e.target.value)} />
              </Field>
              <div className="chips">
                {quickAmounts(cashDue).map((v) => (
                  <button key={v} type="button" className="chip big num" aria-pressed={cashGiven === v} onClick={() => setTendered(String(v))}>
                    {v === cashDue ? 'Đúng số' : vnd(v)}
                  </button>
                ))}
              </div>
              <p className={change >= 0 && cashGiven > 0 ? 'change' : 'change muted'}>
                Tiền thừa trả khách: <strong className="num">{cashGiven >= cashDue ? vndText(change) : '—'}</strong>
              </p>
            </div>
          )}

          <button className="btn primary big block" onClick={complete} disabled={!canPay || pay.busy}>
            {pay.busy ? 'Đang thanh toán…' : 'Hoàn tất & in hóa đơn'}
          </button>
          {missing && <p className="muted hint-line">{missing}</p>}
          {pay.error && (
            <p className="form-error" role="alert">
              {pay.error}
            </p>
          )}
        </section>
      </div>

      {discountOpen && t && (
        <BillDiscountDialog
          total={due}
          onClose={() => setDiscountOpen(false)}
          onConfirm={(summary, body) => {
            setDiscountOpen(false);
            setApproving({ summary, body });
          }}
        />
      )}
      <ApprovalDialog
        open={approving !== null}
        summary={approving?.summary ?? ''}
        onClose={() => setApproving(null)}
        onApproved={async (approvalToken) => {
          await api(`/tabs/${id}/discount`, { method: 'POST', body: { ...approving!.body, approvalToken } });
          setApproving(null);
          setTendered('');
          tab.reload();
        }}
      />
    </Shell>
  );
}

function BillDiscountDialog({ total, onClose, onConfirm }: { total: number; onClose: () => void; onConfirm: (summary: string, body: object) => void }) {
  const [kind, setKind] = useState<'percent' | 'amount'>('percent');
  const [value, setValue] = useState('10');
  const [reason, setReason] = useState<AdjustReason | null>(null);
  const [note, setNote] = useState('');
  const amount = kind === 'percent' ? Math.round((total * Number(value || 0)) / 100) : Number(value || 0);
  const valid = reason !== null && amount > 0 && amount <= total && (reason !== 'KHAC' || note.trim().length > 0);
  return (
    <Dialog
      open
      title="Giảm giá cả hóa đơn"
      onClose={onClose}
      footer={
        <>
          <span className="muted num">Giảm {vndText(amount)} · còn {vndText(Math.max(0, total - amount))}</span>
          <span className="spacer" />
          <button className="btn big" onClick={onClose}>
            Đóng
          </button>
          <button
            className="btn primary big"
            disabled={!valid}
            onClick={() =>
              onConfirm(`Giảm ${kind === 'percent' ? `${value}%` : vndText(amount)} cả hóa đơn (${vndText(amount)}) — lý do: ${note.trim() || ADJUST_REASON_LABELS[reason!]}.`, {
                reason,
                ...(note.trim() ? { note: note.trim() } : {}),
                ...(kind === 'percent' ? { percent: Number(value) } : { amount }),
              })
            }
          >
            Xin duyệt
          </button>
        </>
      }
    >
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

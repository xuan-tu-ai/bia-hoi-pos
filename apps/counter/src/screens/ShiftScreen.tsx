// FR-09 mở / đóng ca. Đóng ca cần Quản lý ca: nếu người đang đứng quầy không phải quản lý thì xin PIN quản lý ngay tại đây.

import { useState } from 'react';
import { APPROVER_ROLES } from '@biahoi/shared';
import { Shell } from '../components/Shell';
import { Dialog, Field, Money, PinPad } from '../components/ui';
import { api, errorText } from '../lib/api';
import { int, signed, time, vnd, vndText } from '../lib/format';
import { useAction, useApi } from '../lib/hooks';
import { printShiftReport } from '../lib/print';
import { useSession } from '../lib/session';
import type { Shift, ShiftSummary, StaffSession } from '../lib/types';
import { SHOP_NAME } from '../shop';

const digits = (s: string) => Number(s.replace(/\D/g, '') || 0);

export function ShiftScreen() {
  const { staff } = useSession();
  const current = useApi<{ shift: Shift | null; summary?: ShiftSummary }>('/shifts/current');
  const [opening, setOpening] = useState('1000000');
  const [closing, setClosing] = useState(false);
  const [counted, setCounted] = useState('');
  const [needPin, setNeedPin] = useState(false);
  const [result, setResult] = useState<{ summary: ShiftSummary; closedBy: string } | null>(null);
  const [pinError, setPinError] = useState<string | null>(null);
  const action = useAction();

  const shift = current.data?.shift;
  const s = current.data?.summary;
  const isManager = !!staff && APPROVER_ROLES.includes(staff.role);
  const diff = s && counted ? digits(counted) - s.expectedCash : null;

  async function openShift() {
    if (await action.run(() => api('/shifts/open', { method: 'POST', body: { openingCash: digits(opening) } }))) current.reload();
  }

  async function closeWith(token: string | undefined, closedBy: string) {
    if (!shift) return;
    const res = await action.run(() =>
      api<{ shift: Shift & { closedAt: string }; summary: ShiftSummary }>(`/shifts/${shift.id}/close`, { method: 'POST', body: { countedCash: digits(counted) }, as: token }),
    );
    if (!res) return;
    setClosing(false);
    setNeedPin(false);
    setResult({ summary: res.summary, closedBy });
    current.reload();
    await printShiftReport(
      {
        openedAt: shift.openedAt,
        closedAt: res.shift.closedAt,
        openedBy: shift.openedBy.name,
        closedBy,
        openingCash: shift.openingCash,
        cashTotal: res.summary.cashTotal,
        transferTotal: res.summary.transferTotal,
        billCount: res.summary.billCount,
        expectedCash: res.summary.expectedCash,
        countedCash: res.summary.countedCash ?? 0,
        difference: res.summary.difference ?? 0,
      },
      SHOP_NAME,
    );
  }

  async function managerPin(pin: string) {
    setPinError(null);
    try {
      const res = await api<{ token: string; staff: StaffSession }>('/auth/pin', { method: 'POST', body: { pin } });
      if (!APPROVER_ROLES.includes(res.staff.role)) {
        setPinError('PIN này không phải của Quản lý ca.');
        return;
      }
      await closeWith(res.token, res.staff.name);
    } catch (e) {
      setPinError(errorText(e));
    }
  }

  return (
    <Shell top={<strong className="tab-title">Ca làm việc</strong>}>
      <div className="shift">
        {result && (
          <section className="notice" role="status">
            Đã đóng ca, {result.closedBy} xác nhận. Tiền mặt {signed(result.summary.difference ?? 0, vnd)} đ so với số phải có. Báo cáo đã gửi in và xem lại được trên Web quản trị.
          </section>
        )}
        {!current.data ? (
          <p className="muted">Đang tải…</p>
        ) : !shift ? (
          <section className="shift-open">
            <h1>Chưa mở ca</h1>
            <p className="muted">Đếm tiền lẻ trong két rồi nhập số tiền đầu ca.</p>
            <Field label="Tiền đầu ca (đ)">
              <input className="input big num" inputMode="numeric" value={opening ? vnd(digits(opening)) : ''} onChange={(e) => setOpening(e.target.value)} />
            </Field>
            <div className="chips">
              {[500_000, 1_000_000, 2_000_000].map((v) => (
                <button key={v} type="button" className="chip big num" aria-pressed={digits(opening) === v} onClick={() => setOpening(String(v))}>
                  {vnd(v)}
                </button>
              ))}
            </div>
            <button className="btn primary big" onClick={openShift} disabled={action.busy}>
              Mở ca
            </button>
          </section>
        ) : (
          <section className="shift-now">
            <h1>
              Ca đang mở <span className="muted">· từ {time(shift.openedAt)}, {shift.openedBy.name}</span>
            </h1>
            <div className="kpis">
              <div className="kpi lead">
                <p className="kpi-label">Tiền mặt phải có trong két</p>
                <p className="kpi-value">
                  <Money value={s?.expectedCash ?? shift.openingCash} />
                </p>
                <p className="delta">Đầu ca {vndText(shift.openingCash)} + tiền mặt thu {vndText(s?.cashTotal ?? 0)}</p>
              </div>
              <div className="kpi">
                <p className="kpi-label">Chuyển khoản</p>
                <p className="kpi-value">
                  <Money value={s?.transferTotal ?? 0} />
                </p>
              </div>
              <div className="kpi">
                <p className="kpi-label">Hóa đơn trong ca</p>
                <p className="kpi-value num">{int(s?.billCount ?? 0)}</p>
              </div>
            </div>
            <button
              className="btn primary big"
              onClick={() => {
                action.clearError();
                setCounted('');
                setClosing(true);
              }}
            >
              Đóng ca
            </button>
          </section>
        )}
        {action.error && !closing && (
          <p className="form-error" role="alert">
            {action.error}
          </p>
        )}
      </div>

      <Dialog
        open={closing}
        title="Đóng ca"
        onClose={() => {
          setClosing(false);
          setNeedPin(false);
        }}
        footer={
          !needPin && (
            <>
              <span className="spacer" />
              <button className="btn big" onClick={() => setClosing(false)}>
                Hủy
              </button>
              <button
                className="btn primary big"
                disabled={!counted || action.busy}
                onClick={() => (isManager ? closeWith(undefined, staff!.name) : setNeedPin(true))}
              >
                {isManager ? 'Đóng ca & in báo cáo' : 'Quản lý ca xác nhận'}
              </button>
            </>
          )
        }
      >
        {!needPin ? (
          <>
            <Field label="Tiền mặt đếm được trong két (đ)">
              <input className="input big num" inputMode="numeric" autoFocus value={counted ? vnd(digits(counted)) : ''} onChange={(e) => setCounted(e.target.value)} />
            </Field>
            {s && (
              <p className="num">
                Phải có {vndText(s.expectedCash)} · chênh lệch{' '}
                <strong className={diff !== null && diff < 0 ? 'neg-text' : ''}>{diff === null ? '—' : `${signed(diff, vnd)} đ`}</strong>
              </p>
            )}
          </>
        ) : (
          <>
            <p className="approval-summary">
              Đóng ca với tiền mặt đếm được {vndText(digits(counted))} (chênh lệch {diff === null ? '—' : `${signed(diff, vnd)} đ`}). Quản lý ca nhập PIN để xác nhận.
            </p>
            <PinPad label="PIN quản lý ca" onSubmit={managerPin} busy={action.busy} submitLabel="Xác nhận đóng ca" />
            {(pinError || action.error) && (
              <p className="form-error" role="alert">
                {pinError ?? action.error}
              </p>
            )}
          </>
        )}
      </Dialog>
    </Shell>
  );
}

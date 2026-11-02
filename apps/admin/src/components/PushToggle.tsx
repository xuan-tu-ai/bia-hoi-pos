// FR-20: chủ quán bật thông báo đẩy cho điện thoại/máy này, ngay trên màn Nhật ký hủy/giảm.

import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { vndText } from '../lib/format';
import { disablePush, enablePush, getPushState, type PushState } from '../lib/push';
import { useApi } from '../lib/hooks';

export function PushToggle() {
  const [state, setState] = useState<PushState | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const info = useApi<{ threshold: number }>('/push/public-key');

  useEffect(() => {
    getPushState().then(setState, () => setState('unsupported'));
  }, []);

  async function act(fn: () => Promise<unknown>, done: string) {
    setBusy(true);
    setMessage(null);
    try {
      await fn();
      setState(await getPushState());
      setMessage(done);
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (state === null) return null;
  const threshold = info.data ? vndText(info.data.threshold) : '200.000 đ';

  return (
    <section className="push-strip" aria-live="polite">
      <div>
        <strong>Thông báo trên thiết bị này</strong>
        <p className="muted">
          {state === 'on' && `Đang bật: báo ngay khi có lần hủy hoặc giảm giá trên ${threshold}.`}
          {state === 'off' && `Báo ngay khi có lần hủy hoặc giảm giá trên ${threshold}, kể cả khi đang không mở ứng dụng.`}
          {state === 'denied' && 'Trình duyệt đang chặn thông báo của trang này. Mở cài đặt trang web để cho phép rồi tải lại.'}
          {state === 'unsupported' && 'Trình duyệt này không hỗ trợ thông báo đẩy. Trên điện thoại, hãy cài ứng dụng ra màn hình chính và mở qua HTTPS.'}
        </p>
        {message && <p className="push-message">{message}</p>}
      </div>
      <div className="push-actions">
        {state === 'off' && (
          <button className="btn primary" disabled={busy} onClick={() => act(enablePush, 'Đã bật thông báo cho thiết bị này.')}>
            Bật thông báo
          </button>
        )}
        {state === 'on' && (
          <>
            <button className="btn" disabled={busy} onClick={() => act(() => api('/push/test', { method: 'POST' }), 'Đã gửi thông báo thử.')}>
              Gửi thử
            </button>
            <button className="btn ghost" disabled={busy} onClick={() => act(disablePush, 'Đã tắt thông báo cho thiết bị này.')}>
              Tắt
            </button>
          </>
        )}
      </div>
    </section>
  );
}

// FR-01: màn khóa. Nhập PIN để vào; sai 5 lần liên tiếp khóa 60 giây (backend đếm, ở đây hiện câu báo).

import { useState, type FormEvent } from 'react';
import { formatVnTime } from '@biahoi/shared';
import { Icon, Mark } from '../components/Icon';
import { Dialog, Field, PinPad } from '../components/ui';
import { errorText, getDeviceKey, setDeviceKey } from '../lib/api';
import { longDate } from '../lib/format';
import { useMinuteClock } from '../lib/hooks';
import { useSession } from '../lib/session';
import { setTheme, useTheme } from '../lib/theme';
import { SHOP_NAME } from '../shop';

export function Lock() {
  const { signIn } = useSession();
  const now = useMinuteClock();
  const theme = useTheme();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [setup, setSetup] = useState(false);
  const [key, setKey] = useState(getDeviceKey());

  async function submit(pin: string) {
    setBusy(true);
    setError(null);
    try {
      await signIn(pin);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  function saveKey(e: FormEvent) {
    e.preventDefault();
    setDeviceKey(key);
    setSetup(false);
  }

  return (
    <main className="lock">
      <section className="lock-side">
        <img className="lock-photo" src={`${import.meta.env.BASE_URL}img/man-khoa.jpg`} alt="" />
        <div className="lock-brand">
          <Mark size={44} />
          <span>
            <strong>Bia Hơi Quầy</strong>
            <span>{SHOP_NAME}</span>
          </span>
        </div>
        <p className="lock-clock num">{formatVnTime(now)}</p>
        <p className="lock-date">{longDate(now)}</p>
        <div className="lock-actions">
          <button className="btn ghost lock-setup" onClick={() => setSetup(true)}>
            <Icon name="settings" /> Cài đặt máy quầy
          </button>
          <button className="btn ghost lock-setup" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
            <Icon name={theme === 'dark' ? 'sun' : 'moon'} /> {theme === 'dark' ? 'Giao diện sáng' : 'Giao diện tối'}
          </button>
        </div>
        <small className="photo-credit">
          Ảnh: ben klocek, Wikimedia Commons, CC BY 2.0
        </small>
      </section>
      <section className="lock-pad" aria-labelledby="lock-title">
        <h1 id="lock-title">Nhập PIN để vào quầy</h1>
        <PinPad label="PIN nhân viên" onSubmit={submit} busy={busy} submitLabel="Vào quầy" />
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
      </section>

      <Dialog
        open={setup}
        title="Cài đặt máy quầy"
        onClose={() => setSetup(false)}
        footer={
          <>
            <span className="spacer" />
            <button className="btn" onClick={() => setSetup(false)}>
              Hủy
            </button>
            <button className="btn primary" type="submit" form="device-form">
              Lưu
            </button>
          </>
        }
      >
        <form id="device-form" onSubmit={saveKey}>
          <Field label="Khóa thiết bị" hint="Do chủ quán cấp (biến COUNTER_DEVICE_KEYS của máy chủ). Để trống nếu máy chủ không yêu cầu.">
            <input className="input" value={key} onChange={(e) => setKey(e.target.value)} autoComplete="off" />
          </Field>
        </form>
      </Dialog>
    </main>
  );
}

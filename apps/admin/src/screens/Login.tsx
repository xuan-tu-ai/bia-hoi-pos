// FR-13 — chủ quán / quản lý ca đăng nhập web bằng email + mật khẩu. Nhân viên quầy bị chặn ở backend.

import { useState, type FormEvent } from 'react';
import { Mark } from '../components/Icon';
import { SHOP_NAME } from '../components/Shell';
import { Field } from '../components/ui';
import { ApiError } from '../lib/api';
import { useAuth } from '../lib/auth';

export function Login() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await login(email, password);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Không đăng nhập được');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="login">
      <figure className="login-photo">
        <img src="/img/dang-nhap.jpg" alt="Ba cốc bia hơi đặt trên chiếc ghế nhựa đỏ ở một quán vỉa hè Hà Nội" />
        <figcaption>
          <strong>{SHOP_NAME}</strong>
          <span>Bia hơi tươi mỗi ngày · Hà Nội</span>
        </figcaption>
        <small className="photo-credit">
          Ảnh: thalling55, <a href="https://commons.wikimedia.org/wiki/File:Bia_Hoi_(fresh_beer)_in_Hanoi_(1345342880).jpg">Wikimedia Commons</a>, CC BY 2.0
        </small>
      </figure>
      <form className="login-card" onSubmit={submit}>
        <div className="brand">
          <Mark size={36} />
          <span className="brand-text">
            <strong>Bia Hơi Quầy</strong>
            <span>{SHOP_NAME}</span>
          </span>
        </div>
        <h1>Đăng nhập quản trị</h1>
        <p className="sub">Dành cho chủ quán và quản lý ca. Nhân viên quầy đăng nhập bằng PIN trên máy quầy.</p>
        <Field label="Email">
          <input className="input" type="email" required autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        <Field label="Mật khẩu">
          <input className="input" type="password" required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </Field>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <button className="btn primary block" type="submit" disabled={busy}>
          {busy ? 'Đang đăng nhập…' : 'Đăng nhập'}
        </button>
      </form>
    </main>
  );
}

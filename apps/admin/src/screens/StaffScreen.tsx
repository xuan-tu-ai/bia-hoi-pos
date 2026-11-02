// FR-13 — nhân viên, vai trò, PIN. Nhân viên quầy không có tài khoản web; không xóa, chỉ ngừng hoạt động.

import { useState, type FormEvent } from 'react';
import { ROLES, ROLE_LABELS, type Role } from '@biahoi/shared';
import { Icon } from '../components/Icon';
import { Dialog, Empty, ErrorBlock, Field, SkeletonRows, TitleRow } from '../components/ui';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { useAction, useApi, useNarrow } from '../lib/hooks';
import type { Staff } from '../lib/types';

interface StaffForm {
  name: string;
  role: Role;
  pin: string;
  email: string;
  password: string;
  active: boolean;
}

const ROLE_RIGHTS: Record<Role, string> = {
  COUNTER: 'Đăng nhập App quầy bằng PIN: mở bàn, gọi món, in phiếu, in tạm tính, thanh toán, thay keg. Hủy hoặc giảm món phải có PIN quản lý.',
  SHIFT_MANAGER: 'Mọi việc của nhân viên quầy, cộng: nhập PIN để duyệt hủy/giảm món và giảm giá hóa đơn, đóng ca. Vào web để xem báo cáo.',
  OWNER: 'Toàn quyền: thực đơn, bàn, nhân viên, kho keg, giờ vàng và mọi báo cáo. Duyệt được như quản lý ca.',
};

const blank: StaffForm = { name: '', role: 'COUNTER', pin: '', email: '', password: '', active: true };

export function StaffScreen() {
  const { user } = useAuth();
  const staff = useApi<Staff[]>('/staff');
  const narrow = useNarrow();
  const [editing, setEditing] = useState<Staff | 'new' | null>(null);
  const [form, setForm] = useState<StaffForm>(blank);
  const save = useAction();
  const set = (patch: Partial<StaffForm>) => setForm((f) => ({ ...f, ...patch }));
  const activeCount = staff.data?.filter((s) => s.active).length ?? 0;
  const isNew = editing === 'new';
  const current = editing && editing !== 'new' ? editing : null;
  const isSelf = current?.id === user?.id;

  function open(s: Staff | 'new') {
    save.clearError();
    setEditing(s);
    setForm(s === 'new' ? blank : { name: s.name, role: s.role, pin: '', email: s.email ?? '', password: '', active: s.active });
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    const web = form.role !== 'COUNTER';
    const body: Record<string, unknown> = { name: form.name, role: form.role, active: form.active };
    if (form.pin) body.pin = form.pin;
    if (web) body.email = form.email.trim() || null;
    if (web && form.password) body.password = form.password;
    const ok = await save.run(() => (current ? api(`/staff/${current.id}`, { method: 'PATCH', body }) : api('/staff', { method: 'POST', body })));
    if (ok) {
      setEditing(null);
      staff.reload();
    }
  }

  return (
    <>
      <TitleRow
        title="Nhân viên"
        sub={staff.data ? `${activeCount} đang làm, ${staff.data.length - activeCount} đã nghỉ` : 'Đang tải…'}
        actions={
          <button className="btn primary" onClick={() => open('new')}>
            <Icon name="plus" /> Thêm nhân viên
          </button>
        }
      />
      <section className="panel flush">
        {staff.error && !staff.data ? (
          <ErrorBlock error={staff.error} onRetry={staff.reload} />
        ) : !staff.data ? (
          <SkeletonRows rows={5} />
        ) : staff.data.length === 0 ? (
          <Empty>Chưa có nhân viên.</Empty>
        ) : narrow ? (
          <ul className="rows">
            {staff.data.map((s) => (
              <li className={s.active ? 'row two-line' : 'row two-line dim'} key={s.id}>
                <button className="grow row-button" onClick={() => open(s)}>
                  <span>{s.name}</span>
                  <span className="sub">
                    {ROLE_LABELS[s.role]}
                    {s.email ? ` · ${s.email}` : ''}
                  </span>
                </button>
                {!s.active && <span className="pill">Đã nghỉ</span>}
              </li>
            ))}
          </ul>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Họ tên</th>
                  <th>Vai trò</th>
                  <th>Đăng nhập web</th>
                  <th>Trạng thái</th>
                  <th aria-label="Thao tác" />
                </tr>
              </thead>
              <tbody>
                {staff.data.map((s) => (
                  <tr key={s.id} className={s.active ? undefined : 'dim'}>
                    <td>
                      {s.name}
                      {s.id === user?.id && <span className="sub">Bạn</span>}
                    </td>
                    <td>{ROLE_LABELS[s.role]}</td>
                    <td>{s.email ?? <span className="muted">Chỉ đăng nhập PIN ở quầy</span>}</td>
                    <td>{s.active ? 'Đang làm' : <span className="pill">Đã nghỉ</span>}</td>
                    <td className="n">
                      <button className="btn ghost icon" onClick={() => open(s)} aria-label={`Sửa ${s.name}`}>
                        <Icon name="edit" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="panel roles">
        <header>
          <h2>Vai trò và quyền</h2>
        </header>
        <dl className="role-grid">
          {ROLES.map((r) => {
            const people = staff.data?.filter((s) => s.role === r && s.active) ?? [];
            return (
              <div key={r}>
                <dt>
                  {ROLE_LABELS[r]} <span className="muted num">· {people.length} người</span>
                </dt>
                <dd>{ROLE_RIGHTS[r]}</dd>
                <dd className="role-people">{people.length ? people.map((p) => p.name).join(', ') : 'Chưa có ai'}</dd>
              </div>
            );
          })}
        </dl>
      </section>

      <Dialog
        open={editing !== null}
        title={isNew ? 'Thêm nhân viên' : 'Sửa nhân viên'}
        onClose={() => setEditing(null)}
        footer={
          <>
            <span className="spacer" />
            <button className="btn" onClick={() => setEditing(null)}>
              Hủy
            </button>
            <button className="btn primary" type="submit" form="staff-form" disabled={save.busy}>
              Lưu
            </button>
          </>
        }
      >
        <form id="staff-form" className="form-grid" onSubmit={submit}>
          <Field label="Họ tên">
            <input className="input" required value={form.name} onChange={(e) => set({ name: e.target.value })} />
          </Field>
          <div className="form-row">
            <Field label="Vai trò">
              <select className="input" value={form.role} onChange={(e) => set({ role: e.target.value as Role })} disabled={isSelf}>
                {ROLES.map((r) => (
                  <option key={r} value={r}>
                    {ROLE_LABELS[r]}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="PIN" hint={isNew ? '4–6 chữ số, không trùng người khác' : 'Để trống nếu không đổi'}>
              <input
                className="input num"
                inputMode="numeric"
                pattern="\d{4,6}"
                required={isNew}
                autoComplete="off"
                value={form.pin}
                onChange={(e) => set({ pin: e.target.value.replace(/\D/g, '').slice(0, 6) })}
              />
            </Field>
          </div>
          {form.role !== 'COUNTER' && (
            <div className="form-row">
              <Field label="Email đăng nhập web">
                <input className="input" type="email" value={form.email} onChange={(e) => set({ email: e.target.value })} />
              </Field>
              <Field label="Mật khẩu web" hint={isNew ? 'Tối thiểu 8 ký tự' : 'Để trống nếu không đổi'}>
                <input className="input" type="password" minLength={8} autoComplete="new-password" value={form.password} onChange={(e) => set({ password: e.target.value })} />
              </Field>
            </div>
          )}
          {current && (
            <label className="switch-label">
              <input type="checkbox" className="switch" checked={form.active} disabled={isSelf} onChange={(e) => set({ active: e.target.checked })} />
              <span>{form.active ? 'Đang làm việc' : 'Đã nghỉ — không đăng nhập được'}</span>
            </label>
          )}
          {save.error && <p className="form-error">{save.error}</p>}
        </form>
      </Dialog>
    </>
  );
}

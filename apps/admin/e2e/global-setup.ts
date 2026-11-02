// Trước khi chạy: (1) seed lại dữ liệu demo, (2) đăng nhập sẵn chủ quán và quản lý ca.
// Đặt E2E_SKIP_SEED=1 để bỏ bước seed; E2E_SEED_CMD để đổi lệnh seed.

import { execSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import type { FullConfig } from '@playwright/test';

const ROOT = path.resolve(import.meta.dirname, '../../..');
export const AUTH_DIR = path.resolve(import.meta.dirname, '.auth');

export default async function globalSetup(config: FullConfig) {
  const baseURL = config.projects[0]!.use.baseURL!;

  if (!process.env.E2E_SKIP_SEED) {
    const cmd = process.env.E2E_SEED_CMD ?? 'docker compose exec -T api npx prisma db seed';
    execSync(cmd, { cwd: ROOT, stdio: 'ignore' });
  }

  mkdirSync(AUTH_DIR, { recursive: true });
  const accounts = { owner: ['chuquan@biahoi.vn', 'chuquan123'], manager: ['quanly@biahoi.vn', 'quanly123'] } as const;
  for (const [name, [email, password]] of Object.entries(accounts)) {
    const res = await fetch(`${baseURL}/api/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) throw new Error(`Không đăng nhập được ${email} (${res.status}). Backend và web đã chạy chưa?`);
    const { token } = (await res.json()) as { token: string };
    const origin = new URL(baseURL).origin;
    writeFileSync(
      path.join(AUTH_DIR, `${name}.json`),
      JSON.stringify({ cookies: [], origins: [{ origin, localStorage: [{ name: 'biahoi.admin.token', value: token }] }] }),
    );
  }
}

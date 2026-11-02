// Seed lại dữ liệu demo trước khi chạy. E2E_SKIP_SEED=1 để bỏ; E2E_SEED_CMD để đổi lệnh.
import { execSync } from 'node:child_process';
import path from 'node:path';

export default async function globalSetup() {
  if (process.env.E2E_SKIP_SEED) return;
  const cmd = process.env.E2E_SEED_CMD ?? 'docker compose exec -T api npx prisma db seed';
  execSync(cmd, { cwd: path.resolve(import.meta.dirname, '../../..'), stdio: 'ignore' });
}

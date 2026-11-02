// Dựng một PostgreSQL nhúng tạm cho test tích hợp, chạy migration, xóa khi xong.

import { execSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import EmbeddedPostgres from 'embedded-postgres';

export default async function setup() {
  const databaseDir = mkdtempSync(path.join(tmpdir(), 'biahoi-test-'));
  const port = 54329;
  const pg = new EmbeddedPostgres({
    databaseDir,
    port,
    user: 'test',
    password: 'test',
    persistent: false,
    initdbFlags: ['--encoding=UTF8', '--no-locale'],
    onLog: () => {},
  });
  await pg.initialise();
  await pg.start();
  await pg.createDatabase('biahoi_test');

  process.env.DATABASE_URL = `postgresql://test:test@localhost:${port}/biahoi_test`;
  process.env.COUNTER_DEVICE_KEYS = '';
  process.env.UPLOAD_DIR = path.join(databaseDir, 'uploads'); // ảnh món của test nằm trong thư mục tạm, xóa cùng CSDL
  process.env.BANK_BIN = '970436';
  process.env.BANK_ACCOUNT_NO = '0011001234567';
  execSync('npx prisma migrate deploy', { cwd: path.resolve(import.meta.dirname, '..'), stdio: 'ignore', env: process.env });

  return async () => {
    await pg.stop();
    rmSync(databaseDir, { recursive: true, force: true });
  };
}

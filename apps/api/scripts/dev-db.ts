// PostgreSQL chạy ngay trong thư mục dự án, không cần cài đặt hay Docker.
// Chạy: pnpm --filter @biahoi/api db:start   (giữ cửa sổ mở; Ctrl+C để dừng)
// Kết nối: postgresql://biahoi:biahoi@localhost:5432/biahoi

import { existsSync } from 'node:fs';
import path from 'node:path';
import EmbeddedPostgres from 'embedded-postgres';

const port = Number(process.env.DEV_DB_PORT ?? 5432);
const databaseDir = path.resolve(import.meta.dirname, '../.pgdata');

const pg = new EmbeddedPostgres({
  databaseDir,
  port,
  user: 'biahoi',
  password: 'biahoi',
  persistent: true,
  // Windows mặc định WIN1252 → không lưu được tiếng Việt
  initdbFlags: ['--encoding=UTF8', '--no-locale'],
  onLog: () => {},
});

if (!existsSync(path.join(databaseDir, 'PG_VERSION'))) {
  console.log('Khởi tạo CSDL lần đầu tại', databaseDir);
  await pg.initialise();
}
await pg.start();
try {
  await pg.createDatabase('biahoi');
} catch {
  // đã tồn tại
}
console.log(`PostgreSQL đang chạy: postgresql://biahoi:biahoi@localhost:${port}/biahoi`);

process.on('SIGINT', async () => {
  await pg.stop();
  process.exit(0);
});

import { execSync } from 'node:child_process';
import 'dotenv/config';

/**
 * Chuẩn bị CSDL kiểm thử: áp migration rồi chạy seed (seed tự xóa dữ liệu cũ và tạo lại).
 * TEST_DATABASE_URL phải là CSDL riêng cho test, KHÔNG dùng CSDL thật.
 */
export default function setup() {
  const url = process.env.TEST_DATABASE_URL;
  if (!url) throw new Error('Thiếu TEST_DATABASE_URL trong backend/.env');
  if (url === process.env.DATABASE_URL) throw new Error('TEST_DATABASE_URL phải khác DATABASE_URL');
  const env = { ...process.env, DATABASE_URL: url };
  execSync('npx prisma migrate deploy', { stdio: 'inherit', env });
  execSync('npx prisma db seed', { stdio: 'inherit', env });
}

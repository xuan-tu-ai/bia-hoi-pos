// Chạy trước mỗi file test: trỏ Prisma vào CSDL kiểm thử (TEST_DATABASE_URL trong .env).
import 'dotenv/config';

if (!process.env.TEST_DATABASE_URL) {
  throw new Error('Thiếu TEST_DATABASE_URL trong backend/.env (CSDL riêng cho test, sẽ bị xóa sạch mỗi lần chạy)');
}
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
process.env.NODE_ENV = 'test';

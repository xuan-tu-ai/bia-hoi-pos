import 'dotenv/config';
import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.string().min(1, 'Thiếu DATABASE_URL'),
  JWT_SECRET: z.string().min(16, 'JWT_SECRET phải dài ít nhất 16 ký tự'),
  JWT_EXPIRES_IN: z.string().default('12h'),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),
  VIETQR_BANK: z.string().default('MB'),
  VIETQR_ACCOUNT: z.string().default('0123456789'),
  VIETQR_ACCOUNT_NAME: z.string().default('QUAN BIA HOI DEMO'),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  console.error('Biến môi trường không hợp lệ:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

// Bản triển khai thật không được chạy với giá trị mẫu trong .env.example.
if (parsed.data.NODE_ENV === 'production') {
  const problems: string[] = [];
  if (parsed.data.JWT_SECRET === 'thay-bang-chuoi-ngau-nhien-dai') problems.push('JWT_SECRET vẫn là giá trị mẫu');
  if (/localhost|127\.0\.0\.1/.test(parsed.data.DATABASE_URL)) problems.push('DATABASE_URL đang trỏ vào máy cục bộ');
  if (problems.length > 0) {
    console.error('Cấu hình production không hợp lệ:', problems.join('; '));
    process.exit(1);
  }
}

export const env = {
  ...parsed.data,
  corsOrigins: parsed.data.CORS_ORIGIN.split(',').map((s) => s.trim()).filter(Boolean),
};

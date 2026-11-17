import bcrypt from 'bcryptjs';
import type { z } from 'zod';
import { prisma } from '../../lib/prisma.js';
import { AppError } from '../../lib/errors.js';
import { signToken } from '../../middlewares/auth.js';
import type { loginSchema } from './auth.schema.js';

// Băm sẵn để so sánh khi email không tồn tại → thời gian phản hồi như nhau, không lộ email nào có thật.
const DUMMY_HASH = bcrypt.hashSync('dummy-password', 10);

export async function login(input: z.infer<typeof loginSchema>) {
  const staff = await prisma.staff.findUnique({ where: { email: input.email } });
  const ok = await bcrypt.compare(input.password, staff?.passwordHash ?? DUMMY_HASH);
  if (!staff || !ok) throw new AppError(401, 'INVALID_CREDENTIALS', 'Email hoặc mật khẩu không đúng');
  if (!staff.active) throw new AppError(403, 'ACCOUNT_LOCKED', 'Tài khoản đã bị khóa');

  return {
    token: signToken(staff),
    user: { id: staff.id, fullName: staff.fullName, email: staff.email, role: staff.role },
  };
}

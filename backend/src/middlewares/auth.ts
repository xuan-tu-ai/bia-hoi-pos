import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import type { Role } from '@prisma/client';
import { env } from '../config/env.js';
import { prisma } from '../lib/prisma.js';
import { unauthorized } from '../lib/errors.js';

export type AuthUser = { id: number; fullName: string; email: string; role: Role };

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

type TokenPayload = { sub: string; role: Role };

export function signToken(user: { id: number; role: Role }): string {
  return jwt.sign({ role: user.role }, env.JWT_SECRET, {
    subject: String(user.id),
    expiresIn: env.JWT_EXPIRES_IN as jwt.SignOptions['expiresIn'],
  });
}

/**
 * Kiểm tra JWT trong header `Authorization: Bearer <token>` và gắn `req.user`.
 * Đọc lại nhân viên từ CSDL mỗi lần để tài khoản bị khóa / đổi vai trò có hiệu lực ngay.
 */
export async function authenticate(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization ?? '';
  const [scheme, token] = header.split(' ');
  if (scheme !== 'Bearer' || !token) throw unauthorized('Bạn chưa đăng nhập');

  let payload: TokenPayload;
  try {
    payload = jwt.verify(token, env.JWT_SECRET) as unknown as TokenPayload;
  } catch {
    throw unauthorized('Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại');
  }

  const staff = await prisma.staff.findUnique({
    where: { id: Number(payload.sub) },
    select: { id: true, fullName: true, email: true, role: true, active: true },
  });
  if (!staff || !staff.active) throw unauthorized('Tài khoản không còn hoạt động');

  req.user = { id: staff.id, fullName: staff.fullName, email: staff.email, role: staff.role };
  next();
}

/** Lấy người dùng đã xác thực (chỉ gọi sau `authenticate`). */
export function currentUser(req: Request): AuthUser {
  if (!req.user) throw unauthorized();
  return req.user;
}

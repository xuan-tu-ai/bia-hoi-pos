import type { NextFunction, Request, Response } from 'express';
import type { Role } from '@prisma/client';
import { forbidden, unauthorized } from '../lib/errors.js';

/** Chỉ cho phép các vai trò được liệt kê (ma trận phân quyền SRS 2.2). */
export function requireRole(...roles: Role[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) throw unauthorized();
    if (!roles.includes(req.user.role)) throw forbidden();
    next();
  };
}

/** Viết tắt theo cột "Quyền" của SRS 7.2. */
export const ALL: Role[] = ['COUNTER', 'SHIFT_MANAGER', 'OWNER'];
export const MANAGERS: Role[] = ['SHIFT_MANAGER', 'OWNER'];
export const OWNER: Role[] = ['OWNER'];

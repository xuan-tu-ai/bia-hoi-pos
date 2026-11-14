import type { NextFunction, Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import { ZodError } from 'zod';
import { AppError } from '../lib/errors.js';

type ErrorBody = { error: { code: string; message: string; details?: unknown } };

function send(res: Response, status: number, body: ErrorBody) {
  res.status(status).json(body);
}

/** 404 cho đường dẫn API không tồn tại. */
export function notFoundHandler(_req: Request, res: Response) {
  send(res, 404, { error: { code: 'NOT_FOUND', message: 'Không tìm thấy API' } });
}

/** Trả mọi lỗi theo định dạng chung (SRS 7.1). */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof AppError) {
    return send(res, err.status, {
      error: { code: err.code, message: err.message, ...(err.details !== undefined ? { details: err.details } : {}) },
    });
  }

  if (err instanceof ZodError) {
    const first = err.issues[0];
    return send(res, 400, {
      error: {
        code: 'VALIDATION_ERROR',
        message: first ? `Dữ liệu không hợp lệ: ${first.message}` : 'Dữ liệu không hợp lệ',
        details: err.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
      },
    });
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2025') return send(res, 404, { error: { code: 'NOT_FOUND', message: 'Không tìm thấy dữ liệu' } });
    if (err.code === 'P2002') return send(res, 409, { error: { code: 'DUPLICATE', message: 'Dữ liệu bị trùng' } });
    if (err.code === 'P2003')
      return send(res, 409, { error: { code: 'IN_USE', message: 'Dữ liệu đang được sử dụng, không thể xóa' } });
  }

  // body JSON hỏng (express.json)
  if (typeof err === 'object' && err !== null && (err as { type?: string }).type === 'entity.parse.failed') {
    return send(res, 400, { error: { code: 'VALIDATION_ERROR', message: 'Dữ liệu gửi lên không phải JSON hợp lệ' } });
  }

  console.error(err);
  send(res, 500, { error: { code: 'INTERNAL_ERROR', message: 'Lỗi máy chủ, vui lòng thử lại' } });
}

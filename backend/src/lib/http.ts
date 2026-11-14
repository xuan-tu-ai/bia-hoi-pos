import type { Request } from 'express';
import { z } from 'zod';

const idSchema = z.coerce.number().int().positive();

/** Đọc tham số `:id` (hoặc tên khác) trên đường dẫn thành số nguyên dương. */
export function idParam(req: Request, name = 'id'): number {
  return idSchema.parse(req.params[name]);
}

/** Chuỗi ngày "YYYY-MM-DD". */
export const ymd = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Ngày phải có dạng YYYY-MM-DD');

/** Tiền: số nguyên VND không âm. */
export const money = z.number().int('Tiền phải là số nguyên').min(0, 'Tiền không được âm');

/** PIN duyệt 4–6 chữ số. */
export const pin = z.string().regex(/^\d{4,6}$/, 'PIN gồm 4–6 chữ số');

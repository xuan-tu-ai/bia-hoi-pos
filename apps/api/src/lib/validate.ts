import { z } from 'zod';
import { ADJUST_REASONS, DAY_MS, parseVnDate, vnStartOfDay } from '@biahoi/shared';
import { badRequest } from './errors';

export const idParam = z.object({ id: z.coerce.number().int().positive() });

export const vnd = z.number().int().safe();
export const positiveVnd = vnd.positive();

export const adjustReasonInput = z
  .object({
    reason: z.enum(ADJUST_REASONS),
    note: z.string().trim().max(200).optional(),
  })
  .refine((v) => v.reason !== 'KHAC' || !!v.note, { message: 'Lý do "Khác" cần ghi chú', path: ['note'] });

/** Giảm theo % hoặc theo số tiền, đúng một trong hai. */
export const discountValue = z
  .object({
    percent: z.number().int().min(1).max(100).optional(),
    amount: positiveVnd.optional(),
  })
  .refine((v) => (v.percent === undefined) !== (v.amount === undefined), {
    message: 'Nhập phần trăm hoặc số tiền giảm (chỉ một)',
  });

const vnDateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Định dạng ngày YYYY-MM-DD');

export const dateRangeQuery = z.object({ from: vnDateString.optional(), to: vnDateString.optional() });

/**
 * Khoảng ngày theo giờ Việt Nam, `to` tính cả ngày cuối. Mặc định là hôm nay.
 * Trả về [start, end) để dùng trong truy vấn.
 */
export function resolveDateRange(q: { from?: string; to?: string }, maxDays = 31, now = new Date()) {
  const parse = (s: string) => {
    try {
      return parseVnDate(s);
    } catch (err) {
      throw badRequest('INVALID_DATE', (err as Error).message);
    }
  };
  const today = vnStartOfDay(now);
  const start = q.from ? parse(q.from) : today;
  const last = q.to ? parse(q.to) : start;
  const end = new Date(last.getTime() + DAY_MS);
  const days = Math.round((end.getTime() - start.getTime()) / DAY_MS);
  if (days < 1) throw badRequest('INVALID_RANGE', 'Ngày bắt đầu phải trước ngày kết thúc');
  if (days > maxDays) throw badRequest('RANGE_TOO_LONG', `Khoảng ngày tối đa ${maxDays} ngày`);
  return { start, end, days };
}

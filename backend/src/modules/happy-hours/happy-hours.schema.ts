import { z } from 'zod';
import { money } from '../../lib/http.js';

const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Giờ phải có dạng HH:mm');

const base = z.object({
  name: z.string().trim().min(1, 'Chưa nhập tên khung giờ').max(100),
  weekdays: z
    .array(z.number().int().min(1).max(7))
    .min(1, 'Chọn ít nhất một thứ trong tuần')
    .transform((d) => [...new Set(d)].sort()),
  startTime: hhmm,
  endTime: hhmm,
  enabled: z.boolean().optional(),
  prices: z
    .array(z.object({ menuItemId: z.number().int().positive(), price: money }))
    .refine((ps) => new Set(ps.map((p) => p.menuItemId)).size === ps.length, 'Một món chỉ được khai báo một lần'),
});

const timeOrder = (v: { startTime?: string; endTime?: string }) => !v.startTime || !v.endTime || v.startTime !== v.endTime;
const timeMsg = { message: 'Giờ bắt đầu và kết thúc không được trùng nhau', path: ['endTime'] };

export const createHappyHourSchema = base.refine(timeOrder, timeMsg);
export const updateHappyHourSchema = base.partial().refine(timeOrder, timeMsg);

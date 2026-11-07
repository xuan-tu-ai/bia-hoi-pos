import { z } from 'zod';
import { money, ymd } from '../../lib/http.js';

export const listKegsQuery = z.object({
  status: z.enum(['IN_STOCK', 'TAPPED', 'EMPTY']).optional(),
});

export const receiveKegsSchema = z.object({
  beerName: z.string().trim().min(1, 'Chưa nhập loại bia').max(100),
  capacityMl: z.union([z.literal(30000), z.literal(50000)], { errorMap: () => ({ message: 'Dung tích là 30 L hoặc 50 L' }) }),
  cost: money,
  receivedAt: ymd,
  quantity: z.number().int().min(1, 'Số lượng ít nhất là 1').max(50, 'Nhập tối đa 50 keg một lần'),
});

export const changeKegSchema = z.object({
  kegId: z.number().int().positive(),
});

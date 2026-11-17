import { z } from 'zod';
import { money } from '../../lib/http.js';

export const groupSchema = z.object({
  name: z.string().trim().min(1, 'Chưa nhập tên nhóm').max(50),
  sortOrder: z.number().int().optional(),
});
export const updateGroupSchema = groupSchema.partial();

export const stationSchema = z.object({
  name: z.string().trim().min(1, 'Chưa nhập tên khu chế biến').max(50),
  sortOrder: z.number().int().optional(),
});
export const updateStationSchema = stationSchema.partial();

const itemBase = z.object({
  name: z.string().trim().min(1, 'Chưa nhập tên món').max(100),
  shortcut: z
    .string()
    .trim()
    .toLowerCase()
    .min(1, 'Chưa nhập mã tắt')
    .max(20)
    .regex(/^[a-z0-9]+$/, 'Mã tắt chỉ gồm chữ không dấu và số'),
  groupId: z.number().int().positive(),
  price: money,
  unit: z.string().trim().min(1, 'Chưa nhập đơn vị').max(20),
  stationId: z.number().int().positive(),
  /** Thể tích (ml) — chỉ món bia hơi; null = không phải bia hơi. */
  beerVolumeMl: z.number().int().positive().nullable().optional(),
  defaultTapId: z.number().int().positive().nullable().optional(),
  available: z.boolean().optional(),
  active: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
});

const beerRule = (v: { beerVolumeMl?: number | null; defaultTapId?: number | null }) =>
  !v.beerVolumeMl || !!v.defaultTapId;
const beerRuleMsg = { message: 'Món bia hơi phải chọn vòi mặc định', path: ['defaultTapId'] };

export const createItemSchema = itemBase.refine(beerRule, beerRuleMsg);
export const updateItemSchema = itemBase.partial();

export const listItemsQuery = z.object({
  groupId: z.coerce.number().int().positive().optional(),
  q: z.string().trim().optional(),
  includeInactive: z.enum(['true', 'false']).optional(),
});

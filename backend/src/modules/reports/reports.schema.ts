import { z } from 'zod';
import { ymd } from '../../lib/http.js';

const range = { from: ymd.optional(), to: ymd.optional() };

export const kegLossQuery = z.object({
  ...range,
  threshold: z.coerce.number().min(0).max(100).default(5),
});

export const voidsQuery = z.object({
  ...range,
  staffId: z.coerce.number().int().positive().optional(),
  approverId: z.coerce.number().int().positive().optional(),
  reason: z.enum(['CUSTOMER_CHANGED_MIND', 'OUT_OF_STOCK', 'WRONG_ENTRY', 'DEFECTIVE', 'OTHER']).optional(),
  type: z.enum(['VOID', 'DISCOUNT', 'BILL_DISCOUNT']).optional(),
});

export const topItemsQuery = z.object({
  ...range,
  by: z.enum(['qty', 'revenue']).default('qty'),
  limit: z.coerce.number().int().min(1).max(50).default(10),
});

export const hourlyQuery = z.object(range);

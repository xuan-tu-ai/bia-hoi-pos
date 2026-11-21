import { z } from 'zod';
import { pin } from '../../lib/http.js';
import { reasonSchema } from '../tabs/tabs.schema.js';

export const vietqrQuery = z.object({
  amount: z.coerce.number().int().positive('Số tiền phải lớn hơn 0').optional(),
});

export const paySchema = z.object({
  billDiscount: z
    .object({
      type: z.enum(['PERCENT', 'AMOUNT']),
      value: z.number().min(0),
      reason: reasonSchema.optional(),
      note: z.string().trim().max(200).nullable().optional(),
    })
    .refine((d) => d.type !== 'PERCENT' || d.value <= 100, { message: 'Giảm tối đa 100%', path: ['value'] })
    .nullable()
    .optional(),
  approverPin: pin.nullable().optional(),
  payments: z
    .array(
      z.object({
        method: z.enum(['CASH', 'TRANSFER']),
        amount: z.number().int('Tiền phải là số nguyên').positive('Số tiền phải lớn hơn 0'),
      }),
    )
    .max(10),
});

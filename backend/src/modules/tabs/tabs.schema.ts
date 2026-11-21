import { z } from 'zod';
import { pin } from '../../lib/http.js';

export const openTabSchema = z.object({
  tableId: z.number().int().positive(),
  guestCount: z.number().int().min(1).max(200).nullable().optional(),
});

export const sendRoundSchema = z.object({
  items: z
    .array(
      z.object({
        menuItemId: z.number().int().positive(),
        qty: z.number().int().min(1, 'Số lượng ít nhất là 1').max(999),
        note: z.string().trim().max(200).nullable().optional(),
      }),
    )
    .min(1, 'Lượt gọi phải có ít nhất 1 món')
    .max(100),
});

export const targetTableSchema = z.object({
  targetTableId: z.number().int().positive(),
});

/** Giá trị `reason` theo SRS 7.3. */
export const REASONS = ['CUSTOMER_CHANGED_MIND', 'OUT_OF_STOCK', 'WRONG_ENTRY', 'DEFECTIVE', 'OTHER'] as const;
export const reasonSchema = z.enum(REASONS, { errorMap: () => ({ message: 'Chưa chọn lý do' }) });

const needNoteForOther = (v: { reason: string; note?: string | null }) => v.reason !== 'OTHER' || !!v.note?.trim();
const needNoteMsg = { message: 'Lý do "Khác" phải có ghi chú', path: ['note'] };

export const voidSchema = z
  .object({
    qty: z.number().int().min(1, 'Số lượng hủy ít nhất là 1'),
    reason: reasonSchema,
    note: z.string().trim().max(200).nullable().optional(),
    approverPin: pin.nullable().optional(),
  })
  .refine(needNoteForOther, needNoteMsg);

export const discountSchema = z
  .object({
    type: z.enum(['PERCENT', 'AMOUNT']),
    value: z.number().positive('Giá trị giảm phải lớn hơn 0'),
    reason: reasonSchema,
    note: z.string().trim().max(200).nullable().optional(),
    approverPin: pin.nullable().optional(),
  })
  .refine((v) => v.type !== 'PERCENT' || v.value <= 100, { message: 'Giảm tối đa 100%', path: ['value'] })
  .refine(needNoteForOther, needNoteMsg);

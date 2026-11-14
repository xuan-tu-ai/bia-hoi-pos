import { z } from 'zod';

export const listAreasQuery = z.object({
  include: z.enum(['tables']).optional(),
});

export const createAreaSchema = z.object({
  name: z.string().trim().min(1, 'Chưa nhập tên khu').max(50),
  sortOrder: z.number().int().optional(),
});

export const updateAreaSchema = createAreaSchema.partial();

export const createTableSchema = z.object({
  areaId: z.number().int().positive(),
  code: z.string().trim().min(1, 'Chưa nhập số bàn').max(10),
  sortOrder: z.number().int().optional(),
});

export const updateTableSchema = createTableSchema.partial().extend({
  active: z.boolean().optional(),
});

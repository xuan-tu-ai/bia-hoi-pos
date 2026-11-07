import { api } from './client';
import type { HappyHour } from '@/types';

export type HappyHourInput = {
  name: string;
  weekdays: number[];
  startTime: string;
  endTime: string;
  enabled?: boolean;
  prices: { menuItemId: number; price: number }[];
};

export const happyHoursApi = {
  list: () => api.get<HappyHour[]>('/happy-hours').then((r) => r.data),
  create: (body: HappyHourInput) => api.post<HappyHour>('/happy-hours', body).then((r) => r.data),
  update: (id: number, body: Partial<HappyHourInput>) => api.patch<HappyHour>(`/happy-hours/${id}`, body).then((r) => r.data),
  remove: (id: number) => api.delete(`/happy-hours/${id}`),
};

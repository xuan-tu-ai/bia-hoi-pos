import { api } from './client';
import type { Shift } from '@/types';

export const shiftsApi = {
  current: () => api.get<Shift | null>('/shifts/current').then((r) => r.data),
  list: () => api.get<Shift[]>('/shifts').then((r) => r.data),
  open: (openingCash: number) => api.post<Shift>('/shifts/open', { openingCash }).then((r) => r.data),
  close: (id: number, countedCash: number) => api.post<Shift>(`/shifts/${id}/close`, { countedCash }).then((r) => r.data),
};

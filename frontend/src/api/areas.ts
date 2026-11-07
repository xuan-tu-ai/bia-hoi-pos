import { api } from './client';
import type { Area, DiningTable } from '@/types';

export const areasApi = {
  list: () => api.get<Area[]>('/areas', { params: { include: 'tables' } }).then((r) => r.data),
  createArea: (body: { name: string; sortOrder?: number }) => api.post<Area>('/areas', body).then((r) => r.data),
  updateArea: (id: number, body: { name?: string; sortOrder?: number }) => api.patch<Area>(`/areas/${id}`, body).then((r) => r.data),
  deleteArea: (id: number) => api.delete(`/areas/${id}`),
  createTable: (body: { areaId: number; code: string; sortOrder?: number }) => api.post<DiningTable>('/tables', body).then((r) => r.data),
  updateTable: (id: number, body: { areaId?: number; code?: string; sortOrder?: number }) =>
    api.patch<DiningTable>(`/tables/${id}`, body).then((r) => r.data),
  deleteTable: (id: number) => api.delete(`/tables/${id}`),
};

import { api } from './client';
import type { KitchenStation, MenuGroup, MenuGroupWithItems, MenuItem } from '@/types';

export type MenuItemInput = {
  name: string;
  shortcut: string;
  groupId: number;
  price: number;
  unit: string;
  stationId: number;
  beerVolumeMl?: number | null;
  defaultTapId?: number | null;
  available?: boolean;
  active?: boolean;
};

export const menuApi = {
  menu: () => api.get<MenuGroupWithItems[]>('/menu').then((r) => r.data),

  groups: () => api.get<MenuGroup[]>('/menu-groups').then((r) => r.data),
  createGroup: (body: { name: string; sortOrder?: number }) => api.post('/menu-groups', body).then((r) => r.data),
  updateGroup: (id: number, body: { name?: string; sortOrder?: number }) => api.patch(`/menu-groups/${id}`, body).then((r) => r.data),

  items: (params: { includeInactive?: boolean } = {}) =>
    api.get<MenuItem[]>('/menu-items', { params: { includeInactive: params.includeInactive ? 'true' : undefined } }).then((r) => r.data),
  createItem: (body: MenuItemInput) => api.post<MenuItem>('/menu-items', body).then((r) => r.data),
  updateItem: (id: number, body: Partial<MenuItemInput>) => api.patch<MenuItem>(`/menu-items/${id}`, body).then((r) => r.data),

  stations: () => api.get<KitchenStation[]>('/kitchen-stations').then((r) => r.data),
  createStation: (body: { name: string; sortOrder?: number }) => api.post('/kitchen-stations', body).then((r) => r.data),
  updateStation: (id: number, body: { name?: string; sortOrder?: number }) => api.patch(`/kitchen-stations/${id}`, body).then((r) => r.data),
};

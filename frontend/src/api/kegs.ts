import { api } from './client';
import type { KegStatus, KegsResponse, TapsResponse } from '@/types';

export const kegsApi = {
  taps: () => api.get<TapsResponse>('/taps').then((r) => r.data),
  changeKeg: (tapId: number, kegId: number) => api.post(`/taps/${tapId}/change-keg`, { kegId }).then((r) => r.data),
  list: (status?: KegStatus) => api.get<KegsResponse>('/kegs', { params: { status } }).then((r) => r.data),
  receive: (body: { beerName: string; capacityMl: number; cost: number; receivedAt: string; quantity: number }) =>
    api.post('/kegs', body).then((r) => r.data),
};

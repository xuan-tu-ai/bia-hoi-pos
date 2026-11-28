import { apiRequest } from './client.ts';
import type { AvailableKeg, ShiftInfo, TapInfo } from '../types/index.ts';

export interface CurrentShiftResponse {
  current: ShiftInfo | null;
  lastClosed: {
    id: number;
    staffName: string;
    openedAt: string;
    closedAt: string;
    openingCash: number;
    countedCash: number;
    cashSales: number;
    transferSales: number;
  } | null;
}

export const counterApi = {
  getCurrentShift: () => apiRequest<CurrentShiftResponse>('/shifts/current'),
  openShift: (openingCash: number) => apiRequest<{ id: number }>('/shifts/open', {
    method: 'POST',
    body: JSON.stringify({ openingCash })
  }),
  closeShift: (shiftId: number, countedCash: number) => apiRequest<{ id: number }>(`/shifts/${shiftId}/close`, {
    method: 'POST',
    body: JSON.stringify({ countedCash })
  }),
  getTaps: () => apiRequest<{ taps: TapInfo[]; availableKegs: AvailableKeg[] }>('/taps'),
  changeTapKeg: (tapId: number, kegId: number) => apiRequest<{ ok: boolean }>(`/taps/${tapId}/change-keg`, {
    method: 'POST',
    body: JSON.stringify({ kegId })
  })
};

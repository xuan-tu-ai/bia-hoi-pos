import { api } from './client';
import type { PaidBill, PaymentMethod, ProvisionalBill, Reason, SendRoundResponse, TabDetail, TabsSummary, VietQr } from '@/types';

export type AdjustBody = { reason: Reason; note?: string | null; approverPin?: string | null };
export type PayBody = {
  billDiscount?: { type: 'PERCENT' | 'AMOUNT'; value: number; reason?: Reason; note?: string | null } | null;
  approverPin?: string | null;
  payments: { method: PaymentMethod; amount: number }[];
};

export const tabsApi = {
  summary: () => api.get<TabsSummary>('/tabs/summary').then((r) => r.data),
  open: (tableId: number, guestCount?: number | null) =>
    api.post<{ id: number }>('/tabs', { tableId, guestCount: guestCount || null }).then((r) => r.data),
  get: (id: number) => api.get<TabDetail>(`/tabs/${id}`).then((r) => r.data),
  sendRound: (id: number, items: { menuItemId: number; qty: number; note?: string | null }[]) =>
    api.post<SendRoundResponse>(`/tabs/${id}/rounds`, { items }).then((r) => r.data),
  move: (id: number, targetTableId: number) =>
    api.post<{ tabId: number; tableCode: string }>(`/tabs/${id}/move`, { targetTableId }).then((r) => r.data),
  merge: (id: number, targetTableId: number) =>
    api.post<{ targetTabId: number; tableCode: string; tabTotal: number }>(`/tabs/${id}/merge`, { targetTableId }).then((r) => r.data),
  voidLine: (lineId: number, body: AdjustBody & { qty: number }) => api.post(`/order-lines/${lineId}/void`, body).then((r) => r.data),
  discountLine: (lineId: number, body: AdjustBody & { type: 'PERCENT' | 'AMOUNT'; value: number }) =>
    api.post(`/order-lines/${lineId}/discount`, body).then((r) => r.data),
  provisional: (id: number) => api.post<ProvisionalBill>(`/tabs/${id}/provisional`).then((r) => r.data),
  vietqr: (id: number, amount: number) => api.get<VietQr>(`/tabs/${id}/vietqr`, { params: { amount } }).then((r) => r.data),
  pay: (id: number, body: PayBody) => api.post<PaidBill>(`/tabs/${id}/pay`, body).then((r) => r.data),
};

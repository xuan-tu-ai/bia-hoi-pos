import { api } from './client';
import type { HourlyReport, KegLossReport, TodayReport, TopItemsReport, VoidsReport } from '@/types';

type Range = { from?: string; to?: string };

export const reportsApi = {
  today: () => api.get<TodayReport>('/reports/today').then((r) => r.data),
  kegLoss: (p: Range & { threshold?: number }) => api.get<KegLossReport>('/reports/keg-loss', { params: p }).then((r) => r.data),
  voids: (p: Range & { staffId?: number; approverId?: number; reason?: string; type?: string }) =>
    api.get<VoidsReport>('/reports/voids', { params: p }).then((r) => r.data),
  topItems: (p: Range & { by: 'qty' | 'revenue' }) => api.get<TopItemsReport>('/reports/top-items', { params: p }).then((r) => r.data),
  hourly: (p: Range) => api.get<HourlyReport>('/reports/hourly', { params: p }).then((r) => r.data),
};

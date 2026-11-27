import { apiRequest } from './client.ts';
import type { ReportKegLoss, ReportSummary, ReportTopItems, ReportVoid } from '../types/index.ts';

export const reportsApi = {
  today: () => apiRequest<ReportSummary>('/reports/today'),
  kegLoss: (query: string) => apiRequest<ReportKegLoss>(`/reports/keg-loss${query}`),
  voids: (query: string) => apiRequest<ReportVoid[]>(`/reports/voids${query}`),
  topItems: (query: string) => apiRequest<ReportTopItems[]>(`/reports/top-items${query}`),
  hourly: (query: string) => apiRequest<Array<{ hour: number; revenue: number }>>(`/reports/hourly${query}`)
};

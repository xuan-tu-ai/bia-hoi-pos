import { useQuery } from '@tanstack/react-query';
import { areasApi } from '@/api/areas';
import { menuApi } from '@/api/menu';
import { tabsApi } from '@/api/tabs';

export const qk = {
  areas: ['areas'] as const,
  summary: ['tabs', 'summary'] as const,
  tab: (id: number) => ['tabs', id] as const,
  menu: ['menu'] as const,
  taps: ['taps'] as const,
  shift: ['shifts', 'current'] as const,
  shifts: ['shifts', 'list'] as const,
};

export const useAreas = () => useQuery({ queryKey: qk.areas, queryFn: areasApi.list, staleTime: 60_000 });

/** FR-02: tự tải lại mỗi 3 giây để thấy thay đổi từ máy khác. */
export const useSummary = () => useQuery({ queryKey: qk.summary, queryFn: tabsApi.summary, refetchInterval: 3_000 });

export const useTab = (id: number) => useQuery({ queryKey: qk.tab(id), queryFn: () => tabsApi.get(id), refetchInterval: 5_000 });

export const useMenu = () => useQuery({ queryKey: qk.menu, queryFn: menuApi.menu, refetchInterval: 30_000 });

import type { TableStatus } from './types';

/**
 * Màu ô bàn (FR-02): xám = trống; xanh = đang ngồi; vàng = đã in tạm tính;
 * đỏ = có lượt gọi in lỗi. Lỗi in được ưu tiên vì cần xử lý ngay.
 */
export function tableStatus(tab: { hasPrintError: boolean; provisionalCount: number } | null): TableStatus {
  if (!tab) return 'EMPTY';
  if (tab.hasPrintError) return 'PRINT_ERROR';
  if (tab.provisionalCount > 0) return 'PROVISIONAL';
  return 'OPEN';
}

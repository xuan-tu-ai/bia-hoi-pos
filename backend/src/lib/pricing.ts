import type { Tx } from './prisma.js';
import { vnHHmm, vnWeekday } from './time.js';

export type HappyHourLike = {
  weekdays: number[];
  startTime: string;
  endTime: string;
  enabled: boolean;
  prices: { menuItemId: number; price: number }[];
};

/** Khung giờ vàng có đang hiệu lực tại thời điểm `at` (giờ VN) không. */
export function isHappyHourActive(h: Pick<HappyHourLike, 'weekdays' | 'startTime' | 'endTime' | 'enabled'>, at: Date) {
  if (!h.enabled || !h.weekdays.includes(vnWeekday(at))) return false;
  const now = vnHHmm(at);
  // Khung qua nửa đêm (vd 22:00–02:00) tính theo thứ của lúc bắt đầu tối hôm đó — đơn giản hóa: so theo giờ.
  if (h.startTime <= h.endTime) return now >= h.startTime && now < h.endTime;
  return now >= h.startTime || now < h.endTime;
}

/** menuItemId → giá giờ vàng đang áp dụng. Nhiều khung cùng lúc thì lấy giá thấp nhất. */
export function happyPriceMap(happyHours: HappyHourLike[], at: Date): Map<number, number> {
  const map = new Map<number, number>();
  for (const h of happyHours) {
    if (!isHappyHourActive(h, at)) continue;
    for (const p of h.prices) {
      const cur = map.get(p.menuItemId);
      if (cur === undefined || p.price < cur) map.set(p.menuItemId, p.price);
    }
  }
  return map;
}

/** Tải các khung giờ vàng đang bật và trả về bảng giá ưu đãi tại thời điểm `at`. */
export async function loadHappyPrices(tx: Tx, at: Date): Promise<Map<number, number>> {
  const hours = await tx.happyHour.findMany({ where: { enabled: true }, include: { prices: true } });
  return happyPriceMap(hours, at);
}

/** Giá bán của một món tại thời điểm gửi: giá giờ vàng nếu có, ngược lại giá thường. */
export function priceOf(item: { id: number; price: number }, happy: Map<number, number>): number {
  return happy.get(item.id) ?? item.price;
}

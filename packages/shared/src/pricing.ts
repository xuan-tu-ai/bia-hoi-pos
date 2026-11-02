// Giá giờ vàng (FR-15): giá được chốt theo thời điểm gửi lượt gọi (FR-04).

import { vnParts } from './time';

export interface HappyHourRule {
  id: number;
  /** 0 = Chủ nhật … 6 = Thứ bảy; là thứ của giờ bắt đầu khung */
  daysOfWeek: readonly number[];
  startMinute: number;
  endMinute: number;
  /** itemId → giá giờ vàng */
  prices: ReadonlyMap<number, number>;
}

/**
 * Khung giờ có hiệu lực tại thời điểm `at` không. Hỗ trợ khung qua nửa đêm
 * (vd 22:00–02:00 thứ Sáu áp dụng cả 00:00–02:00 sáng thứ Bảy).
 */
export function isRuleActive(rule: Pick<HappyHourRule, 'daysOfWeek' | 'startMinute' | 'endMinute'>, at: Date): boolean {
  const { dayOfWeek, minuteOfDay } = vnParts(at);
  const { startMinute: start, endMinute: end, daysOfWeek } = rule;
  if (start === end) return false;
  if (start < end) {
    return daysOfWeek.includes(dayOfWeek) && minuteOfDay >= start && minuteOfDay < end;
  }
  if (minuteOfDay >= start) return daysOfWeek.includes(dayOfWeek);
  if (minuteOfDay < end) return daysOfWeek.includes((dayOfWeek + 6) % 7);
  return false;
}

export interface ResolvedPrice {
  unitPrice: number;
  happyHourId: number | null;
}

/** Giá áp dụng cho một món tại thời điểm `at`. Nếu nhiều khung trùng nhau, lấy giá thấp nhất. */
export function resolveUnitPrice(
  itemId: number,
  basePrice: number,
  rules: readonly HappyHourRule[],
  at: Date,
): ResolvedPrice {
  let best: ResolvedPrice = { unitPrice: basePrice, happyHourId: null };
  for (const rule of rules) {
    const price = rule.prices.get(itemId);
    if (price === undefined || !isRuleActive(rule, at)) continue;
    if (best.happyHourId === null || price < best.unitPrice) best = { unitPrice: price, happyHourId: rule.id };
  }
  return best;
}

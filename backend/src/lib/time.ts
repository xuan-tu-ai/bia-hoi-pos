/**
 * Quán ở Việt Nam (UTC+7, không có giờ mùa hè). Mọi phép "hôm nay", "giờ vàng",
 * "doanh thu theo giờ" đều tính theo giờ Việt Nam, bất kể máy chủ đặt múi giờ nào.
 */
export const VN_OFFSET_MS = 7 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

/** Đổi sang "đồng hồ Việt Nam": các hàm getUTC* của Date trả về giờ VN. */
function vnClock(d: Date): Date {
  return new Date(d.getTime() + VN_OFFSET_MS);
}

/** 0h hôm đó (giờ VN), trả về thời điểm UTC thật. */
export function startOfVnDay(d: Date = new Date()): Date {
  const c = vnClock(d);
  return new Date(Date.UTC(c.getUTCFullYear(), c.getUTCMonth(), c.getUTCDate()) - VN_OFFSET_MS);
}

export function addDays(d: Date, days: number): Date {
  return new Date(d.getTime() + days * DAY_MS);
}

/** Giờ trong ngày (0–23) theo giờ VN. */
export function vnHour(d: Date): number {
  return vnClock(d).getUTCHours();
}

/** "HH:mm" theo giờ VN. */
export function vnHHmm(d: Date): string {
  const c = vnClock(d);
  return `${String(c.getUTCHours()).padStart(2, '0')}:${String(c.getUTCMinutes()).padStart(2, '0')}`;
}

/** Thứ trong tuần theo quy ước SRS: 1 = Thứ 2 ... 7 = Chủ nhật. */
export function vnWeekday(d: Date): number {
  const js = vnClock(d).getUTCDay(); // 0 = CN
  return js === 0 ? 7 : js;
}

/** "YYYYMMDD" theo giờ VN, dùng cho số hóa đơn. */
export function vnYmd(d: Date): string {
  const c = vnClock(d);
  return `${c.getUTCFullYear()}${String(c.getUTCMonth() + 1).padStart(2, '0')}${String(c.getUTCDate()).padStart(2, '0')}`;
}

/** "YYYY-MM-DD" (giờ VN) → [0h ngày đó, 0h ngày hôm sau). */
export function vnDayRange(ymd: string): { start: Date; end: Date } {
  const [y, m, d] = ymd.split('-').map(Number);
  const start = new Date(Date.UTC(y, m - 1, d) - VN_OFFSET_MS);
  return { start, end: addDays(start, 1) };
}

/** Số ngày (tính cả hai đầu) giữa hai chuỗi "YYYY-MM-DD". */
export function daysInclusive(from: string, to: string): number {
  return Math.round((vnDayRange(to).start.getTime() - vnDayRange(from).start.getTime()) / DAY_MS) + 1;
}

/** "YYYY-MM-DD" của một thời điểm theo giờ VN. */
export function vnDateString(d: Date): string {
  const c = vnClock(d);
  return `${c.getUTCFullYear()}-${String(c.getUTCMonth() + 1).padStart(2, '0')}-${String(c.getUTCDate()).padStart(2, '0')}`;
}

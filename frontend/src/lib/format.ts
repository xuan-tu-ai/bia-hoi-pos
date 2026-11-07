/** Định dạng dùng chung (SRS 9.1): tiền là số nguyên VND, hiển thị "15.000 ₫". */

const money = new Intl.NumberFormat('vi-VN');

export function formatMoney(v: number | null | undefined): string {
  return `${money.format(Math.round(v ?? 0))} ₫`;
}

/** Số gọn cho thẻ/biểu đồ: 6,4 tr · 850 k */
export function formatMoneyShort(v: number): string {
  if (Math.abs(v) >= 1_000_000) return `${(v / 1_000_000).toLocaleString('vi-VN', { maximumFractionDigits: 1 })} tr`;
  if (Math.abs(v) >= 1_000) return `${Math.round(v / 1_000)} k`;
  return String(v);
}

export function formatNumber(v: number, digits = 0): string {
  return v.toLocaleString('vi-VN', { maximumFractionDigits: digits, minimumFractionDigits: digits });
}

const tz = 'Asia/Ho_Chi_Minh';

export function formatTime(iso: string | Date): string {
  return new Date(iso).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', timeZone: tz });
}

export function formatDateTime(iso: string | Date): string {
  return new Date(iso).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric', timeZone: tz });
}

export function formatDate(iso: string | Date): string {
  return new Date(iso).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: tz });
}

/** Thời gian đã ngồi: "1g 25p", "12p". */
export function formatDuration(fromIso: string | Date, to: Date = new Date()): string {
  const mins = Math.max(0, Math.floor((to.getTime() - new Date(fromIso).getTime()) / 60000));
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h > 0 ? `${h}g ${m}p` : `${m}p`;
}

export function formatMinutes(mins: number | null): string {
  if (mins == null) return '—';
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h > 0 ? `${h}g ${m}p` : `${m}p`;
}

export function formatLiters(ml: number): string {
  return `${formatNumber(ml / 1000, ml % 1000 === 0 ? 0 : 1)} L`;
}

/** 8 → "8%", 7,5 → "7,5%" */
export function formatPercent(v: number | null | undefined, digits = 1): string {
  if (v == null) return '—';
  return `${v.toLocaleString('vi-VN', { maximumFractionDigits: digits })}%`;
}

/** "YYYY-MM-DD" theo giờ Việt Nam. */
export function toYmd(d: Date): string {
  return d.toLocaleDateString('en-CA', { timeZone: tz });
}

export function daysAgo(n: number): string {
  return toYmd(new Date(Date.now() - n * 86_400_000));
}

export const ROLE_LABEL = {
  COUNTER: 'Nhân viên quầy',
  SHIFT_MANAGER: 'Quản lý ca',
  OWNER: 'Chủ quán',
} as const;

export const REASON_LABEL = {
  CUSTOMER_CHANGED_MIND: 'Khách đổi ý',
  OUT_OF_STOCK: 'Bếp hết món',
  WRONG_ENTRY: 'Nhập nhầm',
  DEFECTIVE: 'Món lỗi',
  OTHER: 'Khác',
} as const;

export const WEEKDAY_LABEL: Record<number, string> = { 1: 'T2', 2: 'T3', 3: 'T4', 4: 'T5', 5: 'T6', 6: 'T7', 7: 'CN' };

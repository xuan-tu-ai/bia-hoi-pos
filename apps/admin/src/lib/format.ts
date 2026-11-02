// Định dạng số liệu theo kiểu Việt Nam: dấu chấm phân cách nghìn, dấu phẩy thập phân.

import { DAY_MS, formatVnDate, formatVnTime, vnParts, vnStartOfDay } from '@biahoi/shared';

const intFmt = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 0 });
const litreFmt = new Intl.NumberFormat('vi-VN', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const pctFmt = new Intl.NumberFormat('vi-VN', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const MINUS = '−';

/** 945000 → "945.000" (đơn vị "đ" đặt riêng, nhỏ và xám). */
export const vnd = (n: number) => (n < 0 ? MINUS : '') + intFmt.format(Math.abs(n));
export const vndText = (n: number) => `${vnd(n)} đ`;
export const int = (n: number) => intFmt.format(n);
/** 46000 ml → "46,0" */
export const litres = (ml: number) => litreFmt.format(ml / 1000);
export const pct = (p: number) => `${pctFmt.format(p)}%`;
export const signed = (n: number, f: (v: number) => string = int) => (n > 0 ? '+' : n < 0 ? MINUS : '') + f(Math.abs(n));

export const time = (iso: string) => formatVnTime(new Date(iso));

const WEEKDAYS = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
export const weekdayLabel = (d: number) => WEEKDAYS[d] ?? '';

/** "Hôm nay", "Hôm qua", hoặc "T6 23/10". */
export function day(iso: string, now = new Date()): string {
  const d = new Date(iso);
  const diff = Math.round((vnStartOfDay(now).getTime() - vnStartOfDay(d).getTime()) / DAY_MS);
  if (diff === 0) return 'Hôm nay';
  if (diff === 1) return 'Hôm qua';
  const p = vnParts(d);
  return `${weekdayLabel(p.dayOfWeek)} ${String(p.day).padStart(2, '0')}/${String(p.month).padStart(2, '0')}`;
}

export const dayTime = (iso: string) => `${day(iso)}, ${time(iso)}`;

/** Như dayTime nhưng đặt giữa câu: "hôm qua, 18:49", "T5 22/10, 17:20". */
export const dayTimeInline = (iso: string) => dayTime(iso).replace(/^Hôm/, 'hôm');

/** 125 phút → "2 giờ 5 phút" */
export function duration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} phút`;
  return m ? `${h} giờ ${m} phút` : `${h} giờ`;
}

/** "Thứ bảy, 24/10/2026" */
export function longDate(d = new Date()): string {
  const p = vnParts(d);
  const names = ['Chủ nhật', 'Thứ hai', 'Thứ ba', 'Thứ tư', 'Thứ năm', 'Thứ sáu', 'Thứ bảy'];
  return `${names[p.dayOfWeek]}, ${String(p.day).padStart(2, '0')}/${String(p.month).padStart(2, '0')}/${p.year}`;
}

/** Ngày VN dạng YYYY-MM-DD, lùi `daysAgo` ngày. */
export const vnDate = (daysAgo = 0) => formatVnDate(new Date(Date.now() - daysAgo * DAY_MS));

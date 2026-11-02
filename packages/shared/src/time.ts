// Giờ Việt Nam (UTC+7, không có giờ mùa hè). Máy chủ có thể chạy ở múi giờ khác,
// nên mọi phép tính "theo ngày", "theo giờ" đều đi qua các hàm này.

export const VN_OFFSET_MS = 7 * 60 * 60 * 1000;
export const DAY_MS = 24 * 60 * 60 * 1000;

export interface VnParts {
  year: number;
  month: number; // 1–12
  day: number;
  /** 0 = Chủ nhật … 6 = Thứ bảy */
  dayOfWeek: number;
  hour: number;
  minute: number;
  minuteOfDay: number;
}

export function vnParts(date: Date): VnParts {
  const t = new Date(date.getTime() + VN_OFFSET_MS);
  const hour = t.getUTCHours();
  const minute = t.getUTCMinutes();
  return {
    year: t.getUTCFullYear(),
    month: t.getUTCMonth() + 1,
    day: t.getUTCDate(),
    dayOfWeek: t.getUTCDay(),
    hour,
    minute,
    minuteOfDay: hour * 60 + minute,
  };
}

/** 00:00 giờ Việt Nam của ngày chứa `date`. */
export function vnStartOfDay(date: Date): Date {
  const local = date.getTime() + VN_OFFSET_MS;
  return new Date(Math.floor(local / DAY_MS) * DAY_MS - VN_OFFSET_MS);
}

/** Đọc chuỗi 'YYYY-MM-DD' thành 00:00 giờ Việt Nam của ngày đó. */
export function parseVnDate(s: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) throw new Error(`Ngày không hợp lệ: ${s}`);
  const utc = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const d = new Date(utc - VN_OFFSET_MS);
  if (vnParts(d).day !== Number(m[3])) throw new Error(`Ngày không hợp lệ: ${s}`);
  return d;
}

export function formatVnDate(date: Date): string {
  const p = vnParts(date);
  return `${p.year}-${pad(p.month)}-${pad(p.day)}`;
}

/** 'HH:mm' theo giờ Việt Nam. */
export function formatVnTime(date: Date): string {
  const p = vnParts(date);
  return `${pad(p.hour)}:${pad(p.minute)}`;
}

/** 'HH:mm' → số phút trong ngày. */
export function parseHhmm(s: string): number {
  const m = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(s);
  if (!m) throw new Error(`Giờ không hợp lệ: ${s}`);
  return Number(m[1]) * 60 + Number(m[2]);
}

export function minuteToHhmm(minute: number): string {
  return `${pad(Math.floor(minute / 60))}:${pad(minute % 60)}`;
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

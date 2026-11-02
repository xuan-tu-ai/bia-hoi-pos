// Khóa tạm sau nhiều lần nhập sai PIN/mật khẩu (FR-01: sai 5 lần liên tiếp khóa 60 giây).
// Lưu trong bộ nhớ là đủ vì chỉ có một tiến trình API.

import { config } from '../config';
import { AppError } from './errors';

const attempts = new Map<string, { fails: number; lockedUntil: number }>();

export function assertNotLocked(key: string, now = Date.now()): void {
  const entry = attempts.get(key);
  if (entry && entry.lockedUntil > now) {
    const seconds = Math.ceil((entry.lockedUntil - now) / 1000);
    throw new AppError(429, 'LOCKED', `Nhập sai quá nhiều lần, thử lại sau ${seconds} giây`, { retryAfter: seconds });
  }
}

/** Ghi nhận một lần sai; trả về số lần còn lại trước khi bị khóa. */
export function recordFailure(key: string, now = Date.now()): number {
  const entry = attempts.get(key) ?? { fails: 0, lockedUntil: 0 };
  if (entry.lockedUntil && entry.lockedUntil <= now) entry.fails = 0;
  entry.fails += 1;
  entry.lockedUntil = 0;
  if (entry.fails >= config.pinMaxFails) {
    entry.lockedUntil = now + config.pinLockMs;
    entry.fails = 0;
  }
  attempts.set(key, entry);
  return entry.lockedUntil ? 0 : config.pinMaxFails - entry.fails;
}

export function recordSuccess(key: string): void {
  attempts.delete(key);
}

export function resetLockouts(): void {
  attempts.clear();
}

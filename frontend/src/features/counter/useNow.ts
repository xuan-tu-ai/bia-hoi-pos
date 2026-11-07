import { useEffect, useState } from 'react';

/** Thời điểm hiện tại, cập nhật định kỳ (để "đã ngồi 1g 25p" tự nhảy). */
export function useNow(intervalMs = 30_000) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

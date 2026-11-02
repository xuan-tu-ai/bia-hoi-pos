// FR-21: nút "Cài ứng dụng" thay cho việc tìm trong menu trình duyệt.
// Chrome/Edge phát beforeinstallprompt khi trang đủ điều kiện cài (HTTPS hoặc localhost, có service worker và manifest).
// Sự kiện có thể đến trước khi React chạy, nên bắt ngay khi tải module này.

import { useEffect, useState } from 'react';

interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

let deferred: InstallPromptEvent | null = null;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((fn) => fn());

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferred = e as InstallPromptEvent;
  notify();
});
window.addEventListener('appinstalled', () => {
  deferred = null;
  notify();
});

/** Trả về hàm mở hộp thoại cài, hoặc null khi trình duyệt chưa cho cài (đã cài rồi, iPhone, hoặc chưa đủ điều kiện). */
export function useInstall(): (() => Promise<void>) | null {
  const [, force] = useState(0);
  useEffect(() => {
    const fn = () => force((n) => n + 1);
    listeners.add(fn);
    return () => void listeners.delete(fn);
  }, []);
  if (!deferred) return null;
  const event = deferred;
  return async () => {
    await event.prompt();
    await event.userChoice;
    deferred = null; // mỗi sự kiện chỉ dùng được một lần
    notify();
  };
}

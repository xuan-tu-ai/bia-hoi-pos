// Giao diện sáng/tối. Lựa chọn lưu trên từng máy; chưa chọn thì theo cài đặt sáng/tối của máy.
// index.html đã đặt <html data-theme> trước khi React chạy (tránh nháy trắng), module này chỉ đổi và theo dõi.

import { useEffect, useState } from 'react';

export type Theme = 'light' | 'dark';
const KEY = 'biahoi-theme-counter';

const current = (): Theme => (document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light');

function apply(theme: Theme) {
  document.documentElement.dataset.theme = theme;
  window.dispatchEvent(new Event('themechange'));
}

export function setTheme(theme: Theme) {
  try {
    localStorage.setItem(KEY, theme);
  } catch {
    // trình duyệt chặn lưu trữ: vẫn đổi được trong phiên này
  }
  apply(theme);
}

function stored(): Theme | null {
  try {
    const v = localStorage.getItem(KEY);
    return v === 'light' || v === 'dark' ? v : null;
  } catch {
    return null;
  }
}

// Máy đổi chế độ sáng/tối (vd tự tối lúc chiều) thì đổi theo, nếu người dùng chưa tự chọn
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
  if (!stored()) apply(e.matches ? 'dark' : 'light');
});

export function useTheme(): Theme {
  const [theme, setState] = useState(current);
  useEffect(() => {
    const fn = () => setState(current());
    window.addEventListener('themechange', fn);
    return () => window.removeEventListener('themechange', fn);
  }, []);
  return theme;
}

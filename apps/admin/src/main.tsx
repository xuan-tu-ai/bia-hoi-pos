import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
// Font đóng gói cùng ứng dụng (không tải từ Google), để quán mất Internet vẫn hiện đúng chữ
import '@fontsource/be-vietnam-pro/400.css';
import '@fontsource/be-vietnam-pro/500.css';
import '@fontsource/be-vietnam-pro/600.css';
import '@fontsource/be-vietnam-pro/700.css';
import { App } from './App';
import './lib/install';
import './styles/app.css';
import './styles/screens.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// FR-21: service worker để cài PWA và hiện trang "Mất kết nối" khi không có mạng; FR-20 nhận thông báo đẩy.
// Đăng ký cả khi phát triển để thử được thông báo; nó chỉ lưu đệm tệp đã build (/assets/).
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // không đăng ký được thì web vẫn chạy bình thường, chỉ không cài được
    });
  });
}

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
// Font đóng gói cùng ứng dụng (không tải từ Google), để quán mất Internet vẫn hiện đúng chữ
import '@fontsource/be-vietnam-pro/400.css';
import '@fontsource/be-vietnam-pro/500.css';
import '@fontsource/be-vietnam-pro/600.css';
import '@fontsource/be-vietnam-pro/700.css';
import { App } from './App';
import './styles/base.css';
import './styles/counter.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

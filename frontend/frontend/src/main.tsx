import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App.tsx';
import './styles/common.css';
import './styles/layout.css';
import './styles/dashboard.css';
import './styles/login.css';

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('Không tìm thấy phần tử #root.');

createRoot(rootElement).render(<StrictMode><App /></StrictMode>);
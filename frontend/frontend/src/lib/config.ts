export const APP_CONFIG = Object.freeze({
  name: 'Quầy Bia',
  currency: 'VND',
  locale: 'vi-VN',
  storagePrefix: 'quanlyquaybia'
});

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';
export const USE_MOCK = import.meta.env.VITE_USE_MOCK !== 'true';
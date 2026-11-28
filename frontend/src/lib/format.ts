import { APP_CONFIG } from './config.ts';

export const formatMoney = (value: number) => new Intl.NumberFormat(APP_CONFIG.locale, {
  style: 'currency', currency: APP_CONFIG.currency, maximumFractionDigits: 0
}).format(value);

export const formatTime = (value: string | Date) => new Intl.DateTimeFormat(APP_CONFIG.locale, {
  hour: '2-digit', minute: '2-digit'
}).format(new Date(value));

export const formatDate = (value: string | Date = new Date()) => new Intl.DateTimeFormat(APP_CONFIG.locale, {
  weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
}).format(new Date(value));

export const initials = (name = '') => name.trim().split(/\s+/).slice(-2).map((part) => part[0] || '').join('').toUpperCase();

export const escapeHtml = (value = '') => String(value).replace(/[&<>"']/g, (character) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[character] ?? character));
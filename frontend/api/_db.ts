import { neon } from '@neondatabase/serverless';

const EXACT_DB_KEYS = [
  'TEST_DATABASE_URL',
  'DATABASE_URL',
  'POSTGRES_URL',
  'POSTGRES_URL_NON_POOLING',
  'NEON_DATABASE_URL',
  'DATABASE_URL_UNPOOLED',
  'TEST DATABASE URL'
];

function sanitizeDbUrl(raw: string): string {
  return raw
    .trim()
    .replace(/^[A-Za-z0-9_\s-]+=\s*/, '')
    .replace(/^["']|["']$/g, '')
    .trim();
}

export function resolveDbUrl(): string | undefined {
  for (const key of EXACT_DB_KEYS) {
    const raw = process.env[key];
    if (raw && raw.trim()) return sanitizeDbUrl(raw);
  }
  for (const [key, raw] of Object.entries(process.env)) {
    const normalized = key.trim().toUpperCase().replace(/[\s-]+/g, '_');
    if ((normalized === 'TEST_DATABASE_URL' || normalized === 'DATABASE_URL' || normalized === 'POSTGRES_URL') && raw?.trim()) {
      return sanitizeDbUrl(raw);
    }
  }
  return undefined;
}

export function getSql() {
  const connectionString = resolveDbUrl();
  if (!connectionString) {
    const envName = process.env.VERCEL_ENV || process.env.NODE_ENV || 'unknown';
    const foundDbKeys = Object.keys(process.env).filter((k) => /db|database|postgres|neon/i.test(k));
    const keysHint = foundDbKeys.length > 0 ? foundDbKeys.join(', ') : 'không có';
    throw new Error(`Thiếu biến môi trường TEST_DATABASE_URL hoặc DATABASE_URL (env=${envName}, các biến DB hiện có: ${keysHint}).`);
  }
  return neon(connectionString);
}

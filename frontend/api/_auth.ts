import { createHmac, timingSafeEqual } from 'node:crypto';
import type { VercelRequest } from '@vercel/node';
import { resolveDbUrl } from './_db.js';

export interface TokenUser {
  id: number;
  fullName: string;
  email: string;
  role: 'COUNTER' | 'SHIFT_MANAGER' | 'OWNER';
}

function getSecret(): string {
  return process.env.AUTH_SECRET || resolveDbUrl() || 'biahoi-dev-secret';
}

function base64UrlEncode(input: string): string {
  return Buffer.from(input, 'utf8').toString('base64url');
}

function base64UrlDecode(input: string): string {
  return Buffer.from(input, 'base64url').toString('utf8');
}

export function signToken(user: TokenUser): string {
  const payload = base64UrlEncode(JSON.stringify({ ...user, exp: Date.now() + 7 * 24 * 60 * 60 * 1000 }));
  const sig = createHmac('sha256', getSecret()).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}

export function verifyToken(req: VercelRequest): TokenUser | null {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) return null;
  const token = auth.slice(7).trim();
  const parts = token.split('.');
  if (parts.length !== 2) return null;

  const [payload, sig] = parts;
  const expected = createHmac('sha256', getSecret()).update(payload).digest('base64url');
  const sigBuf = Buffer.from(sig);
  const expectedBuf = Buffer.from(expected);
  if (sigBuf.length !== expectedBuf.length || !timingSafeEqual(sigBuf, expectedBuf)) {
    return null;
  }

  try {
    const data = JSON.parse(base64UrlDecode(payload)) as TokenUser & { exp?: number };
    if (data.exp && data.exp < Date.now()) return null;
    return { id: data.id, fullName: data.fullName, email: data.email, role: data.role };
  } catch {
    return null;
  }
}

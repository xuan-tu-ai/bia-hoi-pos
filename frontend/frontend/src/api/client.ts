import { API_BASE_URL, USE_MOCK } from '../lib/config.ts';
import { getStoredSession, clearStoredSession } from '../lib/storage.ts';

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
    readonly details?: unknown
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export async function apiRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  if (USE_MOCK) {
    const { mockApiRequest } = await import('../mocks/api.ts');
    return mockApiRequest<T>(path, options);
  }

  const session = getStoredSession();
  const headers = new Headers(options.headers);
  if (!headers.has('Content-Type') && options.body) headers.set('Content-Type', 'application/json');
  if (session?.token) headers.set('Authorization', `Bearer ${session.token}`);

  const response = await fetch(`${API_BASE_URL}${path}`, { ...options, headers });
  if (response.status === 204) {
    if (!response.ok) throw new ApiError('Yêu cầu không thành công.', response.status);
    return undefined as T;
  }

  const payload: unknown = await response.json();
  if (!response.ok) {
    if (response.status === 401) clearStoredSession();
    const error = (payload as { error?: { code?: string; message?: string; details?: unknown } }).error;
    throw new ApiError(error?.message ?? 'Yêu cầu không thành công.', response.status, error?.code, error?.details);
  }

  return payload as T;
}

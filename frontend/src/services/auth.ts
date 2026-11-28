import { apiRequest } from './client.ts';
import { USE_MOCK } from '../lib/config.ts';
import { getStoredSession } from '../lib/storage.ts';
import type { AuthSession, User, UserRole } from '../types/index.ts';

interface ApiUser {
  id: number;
  fullName: string;
  email: string;
  role: 'COUNTER' | 'SHIFT_MANAGER' | 'OWNER' | UserRole;
}

interface LoginResponse {
  token: string;
  user: ApiUser | User;
}

const roles: Record<ApiUser['role'], UserRole> = {
  COUNTER: 'staff',
  SHIFT_MANAGER: 'manager',
  OWNER: 'owner',
  staff: 'staff',
  manager: 'manager',
  owner: 'owner'
};

const mapUser = (user: ApiUser | User): User => 'name' in user
  ? user
  : { name: user.fullName, email: user.email, role: roles[user.role] };

export async function login(email: string, password: string): Promise<AuthSession> {
  if (USE_MOCK) return (await import('../mocks/auth.ts')).mockLogin(email, password);
  const response = await apiRequest<LoginResponse>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password })
  });
  return { token: response.token, user: mapUser(response.user) };
}

export async function getCurrentUser(): Promise<User | null> {
  if (USE_MOCK) return getStoredSession()?.user ?? null;
  if (!getStoredSession()?.token) return null;

  return mapUser(await apiRequest<ApiUser>('/auth/me'));
}

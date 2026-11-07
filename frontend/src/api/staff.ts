import { api } from './client';
import type { Role, Staff } from '@/types';

export type StaffInput = {
  fullName: string;
  email: string;
  password?: string;
  role: Role;
  pin?: string | null;
  active?: boolean;
};

export const staffApi = {
  list: () => api.get<Staff[]>('/staff').then((r) => r.data),
  create: (body: StaffInput & { password: string }) => api.post<Staff>('/staff', body).then((r) => r.data),
  update: (id: number, body: Partial<StaffInput>) => api.patch<Staff>(`/staff/${id}`, body).then((r) => r.data),
};

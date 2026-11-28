import { apiRequest } from './client.ts';

export const adminApi = {
  list: <T>(resource: string) => apiRequest<T[]>(`/${resource}`),
  create: <T>(resource: string, value: unknown) => apiRequest<T>(`/${resource}`, { method: 'POST', body: JSON.stringify(value) }),
  update: <T>(resource: string, id: string | number, value: unknown) => apiRequest<T>(`/${resource}/${id}`, { method: 'PATCH', body: JSON.stringify(value) }),
  remove: (resource: string, id: string | number) => apiRequest<void>(`/${resource}/${id}`, { method: 'DELETE' })
};

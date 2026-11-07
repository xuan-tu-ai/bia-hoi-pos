import { useEffect } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from 'react-router-dom';
import { Toaster } from 'sonner';
import { authApi } from '@/api/auth';
import { authStore } from '@/stores/auth';
import { router } from './router';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (count, err: unknown) => {
        const status = (err as { response?: { status?: number } })?.response?.status;
        return status ? status >= 500 && count < 2 : count < 2;
      },
      refetchOnWindowFocus: true,
      staleTime: 2_000,
    },
  },
});

export default function App() {
  // Làm mới thông tin người dùng (vai trò có thể đã đổi, tài khoản có thể đã bị khóa)
  useEffect(() => {
    if (authStore.get().token) authApi.me().then(authStore.setUser).catch(() => undefined);
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
      <Toaster position="top-center" richColors closeButton />
    </QueryClientProvider>
  );
}

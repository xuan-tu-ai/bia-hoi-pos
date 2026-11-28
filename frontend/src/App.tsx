import { QueryClientProvider } from '@tanstack/react-query';
import { useEffect } from 'react';
import { BrowserRouter, useLocation } from 'react-router-dom';
import { AuthProvider } from './stores/auth.tsx';
import { AppRouter } from './router.tsx';
import { queryClient } from './lib/query-client.ts';

function RouteBodyClass() {
  const { pathname } = useLocation();

  useEffect(() => {
    document.body.classList.toggle('login-page', pathname === '/login');
    return () => document.body.classList.remove('login-page');
  }, [pathname]);

  return null;
}

export function App() {
  return <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <BrowserRouter>
        <RouteBodyClass />
        <AppRouter />
      </BrowserRouter>
    </AuthProvider>
  </QueryClientProvider>;
}

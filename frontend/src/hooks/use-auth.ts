import { useContext } from 'react';
import { AuthContext } from '../stores/auth.tsx';

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth phải được gọi bên trong AuthProvider.');
  return context;
}

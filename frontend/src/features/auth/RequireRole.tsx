import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../hooks/use-auth.ts';
import type { UserRole } from '../../types/index.ts';

interface RouteGuardProps {
  children: ReactNode;
  guestOnly?: boolean;
  allowedRoles?: readonly UserRole[];
}

export function RequireRole({ children, guestOnly = false, allowedRoles }: RouteGuardProps) {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (guestOnly) return user ? <Navigate to="/dashboard" replace /> : children;
  if (!user) return <Navigate to="/login" replace />;
  if (allowedRoles && !allowedRoles.includes(user.role)) return <Navigate to="/dashboard" replace />;
  return children;
}
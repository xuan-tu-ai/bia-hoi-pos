import { can, type Permission } from '../lib/permissions.ts';
import { useAuth } from './use-auth.ts';

export function usePermission(permission: Permission) {
  const { user } = useAuth();
  return can(user, permission);
}

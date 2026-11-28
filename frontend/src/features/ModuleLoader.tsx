import type { ReactNode } from 'react';
import { can } from '../lib/permissions.ts';
import type { User } from '../types/index.ts';
import { FEATURE_MODULES } from './registry.ts';

interface ModuleLoaderProps {
  view: string;
  user: User;
  children: ReactNode;
}

export function ModuleLoader({ view, user, children }: ModuleLoaderProps) {
  const featureModule = FEATURE_MODULES.find((module) => module.view === view);
  if (!featureModule || !can(user, featureModule.permission)) {
    return <main className="page-content"><section className="panel"><h1>Bạn không có quyền truy cập chức năng này</h1></section></main>;
  }
  return children;
}

import { AreasPage } from './admin/areas/index.tsx';
import { HappyHoursPage } from './admin/happy-hours/index.tsx';
import { KegsPage } from './admin/kegs/index.tsx';
import { MenuPage } from './admin/menu/index.tsx';
import { StaffPage } from './admin/staff/index.tsx';
import { ShiftPage } from './counter/shift/index.tsx';
import { TapPage } from './counter/taps/index.tsx';
import { ReportPage } from './reports/index.tsx';
import type { User } from '../types/index.ts';
import type { Dispatch, SetStateAction } from 'react';

interface FeatureRouterProps {
  view: string;
  user: User;
  shiftOpen: boolean;
  setShiftOpen: Dispatch<SetStateAction<boolean>>;
  onToast: (message: string) => void;
}

export function FeatureRouter({ view, user, shiftOpen, setShiftOpen, onToast }: FeatureRouterProps) {
  if (view === 'shifts') return <ShiftPage user={user} isOpen={shiftOpen} setIsOpen={setShiftOpen} onToast={onToast} />;
  if (view === 'taps') return <TapPage onToast={onToast} />;
  if (['reports', 'kegLoss', 'voids', 'topItems'].includes(view)) return <ReportPage view={view} onToast={onToast} />;
  if (view === 'menu') return <MenuPage onToast={onToast} />;
  if (view === 'areas') return <AreasPage onToast={onToast} />;
  if (view === 'staff') return <StaffPage onToast={onToast} />;
  if (view === 'kegs') return <KegsPage onToast={onToast} />;
  if (view === 'happyHours') return <HappyHoursPage onToast={onToast} />;
  return null;
}

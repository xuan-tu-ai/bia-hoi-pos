import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/use-auth.ts';
import type { User } from '../../types/index.ts';
import type { ReactNode, Dispatch, SetStateAction } from 'react';
import { Sidebar } from './Sidebar.tsx';
import { Topbar } from './Topbar.tsx';

interface DashboardLayoutProps {
  user: User;
  occupiedCount: number;
  shiftOpen: boolean;
  activeView: string;
  onNavigate: (view: string) => void;
  children: ReactNode;
}

export function DashboardLayout({ user, occupiedCount, shiftOpen, activeView, onNavigate, children }: DashboardLayoutProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { logout } = useAuth();
  const navigate = useNavigate();
  const signOut = () => {
    logout();
    navigate('/login', { replace: true });
  };

  return <div className="app-shell">
    <Sidebar user={user} occupiedCount={occupiedCount} shiftOpen={shiftOpen} activeView={activeView} onNavigate={onNavigate} onSignOut={signOut} mobileOpen={mobileOpen} setMobileOpen={setMobileOpen} />
    <div className="main-column"><Topbar activeView={activeView} mobileOpen={mobileOpen} onToggleMobile={() => setMobileOpen((value) => !value)} />{children}</div>
  </div>;
}
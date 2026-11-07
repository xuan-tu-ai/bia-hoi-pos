import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { Beer, LogOut, Menu, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { authStore, useAuth } from '@/stores/auth';
import { ROLE_LABEL } from '@/lib/format';
import { cn } from '@/lib/utils';
import { ErrorBoundary } from './ErrorBoundary';
import { navFor } from './nav';

const COLLAPSE_KEY = 'biahoi.sidebarCollapsed';

function NavList({ collapsed, onNavigate }: { collapsed?: boolean; onNavigate?: () => void }) {
  const { user } = useAuth();
  if (!user) return null;
  return (
    <nav className="flex flex-col gap-3">
      {navFor(user.role).map((section) => (
        <div key={section.title}>
          {!collapsed && <div className="mb-1 px-3 text-[11px] font-semibold uppercase tracking-wider text-stone-400">{section.title}</div>}
          <ul className="flex flex-col gap-0.5">
            {section.items.map((item) => (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  end={item.to === '/counter'}
                  onClick={onNavigate}
                  title={collapsed ? item.label : undefined}
                  className={({ isActive }) =>
                    cn(
                      'flex h-9 items-center gap-3 rounded-md px-3 text-sm font-medium text-stone-300 transition-colors hover:bg-white/10 hover:text-white',
                      isActive && 'bg-amber-500/15 text-amber-300 hover:bg-amber-500/20 hover:text-amber-200',
                      collapsed && 'justify-center px-0',
                    )
                  }
                >
                  <item.icon className="h-[18px] w-[18px] shrink-0" />
                  {!collapsed && <span className="truncate">{item.label}</span>}
                </NavLink>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  );
}

function UserBox({ collapsed }: { collapsed?: boolean }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  if (!user) return null;
  const logout = () => {
    qc.clear();
    authStore.logout();
  };
  return (
    <div className={cn('flex items-center gap-2 border-t border-white/10 pt-3', collapsed && 'flex-col')}>
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-500/20 text-sm font-semibold text-amber-200">
        {user.fullName.split(' ').pop()?.[0]}
      </div>
      {!collapsed && (
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium text-white">{user.fullName}</div>
          <div className="truncate text-xs text-stone-400">{ROLE_LABEL[user.role]}</div>
        </div>
      )}
      <Button variant="ghost" size="icon" onClick={logout} title="Đăng xuất" className="h-9 w-9 text-stone-300 hover:bg-white/10 hover:text-white">
        <LogOut />
      </Button>
    </div>
  );
}

function Brand({ collapsed }: { collapsed?: boolean }) {
  return (
    <div className={cn('flex items-center gap-2 px-1', collapsed && 'justify-center')}>
      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-500 text-stone-950">
        <Beer className="h-5 w-5" />
      </div>
      {!collapsed && (
        <div className="leading-tight">
          <div className="text-sm font-bold text-white">Bia Hơi</div>
          <div className="text-[11px] text-stone-400">Quản lý quầy</div>
        </div>
      )}
    </div>
  );
}

export function AppLayout() {
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem(COLLAPSE_KEY) === '1';
    } catch {
      return false;
    }
  });
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();
  useEffect(() => setMobileOpen(false), [location.pathname]);

  const toggle = () => {
    setCollapsed((c) => {
      try {
        localStorage.setItem(COLLAPSE_KEY, c ? '0' : '1');
      } catch {
        /* bỏ qua */
      }
      return !c;
    });
  };

  return (
    <div className="flex min-h-screen">
      {/* Thanh bên — màn hình ≥ 1024px */}
      <aside
        className={cn(
          'sticky top-0 hidden h-screen shrink-0 flex-col gap-4 bg-stone-900 p-3 lg:flex',
          collapsed ? 'w-[68px]' : 'w-[216px]',
        )}
      >
        <Brand collapsed={collapsed} />
        <div className="flex-1 overflow-y-auto">
          <NavList collapsed={collapsed} />
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={toggle}
          className={cn('justify-start text-stone-400 hover:bg-white/10 hover:text-white', collapsed && 'justify-center')}
          title={collapsed ? 'Mở rộng menu' : 'Thu gọn menu'}
        >
          {collapsed ? <PanelLeftOpen /> : <PanelLeftClose />}
          {!collapsed && 'Thu gọn'}
        </Button>
        <UserBox collapsed={collapsed} />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Thanh trên — điện thoại / máy tính bảng */}
        <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b bg-stone-900 px-3 lg:hidden">
          <Button variant="ghost" size="icon" className="text-white hover:bg-white/10 hover:text-white" onClick={() => setMobileOpen(true)} aria-label="Mở menu">
            <Menu />
          </Button>
          <Brand />
        </header>
        <Dialog open={mobileOpen} onOpenChange={setMobileOpen}>
          <DialogContent className="left-0 top-0 h-full max-h-screen w-[260px] max-w-none translate-x-0 translate-y-0 gap-5 rounded-none border-0 bg-stone-900 p-3 data-[state=open]:slide-in-from-left">
            <DialogTitle className="sr-only">Menu</DialogTitle>
            <Brand />
            <div className="flex-1 overflow-y-auto">
              <NavList onNavigate={() => setMobileOpen(false)} />
            </div>
            <UserBox />
          </DialogContent>
        </Dialog>

        <main className="min-w-0 flex-1">
          <ErrorBoundary key={location.pathname}>
            <Outlet />
          </ErrorBoundary>
        </main>
      </div>
    </div>
  );
}

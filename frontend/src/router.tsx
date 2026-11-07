import type { ReactNode } from 'react';
import { Navigate, Outlet, createBrowserRouter, useLocation } from 'react-router-dom';
import { ShieldAlert } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { homeFor } from '@/components/layout/nav';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/stores/auth';
import type { Role } from '@/types';
import { LoginPage } from '@/features/auth/LoginPage';
import { TableMapPage } from '@/features/counter/TableMapPage';
import { TabPage } from '@/features/counter/TabPage';
import { PaymentPage } from '@/features/counter/PaymentPage';
import { TapsPage } from '@/features/counter/TapsPage';
import { ShiftPage } from '@/features/counter/ShiftPage';
import { MenuAdminPage } from '@/features/admin/MenuAdminPage';
import { AreasAdminPage } from '@/features/admin/AreasAdminPage';
import { StaffAdminPage } from '@/features/admin/StaffAdminPage';
import { KegsAdminPage } from '@/features/admin/KegsAdminPage';
import { HappyHoursAdminPage } from '@/features/admin/HappyHoursAdminPage';
import { TodayReportPage } from '@/features/reports/TodayReportPage';
import { KegLossReportPage } from '@/features/reports/KegLossReportPage';
import { VoidsReportPage } from '@/features/reports/VoidsReportPage';
import { TopItemsReportPage } from '@/features/reports/TopItemsReportPage';

const ALL: Role[] = ['COUNTER', 'SHIFT_MANAGER', 'OWNER'];
const MANAGERS: Role[] = ['SHIFT_MANAGER', 'OWNER'];
const OWNER: Role[] = ['OWNER'];

/** Chưa đăng nhập → trang đăng nhập (giữ lại trang định vào). */
function RequireAuth() {
  const { user } = useAuth();
  const location = useLocation();
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  return <Outlet />;
}

export function Forbidden() {
  const { user } = useAuth();
  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center gap-3 px-4 text-center">
      <ShieldAlert className="h-12 w-12 text-destructive" />
      <h1 className="text-xl font-bold">Bạn không có quyền truy cập trang này</h1>
      <p className="max-w-sm text-sm text-muted-foreground">Trang này dành cho vai trò khác. Liên hệ chủ quán nếu bạn cần quyền.</p>
      {user && (
        <Button asChild variant="outline">
          <a href={homeFor(user.role)}>Về trang chính</a>
        </Button>
      )}
    </div>
  );
}

/** Chặn trang theo vai trò (FR-01). Backend vẫn kiểm tra quyền cho từng API. */
function Guard({ roles, children }: { roles: Role[]; children: ReactNode }) {
  const { user } = useAuth();
  if (!user) return null;
  return roles.includes(user.role) ? <>{children}</> : <Forbidden />;
}

function Home() {
  const { user } = useAuth();
  return <Navigate to={user ? homeFor(user.role) : '/login'} replace />;
}

const g = (roles: Role[], el: ReactNode) => <Guard roles={roles}>{el}</Guard>;

export const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  {
    element: <RequireAuth />,
    children: [
      {
        element: <AppLayout />,
        children: [
          { index: true, element: <Home /> },
          // Phân hệ Quầy
          { path: 'counter', element: g(ALL, <TableMapPage />) },
          { path: 'counter/tabs/:tabId', element: g(ALL, <TabPage />) },
          { path: 'counter/tabs/:tabId/pay', element: g(ALL, <PaymentPage />) },
          { path: 'counter/taps', element: g(ALL, <TapsPage />) },
          { path: 'counter/shift', element: g(ALL, <ShiftPage />) },
          // Phân hệ Quản trị
          { path: 'admin/menu', element: g(OWNER, <MenuAdminPage />) },
          { path: 'admin/areas', element: g(OWNER, <AreasAdminPage />) },
          { path: 'admin/staff', element: g(OWNER, <StaffAdminPage />) },
          { path: 'admin/kegs', element: g(MANAGERS, <KegsAdminPage />) },
          { path: 'admin/happy-hours', element: g(OWNER, <HappyHoursAdminPage />) },
          // Phân hệ Báo cáo
          { path: 'reports/today', element: g(MANAGERS, <TodayReportPage />) },
          { path: 'reports/keg-loss', element: g(OWNER, <KegLossReportPage />) },
          { path: 'reports/voids', element: g(MANAGERS, <VoidsReportPage />) },
          { path: 'reports/top-items', element: g(OWNER, <TopItemsReportPage />) },
          { path: '*', element: <Home /> },
        ],
      },
    ],
  },
]);

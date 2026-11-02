import type { ReactNode } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { Mark } from './components/Icon';
import { Shell } from './components/Shell';
import { AuthProvider, isOwner, useAuth } from './lib/auth';
import { AreasTables } from './screens/AreasTables';
import { HappyHours } from './screens/HappyHours';
import { KegLoss } from './screens/KegLoss';
import { KegStock } from './screens/KegStock';
import { Login } from './screens/Login';
import { Menu } from './screens/Menu';
import { Shifts } from './screens/Shifts';
import { StaffScreen } from './screens/StaffScreen';
import { Stations } from './screens/Stations';
import { Today } from './screens/Today';
import { TopItems } from './screens/TopItems';
import { Voids } from './screens/Voids';

/** Màn quản trị chỉ dành cho chủ quán; quản lý ca chỉ xem báo cáo. */
function OwnerOnly({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  return isOwner(user) ? <>{children}</> : <Navigate to="/" replace />;
}

function Routed() {
  const { user, checking } = useAuth();
  if (checking) {
    return (
      <main className="splash" aria-busy="true">
        <Mark size={40} />
      </main>
    );
  }
  if (!user) return <Login />;
  return (
    <Shell>
      <Routes>
        <Route path="/" element={<Today />} />
        <Route path="/hao-hut-keg" element={<KegLoss />} />
        <Route path="/nhat-ky-huy" element={<Voids />} />
        <Route path="/ban-chay" element={<TopItems />} />
        <Route path="/ca" element={<Shifts />} />
        <Route path="/thuc-don" element={<OwnerOnly><Menu /></OwnerOnly>} />
        <Route path="/tram-in" element={<OwnerOnly><Stations /></OwnerOnly>} />
        <Route path="/khu-ban" element={<OwnerOnly><AreasTables /></OwnerOnly>} />
        <Route path="/nhan-vien" element={<OwnerOnly><StaffScreen /></OwnerOnly>} />
        <Route path="/kho-keg" element={<OwnerOnly><KegStock /></OwnerOnly>} />
        <Route path="/gio-vang" element={<OwnerOnly><HappyHours /></OwnerOnly>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Shell>
  );
}

export function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routed />
      </BrowserRouter>
    </AuthProvider>
  );
}

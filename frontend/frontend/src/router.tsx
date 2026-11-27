import { Navigate, Route, Routes } from 'react-router-dom';
import { RequireRole } from './features/auth/RequireRole.tsx';
import { LoginPage } from './features/auth/LoginPage.tsx';
import { DashboardPage } from './features/counter/tables/index.tsx';

export function AppRouter() {
  return <Routes>
    <Route path="/" element={<Navigate to="/login" replace />} />
    <Route path="/login" element={<RequireRole guestOnly><LoginPage /></RequireRole>} />
    <Route path="/dashboard.html" element={<Navigate to="/dashboard" replace />} />
    <Route path="/dashboard/*" element={<RequireRole><DashboardPage /></RequireRole>} />
    <Route path="*" element={<Navigate to="/" replace />} />
  </Routes>;
}

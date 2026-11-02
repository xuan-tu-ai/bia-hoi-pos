import { BrowserRouter, Navigate, Route, Routes, useParams } from 'react-router-dom';
import { Mark } from './components/Icon';
import { SessionProvider, useSession } from './lib/session';
import { FloorMap } from './screens/FloorMap';
import { Lock } from './screens/Lock';
import { Payment } from './screens/Payment';
import { ShiftScreen } from './screens/ShiftScreen';
import { TabScreen } from './screens/TabScreen';
import { Taps } from './screens/Taps';

/** Mỗi phiên bàn một màn mới: chuyển/gộp sang bàn khác không mang theo lượt đang nhập hay thông báo cũ. */
function TabRoute() {
  const { tabId } = useParams();
  return <TabScreen key={tabId} />;
}

function Routed() {
  const { staff, checking } = useSession();
  if (checking) {
    return (
      <main className="splash" aria-busy="true">
        <Mark size={48} />
      </main>
    );
  }
  if (!staff) return <Lock />;
  return (
    <Routes>
      <Route path="/" element={<FloorMap />} />
      <Route path="/ban/:tabId" element={<TabRoute />} />
      <Route path="/ban/:tabId/thanh-toan" element={<Payment />} />
      <Route path="/voi-bia" element={<Taps />} />
      <Route path="/ca" element={<ShiftScreen />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export function App() {
  return (
    <SessionProvider>
      <BrowserRouter basename="/quay">
        <Routed />
      </BrowserRouter>
    </SessionProvider>
  );
}

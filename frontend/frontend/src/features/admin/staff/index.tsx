import { AdminPage } from '../index.tsx';

export function StaffPage({ onToast }: { onToast: (message: string) => void }) {
  return <AdminPage view="staff" onToast={onToast} />;
}

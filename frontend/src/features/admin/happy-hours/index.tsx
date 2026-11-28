import { AdminPage } from '../index.tsx';

export function HappyHoursPage({ onToast }: { onToast: (message: string) => void }) {
  return <AdminPage view="happyHours" onToast={onToast} />;
}

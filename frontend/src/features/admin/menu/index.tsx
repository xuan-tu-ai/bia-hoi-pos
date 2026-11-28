import { AdminPage } from '../index.tsx';

export function MenuPage({ onToast }: { onToast: (message: string) => void }) {
  return <AdminPage view="menu" onToast={onToast} />;
}

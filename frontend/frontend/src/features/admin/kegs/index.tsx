import { AdminPage } from '../index.tsx';

export function KegsPage({ onToast }: { onToast: (message: string) => void }) {
  return <AdminPage view="kegs" onToast={onToast} />;
}

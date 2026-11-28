import { AdminPage } from '../index.tsx';

export function AreasPage({ onToast }: { onToast: (message: string) => void }) {
  return <AdminPage view="areas" onToast={onToast} />;
}

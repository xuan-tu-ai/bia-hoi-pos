import { KeyRound } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/stores/auth';

/**
 * Ô "Nhập PIN Quản lý ca" — chỉ hiện khi người đang đăng nhập là Nhân viên quầy (FR-06, FR-08).
 * Quản lý ca / Chủ quán tự duyệt nên không cần.
 */
export function PinInput({ value, onChange, error }: { value: string; onChange: (v: string) => void; error?: string }) {
  const { user } = useAuth();
  if (user?.role !== 'COUNTER') return null;
  return (
    <div className="grid gap-1.5 rounded-md border border-amber-300 bg-amber-50 p-3">
      <Label htmlFor="approver-pin" className="flex items-center gap-1.5 text-amber-900">
        <KeyRound className="h-4 w-4" /> Nhập PIN Quản lý ca
      </Label>
      <Input
        id="approver-pin"
        type="password"
        inputMode="numeric"
        autoComplete="off"
        maxLength={6}
        placeholder="4–6 số"
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, ''))}
        className="bg-white tracking-[0.4em]"
      />
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

export function needsPin(role: string | undefined) {
  return role === 'COUNTER';
}

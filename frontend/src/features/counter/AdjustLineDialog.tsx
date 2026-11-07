import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { tabsApi } from '@/api/tabs';
import { apiError } from '@/api/client';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input, Textarea } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PinInput, needsPin } from '@/components/PinInput';
import { REASON_LABEL, formatMoney } from '@/lib/format';
import { cn } from '@/lib/utils';
import { useAuth } from '@/stores/auth';
import type { Reason, TabLine } from '@/types';
import { qk } from './queries';

export type AdjustMode = 'void' | 'discount';

/** FR-06 Hủy / giảm món đã gửi — bắt buộc lý do; Nhân viên quầy phải nhập PIN Quản lý ca. */
export function AdjustLineDialog({ tabId, line, mode, onClose }: { tabId: number; line: TabLine | null; mode: AdjustMode; onClose: () => void }) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [qty, setQty] = useState(1);
  const [discountType, setDiscountType] = useState<'PERCENT' | 'AMOUNT'>('PERCENT');
  const [value, setValue] = useState('');
  const [reason, setReason] = useState<Reason | null>(null);
  const [note, setNote] = useState('');
  const [pin, setPin] = useState('');
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    setQty(1);
    setValue('');
    setReason(null);
    setNote('');
    setPin('');
    setErr(null);
  }, [line, mode]);

  const remaining = line?.remainingQty ?? 0;
  const net = line?.netAmount ?? 0;
  const v = Number(value) || 0;
  const discountAmount = discountType === 'PERCENT' ? Math.round((net * v) / 100) : Math.round(v);

  const submit = useMutation({
    mutationFn: async () => {
      if (!line) return;
      const base = { reason: reason!, note: note.trim() || null, approverPin: needsPin(user?.role) ? pin : null };
      if (mode === 'void') return tabsApi.voidLine(line.id, { ...base, qty });
      return tabsApi.discountLine(line.id, { ...base, type: discountType, value: v });
    },
    onSuccess: () => {
      toast.success(mode === 'void' ? 'Đã hủy món' : 'Đã giảm giá món');
      qc.invalidateQueries({ queryKey: qk.tab(tabId) });
      qc.invalidateQueries({ queryKey: qk.summary });
      onClose();
    },
    onError: (e) => setErr(apiError(e).message),
  });

  const validate = () => {
    if (!reason) return 'Chưa chọn lý do';
    if (reason === 'OTHER' && !note.trim()) return 'Lý do "Khác" phải có ghi chú';
    if (mode === 'void' && (qty < 1 || qty > remaining)) return `Số lượng hủy từ 1 đến ${remaining}`;
    if (mode === 'discount') {
      if (v <= 0) return 'Nhập mức giảm';
      if (discountType === 'PERCENT' && v > 100) return 'Giảm tối đa 100%';
      if (discountAmount > net) return `Giảm tối đa ${formatMoney(net)}`;
    }
    if (needsPin(user?.role) && !/^\d{4,6}$/.test(pin)) return 'Cần PIN của Quản lý ca';
    return null;
  };

  return (
    <Dialog open={!!line} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{mode === 'void' ? 'Hủy món' : 'Giảm giá món'}</DialogTitle>
          <DialogDescription>
            {line?.name} — còn {remaining} × {formatMoney(line?.unitPrice)} = {formatMoney(net)}
          </DialogDescription>
        </DialogHeader>

        <form
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            const m = validate();
            setErr(m);
            if (!m) submit.mutate();
          }}
        >
          {mode === 'void' ? (
            <div className="grid gap-1.5">
              <Label>Số lượng hủy</Label>
              <div className="flex items-center gap-2">
                <Button type="button" variant="outline" size="icon" onClick={() => setQty((q) => Math.max(1, q - 1))}>−</Button>
                <Input className="w-20 text-center text-lg" inputMode="numeric" value={qty} onChange={(e) => setQty(Number(e.target.value.replace(/\D/g, '')) || 0)} />
                <Button type="button" variant="outline" size="icon" onClick={() => setQty((q) => Math.min(remaining, q + 1))}>+</Button>
                <span className="text-sm text-muted-foreground">/ {remaining}</span>
              </div>
            </div>
          ) : (
            <div className="grid gap-1.5">
              <Label>Mức giảm</Label>
              <div className="flex gap-2">
                <div className="flex rounded-md border p-0.5">
                  {(['PERCENT', 'AMOUNT'] as const).map((t) => (
                    <button key={t} type="button" onClick={() => setDiscountType(t)} className={cn('h-9 rounded px-3 text-sm font-medium', discountType === t ? 'bg-primary text-primary-foreground' : 'hover:bg-accent')}>
                      {t === 'PERCENT' ? '%' : '₫'}
                    </button>
                  ))}
                </div>
                <Input inputMode="numeric" value={value} onChange={(e) => setValue(e.target.value.replace(/\D/g, ''))} placeholder={discountType === 'PERCENT' ? 'vd 20' : 'vd 10000'} />
              </div>
              {v > 0 && <p className="text-xs text-muted-foreground">Giảm {formatMoney(discountAmount)}</p>}
            </div>
          )}

          <div className="grid gap-1.5">
            <Label>Lý do</Label>
            <div className="grid grid-cols-2 gap-2">
              {(Object.keys(REASON_LABEL) as Reason[]).map((r) => (
                <button key={r} type="button" onClick={() => setReason(r)} className={cn('h-11 rounded-md border text-sm font-medium', reason === r ? 'border-primary bg-primary/10 text-primary' : 'hover:bg-accent')}>
                  {REASON_LABEL[r]}
                </button>
              ))}
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="adjust-note">Ghi chú {reason === 'OTHER' && <span className="text-destructive">*</span>}</Label>
            <Textarea id="adjust-note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} />
          </div>
          <PinInput value={pin} onChange={setPin} />

          {err && <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{err}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Đóng</Button>
            <Button type="submit" variant="destructive" disabled={submit.isPending}>
              {submit.isPending && <Loader2 className="animate-spin" />}
              {mode === 'void' ? 'Xác nhận hủy' : 'Xác nhận giảm'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

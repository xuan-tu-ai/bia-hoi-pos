import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ArrowLeft, Banknote, CheckCircle2, Loader2, QrCode } from 'lucide-react';
import { tabsApi } from '@/api/tabs';
import { apiError } from '@/api/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input, NativeSelect } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ErrorBox, Loading } from '@/components/layout/Page';
import { PinInput, needsPin } from '@/components/PinInput';
import { BillPaper } from '@/components/print/Paper';
import { PrintDialog } from '@/components/print/PrintDialog';
import { REASON_LABEL, formatDateTime, formatMoney } from '@/lib/format';
import { cn } from '@/lib/utils';
import { useAuth } from '@/stores/auth';
import type { PaidBill, Reason } from '@/types';
import { qk, useTab } from './queries';

const QUICK_CASH = [100_000, 200_000, 500_000];
const digits = (s: string) => Number(s.replace(/\D/g, '')) || 0;

/** Giống backend: % làm tròn về số nguyên, không vượt tạm tính. */
function computeDiscount(subtotal: number, type: 'NONE' | 'PERCENT' | 'AMOUNT', value: number) {
  if (type === 'NONE' || value <= 0) return 0;
  const raw = type === 'PERCENT' ? Math.round((subtotal * value) / 100) : Math.round(value);
  return Math.max(0, Math.min(raw, subtotal));
}

/** Đợi người dùng ngừng gõ rồi mới đổi giá trị (đỡ gọi API tạo QR liên tục). */
function useDebounced<T>(value: T, ms = 400) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setV(value), ms);
    return () => clearTimeout(id);
  }, [value, ms]);
  return v;
}

/** FR-08 Thanh toán: tiền mặt / chuyển khoản VietQR / chia hai; giảm giá hóa đơn (NV quầy cần PIN). */
export function PaymentPage() {
  const tabId = Number(useParams().tabId);
  const tab = useTab(tabId);
  const { user } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();

  const [discountType, setDiscountType] = useState<'NONE' | 'PERCENT' | 'AMOUNT'>('NONE');
  const [discountValue, setDiscountValue] = useState('');
  const [discountReason, setDiscountReason] = useState<Reason>('OTHER');
  const [pin, setPin] = useState('');
  const [cash, setCash] = useState('');
  const [transfer, setTransfer] = useState('');
  const [transferConfirmed, setTransferConfirmed] = useState(false);
  const [paidBill, setPaidBill] = useState<PaidBill | null>(null);
  const [error, setError] = useState<string | null>(null);

  const subtotal = tab.data?.subtotal ?? 0;
  const discount = computeDiscount(subtotal, discountType, digits(discountValue));
  const due = subtotal - discount;
  const cashN = digits(cash);
  const transferN = digits(transfer);
  const received = cashN + transferN;
  const missing = Math.max(0, due - received);
  const change = Math.max(0, received - due);
  const transferTooMuch = transferN > due;

  const qrAmount = useDebounced(transferN);
  useEffect(() => setTransferConfirmed(false), [transferN]);
  const qr = useQuery({
    queryKey: ['vietqr', tabId, qrAmount],
    queryFn: () => tabsApi.vietqr(tabId, qrAmount),
    enabled: qrAmount > 0 && !transferTooMuch,
    staleTime: Infinity,
  });

  const pay = useMutation({
    mutationFn: () =>
      tabsApi.pay(tabId, {
        billDiscount: discount > 0 ? { type: discountType as 'PERCENT' | 'AMOUNT', value: digits(discountValue), reason: discountReason } : null,
        approverPin: discount > 0 && needsPin(user?.role) ? pin : null,
        payments: [
          ...(cashN > 0 ? [{ method: 'CASH' as const, amount: cashN }] : []),
          ...(transferN > 0 ? [{ method: 'TRANSFER' as const, amount: transferN }] : []),
        ],
      }),
    onSuccess: (b) => {
      qc.invalidateQueries({ queryKey: ['tabs'] });
      qc.invalidateQueries({ queryKey: qk.shift });
      setPaidBill(b);
      toast.success(`Đã thanh toán ${b.billNo}`);
    },
    onError: (e) => setError(apiError(e).message),
  });

  const blocker = useMemo(() => {
    if (missing > 0) return `Còn thiếu ${formatMoney(missing)}`;
    if (transferTooMuch) return 'Số tiền chuyển khoản vượt quá số phải trả';
    if (transferN > 0 && !transferConfirmed) return 'Kiểm tra điện thoại rồi bấm "Đã nhận tiền"';
    if (discount > 0 && needsPin(user?.role) && !/^\d{4,6}$/.test(pin)) return 'Giảm giá hóa đơn cần PIN Quản lý ca';
    return null;
  }, [missing, transferTooMuch, transferN, transferConfirmed, discount, user?.role, pin]);

  if (tab.isLoading) return <Loading />;
  if (tab.isError || !tab.data) return <div className="p-6"><ErrorBox message={apiError(tab.error).message} /></div>;
  const t = tab.data;

  if (t.status !== 'OPEN' && !paidBill) {
    return (
      <div className="p-6">
        <ErrorBox message="Phiên bàn này đã đóng, không thanh toán được nữa." />
        <Button asChild variant="outline" className="mt-4"><Link to="/counter">Về sơ đồ bàn</Link></Button>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-5 sm:px-6">
      <div className="mb-5 flex items-center gap-2">
        <Button variant="ghost" size="icon" asChild aria-label="Quay lại">
          <Link to={`/counter/tabs/${tabId}`}><ArrowLeft /></Link>
        </Button>
        <h1 className="text-xl font-bold sm:text-2xl">Thanh toán bàn {t.table.code}</h1>
        <span className="text-sm text-muted-foreground">{t.billNo}</span>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_380px]">
        <div className="grid content-start gap-4">
          {/* Giảm giá cả hóa đơn */}
          <Card>
            <CardHeader><CardTitle>Giảm giá hóa đơn</CardTitle></CardHeader>
            <CardContent className="grid gap-3">
              <div className="grid gap-2 sm:grid-cols-[160px_1fr_1fr]">
                <NativeSelect value={discountType} onChange={(e) => setDiscountType(e.target.value as typeof discountType)} aria-label="Kiểu giảm">
                  <option value="NONE">Không giảm</option>
                  <option value="PERCENT">Theo %</option>
                  <option value="AMOUNT">Theo số tiền</option>
                </NativeSelect>
                {discountType !== 'NONE' && (
                  <>
                    <Input inputMode="numeric" placeholder={discountType === 'PERCENT' ? 'Phần trăm' : 'Số tiền'} value={discountValue} onChange={(e) => setDiscountValue(e.target.value.replace(/\D/g, ''))} aria-label="Mức giảm" />
                    <NativeSelect value={discountReason} onChange={(e) => setDiscountReason(e.target.value as Reason)} aria-label="Lý do giảm">
                      {(Object.keys(REASON_LABEL) as Reason[]).map((r) => <option key={r} value={r}>{REASON_LABEL[r]}</option>)}
                    </NativeSelect>
                  </>
                )}
              </div>
              {discount > 0 && <PinInput value={pin} onChange={setPin} />}
            </CardContent>
          </Card>

          {/* Tiền mặt */}
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><Banknote className="h-5 w-5" /> Tiền mặt</CardTitle></CardHeader>
            <CardContent className="grid gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="cash">Tiền khách đưa</Label>
                <Input id="cash" inputMode="numeric" className="h-12 text-xl font-semibold tabular-nums" value={cash ? cashN.toLocaleString('vi-VN') : ''} onChange={(e) => setCash(e.target.value)} placeholder="0" />
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="secondary" onClick={() => setCash(String(Math.max(0, due - transferN)))}>Đủ tiền</Button>
                {QUICK_CASH.map((v) => (
                  <Button key={v} variant="outline" onClick={() => setCash(String(v))}>{v / 1000}k</Button>
                ))}
                {cash && <Button variant="ghost" onClick={() => setCash('')}>Xóa</Button>}
              </div>
            </CardContent>
          </Card>

          {/* Chuyển khoản */}
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><QrCode className="h-5 w-5" /> Chuyển khoản (VietQR)</CardTitle></CardHeader>
            <CardContent className="grid gap-3">
              <div className="flex flex-wrap items-end gap-2">
                <div className="grid flex-1 gap-1.5">
                  <Label htmlFor="transfer">Số tiền chuyển khoản</Label>
                  <Input id="transfer" inputMode="numeric" className="h-12 text-xl font-semibold tabular-nums" value={transfer ? transferN.toLocaleString('vi-VN') : ''} onChange={(e) => setTransfer(e.target.value)} placeholder="0" />
                </div>
                <Button variant="secondary" onClick={() => setTransfer(String(Math.max(0, due - cashN)))}>Phần còn lại</Button>
              </div>
              {transferN > 0 && !transferTooMuch && (
                <div className="flex flex-col items-center gap-3 rounded-lg border bg-muted/30 p-3 sm:flex-row sm:items-start">
                  <div className="flex h-[220px] w-[220px] items-center justify-center rounded-md bg-white">
                    {qr.data ? <img src={qr.data.url} alt="Mã VietQR" className="h-full w-full object-contain" /> : <Loader2 className="animate-spin text-muted-foreground" />}
                  </div>
                  <div className="grid gap-1 text-sm">
                    {qr.data && (
                      <>
                        <div>Ngân hàng: <b>{qr.data.bank}</b></div>
                        <div>Số TK: <b>{qr.data.account}</b></div>
                        <div>Chủ TK: <b>{qr.data.accountName}</b></div>
                        <div>Số tiền: <b>{formatMoney(qr.data.amount)}</b></div>
                        <div>Nội dung: <b className="font-mono">{qr.data.addInfo}</b></div>
                      </>
                    )}
                    <Button
                      className={cn('mt-2', transferConfirmed && 'bg-green-600 hover:bg-green-600/90')}
                      variant={transferConfirmed ? 'default' : 'outline'}
                      onClick={() => setTransferConfirmed((c) => !c)}
                    >
                      <CheckCircle2 /> {transferConfirmed ? 'Đã nhận tiền' : 'Bấm khi đã nhận tiền'}
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Tóm tắt */}
        <Card className="h-fit lg:sticky lg:top-4">
          <CardHeader><CardTitle>Tóm tắt</CardTitle></CardHeader>
          <CardContent className="grid gap-2 text-sm">
            <Row label="Cộng tiền hàng" value={formatMoney(subtotal)} />
            {discount > 0 && <Row label="Giảm giá hóa đơn" value={`−${formatMoney(discount)}`} />}
            <div className="my-1 border-t" />
            <Row label="Phải trả" value={formatMoney(due)} big />
            <Row label="Tiền mặt" value={formatMoney(cashN)} />
            <Row label="Chuyển khoản" value={formatMoney(transferN)} />
            <Row label="Đã nhận" value={formatMoney(received)} />
            {missing > 0 ? <Row label="Còn thiếu" value={formatMoney(missing)} danger /> : <Row label="Tiền thừa trả khách" value={formatMoney(change)} big />}
            {(error || blocker) && <p role="alert" className="mt-2 rounded-md bg-destructive/10 px-3 py-2 text-destructive">{error ?? blocker}</p>}
            <Button size="lg" className="mt-2" disabled={!!blocker || pay.isPending} onClick={() => { setError(null); pay.mutate(); }}>
              {pay.isPending && <Loader2 className="animate-spin" />} Hoàn tất thanh toán
            </Button>
          </CardContent>
        </Card>
      </div>

      <PrintDialog
        open={!!paidBill}
        onOpenChange={(o) => {
          if (!o) navigate('/counter', { replace: true });
        }}
        title="Hóa đơn thanh toán"
        description="Bàn đã trở về trống."
      >
        {paidBill && (
          <BillPaper
            title="Hóa đơn thanh toán"
            {...paidBill}
            footer={<>Đã thanh toán {formatDateTime(paidBill.paidAt)} · {paidBill.cashier}<br />Cảm ơn quý khách!</>}
          />
        )}
      </PrintDialog>
    </div>
  );
}

function Row({ label, value, big, danger }: { label: string; value: string; big?: boolean; danger?: boolean }) {
  return (
    <div className={cn('flex justify-between', big && 'text-lg font-bold', danger && 'font-semibold text-destructive')}>
      <span>{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
}

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Loader2, Pencil, Plus } from 'lucide-react';
import { staffApi, type StaffInput } from '@/api/staff';
import { apiError } from '@/api/client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input, NativeSelect } from '@/components/ui/input';
import { Field } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ErrorBox, Loading, Page } from '@/components/layout/Page';
import { ROLE_LABEL } from '@/lib/format';
import { useAuth } from '@/stores/auth';
import type { Role, Staff } from '@/types';

const key = ['admin', 'staff'] as const;

/** FR-13 Nhân viên: tạo tài khoản, phân quyền, khóa/mở khóa, đặt PIN duyệt. */
export function StaffAdminPage() {
  const list = useQuery({ queryKey: key, queryFn: staffApi.list });
  const [editing, setEditing] = useState<Staff | 'new' | null>(null);

  return (
    <Page title="Nhân viên" description="Mật khẩu và PIN được lưu dạng băm, không ai xem lại được." actions={<Button onClick={() => setEditing('new')}><Plus /> Thêm nhân viên</Button>}>
      {list.isLoading ? (
        <Loading />
      ) : list.isError ? (
        <ErrorBox message={apiError(list.error).message} />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Họ tên</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Vai trò</TableHead>
              <TableHead>PIN duyệt</TableHead>
              <TableHead>Trạng thái</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {list.data!.map((s) => (
              <TableRow key={s.id}>
                <TableCell className="font-medium">{s.fullName}</TableCell>
                <TableCell>{s.email}</TableCell>
                <TableCell>{ROLE_LABEL[s.role]}</TableCell>
                <TableCell>{s.role === 'COUNTER' ? '—' : s.hasPin ? 'Đã đặt' : <span className="text-amber-700">Chưa đặt</span>}</TableCell>
                <TableCell>{s.active ? <Badge variant="success">Hoạt động</Badge> : <Badge variant="secondary">Đã khóa</Badge>}</TableCell>
                <TableCell className="text-right"><Button size="sm" variant="ghost" onClick={() => setEditing(s)}><Pencil /> Sửa</Button></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
      <StaffDialog staff={editing} onClose={() => setEditing(null)} />
    </Page>
  );
}

const schema = z
  .object({
    isNew: z.boolean(),
    fullName: z.string().trim().min(1, 'Chưa nhập họ tên'),
    email: z.string().trim().toLowerCase().email('Email không hợp lệ'),
    password: z.string(),
    role: z.enum(['COUNTER', 'SHIFT_MANAGER', 'OWNER']),
    pin: z.string(),
    active: z.boolean(),
  })
  .superRefine((v, ctx) => {
    if (v.isNew && v.password.length < 6) ctx.addIssue({ code: 'custom', path: ['password'], message: 'Mật khẩu ít nhất 6 ký tự' });
    if (!v.isNew && v.password && v.password.length < 6) ctx.addIssue({ code: 'custom', path: ['password'], message: 'Mật khẩu ít nhất 6 ký tự' });
    if (v.pin && !/^\d{4,6}$/.test(v.pin)) ctx.addIssue({ code: 'custom', path: ['pin'], message: 'PIN gồm 4–6 chữ số' });
  });
type Form = z.infer<typeof schema>;

function StaffDialog({ staff, onClose }: { staff: Staff | 'new' | null; onClose: () => void }) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const isNew = staff === 'new';
  const { register, handleSubmit, reset, watch, formState, setError } = useForm<Form>({ resolver: zodResolver(schema) });

  useEffect(() => {
    if (!staff) return;
    const s = staff === 'new' ? null : staff;
    reset({ isNew: !s, fullName: s?.fullName ?? '', email: s?.email ?? '', password: '', role: s?.role ?? 'COUNTER', pin: '', active: s?.active ?? true });
  }, [staff, reset]);

  const save = useMutation({
    mutationFn: (f: Form) => {
      const body: Partial<StaffInput> = { fullName: f.fullName, email: f.email, role: f.role as Role, active: f.active };
      if (f.password) body.password = f.password;
      if (f.role !== 'COUNTER' && f.pin) body.pin = f.pin;
      return isNew ? staffApi.create(body as StaffInput & { password: string }) : staffApi.update((staff as Staff).id, body);
    },
    onSuccess: () => {
      toast.success('Đã lưu nhân viên');
      qc.invalidateQueries({ queryKey: key });
      onClose();
    },
    onError: (e) => {
      const err = apiError(e);
      if (err.code === 'DUPLICATE_EMAIL') setError('email', { message: err.message });
      else toast.error(err.message);
    },
  });

  const role = watch('role');
  const existing = staff && staff !== 'new' ? staff : null;
  const self = existing?.id === user?.id;
  const e = formState.errors;
  return (
    <Dialog open={!!staff} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>{isNew ? 'Thêm nhân viên' : 'Sửa nhân viên'}</DialogTitle></DialogHeader>
        <form className="grid gap-3" onSubmit={handleSubmit((f) => save.mutate(f))}>
          <Field label="Họ tên" error={e.fullName?.message}><Input autoFocus {...register('fullName')} /></Field>
          <Field label="Email đăng nhập" error={e.email?.message}><Input type="email" {...register('email')} /></Field>
          <Field label={isNew ? 'Mật khẩu' : 'Đặt lại mật khẩu (bỏ trống = giữ nguyên)'} error={e.password?.message}>
            <Input type="password" autoComplete="new-password" {...register('password')} />
          </Field>
          <Field label="Vai trò">
            <NativeSelect {...register('role')}>
              {(Object.keys(ROLE_LABEL) as Role[]).map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
            </NativeSelect>
          </Field>
          {role !== 'COUNTER' && (
            <Field
              label={existing?.hasPin ? 'Đổi PIN duyệt (bỏ trống = giữ nguyên)' : 'PIN duyệt (4–6 số)'}
              error={e.pin?.message}
            >
              <Input type="password" inputMode="numeric" maxLength={6} autoComplete="off" {...register('pin')} />
            </Field>
          )}
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" className="h-4 w-4" disabled={self} {...register('active')} /> Hoạt động (bỏ chọn = khóa tài khoản)
          </label>
          {self && <p className="text-xs text-muted-foreground">Bạn không thể tự khóa tài khoản của mình.</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Hủy</Button>
            <Button type="submit" disabled={save.isPending}>{save.isPending && <Loader2 className="animate-spin" />} Lưu</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

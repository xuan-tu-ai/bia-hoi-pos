import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { Beer, Loader2 } from 'lucide-react';
import { authApi } from '@/api/auth';
import { errorMessage } from '@/api/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Field } from '@/components/ui/label';
import { homeFor } from '@/components/layout/nav';
import { authStore, useAuth } from '@/stores/auth';

const schema = z.object({
  email: z.string().trim().min(1, 'Chưa nhập email').email('Email không hợp lệ'),
  password: z.string().min(1, 'Chưa nhập mật khẩu'),
});
type Form = z.infer<typeof schema>;

const DEMO = [
  { email: 'lan@biahoi.vn', label: 'Nhân viên quầy' },
  { email: 'hung@biahoi.vn', label: 'Quản lý ca' },
  { email: 'hoa@biahoi.vn', label: 'Chủ quán' },
];

/** FR-01 Đăng nhập bằng email + mật khẩu. */
export function LoginPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from;

  const { register, handleSubmit, setValue, formState } = useForm<Form>({ resolver: zodResolver(schema), defaultValues: { email: '', password: '' } });
  const login = useMutation({
    mutationFn: (f: Form) => authApi.login(f.email, f.password),
    onSuccess: (res) => {
      authStore.login(res.token, res.user);
      navigate(from && from !== '/login' ? from : homeFor(res.user.role), { replace: true });
    },
  });

  if (user) return <Navigate to={homeFor(user.role)} replace />;

  return (
    <div className="grid min-h-screen lg:grid-cols-[1.1fr_1fr]">
      <div className="relative hidden overflow-hidden bg-stone-900 lg:block">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(245,158,11,0.35),transparent_55%),radial-gradient(circle_at_80%_90%,rgba(180,83,9,0.45),transparent_50%)]" />
        <div className="relative flex h-full flex-col justify-between p-10 text-stone-100">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-500 text-stone-950">
              <Beer className="h-6 w-6" />
            </div>
            <span className="text-lg font-bold">Bia Hơi — Quản lý quầy</span>
          </div>
          <div className="max-w-md">
            <p className="text-3xl font-bold leading-tight">Gọi món nhanh, tính tiền đúng, biết từng lít bia đi đâu.</p>
            <p className="mt-4 text-stone-300">Sơ đồ 80 bàn, phiếu theo khu chế biến, hủy món có duyệt và báo cáo hao hụt keg.</p>
          </div>
          <p className="text-xs text-stone-500">Nhóm 7 — Quản trị dự án — ĐH Bách Khoa</p>
        </div>
      </div>

      <div className="flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <div className="mb-8 lg:hidden">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-500 text-stone-950">
              <Beer className="h-6 w-6" />
            </div>
          </div>
          <h1 className="text-2xl font-bold">Đăng nhập</h1>
          <p className="mt-1 text-sm text-muted-foreground">Dùng email và mật khẩu chủ quán cấp cho bạn.</p>

          <form className="mt-6 grid gap-4" onSubmit={handleSubmit((f) => login.mutate(f))} noValidate>
            <Field label="Email" htmlFor="email" error={formState.errors.email?.message}>
              <Input id="email" type="email" autoComplete="username" autoFocus {...register('email')} />
            </Field>
            <Field label="Mật khẩu" htmlFor="password" error={formState.errors.password?.message}>
              <Input id="password" type="password" autoComplete="current-password" {...register('password')} />
            </Field>
            {login.isError && (
              <div role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {errorMessage(login.error)}
              </div>
            )}
            <Button type="submit" size="lg" disabled={login.isPending}>
              {login.isPending && <Loader2 className="animate-spin" />} Đăng nhập
            </Button>
          </form>

          <div className="mt-8 rounded-lg border bg-muted/40 p-3 text-xs text-muted-foreground">
            <div className="mb-2 font-medium text-foreground">Tài khoản mẫu (mật khẩu 123456)</div>
            <div className="flex flex-wrap gap-2">
              {DEMO.map((d) => (
                <button
                  key={d.email}
                  type="button"
                  className="rounded-md border bg-background px-2 py-1 hover:bg-accent"
                  onClick={() => {
                    setValue('email', d.email);
                    setValue('password', '123456');
                  }}
                >
                  {d.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

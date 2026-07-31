'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { GraduationCap, Building2, School } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { apiFetch, ApiError } from '@/lib/api';
import { notifyError } from '@/lib/notify';
import { storeSession, type SessionUser } from '@/lib/auth';
import { cn } from '@/lib/utils';

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  tenantSlug: z.string().optional(),
});
type LoginForm = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const router = useRouter();
  const [asSchool, setAsSchool] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginForm>({ resolver: zodResolver(loginSchema) });

  async function onSubmit(values: LoginForm) {
    setError(null);
    try {
      const payload = asSchool ? values : { email: values.email, password: values.password };
      const data = await apiFetch<{ accessToken: string; refreshToken: string; user: SessionUser }>(
        '/auth/login',
        { method: 'POST', body: JSON.stringify(payload) },
      );
      storeSession(data.accessToken, data.refreshToken, data.user);
      router.push(data.user.realm === 'platform' ? '/dashboard' : '/school');
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Login failed';
      setError(message);
      notifyError(err, 'Login failed');
    }
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-slate-950 px-4">
      <div className="absolute inset-0 bg-gradient-to-br from-blue-950 via-slate-950 to-indigo-950" />
      <div className="pointer-events-none absolute -left-32 -top-32 h-96 w-96 rounded-full bg-blue-600/30 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-32 -right-32 h-96 w-96 rounded-full bg-violet-600/30 blur-3xl" />
      <div className="pointer-events-none absolute left-1/2 top-1/3 h-64 w-64 -translate-x-1/2 rounded-full bg-emerald-500/10 blur-3xl" />

      <div className="relative w-full max-w-sm animate-float-up">
        <div className="mb-6 flex flex-col items-center gap-3 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 shadow-lg shadow-blue-900/40">
            <GraduationCap size={28} className="text-white" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-white">School ERP</h1>
            <p className="text-sm text-slate-400">Kenyan CBC School Management Platform</p>
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.07] p-6 shadow-2xl backdrop-blur-xl">
          <div className="mb-5 flex rounded-lg bg-white/5 p-1">
            <button
              type="button"
              onClick={() => setAsSchool(false)}
              className={cn(
                'flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-all',
                !asSchool ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-300 hover:text-white',
              )}
            >
              <Building2 size={13} />
              Super Admin
            </button>
            <button
              type="button"
              onClick={() => setAsSchool(true)}
              className={cn(
                'flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-all',
                asSchool ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-300 hover:text-white',
              )}
            >
              <School size={13} />
              School
            </button>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
            {asSchool && (
              <div className="flex flex-col gap-1 animate-fade-in">
                <label className="text-xs font-medium text-slate-300">School slug</label>
                <Input
                  placeholder="greenfield-academy"
                  className="border-white/10 bg-white/5 text-white placeholder:text-slate-500 focus-visible:ring-blue-500"
                  {...register('tenantSlug')}
                />
              </div>
            )}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-slate-300">Email</label>
              <Input
                type="email"
                placeholder="you@example.com"
                className="border-white/10 bg-white/5 text-white placeholder:text-slate-500 focus-visible:ring-blue-500"
                {...register('email')}
              />
              {errors.email && <p className="text-xs text-rose-400">{errors.email.message}</p>}
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-slate-300">Password</label>
              <Input
                type="password"
                className="border-white/10 bg-white/5 text-white focus-visible:ring-blue-500"
                {...register('password')}
              />
              {errors.password && <p className="text-xs text-rose-400">{errors.password.message}</p>}
            </div>
            {error && (
              <p className="animate-fade-in rounded-md bg-rose-500/10 px-3 py-2 text-xs text-rose-300">{error}</p>
            )}
            <Button
              type="submit"
              disabled={isSubmitting}
              className="bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-400 hover:to-indigo-500"
            >
              {isSubmitting ? 'Signing in...' : 'Sign in'}
            </Button>
          </form>
        </div>
        <p className="mt-5 text-center text-xs text-slate-500">
          Multi-tenant SaaS for CBC schools — PP1 to Grade 9
        </p>
      </div>
    </main>
  );
}

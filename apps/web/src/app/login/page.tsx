'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { GraduationCap, ChevronDown, ShieldCheck } from 'lucide-react';
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

// One login form for everyone — the backend already resolves realm from what's submitted (a
// tenantSlug routes to that school's tenant schema, its absence tries the platform account), so the
// UI doesn't need to ask "which kind of account are you" up front. See AuthService.login().
export default function LoginPage() {
  const router = useRouter();
  const [showSchoolField, setShowSchoolField] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginForm>({ resolver: zodResolver(loginSchema) });

  async function onSubmit(values: LoginForm) {
    setError(null);
    try {
      const payload = { email: values.email, password: values.password, tenantSlug: values.tenantSlug || undefined };
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
    <main className="flex min-h-screen bg-[#07130f]">
      {/* Hero panel — hidden on small screens */}
      <div className="relative hidden w-1/2 flex-col justify-between overflow-hidden p-12 lg:flex">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,_#123324_0%,_#07130f_60%)]" />
        <div className="absolute inset-0 opacity-[0.04] [background-image:linear-gradient(#fff_1px,transparent_1px),linear-gradient(90deg,#fff_1px,transparent_1px)] [background-size:36px_36px]" />
        <div className="pointer-events-none absolute -left-24 top-1/3 h-80 w-80 rounded-full bg-emerald-500/20 blur-3xl" />
        <div className="pointer-events-none absolute bottom-0 right-0 h-96 w-96 rounded-full bg-amber-400/10 blur-3xl" />

        <div className="relative flex items-center gap-2.5">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-400 to-amber-400 shadow-lg shadow-emerald-900/40">
            <GraduationCap size={20} className="text-emerald-950" />
          </div>
          <span className="text-lg font-semibold text-white">School ERP</span>
        </div>

        <div className="relative">
          <h1 className="max-w-md text-4xl font-semibold leading-tight text-white">
            One place for every register, rubric and receipt.
          </h1>
          <p className="mt-6 inline-flex items-center gap-2 text-xs font-medium uppercase tracking-[0.2em] text-emerald-300/70">
            Kenyan CBC · PP1 — Grade 9
          </p>
        </div>
      </div>

      {/* Sign-in panel */}
      <div className="flex w-full flex-col justify-center px-6 py-12 lg:w-1/2 lg:px-16 xl:px-24">
        <div className="mx-auto w-full max-w-sm">
          <div className="mb-8 flex items-center gap-2.5 lg:hidden">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-400 to-amber-400 shadow-lg shadow-emerald-900/40">
              <GraduationCap size={20} className="text-emerald-950" />
            </div>
            <span className="text-lg font-semibold text-white">School ERP</span>
          </div>

          <h2 className="text-2xl font-semibold text-white">Sign in</h2>
          <p className="mt-1.5 text-sm text-slate-400">Enter your details to access your dashboard.</p>

          <form onSubmit={handleSubmit(onSubmit)} className="mt-8 flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium uppercase tracking-wide text-slate-400">Email</label>
              <Input
                type="email"
                placeholder="you@school.ac.ke"
                className="h-11 border-white/10 bg-white/5 text-white placeholder:text-slate-500 focus-visible:ring-emerald-500"
                {...register('email')}
              />
              {errors.email && <p className="text-xs text-rose-400">{errors.email.message}</p>}
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium uppercase tracking-wide text-slate-400">Password</label>
              <Input
                type="password"
                className="h-11 border-white/10 bg-white/5 text-white focus-visible:ring-emerald-500"
                {...register('password')}
              />
              {errors.password && <p className="text-xs text-rose-400">{errors.password.message}</p>}
            </div>

            <button
              type="button"
              onClick={() => setShowSchoolField((v) => !v)}
              className="flex items-center gap-1 self-start text-xs text-slate-400 hover:text-slate-200"
            >
              <ChevronDown size={13} className={cn('transition-transform', showSchoolField && 'rotate-180')} />
              Signing in to a specific school?
            </button>
            {showSchoolField && (
              <div className="flex flex-col gap-1.5 animate-fade-in">
                <label className="text-xs font-medium uppercase tracking-wide text-slate-400">School slug</label>
                <Input
                  placeholder="greenfield-academy"
                  className="h-11 border-white/10 bg-white/5 text-white placeholder:text-slate-500 focus-visible:ring-emerald-500"
                  {...register('tenantSlug')}
                />
              </div>
            )}

            {error && (
              <p className="animate-fade-in rounded-md bg-rose-500/10 px-3 py-2 text-xs text-rose-300">{error}</p>
            )}
            <Button
              type="submit"
              disabled={isSubmitting}
              className="h-11 bg-gradient-to-r from-emerald-500 to-amber-400 font-medium text-emerald-950 hover:from-emerald-400 hover:to-amber-300"
            >
              {isSubmitting ? 'Signing in...' : 'Sign in'}
            </Button>
          </form>

          <div className="mt-8 flex items-center justify-center gap-1.5 text-xs text-slate-500">
            <ShieldCheck size={13} className="text-emerald-500/70" />
            Multi-tenant SaaS for CBC schools — PP1 to Grade 9
          </div>
        </div>
      </div>
    </main>
  );
}

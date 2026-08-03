'use client';

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Eye, EyeOff, GraduationCap, Loader2, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { apiFetch, ApiError, API_ORIGIN } from '@/lib/api';
import { notifyError } from '@/lib/notify';
import { storeSession, type SessionUser } from '@/lib/auth';
import { usePageTransition } from '@/lib/page-transition';
import { cn } from '@/lib/utils';

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});
type LoginForm = z.infer<typeof loginSchema>;

interface Branding {
  systemName: string;
  loginTagline: string | null;
  loginSubtitle: string | null;
  loginLogoUrl: string | null;
  loginHeading: string | null;
  loginHelperText: string | null;
  loginFooterText: string | null;
}
const DEFAULT_BRANDING: Branding = {
  systemName: 'School ERP',
  loginTagline: null,
  loginSubtitle: 'Kenyan CBC · PP1 — Grade 9',
  loginLogoUrl: null,
  loginHeading: 'Sign in',
  loginHelperText: 'Enter your details to access your dashboard.',
  loginFooterText: 'Multi-tenant SaaS for CBC schools — PP1 to Grade 9',
};

// One login form for everyone — the backend resolves which school (if any) an email belongs to via
// the platform-wide user directory, so the UI never needs to ask for a school slug. See
// AuthService.login().
export default function LoginPage() {
  const { navigate } = usePageTransition();
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  // "success" holds the form on a settled, non-interactive state while the redirect happens, so
  // the page doesn't jump straight from a spinner to a hard navigation — see onSubmit below.
  const [success, setSuccess] = useState(false);
  const [branding, setBranding] = useState<Branding>(DEFAULT_BRANDING);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginForm>({ resolver: zodResolver(loginSchema), mode: 'onBlur' });

  // Body defaults to a light background (see app/layout.tsx) for the rest of the app's light-themed
  // pages; synced here so client-side navigation to/from this dark page never shows a flash of the
  // light body color underneath before this page's own background paints.
  useEffect(() => {
    const prev = document.body.style.backgroundColor;
    document.body.style.backgroundColor = '#07130f';
    return () => {
      document.body.style.backgroundColor = prev;
    };
  }, []);

  // Platform-wide branding only (never per-school) — falls back to the default while loading/on
  // error so the page never flashes blank. See BrandingController / PlatformSettings.systemName.
  useEffect(() => {
    apiFetch<Branding>('/public/branding')
      .then(setBranding)
      .catch(() => undefined);
  }, []);

  async function onSubmit(values: LoginForm) {
    setError(null);
    try {
      const payload = { email: values.email, password: values.password };
      const data = await apiFetch<{ accessToken: string; refreshToken: string; user: SessionUser }>(
        '/auth/login',
        { method: 'POST', body: JSON.stringify(payload) },
      );
      storeSession(data.accessToken, data.refreshToken, data.user);
      setSuccess(true);
      navigate(data.user.realm === 'platform' ? '/dashboard' : '/school', { color: '#f8fafc' });
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Login failed';
      setError(message);
      notifyError(err, 'Login failed');
    }
  }

  const busy = isSubmitting || success;

  return (
    <main className="flex min-h-screen bg-[#07130f]">
      {/* Hero panel — hidden on small screens */}
      <div className="relative hidden w-1/2 flex-col justify-between overflow-hidden p-12 lg:flex">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,_#123324_0%,_#07130f_60%)]" />
        <div className="absolute inset-0 opacity-[0.04] [background-image:linear-gradient(#fff_1px,transparent_1px),linear-gradient(90deg,#fff_1px,transparent_1px)] [background-size:36px_36px]" />
        <div className="pointer-events-none absolute -left-24 top-1/3 h-80 w-80 rounded-full bg-emerald-500/20 blur-3xl" />
        <div className="pointer-events-none absolute bottom-0 right-0 h-96 w-96 rounded-full bg-amber-400/10 blur-3xl" />

        <div className="animate-float-up relative flex items-center gap-2.5">
          <LoginLogo url={branding.loginLogoUrl} />
          <span className="text-lg font-semibold text-white">{branding.systemName}</span>
        </div>

        <div className="animate-float-up relative" style={{ animationDelay: '80ms' }}>
          <h1 className="max-w-md text-4xl font-semibold leading-tight text-white">
            {branding.loginTagline || 'One place for every register, rubric and receipt.'}
          </h1>
          <p className="mt-6 inline-flex items-center gap-2 text-xs font-medium uppercase tracking-[0.2em] text-emerald-300/70">
            {branding.loginSubtitle || 'Kenyan CBC · PP1 — Grade 9'}
          </p>
        </div>
      </div>

      {/* Sign-in panel */}
      <div className="flex w-full flex-col justify-center px-6 py-12 lg:w-1/2 lg:px-16 xl:px-24">
        <div className="animate-float-up mx-auto w-full max-w-sm">
          <div className="mb-8 flex items-center gap-2.5 lg:hidden">
            <LoginLogo url={branding.loginLogoUrl} />
            <span className="text-lg font-semibold text-white">{branding.systemName}</span>
          </div>

          <h2 className="text-2xl font-semibold text-white">{branding.loginHeading || DEFAULT_BRANDING.loginHeading}</h2>
          <p className="mt-1.5 text-sm text-slate-400">{branding.loginHelperText || DEFAULT_BRANDING.loginHelperText}</p>

          <form onSubmit={handleSubmit(onSubmit)} className="mt-8 flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium uppercase tracking-wide text-slate-400">Email</label>
              <Input
                type="email"
                placeholder="you@school.ac.ke"
                disabled={busy}
                className="h-11 border-white/10 bg-white/5 text-white placeholder:text-slate-500 transition-colors focus-visible:ring-emerald-500"
                {...register('email')}
              />
              <p className={cn('text-xs text-rose-400 transition-opacity', errors.email ? 'opacity-100' : 'h-0 opacity-0')}>
                {errors.email?.message ?? ' '}
              </p>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium uppercase tracking-wide text-slate-400">Password</label>
              <div className="relative">
                <Input
                  type={showPassword ? 'text' : 'password'}
                  disabled={busy}
                  className="h-11 border-white/10 bg-white/5 pr-10 text-white transition-colors focus-visible:ring-emerald-500"
                  {...register('password')}
                />
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="absolute right-0 top-0 flex h-11 w-10 items-center justify-center text-slate-500 transition-colors hover:text-slate-300"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              <p className={cn('text-xs text-rose-400 transition-opacity', errors.password ? 'opacity-100' : 'h-0 opacity-0')}>
                {errors.password?.message ?? ' '}
              </p>
            </div>

            <div
              className={cn(
                'grid overflow-hidden transition-all duration-200 ease-out',
                error ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0',
              )}
            >
              <p className="min-h-0 rounded-md bg-rose-500/10 px-3 py-2 text-xs text-rose-300">{error}</p>
            </div>

            <Button
              type="submit"
              disabled={busy}
              className="h-11 bg-gradient-to-r from-emerald-500 to-amber-400 font-medium text-emerald-950 transition-all hover:from-emerald-400 hover:to-amber-300 disabled:opacity-80"
            >
              {busy ? (
                <span className="inline-flex items-center gap-2">
                  <Loader2 size={16} className="animate-spin" />
                  {success ? 'Redirecting...' : 'Signing in...'}
                </span>
              ) : (
                'Sign in'
              )}
            </Button>
          </form>

          <div className="mt-8 flex items-center justify-center gap-1.5 text-center text-xs text-slate-500">
            <ShieldCheck size={13} className="shrink-0 text-emerald-500/70" />
            {branding.loginFooterText || DEFAULT_BRANDING.loginFooterText}
          </div>
        </div>
      </div>
    </main>
  );
}

/** Renders the Super-Admin-uploaded login logo when set, else the built-in gradient mark — same
 * "placeholder as default suggestion" fallback used everywhere else branding is configurable. */
function LoginLogo({ url }: { url: string | null }) {
  if (url) {
    const src = url.startsWith('http') ? url : `${API_ORIGIN}${url}`;
    // eslint-disable-next-line @next/next/no-img-element -- external/uploaded URL, not a static asset
    return <img src={src} alt="" className="h-10 w-10 rounded-xl object-cover shadow-lg shadow-emerald-900/40" />;
  }
  return (
    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-400 to-amber-400 shadow-lg shadow-emerald-900/40">
      <GraduationCap size={20} className="text-emerald-950" />
    </div>
  );
}

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { apiFetch, ApiError } from '@/lib/api';
import { storeSession, type SessionUser } from '@/lib/auth';

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
      setError(err instanceof ApiError ? err.message : 'Login failed');
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>School ERP</CardTitle>
          <CardDescription>
            {asSchool ? 'Sign in to your school account' : 'Platform Super Admin sign-in'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
            {asSchool && (
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-slate-700">School slug</label>
                <Input placeholder="greenfield-academy" {...register('tenantSlug')} />
              </div>
            )}
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-slate-700">Email</label>
              <Input type="email" placeholder="you@example.com" {...register('email')} />
              {errors.email && <p className="text-xs text-red-600">{errors.email.message}</p>}
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-slate-700">Password</label>
              <Input type="password" {...register('password')} />
              {errors.password && <p className="text-xs text-red-600">{errors.password.message}</p>}
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Signing in...' : 'Sign in'}
            </Button>
            <button
              type="button"
              onClick={() => setAsSchool((v) => !v)}
              className="text-xs text-slate-500 underline underline-offset-2"
            >
              {asSchool ? 'Sign in as platform Super Admin instead' : 'Sign in to a school instead'}
            </button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}

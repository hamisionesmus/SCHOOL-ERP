'use client';

import { useEffect, useState } from 'react';
import { BookOpen, ExternalLink, GraduationCap, LogOut, Loader2 } from 'lucide-react';
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ApiError, API_ORIGIN } from '@/lib/api';

const TOKEN_KEY = 'school-erp:trainee-token';

interface TraineeMe {
  id: string;
  fullName: string;
  gender: string;
  portalEmail: string;
  program: { id: string; title: string; track: string; startDate: string; endDate: string; status: string };
}

interface TraineeProgress {
  totalSessions: number;
  present: number;
  absent: number;
  attendancePct: number | null;
  history: { date: string; present: boolean; topicsCovered: string | null; hadTrainingToday: boolean }[];
}

interface TraineeDocument {
  id: string;
  title: string;
  category: string | null;
  fileUrl: string;
  createdAt: string;
}

async function traineeFetch<T>(path: string): Promise<T> {
  const token = localStorage.getItem(TOKEN_KEY);
  const res = await fetch(`${API_ORIGIN}${path}`, { headers: token ? { Authorization: `Bearer ${token}` } : undefined });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ message: res.statusText }));
    throw new ApiError(res.status, body.message ?? 'Request failed');
  }
  return res.json();
}

// A lightweight self-service portal for adult (20+) trainees — see TraineePortalService on the API
// side. Uses its own token, entirely separate from the platform/tenant session.
export default function TraineePortalPage() {
  const [loggedIn, setLoggedIn] = useState(false);
  const [checking, setChecking] = useState(true);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loggingIn, setLoggingIn] = useState(false);

  const [me, setMe] = useState<TraineeMe | null>(null);
  const [progress, setProgress] = useState<TraineeProgress | null>(null);
  const [materials, setMaterials] = useState<TraineeDocument[] | null>(null);
  const [loadingData, setLoadingData] = useState(false);

  useEffect(() => {
    if (localStorage.getItem(TOKEN_KEY)) {
      setLoggedIn(true);
      loadAll();
    }
    setChecking(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadAll() {
    setLoadingData(true);
    try {
      const [meData, progressData, materialsData] = await Promise.all([
        traineeFetch<TraineeMe>('/trainee-portal/me'),
        traineeFetch<TraineeProgress>('/trainee-portal/progress'),
        traineeFetch<TraineeDocument[]>('/trainee-portal/materials'),
      ]);
      setMe(meData);
      setProgress(progressData);
      setMaterials(materialsData);
    } catch {
      localStorage.removeItem(TOKEN_KEY);
      setLoggedIn(false);
    } finally {
      setLoadingData(false);
    }
  }

  async function onLogin() {
    setLoginError(null);
    setLoggingIn(true);
    try {
      const res = await fetch(`${API_ORIGIN}/trainee-portal/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({ message: 'Login failed' }));
        throw new Error(body.message ?? 'Login failed');
      }
      const data: { accessToken: string } = await res.json();
      localStorage.setItem(TOKEN_KEY, data.accessToken);
      setLoggedIn(true);
      await loadAll();
    } catch (err) {
      setLoginError(err instanceof Error ? err.message : 'Could not sign in.');
    } finally {
      setLoggingIn(false);
    }
  }

  function logout() {
    localStorage.removeItem(TOKEN_KEY);
    setLoggedIn(false);
    setMe(null);
    setProgress(null);
    setMaterials(null);
  }

  const chartData = progress ? [{ name: 'Attendance', present: progress.present, absent: progress.absent }] : [];

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#07130f] px-4 py-10 sm:px-6">
      <div className="relative w-full max-w-xl overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] p-6 sm:p-8">
        <div className="pointer-events-none absolute -left-16 -top-16 h-56 w-56 rounded-full bg-emerald-500/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-16 -right-16 h-56 w-56 rounded-full bg-amber-400/10 blur-3xl" />

        <div className="relative mb-6 flex items-center justify-between gap-2.5">
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-400 to-amber-400 shadow-lg shadow-emerald-900/40">
              <GraduationCap size={20} className="text-emerald-950" />
            </div>
            <span className="text-lg font-semibold text-white">My Training Portal</span>
          </div>
          {loggedIn && (
            <button onClick={logout} className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-white">
              <LogOut size={13} /> Sign out
            </button>
          )}
        </div>

        <div className="relative">
          {checking ? null : !loggedIn ? (
            <div className="py-2">
              <h2 className="text-xl font-semibold text-white">Sign in</h2>
              <p className="mt-1 text-sm text-slate-400">Use the email and password given to you by your trainer.</p>

              <div className="mt-5 flex flex-col gap-3">
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Email"
                  className="h-11 border-white/10 bg-white/5 text-white placeholder:text-slate-500 focus-visible:ring-emerald-500"
                />
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Password"
                  className="h-11 border-white/10 bg-white/5 text-white placeholder:text-slate-500 focus-visible:ring-emerald-500"
                />
                {loginError && <p className="text-xs text-rose-400">{loginError}</p>}
                <Button
                  disabled={!email || !password || loggingIn}
                  onClick={onLogin}
                  className="h-11 w-full bg-gradient-to-r from-emerald-500 to-amber-400 font-medium text-emerald-950 hover:from-emerald-400 hover:to-amber-300 disabled:opacity-80"
                >
                  {loggingIn ? 'Signing in…' : 'Sign in'}
                </Button>
              </div>
            </div>
          ) : loadingData || !me || !progress ? (
            <div className="flex flex-col items-center gap-3 py-10 text-slate-400">
              <Loader2 size={24} className="animate-spin" />
              <p className="text-sm">Loading…</p>
            </div>
          ) : (
            <div className="py-1">
              <h2 className="text-xl font-semibold text-white">Hi, {me.fullName}</h2>
              <p className="mt-1 text-sm text-slate-400">
                {me.program.title} · {me.program.track.replace(/_/g, ' ')}
              </p>

              <div className="mt-5 grid grid-cols-3 gap-3">
                <div className="rounded-lg border border-white/10 bg-white/5 p-3 text-center">
                  <p className="text-2xl font-semibold text-white">{progress.attendancePct ?? '—'}%</p>
                  <p className="text-xs text-slate-400">Attendance</p>
                </div>
                <div className="rounded-lg border border-white/10 bg-white/5 p-3 text-center">
                  <p className="text-2xl font-semibold text-emerald-400">{progress.present}</p>
                  <p className="text-xs text-slate-400">Present</p>
                </div>
                <div className="rounded-lg border border-white/10 bg-white/5 p-3 text-center">
                  <p className="text-2xl font-semibold text-rose-400">{progress.absent}</p>
                  <p className="text-xs text-slate-400">Absent</p>
                </div>
              </div>

              {progress.totalSessions > 0 && (
                <div className="mt-4 h-32 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} layout="vertical">
                      <XAxis type="number" hide />
                      <YAxis type="category" dataKey="name" hide />
                      <Tooltip contentStyle={{ background: '#0b1a15', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, fontSize: 12 }} />
                      <Bar dataKey="present" stackId="a" fill="#34d399" radius={[6, 0, 0, 6]} />
                      <Bar dataKey="absent" stackId="a" fill="#fb7185" radius={[0, 6, 6, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}

              <h3 className="mt-6 text-sm font-semibold text-white">Learning materials</h3>
              {!materials || materials.length === 0 ? (
                <p className="mt-2 text-sm text-slate-500">No materials shared yet.</p>
              ) : (
                <div className="mt-2 flex flex-col gap-1.5">
                  {materials.map((m) => (
                    <a
                      key={m.id}
                      href={`${API_ORIGIN}${m.fileUrl}`}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center justify-between rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-slate-200 hover:bg-white/10"
                    >
                      <span className="inline-flex items-center gap-2">
                        <BookOpen size={14} className="text-emerald-400" /> {m.title}
                      </span>
                      <ExternalLink size={13} className="text-slate-500" />
                    </a>
                  ))}
                </div>
              )}

              <h3 className="mt-6 text-sm font-semibold text-white">Recent sessions</h3>
              <div className="mt-2 flex flex-col gap-1.5">
                {progress.history.slice(0, 8).map((h, i) => (
                  <div key={i} className="flex items-center justify-between rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2 text-xs text-slate-300">
                    <span>{new Date(h.date).toLocaleDateString()}</span>
                    <span className={h.hadTrainingToday ? (h.present ? 'text-emerald-400' : 'text-rose-400') : 'text-slate-500'}>
                      {h.hadTrainingToday ? (h.present ? 'Present' : 'Absent') : 'No training'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

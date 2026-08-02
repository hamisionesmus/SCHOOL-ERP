'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { GraduationCap, Loader2, Star, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { apiFetch, ApiError } from '@/lib/api';
import { cn } from '@/lib/utils';

interface SchoolInfo {
  schoolName: string;
}

// Public, unauthenticated — reached from the survey link in a demo-expiry reminder. See
// FeedbackController on the API side.
export default function FeedbackPage() {
  const params = useParams<{ token: string }>();
  const token = params.token;

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [info, setInfo] = useState<SchoolInfo | null>(null);

  const [rating, setRating] = useState(0);
  const [improvements, setImprovements] = useState('');
  const [interested, setInterested] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<SchoolInfo>(`/public/feedback/${token}`)
      .then(setInfo)
      .catch((err) => setLoadError(err instanceof ApiError ? err.message : 'This survey link could not be loaded.'))
      .finally(() => setLoading(false));
  }, [token]);

  async function onSubmit() {
    setSubmitError(null);
    setSubmitting(true);
    try {
      await apiFetch(`/public/feedback/${token}`, {
        method: 'POST',
        body: JSON.stringify({
          rating: rating || undefined,
          improvements: improvements || undefined,
          interestedInRealAccount: interested,
        }),
      });
      setSubmitted(true);
    } catch (err) {
      setSubmitError(err instanceof ApiError ? err.message : 'Could not submit your feedback. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#07130f] px-4 py-12 sm:px-6">
      <div className="relative w-full max-w-md overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] p-6 sm:p-8">
        <div className="pointer-events-none absolute -left-16 -top-16 h-56 w-56 rounded-full bg-emerald-500/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-16 -right-16 h-56 w-56 rounded-full bg-amber-400/10 blur-3xl" />

        <div className="relative mb-6 flex items-center gap-2.5">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-400 to-amber-400 shadow-lg shadow-emerald-900/40">
            <GraduationCap size={20} className="text-emerald-950" />
          </div>
          <span className="text-lg font-semibold text-white">School ERP</span>
        </div>

        <div className="relative">
          {loading && (
            <div className="flex flex-col items-center gap-3 py-10 text-slate-400">
              <Loader2 size={24} className="animate-spin" />
              <p className="text-sm">Loading…</p>
            </div>
          )}

          {!loading && loadError && (
            <div className="py-6">
              <h2 className="text-xl font-semibold text-white">Link not valid</h2>
              <p className="mt-2 text-sm text-slate-400">{loadError}</p>
            </div>
          )}

          {!loading && !loadError && info && (
            submitted ? (
              <div className="py-6">
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/15">
                  <ShieldCheck size={24} className="text-emerald-400" />
                </div>
                <h2 className="text-xl font-semibold text-white">Thank you!</h2>
                <p className="mt-2 text-sm text-slate-400">
                  Your feedback on {info.schoolName} has been recorded. We really appreciate it.
                </p>
              </div>
            ) : (
              <div className="py-2">
                <h2 className="text-xl font-semibold text-white">How was your demo?</h2>
                <p className="mt-1.5 text-sm text-slate-400">
                  A minute of your time on {info.schoolName} — it really helps us improve.
                </p>

                <div className="mt-5 flex flex-col gap-1.5">
                  <label className="text-xs font-medium uppercase tracking-wide text-slate-400">Rating</label>
                  <div className="flex gap-1">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <button
                        key={n}
                        type="button"
                        onClick={() => setRating(n)}
                        aria-label={`Rate ${n} out of 5`}
                        className="p-1"
                      >
                        <Star
                          size={26}
                          className={cn(
                            'transition-colors',
                            n <= rating ? 'fill-amber-400 text-amber-400' : 'text-slate-600',
                          )}
                        />
                      </button>
                    ))}
                  </div>
                </div>

                <div className="mt-4 flex flex-col gap-1.5">
                  <label className="text-xs font-medium uppercase tracking-wide text-slate-400">
                    What could be better?
                  </label>
                  <textarea
                    value={improvements}
                    onChange={(e) => setImprovements(e.target.value)}
                    rows={3}
                    placeholder="Optional — anything you'd improve"
                    className="rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
                  />
                </div>

                <label className="mt-4 flex items-center gap-2 text-sm text-slate-300">
                  <input
                    type="checkbox"
                    checked={interested}
                    onChange={(e) => setInterested(e.target.checked)}
                    className="h-4 w-4 rounded border-white/20 bg-white/5"
                  />
                  I&apos;m interested in getting a real account
                </label>

                {submitError && (
                  <p className="mt-3 rounded-md bg-rose-500/10 px-3 py-2 text-xs text-rose-300">{submitError}</p>
                )}

                <Button
                  disabled={submitting}
                  onClick={onSubmit}
                  className="mt-5 h-11 w-full bg-gradient-to-r from-emerald-500 to-amber-400 font-medium text-emerald-950 hover:from-emerald-400 hover:to-amber-300 disabled:opacity-80"
                >
                  {submitting ? (
                    <span className="inline-flex items-center gap-2">
                      <Loader2 size={16} className="animate-spin" />
                      Submitting…
                    </span>
                  ) : (
                    'Submit feedback'
                  )}
                </Button>
              </div>
            )
          )}
        </div>
      </div>
    </main>
  );
}

'use client';

import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { AlertCircle, CheckCircle2, Clock, GraduationCap, ListChecks, Loader2, ShieldCheck, Users, Video } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { apiFetch, ApiError } from '@/lib/api';

interface RosterPerson {
  name: string | null;
  position: string | null;
}

interface JoinInfo {
  title: string;
  description: string | null;
  agenda: string[];
  scheduledAt: string;
  meetingLink: string | null;
  organizerName: string;
  ended: boolean;
  hasStarted: boolean;
  roster: RosterPerson[];
  invitedEmailMatched: boolean;
  alreadyJoined: boolean;
  alreadyRespondedAbsence: boolean;
}

// Entirely public — reached from the personalized join link every invitee gets in their invite
// email/SMS, no login required. Before the meeting: opening it with the email the invite was sent to
// marks the visitor present automatically (see HamzoneMeetingsService.recordJoin) — the link only
// becomes functional once the scheduled time actually arrives, so opening it early can't count. After
// the host ends the meeting: anyone recorded absent gets a 30-minute window here to either confirm the
// email they actually joined with, or give a reason.
export default function MeetingJoinPage() {
  const params = useParams<{ token: string }>();
  const token = params.token;
  const searchParams = useSearchParams();

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [info, setInfo] = useState<JoinInfo | null>(null);
  const [email, setEmail] = useState(searchParams.get('email') ?? '');
  const [joining, setJoining] = useState(false);
  const [joined, setJoined] = useState(false);
  const [matched, setMatched] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);

  const [giveReason, setGiveReason] = useState(false);
  const [reason, setReason] = useState('');
  const [submittingReason, setSubmittingReason] = useState(false);
  const [reasonSubmitted, setReasonSubmitted] = useState(false);
  const [reasonError, setReasonError] = useState<string | null>(null);

  function load() {
    const currentEmail = email.trim();
    return apiFetch<JoinInfo>(`/public/meetings/join/${token}${currentEmail ? `?email=${encodeURIComponent(currentEmail)}` : ''}`)
      .then((data) => {
        setInfo(data);
        if (data.alreadyJoined) setJoined(true);
        if (data.alreadyRespondedAbsence) setReasonSubmitted(true);
        return data;
      })
      .catch((err) => {
        setLoadError(err instanceof ApiError ? err.message : 'This link could not be loaded.');
        return null;
      });
  }

  useEffect(() => {
    load().finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  async function join() {
    setJoinError(null);
    if (!email.trim()) {
      setJoinError('Enter the email address you were invited with');
      return;
    }
    setJoining(true);
    try {
      const res = await apiFetch<{ joined: boolean; matched: boolean; meetingLink: string | null }>(`/public/meetings/join/${token}`, {
        method: 'POST',
        body: JSON.stringify({ email: email.trim() }),
      });
      setJoined(true);
      setMatched(res.matched);
    } catch (err) {
      setJoinError(err instanceof ApiError ? err.message : 'Could not join — please try again.');
    } finally {
      setJoining(false);
    }
  }

  async function submitReason() {
    setReasonError(null);
    if (!email.trim()) {
      setReasonError('Enter the email address you were invited with');
      return;
    }
    if (!reason.trim()) {
      setReasonError('Give a short reason');
      return;
    }
    setSubmittingReason(true);
    try {
      await apiFetch(`/public/meetings/join/${token}/absence-reason`, {
        method: 'POST',
        body: JSON.stringify({ email: email.trim(), reason: reason.trim() }),
      });
      setReasonSubmitted(true);
    } catch (err) {
      setReasonError(err instanceof ApiError ? err.message : 'Could not submit — please try again.');
    } finally {
      setSubmittingReason(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#07130f] px-4 py-10 sm:px-6">
      <div className="relative w-full max-w-lg overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] p-6 sm:p-8">
        <div className="pointer-events-none absolute -left-16 -top-16 h-56 w-56 rounded-full bg-emerald-500/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-16 -right-16 h-56 w-56 rounded-full bg-amber-400/10 blur-3xl" />

        <div className="relative mb-6 flex items-center gap-2.5">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-400 to-amber-400 shadow-lg shadow-emerald-900/40">
            <GraduationCap size={20} className="text-emerald-950" />
          </div>
          <span className="text-lg font-semibold text-white">Hamzone Technologies — Meeting</span>
        </div>

        <div className="relative">
          {loading && (
            <div className="flex flex-col items-center gap-3 py-10 text-slate-400">
              <Loader2 size={24} className="animate-spin" />
              <p className="text-sm">Loading...</p>
            </div>
          )}

          {!loading && loadError && (
            <div className="py-6">
              <h2 className="text-xl font-semibold text-white">Link not valid</h2>
              <p className="mt-2 text-sm text-slate-400">{loadError}</p>
            </div>
          )}

          {!loading && !loadError && info && (
            <div className="py-1">
              <h2 className="text-xl font-semibold text-white">{info.title}</h2>
              <p className="mt-1 text-sm text-slate-400">
                {new Date(info.scheduledAt).toLocaleString()} · organized by {info.organizerName}
              </p>
              {info.description && <p className="mt-3 text-sm text-slate-300">{info.description}</p>}

              {info.agenda.length > 0 && (
                <div className="mt-4">
                  <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-slate-400">
                    <ListChecks size={13} /> Agenda
                  </p>
                  <ol className="mt-1.5 list-decimal space-y-1 pl-5 text-sm text-slate-300">
                    {info.agenda.map((item, i) => (
                      <li key={i}>{item}</li>
                    ))}
                  </ol>
                </div>
              )}

              {info.roster.length > 0 && (
                <div className="mt-4">
                  <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-slate-400">
                    <Users size={13} /> Who else to expect
                  </p>
                  <ul className="mt-1.5 space-y-0.5 text-sm text-slate-300">
                    {info.roster.map((p, i) => (
                      <li key={i}>
                        {p.name ?? 'Unnamed'}
                        {p.position && <span className="text-slate-500"> — {p.position}</span>}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Pre-meeting / during-meeting: not ended yet */}
              {!info.ended && !joined && (
                <div className="mt-5">
                  {!info.hasStarted ? (
                    <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-300">
                      <p className="inline-flex items-center gap-1.5 font-medium">
                        <Clock size={14} /> This meeting hasn&apos;t started yet
                      </p>
                      <p className="mt-1 text-xs text-amber-300/80">
                        The join link becomes active at {new Date(info.scheduledAt).toLocaleString()}. Come back then to be marked present.
                      </p>
                    </div>
                  ) : (
                    <>
                      <label className="text-xs font-medium uppercase tracking-wide text-slate-400">Your email</label>
                      <p className="mt-1 text-xs text-slate-500">
                        Use the exact email address this meeting was sent to, so you&apos;re marked present automatically.
                      </p>
                      <Input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="you@example.com"
                        className="mt-2 h-11 border-white/10 bg-white/5 text-white placeholder:text-slate-500 focus-visible:ring-emerald-500"
                      />
                      {joinError && <p className="mt-2 text-xs text-rose-400">{joinError}</p>}
                      <Button
                        disabled={joining}
                        onClick={join}
                        className="mt-3 h-11 w-full bg-gradient-to-r from-emerald-500 to-amber-400 font-medium text-emerald-950 hover:from-emerald-400 hover:to-amber-300 disabled:opacity-80"
                      >
                        {joining ? 'Joining...' : 'Join meeting'}
                      </Button>
                    </>
                  )}
                </div>
              )}

              {/* Present, either path */}
              {joined && (
                <div className="mt-5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-4">
                  <p className="inline-flex items-center gap-1.5 text-sm font-medium text-emerald-300">
                    <CheckCircle2 size={16} />
                    {matched || info.invitedEmailMatched ? "You're marked present." : "You're in — this email wasn't on the invite list, so it's noted separately."}
                  </p>
                  {info.meetingLink ? (
                    <a href={info.meetingLink} target="_blank" rel="noreferrer" className="mt-3 block">
                      <Button className="h-11 w-full gap-1.5 bg-gradient-to-r from-emerald-500 to-amber-400 font-medium text-emerald-950 hover:from-emerald-400 hover:to-amber-300">
                        <Video size={15} /> Open meeting link
                      </Button>
                    </a>
                  ) : (
                    <p className="mt-2 text-xs text-slate-400">No external link was set for this meeting — check the meeting details in-app.</p>
                  )}
                </div>
              )}

              {/* Post-meeting follow-up: recorded absent, hasn't responded either way */}
              {info.ended && !joined && !reasonSubmitted && (
                <div className="mt-5">
                  <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-300">
                    <p className="inline-flex items-center gap-1.5 font-medium">
                      <AlertCircle size={14} /> You were recorded absent for this meeting
                    </p>
                    <p className="mt-1 text-xs text-rose-300/80">
                      This link expires in 30 minutes — please respond now, since the meeting minutes are being finalized. If we don&apos;t
                      hear back in time, you&apos;ll remain marked absent.
                    </p>
                  </div>

                  {!giveReason ? (
                    <div className="mt-4">
                      <label className="text-xs font-medium uppercase tracking-wide text-slate-400">Did you actually attend?</label>
                      <p className="mt-1 text-xs text-slate-500">Confirm the email you joined with and we&apos;ll mark you present.</p>
                      <Input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="you@example.com"
                        className="mt-2 h-11 border-white/10 bg-white/5 text-white placeholder:text-slate-500 focus-visible:ring-emerald-500"
                      />
                      {joinError && <p className="mt-2 text-xs text-rose-400">{joinError}</p>}
                      <Button
                        disabled={joining}
                        onClick={join}
                        className="mt-3 h-11 w-full bg-gradient-to-r from-emerald-500 to-amber-400 font-medium text-emerald-950 hover:from-emerald-400 hover:to-amber-300 disabled:opacity-80"
                      >
                        {joining ? 'Checking...' : "Yes — I attended, mark me present"}
                      </Button>
                      <button
                        type="button"
                        onClick={() => setGiveReason(true)}
                        className="mt-3 w-full text-center text-xs font-medium text-slate-400 underline hover:text-slate-300"
                      >
                        No — I wasn&apos;t able to attend, let me give a reason
                      </button>
                    </div>
                  ) : (
                    <div className="mt-4">
                      <label className="text-xs font-medium uppercase tracking-wide text-slate-400">Your email</label>
                      <Input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="you@example.com"
                        className="mt-1.5 h-11 border-white/10 bg-white/5 text-white placeholder:text-slate-500 focus-visible:ring-emerald-500"
                      />
                      <label className="mt-3 block text-xs font-medium uppercase tracking-wide text-slate-400">Why weren&apos;t you able to attend?</label>
                      <textarea
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        rows={3}
                        placeholder="Give a short reason..."
                        className="mt-1.5 w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
                      />
                      {reasonError && <p className="mt-2 text-xs text-rose-400">{reasonError}</p>}
                      <Button
                        disabled={submittingReason}
                        onClick={submitReason}
                        className="mt-3 h-11 w-full bg-gradient-to-r from-emerald-500 to-amber-400 font-medium text-emerald-950 hover:from-emerald-400 hover:to-amber-300 disabled:opacity-80"
                      >
                        {submittingReason ? 'Submitting...' : 'Submit reason'}
                      </Button>
                      <button type="button" onClick={() => setGiveReason(false)} className="mt-2 w-full text-center text-xs font-medium text-slate-400 underline hover:text-slate-300">
                        Actually, I did attend
                      </button>
                    </div>
                  )}
                </div>
              )}

              {info.ended && !joined && reasonSubmitted && (
                <div className="mt-5 rounded-lg border border-white/10 bg-white/5 p-4">
                  <p className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-200">
                    <CheckCircle2 size={16} /> Thanks — we&apos;ve recorded your reason for missing this meeting.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setReasonSubmitted(false);
                      setGiveReason(false);
                    }}
                    className="mt-2 text-xs font-medium text-slate-400 underline hover:text-slate-300"
                  >
                    Actually, I did attend — let me confirm
                  </button>
                </div>
              )}

              <p className="mt-6 inline-flex items-center gap-1.5 text-xs text-slate-500">
                <ShieldCheck size={13} /> This link is tied to this meeting only and works for anyone it was shared with.
              </p>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

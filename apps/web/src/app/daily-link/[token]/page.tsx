'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Camera, CheckCircle2, GraduationCap, Loader2, Plus, ShieldCheck, Trash2, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { apiFetch, ApiError, API_ORIGIN } from '@/lib/api';
import { cn } from '@/lib/utils';

const GENDERS = ['MALE', 'FEMALE', 'OTHER'] as const;
type Gender = (typeof GENDERS)[number];

interface RosterEntry {
  id: string;
  fullName: string;
  gender: Gender;
  phone: string | null;
  address: string | null;
  age: number | null;
  educationLevel: string | null;
}

interface DailyLinkInfo {
  programTitle: string;
  centerName: string | null;
  trainerName: string;
  date: string;
  isFirstTime: boolean;
  roster: RosterEntry[];
  alreadySubmitted: boolean;
  locked: boolean;
  hadTrainingToday: boolean | null;
  noTrainingReason: string | null;
  topicsCovered: string | null;
  notes: string | null;
  attendance: { traineeId: string; present: boolean }[];
  photo1Url: string | null;
  photo2Url: string | null;
}

interface AttendanceRow {
  id?: string;
  fullName: string;
  gender: Gender;
  phone: string;
  address: string;
  age: string;
  educationLevel: string;
  present: boolean;
}

// Entirely public — reached from the daily SMS/email link a trainer gets automatically every
// training day, no login required. See DailyLinkService on the API side; the token itself is
// scoped to exactly one calendar day.
export default function DailyLinkPage() {
  const params = useParams<{ token: string }>();
  const token = params.token;

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [info, setInfo] = useState<DailyLinkInfo | null>(null);

  const [hadTraining, setHadTraining] = useState<boolean | null>(null);

  const [reason, setReason] = useState('');
  const [savingReason, setSavingReason] = useState(false);
  const [reasonSaved, setReasonSaved] = useState(false);
  const [reasonError, setReasonError] = useState<string | null>(null);

  const [rows, setRows] = useState<AttendanceRow[]>([]);
  const [topicsCovered, setTopicsCovered] = useState('');
  const [notes, setNotes] = useState('');
  const [savingRegister, setSavingRegister] = useState(false);
  const [registerSaved, setRegisterSaved] = useState(false);
  const [registerError, setRegisterError] = useState<string | null>(null);

  const [photo1Url, setPhoto1Url] = useState<string | null>(null);
  const [photo2Url, setPhoto2Url] = useState<string | null>(null);
  const [uploading, setUploading] = useState<1 | 2 | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [locked, setLocked] = useState(false);

  useEffect(() => {
    apiFetch<DailyLinkInfo>(`/public/daily-link/${token}`)
      .then((data) => {
        setInfo(data);
        setHadTraining(data.hadTrainingToday);
        setReason(data.noTrainingReason ?? '');
        setTopicsCovered(data.topicsCovered ?? '');
        setNotes(data.notes ?? '');
        setPhoto1Url(data.photo1Url);
        setPhoto2Url(data.photo2Url);
        setLocked(data.locked);
        setRows(
          data.roster.map((r) => ({
            id: r.id,
            fullName: r.fullName,
            gender: r.gender,
            phone: r.phone ?? '',
            address: r.address ?? '',
            age: r.age != null ? String(r.age) : '',
            educationLevel: r.educationLevel ?? '',
            present: data.attendance.find((a) => a.traineeId === r.id)?.present ?? true,
          })),
        );
      })
      .catch((err) => setLoadError(err instanceof ApiError ? err.message : 'This link could not be loaded.'))
      .finally(() => setLoading(false));
  }, [token]);

  async function submitNoTraining() {
    setReasonError(null);
    if (!reason.trim()) {
      setReasonError('Please give a reason for no training today');
      return;
    }
    setSavingReason(true);
    try {
      await apiFetch(`/public/daily-link/${token}/no-training`, { method: 'POST', body: JSON.stringify({ reason }) });
      setReasonSaved(true);
      setLocked(true);
    } catch (err) {
      setReasonError(err instanceof ApiError ? err.message : 'Could not save — please try again.');
    } finally {
      setSavingReason(false);
    }
  }

  function addRow() {
    setRows((r) => [...r, { fullName: '', gender: 'MALE', phone: '', address: '', age: '', educationLevel: '', present: true }]);
  }

  function removeRow(index: number) {
    setRows((r) => r.filter((_, i) => i !== index));
  }

  function updateRow(index: number, patch: Partial<AttendanceRow>) {
    setRows((r) => r.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }

  async function submitRegister() {
    setRegisterError(null);
    if (rows.length === 0) {
      setRegisterError('Add at least one trainee before submitting');
      return;
    }
    if (rows.some((r) => !r.fullName.trim())) {
      setRegisterError('Every trainee needs a name');
      return;
    }
    setSavingRegister(true);
    try {
      await apiFetch(`/public/daily-link/${token}/register`, {
        method: 'POST',
        body: JSON.stringify({
          trainees: rows.map((r) => ({
            id: r.id,
            fullName: r.fullName.trim(),
            gender: r.gender,
            phone: r.phone.trim() || undefined,
            address: r.address.trim() || undefined,
            age: r.age.trim() ? Number(r.age) : undefined,
            educationLevel: r.educationLevel.trim() || undefined,
            present: r.present,
          })),
          topicsCovered: topicsCovered.trim() || undefined,
          notes: notes.trim() || undefined,
        }),
      });
      setRegisterSaved(true);
      setLocked(true);
    } catch (err) {
      setRegisterError(err instanceof ApiError ? err.message : 'Could not save — please try again.');
    } finally {
      setSavingRegister(false);
    }
  }

  async function uploadPhoto(slot: 1 | 2, file: File) {
    setPhotoError(null);
    setUploading(slot);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch(`${API_ORIGIN}/public/daily-link/${token}/photo/${slot}`, { method: 'POST', body: formData });
      if (!res.ok) {
        const body = await res.json().catch(() => ({ message: 'Upload failed' }));
        throw new Error(body.message ?? 'Upload failed');
      }
      const data: { url: string } = await res.json();
      if (slot === 1) setPhoto1Url(data.url);
      else setPhoto2Url(data.url);
    } catch (err) {
      setPhotoError(err instanceof Error ? err.message : 'Could not upload photo — please try again.');
    } finally {
      setUploading(null);
    }
  }

  const presentCount = rows.filter((r) => r.present).length;

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#07130f] px-4 py-10 sm:px-6">
      <div className="relative w-full max-w-xl overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] p-6 sm:p-8">
        <div className="pointer-events-none absolute -left-16 -top-16 h-56 w-56 rounded-full bg-emerald-500/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-16 -right-16 h-56 w-56 rounded-full bg-amber-400/10 blur-3xl" />

        <div className="relative mb-6 flex items-center gap-2.5">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-400 to-amber-400 shadow-lg shadow-emerald-900/40">
            <GraduationCap size={20} className="text-emerald-950" />
          </div>
          <span className="text-lg font-semibold text-white">Hamzone Technologies — Daily Register</span>
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
            <div className="py-1">
              <h2 className="text-xl font-semibold text-white">{info.programTitle}</h2>
              <p className="mt-1 text-sm text-slate-400">
                {info.centerName ? `${info.centerName} · ` : ''}
                {info.trainerName} · {info.date}
              </p>

              {locked && (
                <div className="mt-4 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-300">
                  <p className="font-medium">Today&apos;s register is submitted and locked</p>
                  <p className="mt-1 text-xs text-amber-300/80">It can&apos;t be edited from here — contact your admin if a correction is needed. You can still add proof photos below.</p>
                </div>
              )}

              <div className="mt-5">
                <label className="text-xs font-medium uppercase tracking-wide text-slate-400">Is there training today?</label>
                <div className="mt-2 flex gap-2">
                  <button
                    type="button"
                    disabled={locked}
                    onClick={() => setHadTraining(true)}
                    className={cn(
                      'flex-1 rounded-md border px-4 py-2.5 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60',
                      hadTraining === true
                        ? 'border-emerald-500 bg-emerald-500/15 text-emerald-300'
                        : 'border-white/10 bg-white/5 text-slate-300 hover:bg-white/10',
                    )}
                  >
                    Yes
                  </button>
                  <button
                    type="button"
                    disabled={locked}
                    onClick={() => setHadTraining(false)}
                    className={cn(
                      'flex-1 rounded-md border px-4 py-2.5 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60',
                      hadTraining === false
                        ? 'border-rose-500 bg-rose-500/15 text-rose-300'
                        : 'border-white/10 bg-white/5 text-slate-300 hover:bg-white/10',
                    )}
                  >
                    No
                  </button>
                </div>
              </div>

              {hadTraining === false && (
                <div className="mt-5">
                  <label className="text-xs font-medium uppercase tracking-wide text-slate-400">Reason</label>
                  <textarea
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    rows={3}
                    disabled={locked}
                    placeholder="Why is there no training today?"
                    className="mt-1.5 w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 disabled:opacity-60"
                  />
                  {reasonError && <p className="mt-2 text-xs text-rose-400">{reasonError}</p>}
                  {reasonSaved && (
                    <p className="mt-2 inline-flex items-center gap-1.5 text-xs text-emerald-400">
                      <CheckCircle2 size={14} /> Saved and locked
                    </p>
                  )}
                  {!locked && (
                    <Button
                      disabled={savingReason}
                      onClick={submitNoTraining}
                      className="mt-3 h-11 w-full bg-gradient-to-r from-emerald-500 to-amber-400 font-medium text-emerald-950 hover:from-emerald-400 hover:to-amber-300 disabled:opacity-80"
                    >
                      {savingReason ? 'Saving…' : 'Save'}
                    </Button>
                  )}
                </div>
              )}

              {hadTraining === true && (
                <div className="mt-5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-medium uppercase tracking-wide text-slate-400">
                      Trainees ({presentCount}/{rows.length} present)
                    </label>
                    {!locked && (
                      <button
                        type="button"
                        onClick={addRow}
                        className="inline-flex items-center gap-1.5 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1.5 text-xs font-medium text-emerald-300 hover:bg-emerald-500/20"
                      >
                        <Plus size={14} /> Add trainee
                      </button>
                    )}
                  </div>

                  {rows.length === 0 && (
                    <p className="mt-3 flex items-center gap-2 rounded-md border border-white/10 bg-white/5 px-3 py-3 text-xs text-slate-400">
                      <Users size={14} />
                      {info.isFirstTime
                        ? 'First time marking this register — add each trainee by name below.'
                        : 'No trainees yet — add one below.'}
                    </p>
                  )}

                  <div className="mt-3 flex flex-col gap-3">
                    {rows.map((row, i) => (
                      <div key={i} className="rounded-lg border border-white/10 bg-white/[0.02] p-3">
                        <div className="flex items-start gap-2">
                          <Input
                            value={row.fullName}
                            onChange={(e) => updateRow(i, { fullName: e.target.value })}
                            placeholder="Full name"
                            disabled={locked}
                            className="h-9 border-white/10 bg-white/5 text-sm text-white placeholder:text-slate-500 focus-visible:ring-emerald-500 disabled:opacity-60"
                          />
                          <select
                            value={row.gender}
                            onChange={(e) => updateRow(i, { gender: e.target.value as Gender })}
                            disabled={locked}
                            className="h-9 rounded-md border border-white/10 bg-white/5 px-2 text-sm text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 disabled:opacity-60"
                          >
                            {GENDERS.map((g) => (
                              <option key={g} value={g} className="bg-[#0b1a15]">
                                {g[0] + g.slice(1).toLowerCase()}
                              </option>
                            ))}
                          </select>
                          {!locked && (
                            <button
                              type="button"
                              onClick={() => removeRow(i)}
                              className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-md border border-white/10 text-slate-400 hover:bg-rose-500/10 hover:text-rose-400"
                              aria-label="Remove trainee"
                            >
                              <Trash2 size={14} />
                            </button>
                          )}
                        </div>
                        {info.isFirstTime && (
                          <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
                            <Input
                              value={row.phone}
                              onChange={(e) => updateRow(i, { phone: e.target.value })}
                              placeholder="Phone (optional)"
                              disabled={locked}
                              className="h-8 border-white/10 bg-white/5 text-xs text-white placeholder:text-slate-500 focus-visible:ring-emerald-500 disabled:opacity-60"
                            />
                            <Input
                              value={row.address}
                              onChange={(e) => updateRow(i, { address: e.target.value })}
                              placeholder="Address (optional)"
                              disabled={locked}
                              className="h-8 border-white/10 bg-white/5 text-xs text-white placeholder:text-slate-500 focus-visible:ring-emerald-500 disabled:opacity-60"
                            />
                            <Input
                              value={row.age}
                              onChange={(e) => updateRow(i, { age: e.target.value.replace(/\D/g, '') })}
                              placeholder="Age (optional)"
                              disabled={locked}
                              className="h-8 border-white/10 bg-white/5 text-xs text-white placeholder:text-slate-500 focus-visible:ring-emerald-500 disabled:opacity-60"
                            />
                            <Input
                              value={row.educationLevel}
                              onChange={(e) => updateRow(i, { educationLevel: e.target.value })}
                              placeholder="Education level (optional)"
                              disabled={locked}
                              className="h-8 border-white/10 bg-white/5 text-xs text-white placeholder:text-slate-500 focus-visible:ring-emerald-500 disabled:opacity-60"
                            />
                          </div>
                        )}
                        <label className="mt-2 flex items-center gap-2 text-xs text-slate-300">
                          <input
                            type="checkbox"
                            checked={row.present}
                            onChange={(e) => updateRow(i, { present: e.target.checked })}
                            disabled={locked}
                            className="h-4 w-4 rounded border-white/20 bg-white/5 disabled:opacity-60"
                          />
                          Present today
                        </label>
                      </div>
                    ))}
                  </div>

                  <div className="mt-4 flex flex-col gap-1.5">
                    <label className="text-xs font-medium uppercase tracking-wide text-slate-400">Topics covered</label>
                    <textarea
                      value={topicsCovered}
                      onChange={(e) => setTopicsCovered(e.target.value)}
                      rows={2}
                      placeholder="What was covered today?"
                      disabled={locked}
                      className="rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 disabled:opacity-60"
                    />
                  </div>
                  <div className="mt-3 flex flex-col gap-1.5">
                    <label className="text-xs font-medium uppercase tracking-wide text-slate-400">Notes (optional)</label>
                    <textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      rows={2}
                      disabled={locked}
                      className="rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 disabled:opacity-60"
                    />
                  </div>

                  {registerError && <p className="mt-3 text-xs text-rose-400">{registerError}</p>}
                  {registerSaved && (
                    <p className="mt-3 inline-flex items-center gap-1.5 text-xs text-emerald-400">
                      <CheckCircle2 size={14} /> Saved and locked — contact your admin if a correction is needed
                    </p>
                  )}
                  {!locked && (
                    <Button
                      disabled={savingRegister}
                      onClick={submitRegister}
                      className="mt-3 h-11 w-full bg-gradient-to-r from-emerald-500 to-amber-400 font-medium text-emerald-950 hover:from-emerald-400 hover:to-amber-300 disabled:opacity-80"
                    >
                      {savingRegister ? 'Saving…' : 'Save register'}
                    </Button>
                  )}

                  <div className="mt-6">
                    <label className="text-xs font-medium uppercase tracking-wide text-slate-400">
                      Proof of today&apos;s training (2 photos)
                    </label>
                    <div className="mt-2 grid grid-cols-2 gap-3">
                      {([1, 2] as const).map((slot) => {
                        const url = slot === 1 ? photo1Url : photo2Url;
                        return (
                          <label
                            key={slot}
                            className="flex aspect-square cursor-pointer flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed border-white/15 bg-white/5 text-center hover:bg-white/10"
                          >
                            <input
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) void uploadPhoto(slot, file);
                              }}
                            />
                            {uploading === slot ? (
                              <Loader2 size={20} className="animate-spin text-slate-400" />
                            ) : url ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={`${API_ORIGIN}${url}`} alt={`Photo ${slot}`} className="h-full w-full rounded-lg object-cover" />
                            ) : (
                              <>
                                <Camera size={20} className="text-slate-400" />
                                <span className="text-xs text-slate-400">Photo {slot}</span>
                              </>
                            )}
                          </label>
                        );
                      })}
                    </div>
                    {photoError && <p className="mt-2 text-xs text-rose-400">{photoError}</p>}
                  </div>
                </div>
              )}

              <p className="mt-6 inline-flex items-center gap-1.5 text-xs text-slate-500">
                <ShieldCheck size={13} /> This link is only valid for today — a new one is sent automatically each training day.
              </p>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

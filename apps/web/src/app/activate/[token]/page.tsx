'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import { Building2, CreditCard, Download, GraduationCap, Loader2, Send, ShieldCheck, Smartphone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { apiFetch, ApiError, API_ORIGIN } from '@/lib/api';
import { usePageTransition } from '@/lib/page-transition';
import { cn } from '@/lib/utils';

interface ActivationStatus {
  schoolName: string;
  amountKes: number;
  status: 'PENDING' | 'PAID';
}

interface PaymentDetails {
  bankName: string | null;
  bankAccountName: string | null;
  bankAccountNumber: string | null;
  paybillNumber: string | null;
  paybillAccountName: string | null;
}

type Method = 'stk' | 'bank' | 'paybill';

const POLL_MS = 4000;

// Public, unauthenticated — reached from the activation link in the welcome email, before the
// school has ever been able to log in. See ActivationController on the API side.
export default function ActivatePage() {
  const params = useParams<{ token: string }>();
  const token = params.token;
  const { navigate } = usePageTransition();

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [info, setInfo] = useState<ActivationStatus | null>(null);
  const [method, setMethod] = useState<Method>('stk');
  const [details, setDetails] = useState<PaymentDetails | null>(null);

  const [phone, setPhone] = useState('');
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [paying, setPaying] = useState(false);
  const [awaitingConfirmation, setAwaitingConfirmation] = useState(false);

  const [proofMessage, setProofMessage] = useState('');
  const [proofError, setProofError] = useState<string | null>(null);
  const [submittingProof, setSubmittingProof] = useState(false);
  const [proofSubmitted, setProofSubmitted] = useState(false);

  const [downloadingInvoice, setDownloadingInvoice] = useState(false);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  async function downloadInvoice() {
    setDownloadingInvoice(true);
    try {
      const res = await fetch(`${API_ORIGIN}/public/activation/${token}/invoice-pdf`);
      if (!res.ok) throw new Error('Failed to generate invoice PDF');
      const disposition = res.headers.get('Content-Disposition') ?? '';
      const filenameMatch = disposition.match(/filename="([^"]+)"/);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filenameMatch?.[1] ?? 'invoice.pdf';
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      // Non-critical — the invoice was already emailed/SMS'd; a failed download here isn't worth
      // a scary error state on an otherwise-working activation page.
    } finally {
      setDownloadingInvoice(false);
    }
  }

  async function fetchStatus() {
    try {
      const data = await apiFetch<ActivationStatus>(`/public/activation/${token}`);
      setInfo(data);
      setLoadError(null);
      return data;
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : 'This activation link could not be loaded.');
      return null;
    }
  }

  useEffect(() => {
    fetchStatus().finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  useEffect(() => {
    if (method === 'stk' || details) return;
    apiFetch<PaymentDetails>(`/public/activation/${token}/payment-details`)
      .then(setDetails)
      .catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [method]);

  // Poll once we're waiting on anything async — an STK prompt in flight, or a submitted proof
  // under review — so the page flips to the success state on its own either way.
  useEffect(() => {
    if (!awaitingConfirmation && !proofSubmitted) return;
    pollRef.current = setInterval(async () => {
      const data = await fetchStatus();
      if (data?.status === 'PAID' && pollRef.current) clearInterval(pollRef.current);
    }, POLL_MS);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [awaitingConfirmation, proofSubmitted]);

  async function onPay() {
    setPhoneError(null);
    if (phone.replace(/\D/g, '').length < 9) {
      setPhoneError('Enter a valid phone number, e.g. 0712345678');
      return;
    }
    setPaying(true);
    try {
      await apiFetch(`/public/activation/${token}/pay`, { method: 'POST', body: JSON.stringify({ phone }) });
      setAwaitingConfirmation(true);
    } catch (err) {
      setPhoneError(err instanceof ApiError ? err.message : 'Could not start the payment. Please try again.');
    } finally {
      setPaying(false);
    }
  }

  async function onSubmitProof() {
    setProofError(null);
    if (proofMessage.trim().length < 5) {
      setProofError('Paste the full payment confirmation message');
      return;
    }
    setSubmittingProof(true);
    try {
      await apiFetch(`/public/activation/${token}/proof`, {
        method: 'POST',
        body: JSON.stringify({ method: method.toUpperCase(), message: proofMessage }),
      });
      setProofSubmitted(true);
    } catch (err) {
      setProofError(err instanceof ApiError ? err.message : 'Could not submit your proof. Please try again.');
    } finally {
      setSubmittingProof(false);
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
              <p className="text-sm">Loading activation details…</p>
            </div>
          )}

          {!loading && loadError && (
            <div className="py-6">
              <h2 className="text-xl font-semibold text-white">Link not valid</h2>
              <p className="mt-2 text-sm text-slate-400">{loadError}</p>
              <p className="mt-4 text-xs text-slate-500">
                If you believe this is an error, contact the School ERP team for a new activation link.
              </p>
            </div>
          )}

          {!loading && !loadError && info && (info.status === 'PAID' ? (
            <div className="py-6">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/15">
                <ShieldCheck size={24} className="text-emerald-400" />
              </div>
              <h2 className="text-xl font-semibold text-white">{info.schoolName} is active</h2>
              <p className="mt-2 text-sm text-slate-400">
                Payment has been received. You can now sign in with the details from your welcome email.
              </p>
              <Button
                className="mt-6 h-11 w-full bg-gradient-to-r from-emerald-500 to-amber-400 font-medium text-emerald-950 hover:from-emerald-400 hover:to-amber-300"
                onClick={() => navigate('/login', { color: '#07130f' })}
              >
                Go to sign in
              </Button>
            </div>
          ) : awaitingConfirmation ? (
            <div className="flex flex-col items-center gap-3 py-10 text-center">
              <Loader2 size={24} className="animate-spin text-emerald-400" />
              <h2 className="text-lg font-semibold text-white">Check your phone</h2>
              <p className="text-sm text-slate-400">
                Enter your M-Pesa PIN on the prompt sent to {phone} to complete the KES{' '}
                {info.amountKes.toLocaleString()} activation payment.
              </p>
              <p className="text-xs text-slate-500">This page will update automatically once payment is confirmed.</p>
              <InvoiceDownloadButton downloading={downloadingInvoice} onClick={downloadInvoice} />
            </div>
          ) : proofSubmitted ? (
            <div className="flex flex-col items-center gap-3 py-10 text-center">
              <Loader2 size={24} className="animate-spin text-emerald-400" />
              <h2 className="text-lg font-semibold text-white">Confirmation received</h2>
              <p className="text-sm text-slate-400">
                We&apos;ve received your payment confirmation and will verify it shortly. You&apos;ll be
                notified once your payment is confirmed and the school unlocked.
              </p>
              <p className="text-xs text-slate-500">
                This page updates automatically once confirmed. If you don&apos;t hear back or run into an
                issue, contact support.
              </p>
              <InvoiceDownloadButton downloading={downloadingInvoice} onClick={downloadInvoice} />
            </div>
          ) : (
            <div className="py-2">
              <h2 className="text-xl font-semibold text-white">Activate {info.schoolName}</h2>
              <p className="mt-1.5 text-sm text-slate-400">
                Pay the one-time activation fee to unlock sign-in for your school.
              </p>
              <div className="mt-5 rounded-lg border border-white/10 bg-white/5 px-4 py-3">
                <p className="text-xs uppercase tracking-wide text-slate-500">Amount due</p>
                <p className="text-2xl font-semibold text-white">KES {info.amountKes.toLocaleString()}</p>
              </div>
              <InvoiceDownloadButton downloading={downloadingInvoice} onClick={downloadInvoice} />

              <div className="mt-5 grid grid-cols-3 gap-2">
                <MethodTab active={method === 'stk'} onClick={() => setMethod('stk')} icon={Smartphone} label="M-Pesa STK" />
                <MethodTab active={method === 'bank'} onClick={() => setMethod('bank')} icon={Building2} label="Bank" />
                <MethodTab active={method === 'paybill'} onClick={() => setMethod('paybill')} icon={CreditCard} label="Paybill" />
              </div>

              {method === 'stk' ? (
                <>
                  <div className="mt-5 flex flex-col gap-1.5">
                    <label className="text-xs font-medium uppercase tracking-wide text-slate-400">
                      M-Pesa phone number
                    </label>
                    <div className="relative">
                      <Smartphone size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                      <Input
                        type="tel"
                        placeholder="0712345678"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        className="h-11 border-white/10 bg-white/5 pl-9 text-white placeholder:text-slate-500 focus-visible:ring-emerald-500"
                      />
                    </div>
                    {phoneError && <p className="text-xs text-rose-400">{phoneError}</p>}
                  </div>
                  <Button
                    disabled={paying}
                    onClick={onPay}
                    className="mt-5 h-11 w-full bg-gradient-to-r from-emerald-500 to-amber-400 font-medium text-emerald-950 hover:from-emerald-400 hover:to-amber-300 disabled:opacity-80"
                  >
                    {paying ? (
                      <span className="inline-flex items-center gap-2">
                        <Loader2 size={16} className="animate-spin" />
                        Sending prompt…
                      </span>
                    ) : (
                      'Pay with M-Pesa'
                    )}
                  </Button>
                </>
              ) : (
                <>
                  <div className="mt-5 rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-sm">
                    {!details ? (
                      <p className="text-slate-500">Loading payment details…</p>
                    ) : method === 'bank' ? (
                      <dl className="flex flex-col gap-1.5 text-slate-300">
                        <Row label="Bank" value={details.bankName} />
                        <Row label="Account name" value={details.bankAccountName} />
                        <Row label="Account number" value={details.bankAccountNumber} />
                      </dl>
                    ) : (
                      <dl className="flex flex-col gap-1.5 text-slate-300">
                        <Row label="Paybill number" value={details.paybillNumber} />
                        <Row label="Account name" value={details.paybillAccountName} />
                      </dl>
                    )}
                  </div>
                  <p className="mt-3 text-xs text-slate-500">
                    After paying, paste the confirmation message you received below — a Super Admin will
                    verify it and activate your school. Verification isn&apos;t instant, but this page will
                    update automatically once it&apos;s done.
                  </p>
                  <div className="mt-3 flex flex-col gap-1.5">
                    <label className="text-xs font-medium uppercase tracking-wide text-slate-400">
                      Payment confirmation message
                    </label>
                    <textarea
                      value={proofMessage}
                      onChange={(e) => setProofMessage(e.target.value)}
                      rows={4}
                      placeholder="Paste the SMS/confirmation text here…"
                      className="rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
                    />
                    {proofError && <p className="text-xs text-rose-400">{proofError}</p>}
                  </div>
                  <Button
                    disabled={submittingProof}
                    onClick={onSubmitProof}
                    className="mt-4 h-11 w-full bg-gradient-to-r from-emerald-500 to-amber-400 font-medium text-emerald-950 hover:from-emerald-400 hover:to-amber-300 disabled:opacity-80"
                  >
                    {submittingProof ? (
                      <span className="inline-flex items-center gap-2">
                        <Loader2 size={16} className="animate-spin" />
                        Submitting…
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-2">
                        <Send size={16} />
                        Submit for verification
                      </span>
                    )}
                  </Button>
                </>
              )}
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}

function MethodTab({
  active,
  onClick,
  icon: Icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: typeof Smartphone;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex flex-col items-center gap-1 rounded-lg border px-2 py-2.5 text-xs font-medium transition-colors',
        active
          ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-300'
          : 'border-white/10 bg-white/5 text-slate-400 hover:text-slate-200',
      )}
    >
      <Icon size={16} />
      {label}
    </button>
  );
}

function InvoiceDownloadButton({ downloading, onClick }: { downloading: boolean; onClick: () => void }) {
  return (
    <Button
      type="button"
      variant="outline"
      disabled={downloading}
      onClick={onClick}
      className="mt-3 h-9 w-full border-white/10 bg-white/5 text-xs font-medium text-slate-300 hover:bg-white/10 hover:text-white disabled:opacity-70"
    >
      {downloading ? (
        <span className="inline-flex items-center gap-2">
          <Loader2 size={14} className="animate-spin" />
          Preparing…
        </span>
      ) : (
        <span className="inline-flex items-center gap-2">
          <Download size={14} />
          Download Invoice (PDF)
        </span>
      )}
    </Button>
  );
}

function Row({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-slate-500">{label}</dt>
      <dd className="font-medium text-white">{value}</dd>
    </div>
  );
}

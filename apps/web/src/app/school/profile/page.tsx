'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { KeyRound, ShieldCheck } from 'lucide-react';
import { apiFetch, ApiError } from '@/lib/api';
import { notifyError, notifySuccess } from '@/lib/notify';
import { Button } from '@/components/ui/button';
import { PasswordInput } from '@/components/ui/password-input';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

interface PinStatus {
  set: boolean;
}

/** Self-service account page for any tenant user (parent/staff/teacher/admin) — currently just the
 * WhatsApp PIN, which the bot requires before sharing anything sensitive (see WhatsAppPinService).
 * Nothing here is school-wide config (that's /school/settings, admin-only) — this is purely the
 * logged-in user's own account. */
export default function ProfilePage() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['profile-whatsapp-pin'],
    queryFn: () => apiFetch<PinStatus>('/profile/whatsapp-pin'),
  });

  const [showForm, setShowForm] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [error, setError] = useState<string | null>(null);

  const resetForm = () => {
    setCurrentPassword('');
    setPin('');
    setConfirmPin('');
    setError(null);
    setShowForm(false);
  };

  const setPinMutation = useMutation({
    mutationFn: () => apiFetch('/profile/whatsapp-pin', { method: 'POST', body: JSON.stringify({ currentPassword, pin }) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile-whatsapp-pin'] });
      notifySuccess('WhatsApp PIN set');
      resetForm();
    },
    onError: (err) => {
      setError(err instanceof ApiError ? err.message : 'Failed to set PIN');
      notifyError(err, 'Failed to set PIN');
    },
  });

  const clearPinMutation = useMutation({
    mutationFn: (password: string) => apiFetch('/profile/whatsapp-pin', { method: 'DELETE', body: JSON.stringify({ currentPassword: password }) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile-whatsapp-pin'] });
      notifySuccess('WhatsApp PIN removed');
      resetForm();
    },
    onError: (err) => notifyError(err, 'Failed to remove PIN'),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (pin !== confirmPin) {
      setError('PINs do not match');
      return;
    }
    setPinMutation.mutate();
  };

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <KeyRound size={18} className="text-slate-400" />
            WhatsApp PIN
          </CardTitle>
          <CardDescription>
            Extra protection for the WhatsApp assistant — before it shares anything sensitive (fee balance, attendance, exam results,
            homework, leave status) or accepts a leave request, it asks for this PIN once every 24 hours. Without it set, the bot won&apos;t
            answer anything for your account.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-10 w-full" />
          ) : showForm ? (
            <form onSubmit={handleSubmit} className="flex flex-col gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-slate-700">Current password</label>
                <PasswordInput value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} required />
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-medium text-slate-700">New PIN (4-6 digits)</label>
                  <Input
                    inputMode="numeric"
                    pattern="\d{4,6}"
                    maxLength={6}
                    value={pin}
                    onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                    required
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-medium text-slate-700">Confirm PIN</label>
                  <Input
                    inputMode="numeric"
                    pattern="\d{4,6}"
                    maxLength={6}
                    value={confirmPin}
                    onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, ''))}
                    required
                  />
                </div>
              </div>
              {error && <p className="text-sm text-rose-600">{error}</p>}
              <div className="flex gap-2">
                <Button type="submit" disabled={setPinMutation.isPending}>
                  {setPinMutation.isPending ? 'Saving...' : data?.set ? 'Change PIN' : 'Set PIN'}
                </Button>
                <Button type="button" variant="outline" onClick={resetForm}>
                  Cancel
                </Button>
              </div>
            </form>
          ) : (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm">
                {data?.set ? (
                  <>
                    <ShieldCheck size={16} className="text-emerald-500" />
                    <span className="text-slate-700">A WhatsApp PIN is set on your account.</span>
                  </>
                ) : (
                  <span className="text-amber-600">No PIN set — the WhatsApp assistant won&apos;t answer anything for you yet.</span>
                )}
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={() => setShowForm(true)}>
                  {data?.set ? 'Change PIN' : 'Set PIN'}
                </Button>
                {data?.set && (
                  <RemovePinButton onConfirm={(password) => clearPinMutation.mutate(password)} pending={clearPinMutation.isPending} />
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function RemovePinButton({ onConfirm, pending }: { onConfirm: (password: string) => void; pending: boolean }) {
  const [asking, setAsking] = useState(false);
  const [password, setPassword] = useState('');

  if (!asking) {
    return (
      <Button size="sm" variant="outline" onClick={() => setAsking(true)}>
        Remove PIN
      </Button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <PasswordInput
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="Current password"
        className="h-9 w-40"
      />
      <Button
        size="sm"
        variant="outline"
        disabled={pending || !password}
        onClick={() => {
          onConfirm(password);
          setAsking(false);
          setPassword('');
        }}
      >
        Confirm
      </Button>
      <Button size="sm" variant="ghost" onClick={() => setAsking(false)}>
        Cancel
      </Button>
    </div>
  );
}

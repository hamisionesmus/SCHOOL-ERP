'use client';

import { AlertTriangle, CheckCircle2, HelpCircle } from 'lucide-react';
import { Button } from './button';
import { cn } from '@/lib/utils';

export type ConfirmTone = 'default' | 'danger' | 'success';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: ConfirmTone;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

const TONE_STYLES: Record<ConfirmTone, { icon: typeof HelpCircle; iconBg: string; iconColor: string; button: 'default' | 'destructive' }> = {
  default: { icon: HelpCircle, iconBg: 'bg-blue-50', iconColor: 'text-blue-600', button: 'default' },
  danger: { icon: AlertTriangle, iconBg: 'bg-rose-50', iconColor: 'text-rose-600', button: 'destructive' },
  success: { icon: CheckCircle2, iconBg: 'bg-emerald-50', iconColor: 'text-emerald-600', button: 'default' },
};

/** A "sweet alert"-style confirmation modal for actions worth a second look before they fire. */
export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  tone = 'default',
  loading = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  if (!open) return null;
  const { icon: Icon, iconBg, iconColor, button } = TONE_STYLES[tone];

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 animate-fade-in bg-slate-900/40 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative w-full max-w-sm animate-scale-in rounded-2xl bg-white p-6 text-center shadow-2xl">
        <div className={cn('mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full', iconBg)}>
          <Icon size={28} className={iconColor} />
        </div>
        <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
        {description && <p className="mt-1.5 text-sm text-slate-500">{description}</p>}
        <div className="mt-6 flex gap-3">
          <Button variant="outline" className="flex-1" onClick={onCancel} disabled={loading}>
            {cancelLabel}
          </Button>
          <Button variant={button} className="flex-1" onClick={onConfirm} disabled={loading}>
            {loading ? 'Working...' : confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}

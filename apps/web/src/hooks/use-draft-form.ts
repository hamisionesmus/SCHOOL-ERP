'use client';

import { useCallback, useEffect, useRef } from 'react';
import type { FieldValues, UseFormReturn } from 'react-hook-form';

/**
 * Persists a react-hook-form's in-progress values to localStorage as the user types, and restores
 * them on mount — so an accidental browser refresh (not just the background-refetch clobber a
 * `hasSynced` ref already guards against elsewhere) doesn't wipe a half-filled form. The draft is
 * cleared on successful submit via `clearDraft()`, so a stale draft never reappears after a real
 * save. Fields named in `exclude` (e.g. a password) are never written to storage — they're either
 * security-sensitive or trivial to re-enter, and persisting a plaintext password in localStorage
 * isn't worth the convenience.
 */
export function useDraftForm<T extends FieldValues>(
  key: string,
  form: UseFormReturn<T>,
  options?: { exclude?: (keyof T)[] },
) {
  const storageKey = `erp.draft.${key}`;
  const restoredOnce = useRef(false);
  const exclude = options?.exclude ?? [];

  useEffect(() => {
    if (restoredOnce.current) return;
    restoredOnce.current = true;
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const draft = JSON.parse(raw) as Partial<T>;
        form.reset({ ...form.getValues(), ...draft }, { keepDefaultValues: true });
      }
    } catch {
      // corrupt/unavailable storage — just start with a blank form, no need to surface this
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const subscription = form.watch((values) => {
      try {
        const toStore = { ...values } as Record<string, unknown>;
        for (const field of exclude) delete toStore[field as string];
        localStorage.setItem(storageKey, JSON.stringify(toStore));
      } catch {
        // storage full/unavailable — draft persistence is a convenience, not required for the form to work
      }
    });
    return () => subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form]);

  const clearDraft = useCallback(() => {
    localStorage.removeItem(storageKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey]);

  return { clearDraft };
}

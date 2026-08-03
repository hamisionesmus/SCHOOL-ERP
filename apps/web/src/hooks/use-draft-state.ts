'use client';

/**
 * Lower-level sibling of `useDraftForm` for the many settings tabs/pages that manage their form as
 * plain `useState` (not `react-hook-form`) — same "survive an accidental refresh" goal, but exposed
 * as load/save/clear functions the component wires in wherever it already syncs from the server
 * (`hasSynced` ref pattern) and saves, rather than a hook that owns the state itself.
 */
export function useDraftState<T extends Record<string, unknown>>(key: string, exclude: (keyof T)[] = []) {
  const storageKey = `erp.draft.${key}`;

  function loadDraft(): Partial<T> | null {
    try {
      const raw = localStorage.getItem(storageKey);
      return raw ? (JSON.parse(raw) as Partial<T>) : null;
    } catch {
      return null;
    }
  }

  function saveDraft(value: T) {
    try {
      const toStore = { ...value } as Record<string, unknown>;
      for (const field of exclude) delete toStore[field as string];
      localStorage.setItem(storageKey, JSON.stringify(toStore));
    } catch {
      // storage full/unavailable — draft persistence is a convenience, not required for the form to work
    }
  }

  function clearDraft() {
    localStorage.removeItem(storageKey);
  }

  return { loadDraft, saveDraft, clearDraft };
}

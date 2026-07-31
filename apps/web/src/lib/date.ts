/** Whole-day difference between `dateStr` and today, ignoring time-of-day. Positive = future. */
export function daysUntil(dateStr: string): number {
  const target = new Date(dateStr);
  const today = new Date();
  const targetDay = Date.UTC(target.getFullYear(), target.getMonth(), target.getDate());
  const todayDay = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.round((targetDay - todayDay) / 86_400_000);
}

export function formatCountdown(days: number): string {
  if (days === 0) return 'Today';
  if (days === 1) return 'Tomorrow';
  if (days === -1) return 'Yesterday';
  if (days > 1) return `In ${days} days`;
  return `${Math.abs(days)} days ago`;
}

export type CountdownTone = 'soon' | 'upcoming' | 'past';

export function countdownTone(days: number): CountdownTone {
  if (days < 0) return 'past';
  if (days <= 7) return 'soon';
  return 'upcoming';
}

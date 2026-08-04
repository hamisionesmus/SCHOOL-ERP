'use client';

import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, Download, FileText, Trash2 } from 'lucide-react';
import { useSession } from '@/lib/use-session';
import { apiFetch, ApiError, API_ORIGIN } from '@/lib/api';
import { getAccessToken } from '@/lib/auth';
import { notifyError, notifySuccess } from '@/lib/notify';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Pagination } from '@/components/ui/pagination';
import { useTableControls } from '@/hooks/use-table-controls';
import { cn } from '@/lib/utils';
import { useDraftState } from '@/hooks/use-draft-state';

interface CalendarEvent {
  id: string;
  title: string;
  description: string | null;
  category: string;
  startDate: string;
  endDate: string | null;
  allDay: boolean;
  source: 'custom' | 'trip' | 'exam';
}

const CATEGORY_COLOR: Record<string, string> = {
  HOLIDAY: 'bg-emerald-100 text-emerald-700',
  TERM: 'bg-slate-200 text-slate-700',
  EXAM: 'bg-rose-100 text-rose-700',
  MEETING: 'bg-violet-100 text-violet-700',
  SPORTS: 'bg-orange-100 text-orange-700',
  TRIP: 'bg-sky-100 text-sky-700',
  OTHER: 'bg-slate-100 text-slate-600',
};
const CATEGORY_DOT: Record<string, string> = {
  HOLIDAY: 'bg-emerald-500',
  TERM: 'bg-slate-500',
  EXAM: 'bg-rose-500',
  MEETING: 'bg-violet-500',
  SPORTS: 'bg-orange-500',
  TRIP: 'bg-sky-500',
  OTHER: 'bg-slate-400',
};
const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function eventFallsOn(e: CalendarEvent, day: Date): boolean {
  const dayStart = new Date(day.getFullYear(), day.getMonth(), day.getDate());
  const dayEnd = new Date(dayStart.getTime() + 86_400_000);
  const start = new Date(e.startDate);
  const end = e.endDate ? new Date(e.endDate) : start;
  return start < dayEnd && end >= dayStart;
}

async function downloadFile(url: string, filename: string) {
  const token = getAccessToken();
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error('Download failed');
  const blob = await res.blob();
  const objUrl = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = objUrl;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(objUrl);
}

export default function CalendarPage() {
  const { user } = useSession('tenant');
  const queryClient = useQueryClient();
  const [viewDate, setViewDate] = useState(() => new Date());
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { loadDraft, saveDraft, clearDraft } = useDraftState<{ title: string; category: string; description: string; startDate: string; endDate: string }>('calendar-event');
  const draft = loadDraft();
  const [eventTitle, setEventTitle] = useState(draft?.title ?? '');
  const [eventCategory, setEventCategory] = useState(draft?.category ?? '');
  const [eventDescription, setEventDescription] = useState(draft?.description ?? '');
  const [eventStartDate, setEventStartDate] = useState(draft?.startDate ?? '');
  const [eventEndDate, setEventEndDate] = useState(draft?.endDate ?? '');

  useEffect(() => {
    saveDraft({ title: eventTitle, category: eventCategory, description: eventDescription, startDate: eventStartDate, endDate: eventEndDate });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventTitle, eventCategory, eventDescription, eventStartDate, eventEndDate]);

  const canManage = user?.permissions?.includes('CALENDAR:MANAGE');
  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();

  const { data: events } = useQuery({
    queryKey: ['calendar-events'],
    queryFn: () => apiFetch<CalendarEvent[]>('/calendar/events'),
    enabled: !!user,
  });

  const createEvent = useMutation({
    mutationFn: () =>
      apiFetch('/calendar/events', {
        method: 'POST',
        body: JSON.stringify({
          title: eventTitle,
          description: eventDescription || undefined,
          category: eventCategory,
          startDate: eventStartDate,
          endDate: eventEndDate || undefined,
        }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calendar-events'] });
      setShowForm(false);
      setError(null);
      setEventTitle('');
      setEventCategory('');
      setEventDescription('');
      setEventStartDate('');
      setEventEndDate('');
      clearDraft();
      notifySuccess('Event added');
    },
    onError: (err) => {
      setError(err instanceof ApiError ? err.message : 'Failed to add event');
      notifyError(err, 'Failed to add event');
    },
  });

  const deleteEvent = useMutation({
    mutationFn: (id: string) => apiFetch(`/calendar/events/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calendar-events'] });
      notifySuccess('Event removed');
    },
    onError: (err) => notifyError(err, 'Failed to remove event'),
  });

  const upcoming = useMemo(() => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    return (events ?? []).filter((e) => new Date(e.startDate) >= now);
  }, [events]);
  const table = useTableControls(upcoming, { pageSize: 8 });

  const weeks = useMemo(() => {
    const firstOfMonth = new Date(year, month, 1);
    const startWeekday = firstOfMonth.getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const totalCells = Math.ceil((startWeekday + daysInMonth) / 7) * 7;
    const cells: (Date | null)[] = [];
    for (let i = 0; i < totalCells; i++) {
      const dayNum = i - startWeekday + 1;
      cells.push(dayNum >= 1 && dayNum <= daysInMonth ? new Date(year, month, dayNum) : null);
    }
    const rows: (Date | null)[][] = [];
    for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7));
    return rows;
  }, [year, month]);

  if (!user) return null;

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div className="flex items-center gap-3">
            <Button size="sm" variant="outline" onClick={() => setViewDate(new Date(year, month - 1, 1))}>
              <ChevronLeft size={14} />
            </Button>
            <CardTitle>
              {MONTH_NAMES[month]} {year}
            </CardTitle>
            <Button size="sm" variant="outline" onClick={() => setViewDate(new Date(year, month + 1, 1))}>
              <ChevronRight size={14} />
            </Button>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                downloadFile(`${API_ORIGIN}/calendar/pdf?year=${year}&month=${month}`, `Calendar_${year}-${month + 1}.pdf`).catch(
                  (e) => notifyError(e, 'Failed to download PDF'),
                )
              }
            >
              <FileText size={14} className="mr-1" /> PDF
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                downloadFile(`${API_ORIGIN}/calendar/ics`, 'school-calendar.ics').catch((e) =>
                  notifyError(e, 'Failed to export calendar'),
                )
              }
            >
              <Download size={14} className="mr-1" /> Export .ics
            </Button>
            {canManage && (
              <Button size="sm" onClick={() => setShowForm((v) => !v)}>
                {showForm ? 'Cancel' : '+ Add event'}
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <p className="mb-3 text-xs text-slate-500">
            Combines custom entries with approved trip dates and exam windows, in one place. Download a
            printable month PDF, or export .ics to import into Google Calendar / Outlook.
          </p>

          {showForm && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                createEvent.mutate();
              }}
              className="mb-4 grid grid-cols-2 gap-3 rounded-lg border border-slate-200 p-4"
            >
              <Input value={eventTitle} onChange={(e) => setEventTitle(e.target.value)} placeholder="Event title" required className="col-span-2" />
              <select
                value={eventCategory}
                onChange={(e) => setEventCategory(e.target.value)}
                required
                className="h-10 rounded-md border border-slate-300 px-3 text-sm"
              >
                <option value="">Category</option>
                {Object.keys(CATEGORY_COLOR).map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
              <Input value={eventDescription} onChange={(e) => setEventDescription(e.target.value)} placeholder="Description (optional)" />
              <div className="flex flex-col gap-1">
                <label className="text-xs text-slate-500">Start date</label>
                <Input value={eventStartDate} onChange={(e) => setEventStartDate(e.target.value)} type="date" required />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs text-slate-500">End date (optional)</label>
                <Input value={eventEndDate} onChange={(e) => setEventEndDate(e.target.value)} type="date" />
              </div>
              {error && <p className="col-span-2 text-sm text-red-600">{error}</p>}
              <div className="col-span-2">
                <Button type="submit" disabled={createEvent.isPending}>
                  {createEvent.isPending ? 'Saving...' : 'Add event'}
                </Button>
              </div>
            </form>
          )}

          <div className="grid grid-cols-7 gap-px overflow-hidden rounded-lg border border-slate-200 bg-slate-200 text-xs">
            {DAY_NAMES.map((d) => (
              <div key={d} className="bg-slate-50 px-2 py-1.5 text-center font-medium text-slate-500">
                {d}
              </div>
            ))}
            {weeks.map((week, wi) =>
              week.map((day, di) => (
                <div key={`${wi}-${di}`} className="min-h-[80px] bg-white p-1.5">
                  {day && (
                    <>
                      <p className="mb-1 text-[11px] text-slate-400">{day.getDate()}</p>
                      <div className="flex flex-col gap-0.5">
                        {(events ?? [])
                          .filter((e) => eventFallsOn(e, day))
                          .slice(0, 3)
                          .map((e) => (
                            <span
                              key={e.id}
                              title={e.title}
                              className={cn('truncate rounded px-1 py-0.5 text-[10px] font-medium', CATEGORY_COLOR[e.category])}
                            >
                              {e.title}
                            </span>
                          ))}
                      </div>
                    </>
                  )}
                </div>
              )),
            )}
          </div>

          <div className="mt-3 flex flex-wrap gap-3">
            {Object.entries(CATEGORY_DOT).map(([cat, dot]) => (
              <span key={cat} className="flex items-center gap-1.5 text-[11px] text-slate-500">
                <span className={cn('h-2 w-2 rounded-full', dot)} />
                {cat}
              </span>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Upcoming events</CardTitle>
        </CardHeader>
        <CardContent>
          {table.pageItems.length === 0 ? (
            <p className="text-sm text-slate-500">Nothing upcoming.</p>
          ) : (
            <>
              <ul className="flex flex-col gap-2">
                {table.pageItems.map((e) => (
                  <li key={e.id} className="flex items-center justify-between rounded-lg border border-slate-200 p-3 text-sm">
                    <div className="flex items-center gap-2">
                      <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium', CATEGORY_COLOR[e.category])}>
                        {e.category}
                      </span>
                      <span className="font-medium text-slate-900">{e.title}</span>
                      <span className="text-slate-400">
                        {new Date(e.startDate).toLocaleDateString()}
                        {e.endDate && ` – ${new Date(e.endDate).toLocaleDateString()}`}
                      </span>
                    </div>
                    {canManage && e.source === 'custom' && (
                      <button
                        onClick={() => deleteEvent.mutate(e.id)}
                        className="rounded p-1 text-slate-300 hover:bg-slate-100 hover:text-red-600"
                        aria-label="Delete event"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </li>
                ))}
              </ul>
              <Pagination
                page={table.page}
                pageCount={table.pageCount}
                totalItems={table.totalItems}
                pageSize={table.pageSize}
                onPageChange={table.setPage}
              />
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { MessageSquareHeart, Star, Users } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StatCard } from '@/components/ui/stat-card';
import { SkeletonTable } from '@/components/ui/skeleton';
import { Pagination } from '@/components/ui/pagination';
import { useRequireSuperAdmin } from '@/lib/require-super-admin';

interface FeedbackRow {
  id: string;
  rating: number | null;
  improvements: string | null;
  interestedInRealAccount: boolean | null;
  context: 'DEMO_EXPIRY' | 'TICKET_RESOLUTION';
  createdAt: string;
  tenant: { name: string; slug: string };
}

interface FeedbackOverview {
  averageRating: number | null;
  totalResponses: number;
  demoRemindersSent: number;
}

const CONTEXT_LABEL: Record<FeedbackRow['context'], string> = {
  DEMO_EXPIRY: 'Demo survey',
  TICKET_RESOLUTION: 'Ticket feedback',
};

const CONTEXT_TONE: Record<FeedbackRow['context'], string> = {
  DEMO_EXPIRY: 'bg-blue-100 text-blue-700',
  TICKET_RESOLUTION: 'bg-violet-100 text-violet-700',
};

export default function PlatformFeedbackPage() {
  useRequireSuperAdmin();
  const [page, setPage] = useState(1);
  const [context, setContext] = useState<'' | FeedbackRow['context']>('');
  const pageSize = 15;

  const { data, isLoading } = useQuery({
    queryKey: ['platform-feedback', page, context],
    queryFn: () =>
      apiFetch<{ data: FeedbackRow[]; meta: { page: number; pageSize: number; total: number } }>(
        `/platform/feedback?page=${page}&pageSize=${pageSize}${context ? `&context=${context}` : ''}`,
      ),
  });

  const { data: overview } = useQuery({
    queryKey: ['platform-feedback-overview'],
    queryFn: () => apiFetch<FeedbackOverview>('/platform/feedback/overview'),
  });

  const rows = data?.data ?? [];
  const pageCount = data ? Math.max(1, Math.ceil(data.meta.total / pageSize)) : 1;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold text-slate-900">
          <MessageSquareHeart size={22} className="text-slate-400" />
          Feedback
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Survey responses from demo-expiry reminders and resolved support tickets, all in one place.
        </p>
      </div>

      {overview && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatCard
            label="Average rating"
            value={overview.averageRating ?? 0}
            suffix={overview.averageRating ? '/5' : ''}
            icon={Star}
            accent="amber"
          />
          <StatCard label="Total responses" value={overview.totalResponses} icon={MessageSquareHeart} accent="violet" />
          <StatCard label="Demo reminders sent" value={overview.demoRemindersSent} icon={Users} accent="blue" />
        </div>
      )}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">All responses</CardTitle>
          <select
            className="h-9 rounded-md border border-slate-300 bg-white px-2 text-sm"
            value={context}
            onChange={(e) => {
              setContext(e.target.value as '' | FeedbackRow['context']);
              setPage(1);
            }}
          >
            <option value="">All contexts</option>
            <option value="DEMO_EXPIRY">Demo survey</option>
            <option value="TICKET_RESOLUTION">Ticket feedback</option>
          </select>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <SkeletonTable rows={5} cols={5} />
          ) : rows.length === 0 ? (
            <p className="text-sm text-slate-500">No feedback submitted yet.</p>
          ) : (
            <>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-slate-500">
                    <th className="py-2 font-medium">School</th>
                    <th className="py-2 font-medium">Context</th>
                    <th className="py-2 font-medium">Rating</th>
                    <th className="py-2 font-medium">Comments</th>
                    <th className="py-2 font-medium">Submitted</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id} className="border-b border-slate-100">
                      <td className="py-2 font-medium text-slate-900">{r.tenant.name}</td>
                      <td className="py-2">
                        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${CONTEXT_TONE[r.context]}`}>
                          {CONTEXT_LABEL[r.context]}
                        </span>
                      </td>
                      <td className="py-2 text-slate-700">{r.rating ? `${r.rating}/5` : '—'}</td>
                      <td className="max-w-xs truncate py-2 text-slate-500">{r.improvements || '—'}</td>
                      <td className="py-2 text-slate-500">{new Date(r.createdAt).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <Pagination page={page} pageCount={pageCount} totalItems={data?.meta.total} pageSize={pageSize} onPageChange={setPage} />
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

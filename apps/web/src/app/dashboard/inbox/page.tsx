'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Send, RefreshCw, Plus, Inbox as InboxIcon } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { notifyError, notifySuccess } from '@/lib/notify';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { useRequireFinanceAccess } from '@/lib/require-super-admin';

type MailboxKey = 'INFO' | 'PARTNER' | 'BILLING' | 'PERSONAL';

interface MailboxSummary {
  key: MailboxKey;
  address: string;
  displayName: string;
  configured: boolean;
}

interface ThreadListItem {
  id: string;
  subject: string;
  participantEmail: string;
  participantName: string | null;
  lastMessageAt: string;
  mailbox: { key: MailboxKey; address: string; displayName: string };
  messages: { direction: 'IN' | 'OUT'; bodyText: string }[];
  _count: { messages: number };
}

interface ThreadMessage {
  id: string;
  direction: 'IN' | 'OUT';
  fromAddress: string;
  toAddress: string;
  bodyText: string;
  createdAt: string;
  sentBy?: { fullName: string } | null;
}

interface ThreadDetail {
  id: string;
  subject: string;
  participantEmail: string;
  mailbox: { key: MailboxKey; address: string; displayName: string };
  messages: ThreadMessage[];
}

function timeAgo(iso: string) {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diffMs / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return new Date(iso).toLocaleDateString();
}

// Real, reply-able correspondence — Info/Partner/Personal are Super-Admin-only, Billing is also
// open to Assistant Super Admin (the backend enforces this; useRequireFinanceAccess only keeps
// Sub-Admin out at the page level, matching the same visibility tier as Finance/System Health).
export default function InboxPage() {
  useRequireFinanceAccess();
  const queryClient = useQueryClient();
  const [activeKey, setActiveKey] = useState<MailboxKey | null>(null);
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const [replyBody, setReplyBody] = useState('');
  const [composeOpen, setComposeOpen] = useState(false);

  const mailboxesQuery = useQuery({
    queryKey: ['inbox-mailboxes'],
    queryFn: () => apiFetch<MailboxSummary[]>('/platform/mailboxes'),
  });
  const threadsQuery = useQuery({
    queryKey: ['inbox-threads'],
    queryFn: () => apiFetch<ThreadListItem[]>('/platform/mailboxes/threads'),
    refetchInterval: 30_000,
  });

  const mailboxes = mailboxesQuery.data ?? [];
  const activeMailboxKey = activeKey ?? mailboxes[0]?.key ?? null;
  const activeMailbox = mailboxes.find((m) => m.key === activeMailboxKey);
  const threadsForTab = (threadsQuery.data ?? []).filter((t) => t.mailbox.key === activeMailboxKey);

  const threadDetailQuery = useQuery({
    queryKey: ['inbox-thread', selectedThreadId],
    queryFn: () => apiFetch<ThreadDetail>(`/platform/mailboxes/threads/${selectedThreadId}`),
    enabled: !!selectedThreadId,
  });

  function selectThread(id: string) {
    setSelectedThreadId(id);
    setReplyBody('');
    apiFetch(`/platform/mailboxes/threads/${id}/read`, { method: 'POST' })
      .then(() => {
        queryClient.invalidateQueries({ queryKey: ['inbox-threads'] });
        queryClient.invalidateQueries({ queryKey: ['platform-notifications'] });
      })
      .catch(() => undefined);
  }

  const pollNow = useMutation({
    mutationFn: () => apiFetch(`/platform/mailboxes/${activeMailboxKey}/poll-now`, { method: 'POST' }),
    onSuccess: () => {
      notifySuccess('Checked for new mail');
      queryClient.invalidateQueries({ queryKey: ['inbox-threads'] });
    },
    onError: (err) => notifyError(err, 'Failed to check for new mail'),
  });

  const sendReply = useMutation({
    mutationFn: () =>
      apiFetch(`/platform/mailboxes/threads/${selectedThreadId}/reply`, {
        method: 'POST',
        body: JSON.stringify({ body: replyBody }),
      }),
    onSuccess: () => {
      setReplyBody('');
      queryClient.invalidateQueries({ queryKey: ['inbox-thread', selectedThreadId] });
      queryClient.invalidateQueries({ queryKey: ['inbox-threads'] });
      notifySuccess('Reply sent');
    },
    onError: (err) => notifyError(err, 'Failed to send reply'),
  });

  return (
    <div className="flex h-[calc(100vh-8rem)] flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Inbox</h1>
          <p className="mt-1 text-sm text-slate-500">
            Real correspondence from named mailboxes — replies land back here automatically.
          </p>
        </div>
        <Button onClick={() => setComposeOpen(true)} disabled={mailboxes.length === 0}>
          <Plus size={16} className="mr-1.5" />
          Compose
        </Button>
      </div>

      {mailboxesQuery.isLoading ? (
        <Skeleton className="h-96 w-full" />
      ) : (
        <>
          <div className="flex gap-1 border-b border-slate-200">
            {mailboxes.map((m) => (
              <button
                key={m.key}
                onClick={() => {
                  setActiveKey(m.key);
                  setSelectedThreadId(null);
                }}
                className={cn(
                  '-mb-px border-b-2 px-4 py-2 text-sm font-medium transition-colors',
                  activeMailboxKey === m.key
                    ? 'border-slate-900 text-slate-900'
                    : 'border-transparent text-slate-500 hover:text-slate-700',
                )}
              >
                {m.displayName}
              </button>
            ))}
          </div>

          {activeMailbox && !activeMailbox.configured && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-800">
              This mailbox isn&apos;t configured yet — add its SMTP/IMAP credentials in Platform
              Settings → Mailboxes before sending or receiving mail here.
            </div>
          )}

          <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 md:grid-cols-[320px_1fr]">
            <div className="flex flex-col overflow-hidden rounded-lg border border-slate-200 bg-white">
              <div className="flex items-center justify-between border-b border-slate-200 px-3 py-2">
                <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
                  {threadsForTab.length} conversation{threadsForTab.length === 1 ? '' : 's'}
                </span>
                <button
                  onClick={() => pollNow.mutate()}
                  disabled={pollNow.isPending || !activeMailboxKey}
                  className="flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-900 disabled:opacity-50"
                >
                  <RefreshCw size={12} className={pollNow.isPending ? 'animate-spin' : undefined} />
                  Check now
                </button>
              </div>
              <div className="flex-1 overflow-y-auto">
                {threadsForTab.length === 0 ? (
                  <div className="flex flex-col items-center gap-2 px-4 py-12 text-center text-sm text-slate-400">
                    <InboxIcon size={24} />
                    No conversations yet
                  </div>
                ) : (
                  threadsForTab.map((t) => {
                    const unread = t._count.messages > 0;
                    return (
                      <button
                        key={t.id}
                        onClick={() => selectThread(t.id)}
                        className={cn(
                          'flex w-full flex-col gap-0.5 border-b border-slate-100 px-3 py-2.5 text-left hover:bg-slate-50',
                          selectedThreadId === t.id && 'bg-slate-50',
                        )}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className={cn('truncate text-sm', unread ? 'font-semibold text-slate-900' : 'text-slate-700')}>
                            {t.participantName || t.participantEmail}
                          </span>
                          <span className="flex-shrink-0 text-xs text-slate-400">{timeAgo(t.lastMessageAt)}</span>
                        </div>
                        <p className={cn('truncate text-xs', unread ? 'font-medium text-slate-700' : 'text-slate-500')}>
                          {t.subject}
                        </p>
                        {t.messages[0] && (
                          <p className="truncate text-xs text-slate-400">{t.messages[0].bodyText}</p>
                        )}
                      </button>
                    );
                  })
                )}
              </div>
            </div>

            <div className="flex flex-col overflow-hidden rounded-lg border border-slate-200 bg-white">
              {!selectedThreadId ? (
                <div className="flex flex-1 items-center justify-center text-sm text-slate-400">
                  Select a conversation
                </div>
              ) : threadDetailQuery.isLoading || !threadDetailQuery.data ? (
                <div className="p-4">
                  <Skeleton className="h-40 w-full" />
                </div>
              ) : (
                <>
                  <div className="border-b border-slate-200 px-4 py-3">
                    <p className="text-sm font-semibold text-slate-900">{threadDetailQuery.data.subject}</p>
                    <p className="text-xs text-slate-500">
                      with {threadDetailQuery.data.participantEmail} · via {threadDetailQuery.data.mailbox.address}
                    </p>
                  </div>
                  <div className="flex-1 overflow-y-auto px-4 py-3">
                    <div className="flex flex-col gap-3">
                      {threadDetailQuery.data.messages.map((m) => (
                        <div
                          key={m.id}
                          className={cn(
                            'max-w-[85%] rounded-lg px-3 py-2 text-sm',
                            m.direction === 'OUT' ? 'ml-auto bg-slate-900 text-white' : 'bg-slate-100 text-slate-800',
                          )}
                        >
                          <p className="whitespace-pre-wrap">{m.bodyText}</p>
                          <p className={cn('mt-1 text-[11px]', m.direction === 'OUT' ? 'text-slate-300' : 'text-slate-400')}>
                            {m.direction === 'OUT' ? (m.sentBy?.fullName ?? 'You') : m.fromAddress} ·{' '}
                            {new Date(m.createdAt).toLocaleString()}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-end gap-2 border-t border-slate-200 p-3">
                    <textarea
                      value={replyBody}
                      onChange={(e) => setReplyBody(e.target.value)}
                      placeholder="Write a reply..."
                      rows={2}
                      className="flex-1 resize-none rounded-md border border-slate-300 px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900"
                    />
                    <Button
                      onClick={() => sendReply.mutate()}
                      disabled={sendReply.isPending || replyBody.trim().length === 0}
                    >
                      <Send size={14} />
                    </Button>
                  </div>
                </>
              )}
            </div>
          </div>
        </>
      )}

      {composeOpen && (
        <ComposeDialog
          mailboxes={mailboxes}
          defaultKey={activeMailboxKey}
          onClose={() => setComposeOpen(false)}
          onSent={() => {
            setComposeOpen(false);
            queryClient.invalidateQueries({ queryKey: ['inbox-threads'] });
          }}
        />
      )}
    </div>
  );
}

function ComposeDialog({
  mailboxes,
  defaultKey,
  onClose,
  onSent,
}: {
  mailboxes: MailboxSummary[];
  defaultKey: MailboxKey | null;
  onClose: () => void;
  onSent: () => void;
}) {
  const [key, setKey] = useState<MailboxKey>(defaultKey ?? mailboxes[0]?.key ?? 'INFO');
  const [to, setTo] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');

  const send = useMutation({
    mutationFn: () =>
      apiFetch(`/platform/mailboxes/${key}/send`, {
        method: 'POST',
        body: JSON.stringify({ to, subject, body }),
      }),
    onSuccess: () => {
      notifySuccess('Message sent');
      onSent();
    },
    onError: (err) => notifyError(err, 'Failed to send message'),
  });

  return (
    <div className="fixed inset-0 z-50 flex animate-fade-in items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-xl bg-white p-5 shadow-xl">
        <h2 className="text-base font-semibold text-slate-900">Compose email</h2>
        <div className="mt-4 flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-slate-700">From</label>
            <select
              className="flex h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900"
              value={key}
              onChange={(e) => setKey(e.target.value as MailboxKey)}
            >
              {mailboxes.map((m) => (
                <option key={m.key} value={m.key}>
                  {m.displayName} ({m.address})
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-slate-700">To</label>
            <Input type="email" value={to} onChange={(e) => setTo(e.target.value)} placeholder="name@example.com" />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-slate-700">Subject</label>
            <Input value={subject} onChange={(e) => setSubject(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-slate-700">Message</label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={6}
              className="rounded-md border border-slate-300 px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900"
            />
          </div>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={() => send.mutate()}
            disabled={send.isPending || !to || !subject || !body}
          >
            {send.isPending ? 'Sending...' : 'Send'}
          </Button>
        </div>
      </div>
    </div>
  );
}

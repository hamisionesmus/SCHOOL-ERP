'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery } from '@tanstack/react-query';
import { ArrowLeft, Mail, MessageSquare, Plus, Trash2, Users2 } from 'lucide-react';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import { notifyError, notifySuccess } from '@/lib/notify';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useRequireFinanceAccess } from '@/lib/require-super-admin';

interface TenantOption {
  id: string;
  name: string;
  slug: string;
}
interface AdminOption {
  id: string;
  fullName: string;
  email: string;
  role: string;
  deletedAt: string | null;
}
interface ExternalRow {
  name: string;
  email: string;
  phone: string;
}
interface ExternalContact {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
}

const OCCASIONS: { key: string; label: string; subject: string; email: string; sms: string }[] = [
  {
    key: 'new_year',
    label: 'New Year',
    subject: 'Happy New Year from Hamzone Technologies!',
    email: 'Happy New Year! Wishing your school community a term full of growth, learning, and success this year. Thank you for trusting us with your school management. Karibu tena — we look forward to serving you even better.',
    sms: 'Happy New Year from Hamzone Technologies! Wishing your school a term full of growth and success. Karibu tena.',
  },
  {
    key: 'ramadan',
    label: 'Ramadan',
    subject: 'Ramadan Kareem',
    email: 'Ramadan Kareem! As the holy month begins, we wish your school community a peaceful and blessed Ramadan — reflection, unity, and renewed strength for your staff, students, and families.',
    sms: 'Ramadan Kareem from Hamzone Technologies! Wishing your school a peaceful and blessed month.',
  },
  {
    key: 'madaraka',
    label: 'Madaraka Day',
    subject: 'Happy Madaraka Day',
    email: 'Happy Madaraka Day! As we celebrate self-governance and progress, we are proud to support Kenyan schools like yours on your own journey forward. Enjoy the holiday.',
    sms: 'Happy Madaraka Day from Hamzone Technologies! Enjoy the holiday.',
  },
  {
    key: 'mashujaa',
    label: 'Mashujaa Day',
    subject: 'Happy Mashujaa Day',
    email: 'Happy Mashujaa Day! Today we honour the heroes who shaped our nation. Thank you for the everyday dedication of educators and school staff who shape the next generation. Enjoy the holiday.',
    sms: 'Happy Mashujaa Day from Hamzone Technologies! Thank you for all you do.',
  },
  {
    key: 'jamhuri',
    label: 'Jamhuri Day',
    subject: 'Happy Jamhuri Day',
    email: "Happy Jamhuri Day! Wishing your school community a proud and joyful celebration of Kenya's independence.",
    sms: 'Happy Jamhuri Day from Hamzone Technologies!',
  },
  {
    key: 'labour',
    label: 'Labour Day',
    subject: 'Happy Labour Day',
    email: 'Happy Labour Day! We appreciate the hard work of every teacher, administrator, and staff member who keeps your school running. Enjoy a well-deserved rest today.',
    sms: 'Happy Labour Day from Hamzone Technologies! Enjoy the well-deserved rest.',
  },
  {
    key: 'maintenance',
    label: 'Scheduled Maintenance',
    subject: 'Scheduled maintenance notice',
    email: 'Scheduled Maintenance Notice: the system will be briefly unavailable for scheduled maintenance. We apologise for any inconvenience and appreciate your patience as we work to improve your experience. We will notify you again once it is complete.',
    sms: 'Scheduled maintenance notice: the system will be briefly unavailable shortly for improvements. Sorry for any inconvenience.',
  },
];

function PickerList<T>({
  items,
  search,
  onSearch,
  selected,
  onToggle,
  renderLabel,
  renderSub,
  keyOf,
  placeholder,
  emptyLabel,
}: {
  items: T[];
  search: string;
  onSearch: (v: string) => void;
  selected: string[];
  onToggle: (id: string) => void;
  renderLabel: (item: T) => string;
  renderSub?: (item: T) => string | null;
  keyOf: (item: T) => string;
  placeholder: string;
  emptyLabel: string;
}) {
  return (
    <div className="rounded-lg border border-slate-200">
      <div className="border-b border-slate-100 p-2">
        <Input value={search} onChange={(e) => onSearch(e.target.value)} placeholder={placeholder} className="h-8 text-xs" />
      </div>
      <div className="max-h-48 overflow-y-auto p-1">
        {items.length === 0 ? (
          <p className="px-2 py-3 text-center text-xs text-slate-400">{emptyLabel}</p>
        ) : (
          items.map((item) => {
            const id = keyOf(item);
            const checked = selected.includes(id);
            return (
              <label
                key={id}
                className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-xs hover:bg-slate-50"
              >
                <input type="checkbox" checked={checked} onChange={() => onToggle(id)} className="h-3.5 w-3.5" />
                <span className="flex-1 truncate">
                  <span className="font-medium text-slate-800">{renderLabel(item)}</span>
                  {renderSub?.(item) && <span className="ml-1 text-slate-400">{renderSub(item)}</span>}
                </span>
              </label>
            );
          })
        )}
      </div>
    </div>
  );
}

export default function NewCampaignPage() {
  useRequireFinanceAccess();
  const router = useRouter();

  const [channel, setChannel] = useState<'EMAIL' | 'SMS' | 'BOTH'>('BOTH');
  const [subject, setSubject] = useState('');
  const [emailBody, setEmailBody] = useState('');
  const [smsBody, setSmsBody] = useState('');
  const [scheduleMode, setScheduleMode] = useState<'now' | 'later'>('now');
  const [scheduledAt, setScheduledAt] = useState('');

  const [allSchools, setAllSchools] = useState(false);
  const [schoolsWithDebt, setSchoolsWithDebt] = useState(false);
  const [allAdmins, setAllAdmins] = useState(false);
  const [tenantIds, setTenantIds] = useState<string[]>([]);
  const [adminIds, setAdminIds] = useState<string[]>([]);
  const [externalRows, setExternalRows] = useState<ExternalRow[]>([]);
  const [savedContactIds, setSavedContactIds] = useState<string[]>([]);
  const [schoolSearch, setSchoolSearch] = useState('');
  const [adminSearch, setAdminSearch] = useState('');
  const [contactSearch, setContactSearch] = useState('');

  const { data: schoolsData } = useQuery({
    queryKey: ['tenants-picker', schoolSearch],
    queryFn: () =>
      apiFetch<{ data: TenantOption[] }>(`/platform/tenants?pageSize=50${schoolSearch ? `&q=${encodeURIComponent(schoolSearch)}` : ''}`),
  });
  const { data: adminsData } = useQuery({
    queryKey: ['admins-picker', adminSearch],
    queryFn: () => apiFetch<AdminOption[]>(`/platform/admins${adminSearch ? `?q=${encodeURIComponent(adminSearch)}` : ''}`),
  });
  const { data: contactsData } = useQuery({
    queryKey: ['external-contacts-picker', contactSearch],
    queryFn: () => apiFetch<ExternalContact[]>(`/platform/external-contacts${contactSearch ? `?q=${encodeURIComponent(contactSearch)}` : ''}`),
  });
  const activeAdmins = (adminsData ?? []).filter((a) => !a.deletedAt);

  const targets = useMemo(
    () => ({
      allSchools,
      schoolsWithDebt,
      allPlatformAdmins: allAdmins,
      tenantIds: allSchools ? [] : tenantIds,
      platformUserIds: allAdmins ? [] : adminIds,
      external: [
        ...(contactsData ?? [])
          .filter((c) => savedContactIds.includes(c.id))
          .map((c) => ({ name: c.name, email: c.email ?? undefined, phone: c.phone ?? undefined })),
        ...externalRows
          .filter((r) => r.name.trim() && (r.email.trim() || r.phone.trim()))
          .map((r) => ({ name: r.name.trim(), email: r.email.trim() || undefined, phone: r.phone.trim() || undefined })),
      ],
    }),
    [allSchools, schoolsWithDebt, allAdmins, tenantIds, adminIds, externalRows, savedContactIds, contactsData],
  );

  const { data: preview } = useQuery({
    queryKey: ['campaign-preview', targets],
    queryFn: () => apiFetch<{ count: number }>('/platform/campaigns/preview-recipients', { method: 'POST', body: JSON.stringify(targets) }),
  });

  const create = useMutation({
    mutationFn: () =>
      apiFetch<{ id: string }>('/platform/campaigns', {
        method: 'POST',
        body: JSON.stringify({
          subject,
          emailBody: channel !== 'SMS' ? emailBody : undefined,
          smsBody: channel !== 'EMAIL' ? smsBody : undefined,
          channel,
          scheduledAt: scheduleMode === 'later' && scheduledAt ? new Date(scheduledAt).toISOString() : undefined,
          targets,
        }),
      }),
    onSuccess: (campaign) => {
      notifySuccess(scheduleMode === 'later' ? 'Campaign scheduled' : 'Campaign sent');
      router.push(`/dashboard/campaigns/${campaign.id}`);
    },
    onError: (err) => notifyError(err, 'Failed to send campaign'),
  });

  function applyOccasion(o: (typeof OCCASIONS)[number]) {
    setSubject(o.subject);
    setEmailBody(o.email);
    setSmsBody(o.sms);
  }

  function updateExternal(i: number, field: keyof ExternalRow, value: string) {
    setExternalRows((rows) => rows.map((r, idx) => (idx === i ? { ...r, [field]: value } : r)));
  }

  const recipientCount = preview?.count ?? 0;
  const canSubmit =
    subject.trim().length > 0 &&
    (channel === 'SMS' || emailBody.trim().length > 0) &&
    (channel === 'EMAIL' || smsBody.trim().length > 0) &&
    recipientCount > 0 &&
    !create.isPending;

  return (
    <>
      <header className="mb-6">
        <Link href="/dashboard/campaigns" className="mb-2 inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700">
          <ArrowLeft size={13} /> Back to campaigns
        </Link>
        <h1 className="text-2xl font-semibold text-slate-900">New Campaign</h1>
        <p className="text-sm text-slate-500">Compose a broadcast and choose exactly who receives it.</p>
      </header>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Quick occasion templates</CardTitle>
              <CardDescription>Pick one to fill the message below, then edit as you like before sending.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {OCCASIONS.map((o) => (
                  <button
                    key={o.key}
                    type="button"
                    onClick={() => applyOccasion(o)}
                    className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:border-slate-900 hover:text-slate-900"
                  >
                    {o.label}
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Message</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">Channel</label>
                <div className="flex gap-2">
                  {(['BOTH', 'EMAIL', 'SMS'] as const).map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setChannel(c)}
                      className={`rounded-md border px-3 py-1.5 text-xs font-medium transition-colors ${
                        channel === c ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 text-slate-600 hover:border-slate-400'
                      }`}
                    >
                      {c === 'BOTH' ? 'Email + SMS' : c === 'EMAIL' ? 'Email only' : 'SMS only'}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">Subject</label>
                <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="e.g. Happy New Year!" />
              </div>

              {channel !== 'SMS' && (
                <div>
                  <label className="mb-1 flex items-center gap-1.5 text-xs font-medium text-slate-600">
                    <Mail size={12} /> Email body
                  </label>
                  <textarea
                    value={emailBody}
                    onChange={(e) => setEmailBody(e.target.value)}
                    rows={6}
                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900"
                  />
                </div>
              )}

              {channel !== 'EMAIL' && (
                <div>
                  <label className="mb-1 flex items-center gap-1.5 text-xs font-medium text-slate-600">
                    <MessageSquare size={12} /> SMS body
                  </label>
                  <textarea
                    value={smsBody}
                    onChange={(e) => setSmsBody(e.target.value)}
                    rows={3}
                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900"
                  />
                  <p className="mt-1 text-[11px] text-slate-400">{smsBody.length} characters — keep it short, SMS is billed per segment.</p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">When to send</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setScheduleMode('now')}
                  className={`rounded-md border px-3 py-1.5 text-xs font-medium ${
                    scheduleMode === 'now' ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 text-slate-600'
                  }`}
                >
                  Send now
                </button>
                <button
                  type="button"
                  onClick={() => setScheduleMode('later')}
                  className={`rounded-md border px-3 py-1.5 text-xs font-medium ${
                    scheduleMode === 'later' ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 text-slate-600'
                  }`}
                >
                  Schedule for later
                </button>
              </div>
              {scheduleMode === 'later' && (
                <Input type="datetime-local" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} className="max-w-xs" />
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Recipients</CardTitle>
              <CardDescription>Combine any of the options below.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <label className="flex items-center gap-2 text-sm font-medium text-slate-800">
                <input type="checkbox" checked={allSchools} onChange={(e) => setAllSchools(e.target.checked)} className="h-4 w-4" />
                All schools
              </label>
              <label className="flex items-center gap-2 text-sm font-medium text-slate-800">
                <input type="checkbox" checked={schoolsWithDebt} onChange={(e) => setSchoolsWithDebt(e.target.checked)} className="h-4 w-4" />
                Schools with pending / overdue invoices
              </label>
              <label className="flex items-center gap-2 text-sm font-medium text-slate-800">
                <input type="checkbox" checked={allAdmins} onChange={(e) => setAllAdmins(e.target.checked)} className="h-4 w-4" />
                All platform admins
              </label>

              {!allSchools && (
                <div>
                  <p className="mb-1 text-xs font-medium text-slate-600">Specific schools</p>
                  <PickerList
                    items={schoolsData?.data ?? []}
                    search={schoolSearch}
                    onSearch={setSchoolSearch}
                    selected={tenantIds}
                    onToggle={(id) => setTenantIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]))}
                    renderLabel={(t) => t.name}
                    renderSub={(t) => `(${t.slug})`}
                    keyOf={(t) => t.id}
                    placeholder="Search schools..."
                    emptyLabel="No schools found"
                  />
                </div>
              )}

              {!allAdmins && (
                <div>
                  <p className="mb-1 text-xs font-medium text-slate-600">Specific admins</p>
                  <PickerList
                    items={activeAdmins}
                    search={adminSearch}
                    onSearch={setAdminSearch}
                    selected={adminIds}
                    onToggle={(id) => setAdminIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]))}
                    renderLabel={(a) => a.fullName}
                    renderSub={(a) => a.email}
                    keyOf={(a) => a.id}
                    placeholder="Search admins..."
                    emptyLabel="No admins found"
                  />
                </div>
              )}

              <div>
                <p className="mb-1 text-xs font-medium text-slate-600">Saved external contacts — not in the system</p>
                <PickerList
                  items={contactsData ?? []}
                  search={contactSearch}
                  onSearch={setContactSearch}
                  selected={savedContactIds}
                  onToggle={(id) => setSavedContactIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]))}
                  renderLabel={(c) => c.name}
                  renderSub={(c) => c.email ?? c.phone}
                  keyOf={(c) => c.id}
                  placeholder="Search saved contacts..."
                  emptyLabel="No saved external contacts yet"
                />
              </div>

              <div>
                <div className="mb-1 flex items-center justify-between">
                  <p className="text-xs font-medium text-slate-600">Add a new person not in the system</p>
                  <button
                    type="button"
                    onClick={() => setExternalRows((rows) => [...rows, { name: '', email: '', phone: '' }])}
                    className="flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700"
                  >
                    <Plus size={12} /> Add
                  </button>
                </div>
                {externalRows.length === 0 ? (
                  <p className="text-xs text-slate-400">None added.</p>
                ) : (
                  <div className="space-y-2">
                    {externalRows.map((row, i) => (
                      <div key={i} className="flex items-center gap-1.5">
                        <Input
                          value={row.name}
                          onChange={(e) => updateExternal(i, 'name', e.target.value)}
                          placeholder="Name"
                          className="h-8 text-xs"
                        />
                        <Input
                          value={row.email}
                          onChange={(e) => updateExternal(i, 'email', e.target.value)}
                          placeholder="Email"
                          className="h-8 text-xs"
                        />
                        <Input
                          value={row.phone}
                          onChange={(e) => updateExternal(i, 'phone', e.target.value)}
                          placeholder="Phone"
                          className="h-8 text-xs"
                        />
                        <button
                          type="button"
                          onClick={() => setExternalRows((rows) => rows.filter((_, idx) => idx !== i))}
                          className="flex-shrink-0 text-slate-400 hover:text-rose-600"
                          aria-label="Remove"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="flex items-center justify-between pt-6">
              <div className="flex items-center gap-2 text-sm text-slate-600">
                <Users2 size={16} className="text-slate-400" />
                <span>
                  Will reach <strong className="text-slate-900">{recipientCount}</strong> recipient{recipientCount === 1 ? '' : 's'}
                </span>
              </div>
            </CardContent>
          </Card>

          <Button className="w-full" disabled={!canSubmit} onClick={() => create.mutate()}>
            {create.isPending ? 'Sending...' : scheduleMode === 'later' ? 'Schedule campaign' : 'Send now'}
          </Button>
        </div>
      </div>
    </>
  );
}

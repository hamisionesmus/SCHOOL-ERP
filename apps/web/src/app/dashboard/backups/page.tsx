'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Database, Archive, Download, HardDrive, Clock, FolderArchive, Timer } from 'lucide-react';
import { apiFetch, API_ORIGIN } from '@/lib/api';
import { getAccessToken } from '@/lib/auth';
import { notifyError, notifySuccess } from '@/lib/notify';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StatCard } from '@/components/ui/stat-card';
import { SkeletonCard, SkeletonTable } from '@/components/ui/skeleton';
import { Pagination } from '@/components/ui/pagination';
import { useRequireSuperAdmin } from '@/lib/require-super-admin';

interface BackupFile {
  name: string;
  sizeBytes: number;
  createdAt: string;
  kind: 'database' | 'uploads';
  archived: boolean;
}
interface BackupsPage {
  data: BackupFile[];
  meta: { page: number; pageSize: number; total: number };
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

async function downloadBackup(name: string) {
  const token = getAccessToken();
  const res = await fetch(`${API_ORIGIN}/platform/backups/${encodeURIComponent(name)}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('Download failed');
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

interface BackupStats {
  totalCount: number;
  totalSizeBytes: number;
  lastBackupAt: string | null;
  nextBackupAt: string | null;
}

function formatCountdownToNext(iso: string | null | undefined) {
  if (!iso) return 'Unknown';
  const minutes = Math.max(0, Math.round((new Date(iso).getTime() - Date.now()) / 60_000));
  if (minutes < 1) return 'Any moment now';
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rem = minutes % 60;
  return `${hours}h ${rem}m`;
}

export default function BackupsPage() {
  useRequireSuperAdmin('BACKUPS');
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const pageSize = 10;

  const { data, isLoading } = useQuery({
    queryKey: ['backups', page],
    queryFn: () => apiFetch<BackupsPage>(`/platform/backups?page=${page}&pageSize=${pageSize}`),
    refetchInterval: 10_000,
  });

  const statsQuery = useQuery({
    queryKey: ['backups-stats'],
    queryFn: () => apiFetch<BackupStats>('/platform/backups/stats'),
    refetchInterval: 10_000,
  });

  const trigger = useMutation({
    mutationFn: () => apiFetch('/platform/backups/run', { method: 'POST' }),
    onSuccess: () => {
      notifySuccess('Backup started — this runs in the background and can take a moment');
      // Auto-download the freshly created files once they land, so the Super Admin gets a local
      // copy without a second manual click (docs/SRS.md §5: this app never uploads off-box itself).
      setTimeout(async () => {
        const before = new Set((data?.data ?? []).map((f) => f.name));
        const fresh = await apiFetch<BackupsPage>(`/platform/backups?page=1&pageSize=${pageSize}`);
        const newFiles = fresh.data.filter((f) => !before.has(f.name));
        for (const f of newFiles) {
          try {
            await downloadBackup(f.name);
          } catch {
            // best-effort; the file is still visible in the list either way
          }
        }
        setPage(1);
        queryClient.invalidateQueries({ queryKey: ['backups'] });
        queryClient.invalidateQueries({ queryKey: ['backups-stats'] });
      }, 8000);
    },
    onError: (err) => notifyError(err, 'Failed to start backup'),
  });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Backups</h1>
          <p className="mt-1 text-sm text-slate-500">
            A database dump covers every school (schema-per-tenant means one Postgres database for
            all of them), plus an archive of the local-disk uploads folder. A fresh backup runs
            automatically every hour — nothing here needs a manual click to happen — and files older
            than 48 hours are compressed and moved into an archive automatically. Nothing is ever
            deleted; archived files stay downloadable below.
          </p>
        </div>
        <Button onClick={() => trigger.mutate()} disabled={trigger.isPending}>
          {trigger.isPending ? 'Starting...' : 'Run backup now'}
        </Button>
      </div>

      {statsQuery.isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
          <StatCard label="Total backups" value={statsQuery.data?.totalCount ?? 0} icon={FolderArchive} accent="blue" />
          <StatCard
            label="Total size"
            value={statsQuery.data?.totalSizeBytes ?? 0}
            formatValue={formatBytes}
            icon={HardDrive}
            accent="violet"
          />
          <StatCard
            label="Last backup"
            value={0}
            formatValue={() =>
              statsQuery.data?.lastBackupAt ? new Date(statsQuery.data.lastBackupAt).toLocaleString() : 'Never'
            }
            icon={Clock}
            accent="emerald"
          />
          <StatCard
            label="Next backup in"
            value={0}
            formatValue={() => formatCountdownToNext(statsQuery.data?.nextBackupAt)}
            icon={Timer}
            accent="amber"
          />
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Backup files</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="mb-4 text-xs text-slate-500">
            Files are written locally under{' '}
            <code className="rounded bg-slate-100 px-1">apps/api/backups/</code> and are
            auto-downloaded to your browser after a manual run — copy them off-box regularly, this
            page doesn&apos;t upload anywhere itself.
          </p>
          {isLoading ? (
            <SkeletonTable rows={3} cols={4} />
          ) : !data || data.data.length === 0 ? (
            <p className="text-sm text-slate-500">No backups yet. Run one to get started.</p>
          ) : (
            <>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-slate-500">
                    <th className="py-2 font-medium">File</th>
                    <th className="py-2 font-medium">Size</th>
                    <th className="py-2 font-medium">Created</th>
                    <th className="py-2 font-medium"></th>
                  </tr>
                </thead>
                <tbody>
                  {data.data.map((b) => (
                    <tr key={b.name} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="py-2 font-medium text-slate-900">
                        <span className="flex items-center gap-2">
                          {b.kind === 'database' ? (
                            <Database size={14} className="text-blue-500" />
                          ) : (
                            <Archive size={14} className="text-violet-500" />
                          )}
                          {b.name}
                          {b.archived && (
                            <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-500">
                              Archived
                            </span>
                          )}
                        </span>
                      </td>
                      <td className="py-2 text-slate-500">{formatBytes(b.sizeBytes)}</td>
                      <td className="py-2 text-slate-500">{new Date(b.createdAt).toLocaleString()}</td>
                      <td className="py-2 text-right">
                        <button
                          onClick={() => downloadBackup(b.name).catch((e) => notifyError(e, 'Download failed'))}
                          className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-800"
                        >
                          <Download size={13} /> Download
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <Pagination
                page={data.meta.page}
                pageCount={Math.max(1, Math.ceil(data.meta.total / data.meta.pageSize))}
                totalItems={data.meta.total}
                pageSize={data.meta.pageSize}
                onPageChange={setPage}
              />
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

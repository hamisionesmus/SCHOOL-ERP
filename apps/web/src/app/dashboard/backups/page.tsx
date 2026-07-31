'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Database, Archive } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { notifyError, notifySuccess } from '@/lib/notify';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { SkeletonTable } from '@/components/ui/skeleton';

interface BackupFile {
  name: string;
  sizeBytes: number;
  createdAt: string;
  kind: 'database' | 'uploads';
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export default function BackupsPage() {
  const queryClient = useQueryClient();

  const { data: backups, isLoading } = useQuery({
    queryKey: ['backups'],
    queryFn: () => apiFetch<BackupFile[]>('/platform/backups'),
    refetchInterval: 10_000,
  });

  const trigger = useMutation({
    mutationFn: () => apiFetch('/platform/backups/run', { method: 'POST' }),
    onSuccess: () => {
      notifySuccess('Backup started — this runs in the background and can take a moment');
      setTimeout(() => queryClient.invalidateQueries({ queryKey: ['backups'] }), 5000);
    },
    onError: (err) => notifyError(err, 'Failed to start backup'),
  });

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Backups</CardTitle>
        <Button size="sm" onClick={() => trigger.mutate()} disabled={trigger.isPending}>
          {trigger.isPending ? 'Starting...' : 'Run backup now'}
        </Button>
      </CardHeader>
      <CardContent>
        <p className="mb-4 text-xs text-slate-500">
          A single database dump covers every school (schema-per-tenant means all schools live in one
          Postgres database), plus an archive of the local-disk uploads folder. Files are written
          locally under <code className="rounded bg-slate-100 px-1">apps/api/backups/</code> — copy
          them off-box regularly, this page doesn&apos;t upload anywhere.
        </p>
        {isLoading ? (
          <SkeletonTable rows={3} cols={3} />
        ) : !backups || backups.length === 0 ? (
          <p className="text-sm text-slate-500">No backups yet. Run one to get started.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-slate-500">
                <th className="py-2 font-medium">File</th>
                <th className="py-2 font-medium">Size</th>
                <th className="py-2 font-medium">Created</th>
              </tr>
            </thead>
            <tbody>
              {backups.map((b) => (
                <tr key={b.name} className="border-b border-slate-100">
                  <td className="py-2 font-medium text-slate-900">
                    <span className="flex items-center gap-2">
                      {b.kind === 'database' ? (
                        <Database size={14} className="text-blue-500" />
                      ) : (
                        <Archive size={14} className="text-violet-500" />
                      )}
                      {b.name}
                    </span>
                  </td>
                  <td className="py-2 text-slate-500">{formatBytes(b.sizeBytes)}</td>
                  <td className="py-2 text-slate-500">{new Date(b.createdAt).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </CardContent>
    </Card>
  );
}

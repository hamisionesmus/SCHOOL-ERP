'use client';

import { useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Copy, FileText, Trash2, Upload } from 'lucide-react';
import { apiFetch, apiUpload, API_ORIGIN } from '@/lib/api';
import { notifyError, notifySuccess } from '@/lib/notify';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const CATEGORIES = ['POSTER', 'CERTIFICATE', 'BROCHURE', 'OTHER'] as const;

interface Doc {
  id: string;
  title: string;
  category: string;
  fileUrl: string;
  createdAt: string;
  uploadedBy: { fullName: string };
}

export default function CrmDocumentsPage() {
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]>('OTHER');
  const [uploading, setUploading] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['crm-documents'],
    queryFn: () => apiFetch<Doc[]>('/platform/crm/documents'),
  });

  const remove = useMutation({
    mutationFn: (id: string) => apiFetch(`/platform/crm/documents/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['crm-documents'] });
      notifySuccess('Document removed');
    },
    onError: (err) => notifyError(err, 'Failed to remove document'),
  });

  async function handleUpload() {
    const file = fileRef.current?.files?.[0];
    if (!file || !title.trim()) return;
    setUploading(true);
    try {
      const { url } = await apiUpload(file);
      await apiFetch('/platform/crm/documents', { method: 'POST', body: JSON.stringify({ title, category, fileUrl: url }) });
      notifySuccess('Document uploaded');
      setTitle('');
      if (fileRef.current) fileRef.current.value = '';
      queryClient.invalidateQueries({ queryKey: ['crm-documents'] });
    } catch (err) {
      notifyError(err, 'Failed to upload document');
    } finally {
      setUploading(false);
    }
  }

  function copyLink(fileUrl: string) {
    navigator.clipboard.writeText(`${API_ORIGIN}${fileUrl}`);
    notifySuccess('Link copied');
  }

  const documents = data ?? [];

  return (
    <>
      <header className="mb-6">
        <h1 className="text-2xl font-semibold text-slate-900">Documents</h1>
        <p className="text-sm text-slate-500">Posters, certificates, brochures — upload once, share the link anytime.</p>
      </header>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-base">Upload</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap items-end gap-3">
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Document title" className="max-w-xs" />
          <select value={category} onChange={(e) => setCategory(e.target.value as never)} className="h-10 rounded-md border border-slate-300 px-3 text-sm">
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c[0]}
                {c.slice(1).toLowerCase()}
              </option>
            ))}
          </select>
          <input ref={fileRef} type="file" className="text-sm" />
          <Button disabled={!title.trim() || uploading} onClick={handleUpload} className="gap-1.5">
            <Upload size={14} /> {uploading ? 'Uploading...' : 'Upload'}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">All Documents</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-slate-400">Loading...</p>
          ) : documents.length === 0 ? (
            <p className="text-sm text-slate-500">No documents uploaded yet.</p>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {documents.map((d) => (
                <div key={d.id} className="flex items-start gap-3 rounded-lg border border-slate-200 p-3">
                  <FileText size={18} className="mt-0.5 flex-shrink-0 text-slate-400" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-900">{d.title}</p>
                    <p className="text-xs text-slate-400">
                      {d.category} · {d.uploadedBy.fullName}
                    </p>
                  </div>
                  <div className="flex flex-shrink-0 gap-1">
                    <button onClick={() => copyLink(d.fileUrl)} className="rounded p-1 text-slate-400 hover:text-slate-700" title="Copy link">
                      <Copy size={14} />
                    </button>
                    <button onClick={() => remove.mutate(d.id)} className="rounded p-1 text-slate-400 hover:text-rose-600" title="Delete">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}

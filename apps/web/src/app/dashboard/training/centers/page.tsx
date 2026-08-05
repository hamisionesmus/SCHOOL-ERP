'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { notifyError, notifySuccess } from '@/lib/notify';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { SkeletonTable } from '@/components/ui/skeleton';

interface Center {
  id: string;
  name: string;
  location: string | null;
  studentsCount: number | null;
  headUser: { fullName: string } | null;
  _count: { programs: number; trainerProfiles: number };
}

function AddCenterDialog({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [location, setLocation] = useState('');
  const [studentsCount, setStudentsCount] = useState('');

  const create = useMutation({
    mutationFn: () =>
      apiFetch('/platform/training/centers', {
        method: 'POST',
        body: JSON.stringify({ name, location: location || undefined, studentsCount: studentsCount ? Number(studentsCount) : undefined }),
      }),
    onSuccess: () => {
      notifySuccess('Center added');
      setOpen(false);
      setName('');
      setLocation('');
      setStudentsCount('');
      onCreated();
    },
    onError: (err) => notifyError(err, 'Failed to add center'),
  });

  if (!open) {
    return (
      <Button onClick={() => setOpen(true)} className="gap-1.5">
        <Plus size={15} /> Add Center
      </Button>
    );
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl">
        <h3 className="mb-4 text-lg font-semibold text-slate-900">Add Training Center</h3>
        <div className="space-y-3">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Center name" />
          <Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Location (optional)" />
          <Input type="number" value={studentsCount} onChange={(e) => setStudentsCount(e.target.value)} placeholder="Number of students (optional)" />
        </div>
        <div className="mt-6 flex gap-3">
          <Button variant="outline" className="flex-1" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button className="flex-1" disabled={!name.trim() || create.isPending} onClick={() => create.mutate()}>
            {create.isPending ? 'Adding...' : 'Add'}
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function TrainingCentersPage() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ['training-centers'], queryFn: () => apiFetch<Center[]>('/platform/training/centers') });
  const centers = data ?? [];

  return (
    <>
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Training Centers</h1>
          <p className="text-sm text-slate-500">Where training happens, and who heads each one.</p>
        </div>
        <AddCenterDialog onCreated={() => queryClient.invalidateQueries({ queryKey: ['training-centers'] })} />
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">All Centers</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <SkeletonTable rows={3} cols={5} />
          ) : centers.length === 0 ? (
            <p className="text-sm text-slate-500">No centers yet.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-slate-500">
                  <th className="py-2 font-medium">Name</th>
                  <th className="py-2 font-medium">Location</th>
                  <th className="py-2 font-medium">Head</th>
                  <th className="py-2 font-medium">Students</th>
                  <th className="py-2 font-medium">Programs / Trainers</th>
                </tr>
              </thead>
              <tbody>
                {centers.map((c) => (
                  <tr key={c.id} className="border-b border-slate-100">
                    <td className="py-2 font-medium text-slate-900">{c.name}</td>
                    <td className="py-2 text-slate-500">{c.location ?? '—'}</td>
                    <td className="py-2 text-slate-500">{c.headUser?.fullName ?? '—'}</td>
                    <td className="py-2 text-slate-500">{c.studentsCount ?? '—'}</td>
                    <td className="py-2 text-slate-500">
                      {c._count.programs} / {c._count.trainerProfiles}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </>
  );
}

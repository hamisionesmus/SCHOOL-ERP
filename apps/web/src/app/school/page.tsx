'use client';

import { useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSession } from '@/lib/use-session';
import { apiFetch, apiUpload, API_ORIGIN, ApiError } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface GradeLevel {
  id: string;
  code: string;
  name: string;
}
interface Student {
  id: string;
  admissionNumber: string;
  firstName: string;
  lastName: string;
  photoUrl: string | null;
  gradeLevel: GradeLevel;
}

function StudentPhotoCell({ student, canEdit }: { student: Student; canEdit: boolean }) {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const uploadPhoto = useMutation({
    mutationFn: async (file: File) => {
      setUploading(true);
      const { url } = await apiUpload(file);
      return apiFetch(`/students/${student.id}`, { method: 'PATCH', body: JSON.stringify({ photoUrl: url }) });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['students'] });
      setUploading(false);
    },
    onError: () => setUploading(false),
  });

  return (
    <div className="flex items-center gap-2">
      {student.photoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={`${API_ORIGIN}${student.photoUrl}`}
          alt=""
          className="h-8 w-8 rounded-full border border-slate-200 object-cover"
        />
      ) : (
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-[10px] font-medium text-slate-400">
          {student.firstName[0]}
          {student.lastName[0]}
        </div>
      )}
      {canEdit && (
        <>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) uploadPhoto.mutate(file);
            }}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="text-xs text-slate-400 underline underline-offset-2 hover:text-slate-600"
          >
            {uploading ? '...' : 'photo'}
          </button>
        </>
      )}
    </div>
  );
}

export default function SchoolPage() {
  const { user } = useSession('tenant');
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: gradeLevels } = useQuery({
    queryKey: ['grade-levels'],
    queryFn: () => apiFetch<GradeLevel[]>('/grade-levels'),
    enabled: !!user,
  });

  const { data: students, isLoading } = useQuery({
    queryKey: ['students'],
    queryFn: () => apiFetch<Student[]>('/students'),
    enabled: !!user,
  });

  const createStudent = useMutation({
    mutationFn: (formData: FormData) =>
      apiFetch<Student>('/students', {
        method: 'POST',
        body: JSON.stringify({
          firstName: formData.get('firstName'),
          lastName: formData.get('lastName'),
          dateOfBirth: formData.get('dateOfBirth'),
          gender: formData.get('gender'),
          gradeLevelId: formData.get('gradeLevelId'),
        }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['students'] });
      setShowForm(false);
      setError(null);
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : 'Failed to create student'),
  });

  if (!user) return null;

  const canCreate = user.permissions?.includes('STUDENT:CREATE');
  const canEdit = user.permissions?.includes('STUDENT:EDIT');

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Students</CardTitle>
          {canCreate && (
            <Button size="sm" onClick={() => setShowForm((v) => !v)}>
              {showForm ? 'Cancel' : '+ Add student'}
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {showForm && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                createStudent.mutate(new FormData(e.currentTarget));
              }}
              className="mb-6 grid grid-cols-2 gap-3 rounded-lg border border-slate-200 p-4"
            >
              <Input name="firstName" placeholder="First name" required />
              <Input name="lastName" placeholder="Last name" required />
              <Input name="dateOfBirth" type="date" required />
              <select name="gender" required className="h-10 rounded-md border border-slate-300 px-3 text-sm">
                <option value="">Gender</option>
                <option value="MALE">Male</option>
                <option value="FEMALE">Female</option>
              </select>
              <select
                name="gradeLevelId"
                required
                className="col-span-2 h-10 rounded-md border border-slate-300 px-3 text-sm"
              >
                <option value="">Grade level</option>
                {gradeLevels?.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </select>
              {error && <p className="col-span-2 text-sm text-red-600">{error}</p>}
              <div className="col-span-2">
                <Button type="submit" disabled={createStudent.isPending}>
                  {createStudent.isPending ? 'Saving...' : 'Save student'}
                </Button>
              </div>
            </form>
          )}

          {isLoading ? (
            <p className="text-sm text-slate-500">Loading...</p>
          ) : !students || students.length === 0 ? (
            <p className="text-sm text-slate-500">No students yet.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-slate-500">
                  <th className="py-2 font-medium">Photo</th>
                  <th className="py-2 font-medium">Admission #</th>
                  <th className="py-2 font-medium">Name</th>
                  <th className="py-2 font-medium">Grade</th>
                </tr>
              </thead>
              <tbody>
                {students.map((s) => (
                  <tr key={s.id} className="border-b border-slate-100">
                    <td className="py-2">
                      <StudentPhotoCell student={s} canEdit={!!canEdit} />
                    </td>
                    <td className="py-2 text-slate-500">{s.admissionNumber}</td>
                    <td className="py-2 font-medium text-slate-900">
                      {s.firstName} {s.lastName}
                    </td>
                    <td className="py-2 text-slate-500">{s.gradeLevel?.name}</td>
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

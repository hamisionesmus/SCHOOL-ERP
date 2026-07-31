'use client';

import { useMemo, useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Search } from 'lucide-react';
import { useSession } from '@/lib/use-session';
import { apiFetch, apiUpload, API_ORIGIN } from '@/lib/api';
import { notifyError, notifySuccess } from '@/lib/notify';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { SkeletonTable } from '@/components/ui/skeleton';
import { MapPicker } from '@/components/ui/map-picker';
import { SortableTh } from '@/components/ui/sortable-th';
import { Pagination } from '@/components/ui/pagination';
import { useTableControls } from '@/hooks/use-table-controls';

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
  dateOfBirth: string;
  gender: string;
  photoUrl: string | null;
  gradeLevel: GradeLevel;
  gradeLevelId: string;
  addressLine: string | null;
  landmark: string | null;
  latitude: number | null;
  longitude: number | null;
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
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      setUploading(false);
      notifySuccess('Photo updated');
    },
    onError: (err) => {
      setUploading(false);
      notifyError(err, 'Failed to upload photo');
    },
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

function EditStudentDialog({
  student,
  gradeLevels,
  onClose,
}: {
  student: Student;
  gradeLevels: GradeLevel[] | undefined;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [lat, setLat] = useState<number | null>(student.latitude);
  const [lng, setLng] = useState<number | null>(student.longitude);

  const updateStudent = useMutation({
    mutationFn: (fd: FormData) =>
      apiFetch(`/students/${student.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          firstName: fd.get('firstName'),
          lastName: fd.get('lastName'),
          dateOfBirth: fd.get('dateOfBirth'),
          gender: fd.get('gender'),
          gradeLevelId: fd.get('gradeLevelId'),
          addressLine: fd.get('addressLine') || undefined,
          landmark: fd.get('landmark') || undefined,
          latitude: lat ?? undefined,
          longitude: lng ?? undefined,
        }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['students'] });
      notifySuccess('Student updated');
      onClose();
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : 'Failed to update student');
      notifyError(err, 'Failed to update student');
    },
  });

  return (
    <div className="fixed inset-0 z-[90] flex animate-fade-in items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm overflow-y-auto">
      <div className="my-8 w-full max-w-lg animate-scale-in rounded-xl bg-white p-6 shadow-2xl">
        <h2 className="mb-4 text-lg font-semibold text-slate-900">
          Edit {student.firstName} {student.lastName}
        </h2>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            updateStudent.mutate(new FormData(e.currentTarget));
          }}
          className="flex flex-col gap-3"
        >
          <div className="grid grid-cols-2 gap-3">
            <Input name="firstName" defaultValue={student.firstName} placeholder="First name" required />
            <Input name="lastName" defaultValue={student.lastName} placeholder="Last name" required />
            <Input name="dateOfBirth" type="date" defaultValue={student.dateOfBirth?.slice(0, 10)} required />
            <select
              name="gender"
              defaultValue={student.gender}
              required
              className="h-10 rounded-md border border-slate-300 px-3 text-sm"
            >
              <option value="MALE">Male</option>
              <option value="FEMALE">Female</option>
            </select>
            <select
              name="gradeLevelId"
              defaultValue={student.gradeLevelId}
              required
              className="col-span-2 h-10 rounded-md border border-slate-300 px-3 text-sm"
            >
              {gradeLevels?.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
          </div>

          <hr className="my-1 border-slate-200" />
          <p className="text-xs font-medium uppercase text-slate-400">Home location (for transport)</p>
          <Input name="addressLine" defaultValue={student.addressLine ?? ''} placeholder="Address — apartment, estate, plot, etc." />
          <Input name="landmark" defaultValue={student.landmark ?? ''} placeholder="Nearby landmark (optional)" />
          <MapPicker latitude={lat} longitude={lng} onChange={(la, lo) => { setLat(la); setLng(lo); }} />

          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="mt-2 flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={updateStudent.isPending}>
              {updateStudent.isPending ? 'Saving...' : 'Save changes'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function StudentsPage() {
  const { user } = useSession('tenant');
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createLat, setCreateLat] = useState<number | null>(null);
  const [createLng, setCreateLng] = useState<number | null>(null);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);

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

  const [search, setSearch] = useState('');
  const filtered = useMemo(() => {
    if (!students) return [];
    const q = search.trim().toLowerCase();
    if (!q) return students;
    return students.filter(
      (s) =>
        `${s.firstName} ${s.lastName}`.toLowerCase().includes(q) ||
        s.admissionNumber.toLowerCase().includes(q) ||
        s.gradeLevel?.name?.toLowerCase().includes(q),
    );
  }, [students, search]);

  const table = useTableControls(filtered, { pageSize: 10, initialSortKey: 'lastName' });

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
          addressLine: formData.get('addressLine') || undefined,
          landmark: formData.get('landmark') || undefined,
          latitude: createLat ?? undefined,
          longitude: createLng ?? undefined,
        }),
      }),
    onSuccess: (s) => {
      queryClient.invalidateQueries({ queryKey: ['students'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      setShowForm(false);
      setError(null);
      setCreateLat(null);
      setCreateLng(null);
      notifySuccess(`${s.firstName} ${s.lastName} added`);
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : 'Failed to create student');
      notifyError(err, 'Failed to create student');
    },
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
              className="mb-6 flex flex-col gap-3 rounded-lg border border-slate-200 p-4 animate-float-up"
            >
              <div className="grid grid-cols-2 gap-3">
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
              </div>

              <hr className="border-slate-200" />
              <p className="text-xs font-medium uppercase text-slate-400">Home location (for transport)</p>
              <Input name="addressLine" placeholder="Address — apartment, estate, plot, etc." />
              <Input name="landmark" placeholder="Nearby landmark (optional)" />
              <MapPicker
                latitude={createLat}
                longitude={createLng}
                onChange={(la, lo) => { setCreateLat(la); setCreateLng(lo); }}
              />

              {error && <p className="text-sm text-red-600">{error}</p>}
              <div>
                <Button type="submit" disabled={createStudent.isPending}>
                  {createStudent.isPending ? 'Saving...' : 'Save student'}
                </Button>
              </div>
            </form>
          )}

          {isLoading ? (
            <SkeletonTable rows={4} cols={4} />
          ) : !students || students.length === 0 ? (
            <p className="text-sm text-slate-500">No students yet.</p>
          ) : (
            <>
              <div className="relative mb-3 max-w-xs">
                <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by name, admission #, or grade..."
                  className="pl-8"
                />
              </div>
              {table.pageItems.length === 0 ? (
                <p className="text-sm text-slate-500">No students match &quot;{search}&quot;.</p>
              ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-slate-500">
                  <th className="py-2 font-medium">Photo</th>
                  <SortableTh label="Admission #" active={table.sortKey === 'admissionNumber'} dir={table.sortDir} onClick={() => table.toggleSort('admissionNumber')} />
                  <SortableTh label="Name" active={table.sortKey === 'lastName'} dir={table.sortDir} onClick={() => table.toggleSort('lastName')} />
                  <th className="py-2 font-medium">Grade</th>
                  <th className="py-2 font-medium">Address</th>
                  {canEdit && <th className="py-2" />}
                </tr>
              </thead>
              <tbody>
                {table.pageItems.map((s) => (
                  <tr key={s.id} className="border-b border-slate-100">
                    <td className="py-2">
                      <StudentPhotoCell student={s} canEdit={!!canEdit} />
                    </td>
                    <td className="py-2 text-slate-500">{s.admissionNumber}</td>
                    <td className="py-2 font-medium text-slate-900">
                      {s.firstName} {s.lastName}
                    </td>
                    <td className="py-2 text-slate-500">{s.gradeLevel?.name}</td>
                    <td className="py-2 text-slate-500">
                      {s.addressLine ?? <span className="text-slate-300">Not set</span>}
                    </td>
                    {canEdit && (
                      <td className="py-2 text-right">
                        <Button size="sm" variant="outline" onClick={() => setEditingStudent(s)}>
                          Edit
                        </Button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
              )}
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

      {editingStudent && (
        <EditStudentDialog
          student={editingStudent}
          gradeLevels={gradeLevels}
          onClose={() => setEditingStudent(null)}
        />
      )}
    </>
  );
}

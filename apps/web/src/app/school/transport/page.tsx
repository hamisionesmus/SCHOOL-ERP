'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSession } from '@/lib/use-session';
import { apiFetch, ApiError } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface UserRef {
  id: string;
  fullName: string;
}
interface Vehicle {
  id: string;
  plateNumber: string;
  capacity: number;
  driver: UserRef | null;
}
interface Route {
  id: string;
  name: string;
  description: string | null;
  vehicle: Vehicle | null;
  estimatedMinutes: number | null;
}
interface Student {
  id: string;
  firstName: string;
  lastName: string;
}
interface Assignment {
  id: string;
  student: Student;
  route: Route;
}

export default function TransportPage() {
  const { user } = useSession('tenant');
  const queryClient = useQueryClient();
  const [showVehicleForm, setShowVehicleForm] = useState(false);
  const [showRouteForm, setShowRouteForm] = useState(false);
  const [showAssignForm, setShowAssignForm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canManage = user?.permissions?.includes('TRANSPORT:MANAGE');

  const { data: vehicles } = useQuery({
    queryKey: ['vehicles'],
    queryFn: () => apiFetch<Vehicle[]>('/transport/vehicles'),
    enabled: !!user,
  });
  const { data: routes } = useQuery({
    queryKey: ['routes'],
    queryFn: () => apiFetch<Route[]>('/transport/routes'),
    enabled: !!user,
  });
  const { data: students } = useQuery({
    queryKey: ['students'],
    queryFn: () => apiFetch<Student[]>('/students'),
    enabled: !!user && !!canManage,
  });
  const { data: assignments } = useQuery({
    queryKey: ['transport-assignments'],
    queryFn: () => apiFetch<Assignment[]>('/transport/assignments'),
    enabled: !!user,
  });

  const createVehicle = useMutation({
    mutationFn: (fd: FormData) =>
      apiFetch('/transport/vehicles', {
        method: 'POST',
        body: JSON.stringify({ plateNumber: fd.get('plateNumber'), capacity: Number(fd.get('capacity')) }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vehicles'] });
      setShowVehicleForm(false);
      setError(null);
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : 'Failed to add vehicle'),
  });

  const createRoute = useMutation({
    mutationFn: (fd: FormData) =>
      apiFetch('/transport/routes', {
        method: 'POST',
        body: JSON.stringify({
          name: fd.get('name'),
          description: fd.get('description') || undefined,
          vehicleId: fd.get('vehicleId') || undefined,
          estimatedMinutes: fd.get('estimatedMinutes') ? Number(fd.get('estimatedMinutes')) : undefined,
        }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['routes'] });
      setShowRouteForm(false);
      setError(null);
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : 'Failed to add route'),
  });

  const assignStudent = useMutation({
    mutationFn: (fd: FormData) =>
      apiFetch('/transport/assignments', {
        method: 'POST',
        body: JSON.stringify({ studentId: fd.get('studentId'), routeId: fd.get('routeId') }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transport-assignments'] });
      setShowAssignForm(false);
      setError(null);
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : 'Failed to assign student'),
  });

  if (!user) return null;

  return (
    <>
          {canManage && (
        <div className="mb-6 grid grid-cols-2 gap-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Vehicles</CardTitle>
              <Button size="sm" onClick={() => setShowVehicleForm((v) => !v)}>
                {showVehicleForm ? 'Cancel' : '+ Add'}
              </Button>
            </CardHeader>
            <CardContent>
              {showVehicleForm && (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    createVehicle.mutate(new FormData(e.currentTarget));
                  }}
                  className="mb-3 flex flex-col gap-2 rounded-lg border border-slate-200 p-3"
                >
                  <Input name="plateNumber" placeholder="Plate number" required />
                  <Input name="capacity" type="number" min={1} placeholder="Capacity" required />
                  <Button type="submit" size="sm" disabled={createVehicle.isPending}>
                    Save
                  </Button>
                </form>
              )}
              <ul className="text-sm text-slate-600">
                {vehicles?.map((v) => (
                  <li key={v.id}>
                    {v.plateNumber} ({v.capacity} seats){v.driver && ` — driver: ${v.driver.fullName}`}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Routes</CardTitle>
              <Button size="sm" onClick={() => setShowRouteForm((v) => !v)}>
                {showRouteForm ? 'Cancel' : '+ Add'}
              </Button>
            </CardHeader>
            <CardContent>
              {showRouteForm && (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    createRoute.mutate(new FormData(e.currentTarget));
                  }}
                  className="mb-3 flex flex-col gap-2 rounded-lg border border-slate-200 p-3"
                >
                  <Input name="name" placeholder="Route name" required />
                  <select name="vehicleId" className="h-10 rounded-md border border-slate-300 px-3 text-sm">
                    <option value="">Vehicle (optional)</option>
                    {vehicles?.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.plateNumber}
                      </option>
                    ))}
                  </select>
                  <Input
                    name="estimatedMinutes"
                    type="number"
                    min={1}
                    placeholder="Est. travel time (minutes, for pickup SMS)"
                  />
                  <Button type="submit" size="sm" disabled={createRoute.isPending}>
                    Save
                  </Button>
                </form>
              )}
              <ul className="text-sm text-slate-600">
                {routes?.map((r) => (
                  <li key={r.id}>
                    {r.name}
                    {r.vehicle && ` — ${r.vehicle.plateNumber}`}
                    {r.estimatedMinutes && ` · ~${r.estimatedMinutes} min`}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>
      )}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Student assignments</CardTitle>
          {canManage && (
            <Button size="sm" onClick={() => setShowAssignForm((v) => !v)}>
              {showAssignForm ? 'Cancel' : '+ Assign student'}
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {showAssignForm && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                assignStudent.mutate(new FormData(e.currentTarget));
              }}
              className="mb-4 grid grid-cols-2 gap-3 rounded-lg border border-slate-200 p-4"
            >
              <select name="studentId" required className="h-10 rounded-md border border-slate-300 px-3 text-sm">
                <option value="">Student</option>
                {students?.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.firstName} {s.lastName}
                  </option>
                ))}
              </select>
              <select name="routeId" required className="h-10 rounded-md border border-slate-300 px-3 text-sm">
                <option value="">Route</option>
                {routes?.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
              {error && <p className="col-span-2 text-sm text-red-600">{error}</p>}
              <div className="col-span-2">
                <Button type="submit" size="sm" disabled={assignStudent.isPending}>
                  Assign
                </Button>
              </div>
            </form>
          )}
          {!assignments || assignments.length === 0 ? (
            <p className="text-sm text-slate-500">No assignments yet.</p>
          ) : (
            <ul className="flex flex-col gap-1 text-sm">
              {assignments.map((a) => (
                <li key={a.id}>
                  <span className="font-medium text-slate-900">
                    {a.student.firstName} {a.student.lastName}
                  </span>{' '}
                  <span className="text-slate-500">
                    → {a.route.name}
                    {a.route.vehicle && ` (${a.route.vehicle.plateNumber}${a.route.vehicle.driver ? `, driver ${a.route.vehicle.driver.fullName}` : ''})`}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </>
  );
}

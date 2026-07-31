'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSession } from '@/lib/use-session';
import { apiFetch, ApiError } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { SchoolNav } from '@/components/school-nav';

interface Item {
  id: string;
  name: string;
  category: string;
  quantity: number;
  unit: string;
  reorderLevel: number;
}

export default function InventoryPage() {
  const { user, logout } = useSession('tenant');
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [movementDrafts, setMovementDrafts] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  const { data: items, isLoading } = useQuery({
    queryKey: ['inventory-items'],
    queryFn: () => apiFetch<Item[]>('/inventory/items'),
    enabled: !!user,
  });

  const createItem = useMutation({
    mutationFn: (fd: FormData) =>
      apiFetch('/inventory/items', {
        method: 'POST',
        body: JSON.stringify({
          name: fd.get('name'),
          category: fd.get('category'),
          unit: fd.get('unit'),
          reorderLevel: Number(fd.get('reorderLevel')) || 0,
        }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory-items'] });
      setShowForm(false);
      setError(null);
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : 'Failed to add item'),
  });

  const recordMovement = useMutation({
    mutationFn: ({ itemId, type, quantity }: { itemId: string; type: 'IN' | 'OUT'; quantity: number }) =>
      apiFetch(`/inventory/items/${itemId}/movements`, { method: 'POST', body: JSON.stringify({ type, quantity }) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['inventory-items'] }),
    onError: (err) => setError(err instanceof ApiError ? err.message : 'Failed to record movement'),
  });

  if (!user) return null;

  return (
    <main className="mx-auto max-w-4xl px-4 py-10">
      <SchoolNav user={user} onLogout={logout} />

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Inventory</CardTitle>
          <Button size="sm" onClick={() => setShowForm((v) => !v)}>
            {showForm ? 'Cancel' : '+ Add item'}
          </Button>
        </CardHeader>
        <CardContent>
          {showForm && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                createItem.mutate(new FormData(e.currentTarget));
              }}
              className="mb-4 grid grid-cols-2 gap-3 rounded-lg border border-slate-200 p-4"
            >
              <Input name="name" placeholder="Item name" required className="col-span-2" />
              <Input name="category" placeholder="Category" required />
              <Input name="unit" placeholder="Unit (pcs, kg...)" required />
              <Input name="reorderLevel" type="number" min={0} placeholder="Reorder level" />
              {error && <p className="col-span-2 text-sm text-red-600">{error}</p>}
              <div className="col-span-2">
                <Button type="submit" disabled={createItem.isPending}>
                  {createItem.isPending ? 'Saving...' : 'Add item'}
                </Button>
              </div>
            </form>
          )}

          {isLoading ? (
            <p className="text-sm text-slate-500">Loading...</p>
          ) : !items || items.length === 0 ? (
            <p className="text-sm text-slate-500">No inventory items yet.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-slate-500">
                  <th className="py-2 font-medium">Item</th>
                  <th className="py-2 font-medium">Category</th>
                  <th className="py-2 font-medium">Stock</th>
                  <th className="py-2" />
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id} className="border-b border-slate-100">
                    <td className="py-2 font-medium text-slate-900">{item.name}</td>
                    <td className="py-2 text-slate-500">{item.category}</td>
                    <td className="py-2 text-slate-500">
                      {item.quantity} {item.unit}
                      {item.quantity <= item.reorderLevel && (
                        <span className="ml-1 text-xs font-medium text-red-600">low stock</span>
                      )}
                    </td>
                    <td className="py-2 text-right">
                      <div className="flex justify-end gap-2">
                        <Input
                          type="number"
                          min={1}
                          placeholder="Qty"
                          className="h-8 w-20 text-xs"
                          value={movementDrafts[item.id] ?? ''}
                          onChange={(e) => setMovementDrafts((d) => ({ ...d, [item.id]: e.target.value }))}
                        />
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            recordMovement.mutate({ itemId: item.id, type: 'IN', quantity: Number(movementDrafts[item.id]) })
                          }
                        >
                          Stock in
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            recordMovement.mutate({ itemId: item.id, type: 'OUT', quantity: Number(movementDrafts[item.id]) })
                          }
                        >
                          Stock out
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </main>
  );
}

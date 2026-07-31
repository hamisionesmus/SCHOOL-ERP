'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSession } from '@/lib/use-session';
import { apiFetch } from '@/lib/api';
import { notifyError, notifySuccess } from '@/lib/notify';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { SkeletonTable } from '@/components/ui/skeleton';

const KITCHEN_CATEGORY = 'Kitchen';

interface Item {
  id: string;
  name: string;
  category: string;
  quantity: number;
  unit: string;
  reorderLevel: number;
}
interface Movement {
  id: string;
  type: 'IN' | 'OUT';
  quantity: number;
  reason: string | null;
  createdAt: string;
  item: Item;
}

// The Kitchen module deliberately doesn't introduce a parallel stock system — it's the existing
// Inventory engine (InventoryItem/StockMovement, same running-quantity math) filtered to
// category="Kitchen", the same way docs/SRS.md always described "category-specific views" as the
// plan for kitchen/lab/ICT/uniform stock rather than one-off modules per category.
export default function KitchenPage() {
  const { user } = useSession('tenant');
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, { qty: string; reason: string }>>({});

  const { data: items, isLoading } = useQuery({
    queryKey: ['kitchen-items'],
    queryFn: () => apiFetch<Item[]>(`/inventory/items?category=${encodeURIComponent(KITCHEN_CATEGORY)}`),
    enabled: !!user,
  });
  const { data: movements } = useQuery({
    queryKey: ['kitchen-movements'],
    queryFn: () => apiFetch<Movement[]>('/inventory/movements'),
    enabled: !!user,
  });
  const kitchenMovements = (movements ?? []).filter((m) => m.item.category === KITCHEN_CATEGORY).slice(0, 15);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['kitchen-items'] });
    queryClient.invalidateQueries({ queryKey: ['kitchen-movements'] });
  };

  const createItem = useMutation({
    mutationFn: (fd: FormData) =>
      apiFetch('/inventory/items', {
        method: 'POST',
        body: JSON.stringify({
          name: fd.get('name'),
          category: KITCHEN_CATEGORY,
          unit: fd.get('unit'),
          reorderLevel: Number(fd.get('reorderLevel')) || 0,
        }),
      }),
    onSuccess: (_data, fd) => {
      invalidate();
      setShowForm(false);
      setError(null);
      notifySuccess(`${fd.get('name')} added to kitchen stock`);
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : 'Failed to add item');
      notifyError(err, 'Failed to add item');
    },
  });

  const recordMovement = useMutation({
    mutationFn: ({ itemId, type, quantity, reason }: { itemId: string; type: 'IN' | 'OUT'; quantity: number; reason?: string }) =>
      apiFetch(`/inventory/items/${itemId}/movements`, {
        method: 'POST',
        body: JSON.stringify({ type, quantity, reason: reason || undefined }),
      }),
    onSuccess: (_data, vars) => {
      invalidate();
      setDrafts((d) => ({ ...d, [vars.itemId]: { qty: '', reason: '' } }));
      notifySuccess(vars.type === 'IN' ? 'Stock received' : 'Usage recorded');
    },
    onError: (err) => notifyError(err, 'Failed to record stock movement'),
  });

  if (!user) return null;

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Kitchen Stock</CardTitle>
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
              className="mb-4 grid grid-cols-2 gap-3 rounded-lg border border-slate-200 p-4 animate-float-up"
            >
              <Input name="name" placeholder="Item name, e.g. Maize flour" required className="col-span-2" />
              <select name="unit" required className="h-10 rounded-md border border-slate-300 px-3 text-sm">
                <option value="">Unit</option>
                <option value="kg">Kilograms (kg)</option>
                <option value="litres">Litres</option>
                <option value="bags">Bags</option>
                <option value="pcs">Pieces</option>
                <option value="crates">Crates</option>
              </select>
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
            <SkeletonTable rows={3} cols={3} />
          ) : !items || items.length === 0 ? (
            <p className="text-sm text-slate-500">No kitchen stock items yet.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-slate-500">
                  <th className="py-2 font-medium">Item</th>
                  <th className="py-2 font-medium">Remaining</th>
                  <th className="py-2 font-medium">Record intake / usage</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => {
                  const draft = drafts[item.id] ?? { qty: '', reason: '' };
                  return (
                    <tr key={item.id} className="border-b border-slate-100">
                      <td className="py-2 font-medium text-slate-900">{item.name}</td>
                      <td className="py-2">
                        <span className={item.quantity <= item.reorderLevel ? 'font-medium text-rose-600' : 'text-slate-700'}>
                          {item.quantity} {item.unit}
                        </span>
                        {item.quantity <= item.reorderLevel && (
                          <span className="ml-1.5 text-xs text-rose-500">low stock</span>
                        )}
                      </td>
                      <td className="py-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <Input
                            type="number"
                            min={1}
                            placeholder="Qty"
                            className="h-8 w-20 text-xs"
                            value={draft.qty}
                            onChange={(e) => setDrafts((d) => ({ ...d, [item.id]: { ...draft, qty: e.target.value } }))}
                          />
                          <Input
                            placeholder="Reason / source (optional)"
                            className="h-8 w-40 text-xs"
                            value={draft.reason}
                            onChange={(e) => setDrafts((d) => ({ ...d, [item.id]: { ...draft, reason: e.target.value } }))}
                          />
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={!draft.qty || recordMovement.isPending}
                            onClick={() =>
                              recordMovement.mutate({ itemId: item.id, type: 'IN', quantity: Number(draft.qty), reason: draft.reason })
                            }
                          >
                            Stock in
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={!draft.qty || recordMovement.isPending}
                            onClick={() =>
                              recordMovement.mutate({ itemId: item.id, type: 'OUT', quantity: Number(draft.qty), reason: draft.reason })
                            }
                          >
                            Record usage
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recent activity</CardTitle>
        </CardHeader>
        <CardContent>
          {kitchenMovements.length === 0 ? (
            <p className="text-sm text-slate-500">No stock movements recorded yet.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {kitchenMovements.map((m) => (
                <li key={m.id} className="flex items-center justify-between text-sm">
                  <span>
                    <span className={m.type === 'IN' ? 'text-emerald-600' : 'text-amber-600'}>
                      {m.type === 'IN' ? '+' : '-'}
                      {m.quantity} {m.item.unit}
                    </span>{' '}
                    <span className="text-slate-700">{m.item.name}</span>
                    {m.reason && <span className="text-slate-400"> · {m.reason}</span>}
                  </span>
                  <span className="text-xs text-slate-400">{new Date(m.createdAt).toLocaleString()}</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

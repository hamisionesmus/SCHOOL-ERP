'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSession } from '@/lib/use-session';
import { apiFetch, ApiError } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { SchoolNav } from '@/components/school-nav';

interface Book {
  id: string;
  title: string;
  author: string;
  availableCopies: number;
  totalCopies: number;
}
interface Student {
  id: string;
  firstName: string;
  lastName: string;
}
interface Loan {
  id: string;
  book: Book;
  student: Student;
  borrowedAt: string;
  dueDate: string;
  returnedAt: string | null;
  fineAmount: number;
}

export default function LibraryPage() {
  const { user, logout } = useSession('tenant');
  const queryClient = useQueryClient();
  const [showBookForm, setShowBookForm] = useState(false);
  const [showLoanForm, setShowLoanForm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canManage = user?.permissions?.includes('LIBRARY:MANAGE');

  const { data: books } = useQuery({
    queryKey: ['books'],
    queryFn: () => apiFetch<Book[]>('/library/books'),
    enabled: !!user,
  });
  const { data: students } = useQuery({
    queryKey: ['students'],
    queryFn: () => apiFetch<Student[]>('/students'),
    enabled: !!user && !!canManage,
  });
  const { data: loans, isLoading } = useQuery({
    queryKey: ['loans'],
    queryFn: () => apiFetch<Loan[]>('/library/loans'),
    enabled: !!user,
  });

  const createBook = useMutation({
    mutationFn: (fd: FormData) =>
      apiFetch('/library/books', {
        method: 'POST',
        body: JSON.stringify({
          title: fd.get('title'),
          author: fd.get('author'),
          isbn: fd.get('isbn') || undefined,
          totalCopies: Number(fd.get('totalCopies')),
        }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['books'] });
      setShowBookForm(false);
      setError(null);
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : 'Failed to add book'),
  });

  const issueLoan = useMutation({
    mutationFn: (fd: FormData) =>
      apiFetch('/library/loans', {
        method: 'POST',
        body: JSON.stringify({
          bookId: fd.get('bookId'),
          studentId: fd.get('studentId'),
          dueDate: fd.get('dueDate'),
        }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['loans'] });
      queryClient.invalidateQueries({ queryKey: ['books'] });
      setShowLoanForm(false);
      setError(null);
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : 'Failed to issue loan'),
  });

  const returnLoan = useMutation({
    mutationFn: (loanId: string) => apiFetch(`/library/loans/${loanId}/return`, { method: 'PATCH' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['loans'] });
      queryClient.invalidateQueries({ queryKey: ['books'] });
    },
  });

  if (!user) return null;

  return (
    <main className="mx-auto max-w-4xl px-4 py-10">
      <SchoolNav user={user} onLogout={logout} />

      <Card className="mb-6">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Books</CardTitle>
          {canManage && (
            <Button size="sm" onClick={() => setShowBookForm((v) => !v)}>
              {showBookForm ? 'Cancel' : '+ Add book'}
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {showBookForm && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                createBook.mutate(new FormData(e.currentTarget));
              }}
              className="mb-4 grid grid-cols-2 gap-3 rounded-lg border border-slate-200 p-4"
            >
              <Input name="title" placeholder="Title" required className="col-span-2" />
              <Input name="author" placeholder="Author" required />
              <Input name="isbn" placeholder="ISBN (optional)" />
              <Input name="totalCopies" type="number" min={1} placeholder="Copies" required />
              <div className="col-span-2">
                <Button type="submit" disabled={createBook.isPending}>
                  {createBook.isPending ? 'Saving...' : 'Add book'}
                </Button>
              </div>
            </form>
          )}
          {!books || books.length === 0 ? (
            <p className="text-sm text-slate-500">No books in the catalogue yet.</p>
          ) : (
            <ul className="flex flex-col gap-1">
              {books.map((b) => (
                <li key={b.id} className="flex justify-between text-sm">
                  <span className="text-slate-900">
                    {b.title} <span className="text-slate-500">by {b.author}</span>
                  </span>
                  <span className="text-slate-500">
                    {b.availableCopies}/{b.totalCopies} available
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Loans</CardTitle>
          {canManage && (
            <Button size="sm" onClick={() => setShowLoanForm((v) => !v)}>
              {showLoanForm ? 'Cancel' : '+ Issue loan'}
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {showLoanForm && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                issueLoan.mutate(new FormData(e.currentTarget));
              }}
              className="mb-4 grid grid-cols-2 gap-3 rounded-lg border border-slate-200 p-4"
            >
              <select name="bookId" required className="h-10 rounded-md border border-slate-300 px-3 text-sm">
                <option value="">Book</option>
                {books?.map((b) => (
                  <option key={b.id} value={b.id} disabled={b.availableCopies === 0}>
                    {b.title} ({b.availableCopies} left)
                  </option>
                ))}
              </select>
              <select name="studentId" required className="h-10 rounded-md border border-slate-300 px-3 text-sm">
                <option value="">Student</option>
                {students?.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.firstName} {s.lastName}
                  </option>
                ))}
              </select>
              <Input name="dueDate" type="date" required className="col-span-2" />
              {error && <p className="col-span-2 text-sm text-red-600">{error}</p>}
              <div className="col-span-2">
                <Button type="submit" disabled={issueLoan.isPending}>
                  {issueLoan.isPending ? 'Issuing...' : 'Issue loan'}
                </Button>
              </div>
            </form>
          )}
          {isLoading ? (
            <p className="text-sm text-slate-500">Loading...</p>
          ) : !loans || loans.length === 0 ? (
            <p className="text-sm text-slate-500">No loans yet.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-slate-500">
                  <th className="py-2 font-medium">Book</th>
                  <th className="py-2 font-medium">Student</th>
                  <th className="py-2 font-medium">Due</th>
                  <th className="py-2 font-medium">Status</th>
                  <th className="py-2" />
                </tr>
              </thead>
              <tbody>
                {loans.map((l) => (
                  <tr key={l.id} className="border-b border-slate-100">
                    <td className="py-2 text-slate-900">{l.book.title}</td>
                    <td className="py-2 text-slate-500">
                      {l.student.firstName} {l.student.lastName}
                    </td>
                    <td className="py-2 text-slate-500">{new Date(l.dueDate).toLocaleDateString()}</td>
                    <td className="py-2 text-slate-500">
                      {l.returnedAt ? `Returned${l.fineAmount > 0 ? ` (fine KES ${l.fineAmount})` : ''}` : 'Out'}
                    </td>
                    <td className="py-2 text-right">
                      {canManage && !l.returnedAt && (
                        <Button size="sm" variant="outline" onClick={() => returnLoan.mutate(l.id)}>
                          Mark returned
                        </Button>
                      )}
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

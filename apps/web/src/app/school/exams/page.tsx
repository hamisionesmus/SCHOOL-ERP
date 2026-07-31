'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSession } from '@/lib/use-session';
import { apiFetch, ApiError, API_ORIGIN } from '@/lib/api';
import { getAccessToken } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface Subject {
  id: string;
  name: string;
  code: string;
}
interface SchoolClass {
  id: string;
  name: string;
}
interface Exam {
  id: string;
  name: string;
  examType: string;
  term: number;
}
interface ExamSubject {
  id: string;
  examId: string;
  maxScore: number;
  scoringMode: 'NUMERIC' | 'RUBRIC';
  status: 'DRAFT' | 'SUBMITTED' | 'APPROVED';
  reviewComment: string | null;
  subject: Subject;
  schoolClass: SchoolClass;
}
interface Student {
  id: string;
  firstName: string;
  lastName: string;
  currentClassId: string | null;
}
interface ReportCardLine {
  subject: string;
  maxScore: number;
  score: number | null;
  rubricLevel: string | null;
  comment: string | null;
}

const RUBRIC_LEVELS = ['EE', 'ME', 'AE', 'BE'] as const;

export default function ExamsPage() {
  const { user } = useSession('tenant');
  const queryClient = useQueryClient();
  const [selectedExamId, setSelectedExamId] = useState('');
  const [showExamForm, setShowExamForm] = useState(false);
  const [showSubjectForm, setShowSubjectForm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reportCardStudentId, setReportCardStudentId] = useState('');
  const [downloadingPdf, setDownloadingPdf] = useState(false);

  async function downloadReportCardPdf(examId: string, studentId: string) {
    setDownloadingPdf(true);
    try {
      const token = getAccessToken();
      const res = await fetch(`${API_ORIGIN}/exams/${examId}/report-card/${studentId}/pdf`, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      if (!res.ok) throw new Error('Failed to generate PDF');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'report-card.pdf';
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setDownloadingPdf(false);
    }
  }
  const [draftMarks, setDraftMarks] = useState<Record<string, { score?: string; rubricLevel?: string }>>({});

  const perms = user?.permissions ?? [];
  const canManage = perms.includes('EXAM:MANAGE');
  const canApprove = perms.includes('EXAM:APPROVE');
  const canReopen = perms.includes('EXAM:REOPEN');
  const canEnterAny = perms.includes('EXAM:ENTER_MARKS') || canManage;

  const { data: exams } = useQuery({
    queryKey: ['exams'],
    queryFn: () => apiFetch<Exam[]>('/exams'),
    enabled: !!user,
  });
  const { data: academicYears } = useQuery({
    queryKey: ['academic-years'],
    queryFn: () => apiFetch<{ id: string; name: string }[]>('/academic-years'),
    enabled: !!user && canManage,
  });
  const { data: subjects } = useQuery({
    queryKey: ['subjects'],
    queryFn: () => apiFetch<Subject[]>('/subjects'),
    enabled: !!user && canManage,
  });
  const { data: classes } = useQuery({
    queryKey: ['classes'],
    queryFn: () => apiFetch<SchoolClass[]>('/classes'),
    enabled: !!user && canManage,
  });
  const { data: students } = useQuery({
    queryKey: ['students'],
    queryFn: () => apiFetch<Student[]>('/students'),
    enabled: !!user,
  });

  const { data: examSubjects } = useQuery({
    queryKey: ['exam-subjects', selectedExamId],
    queryFn: () => apiFetch<ExamSubject[]>(`/exam-subjects?examId=${selectedExamId}`),
    enabled: !!user && !!selectedExamId && canEnterAny,
  });

  const invalidateExamSubjects = () => queryClient.invalidateQueries({ queryKey: ['exam-subjects', selectedExamId] });

  const createExam = useMutation({
    mutationFn: (fd: FormData) =>
      apiFetch('/exams', {
        method: 'POST',
        body: JSON.stringify({
          name: fd.get('name'),
          examType: fd.get('examType'),
          academicYearId: fd.get('academicYearId'),
          term: Number(fd.get('term')),
          startDate: fd.get('startDate'),
          endDate: fd.get('endDate'),
        }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['exams'] });
      setShowExamForm(false);
      setError(null);
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : 'Failed to create exam'),
  });

  const createExamSubject = useMutation({
    mutationFn: (fd: FormData) =>
      apiFetch(`/exams/${selectedExamId}/subjects`, {
        method: 'POST',
        body: JSON.stringify({
          subjectId: fd.get('subjectId'),
          classId: fd.get('classId'),
          maxScore: Number(fd.get('maxScore')) || 100,
          scoringMode: fd.get('scoringMode'),
        }),
      }),
    onSuccess: () => {
      invalidateExamSubjects();
      setShowSubjectForm(false);
      setError(null);
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : 'Failed to add exam subject'),
  });

  interface MarkEntry {
    studentId: string;
    score?: number;
    rubricLevel?: string;
  }

  const saveMarks = useMutation({
    mutationFn: ({ examSubjectId, entries }: { examSubjectId: string; entries: MarkEntry[] }) =>
      apiFetch(`/exam-subjects/${examSubjectId}/marks`, { method: 'POST', body: JSON.stringify({ entries }) }),
    onSuccess: invalidateExamSubjects,
    onError: (err) => setError(err instanceof ApiError ? err.message : 'Failed to save marks'),
  });

  const workflow = useMutation({
    mutationFn: ({ examSubjectId, action }: { examSubjectId: string; action: string }) =>
      apiFetch(`/exam-subjects/${examSubjectId}/${action}`, { method: 'PATCH' }),
    onSuccess: () => {
      invalidateExamSubjects();
      // Approve/reject/reopen change which marks are visible on the report card below.
      queryClient.invalidateQueries({ queryKey: ['report-card', selectedExamId] });
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : 'Action failed'),
  });

  const { data: reportCard } = useQuery({
    queryKey: ['report-card', selectedExamId, reportCardStudentId],
    queryFn: () => apiFetch<ReportCardLine[]>(`/exams/${selectedExamId}/report-card/${reportCardStudentId}`),
    enabled: !!user && !!selectedExamId && !!reportCardStudentId,
  });

  const myStudents = useMemo(() => students ?? [], [students]);

  if (!user) return null;

  return (
    <>
          <Card className="mb-6">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Exams</CardTitle>
          {canManage && (
            <Button size="sm" onClick={() => setShowExamForm((v) => !v)}>
              {showExamForm ? 'Cancel' : '+ New exam'}
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {showExamForm && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                createExam.mutate(new FormData(e.currentTarget));
              }}
              className="mb-4 grid grid-cols-2 gap-3 rounded-lg border border-slate-200 p-4"
            >
              <Input name="name" placeholder="Exam name, e.g. Term 2 CAT 1" required className="col-span-2" />
              <select name="examType" required className="h-10 rounded-md border border-slate-300 px-3 text-sm">
                <option value="">Type</option>
                {['CAT', 'MIDTERM', 'ENDTERM', 'CBC_ASSESSMENT', 'PROJECT', 'PRACTICAL'].map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
              <Input name="term" type="number" min={1} placeholder="Term" required />
              <select
                name="academicYearId"
                required
                className="col-span-2 h-10 rounded-md border border-slate-300 px-3 text-sm"
              >
                <option value="">Academic year</option>
                {academicYears?.map((y) => (
                  <option key={y.id} value={y.id}>
                    {y.name}
                  </option>
                ))}
              </select>
              <Input name="startDate" type="date" required />
              <Input name="endDate" type="date" required />
              <div className="col-span-2">
                <Button type="submit" disabled={createExam.isPending}>
                  {createExam.isPending ? 'Saving...' : 'Create exam'}
                </Button>
              </div>
            </form>
          )}

          <select
            value={selectedExamId}
            onChange={(e) => {
              setSelectedExamId(e.target.value);
              setReportCardStudentId('');
            }}
            className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm"
          >
            <option value="">Select an exam</option>
            {exams?.map((ex) => (
              <option key={ex.id} value={ex.id}>
                {ex.name} ({ex.examType}, Term {ex.term})
              </option>
            ))}
          </select>
          {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
        </CardContent>
      </Card>

      {selectedExamId && canEnterAny && (
        <Card className="mb-6">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Subjects &amp; marks</CardTitle>
            {canManage && (
              <Button size="sm" onClick={() => setShowSubjectForm((v) => !v)}>
                {showSubjectForm ? 'Cancel' : '+ Add subject'}
              </Button>
            )}
          </CardHeader>
          <CardContent>
            {showSubjectForm && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  createExamSubject.mutate(new FormData(e.currentTarget));
                }}
                className="mb-4 grid grid-cols-2 gap-3 rounded-lg border border-slate-200 p-4"
              >
                <select name="subjectId" required className="h-10 rounded-md border border-slate-300 px-3 text-sm">
                  <option value="">Subject</option>
                  {subjects?.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
                <select name="classId" required className="h-10 rounded-md border border-slate-300 px-3 text-sm">
                  <option value="">Class</option>
                  {classes?.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
                <Input name="maxScore" type="number" placeholder="Max score (default 100)" />
                <select name="scoringMode" className="h-10 rounded-md border border-slate-300 px-3 text-sm">
                  <option value="NUMERIC">Numeric score</option>
                  <option value="RUBRIC">CBC rubric (EE/ME/AE/BE)</option>
                </select>
                <div className="col-span-2">
                  <Button type="submit" disabled={createExamSubject.isPending}>
                    {createExamSubject.isPending ? 'Saving...' : 'Add subject to exam'}
                  </Button>
                </div>
              </form>
            )}

            {!examSubjects || examSubjects.length === 0 ? (
              <p className="text-sm text-slate-500">No subjects added to this exam yet.</p>
            ) : (
              <div className="flex flex-col gap-4">
                {examSubjects.map((es) => {
                  const classStudents = myStudents.filter((s) => s.currentClassId === es.schoolClass.id);
                  return (
                    <div key={es.id} className="rounded-lg border border-slate-200 p-4">
                      <div className="mb-3 flex items-center justify-between">
                        <div>
                          <p className="font-medium text-slate-900">
                            {es.subject.name} · {es.schoolClass.name}
                          </p>
                          <p className="text-xs text-slate-500">
                            Max {es.maxScore} · {es.scoringMode}
                            {es.reviewComment && ` · "${es.reviewComment}"`}
                          </p>
                        </div>
                        <Badge status={es.status} />
                      </div>

                      {es.status === 'DRAFT' && (
                        <>
                          <table className="w-full text-sm">
                            <tbody>
                              {classStudents.map((s) => (
                                <tr key={s.id} className="border-b border-slate-100">
                                  <td className="py-1.5">
                                    {s.firstName} {s.lastName}
                                  </td>
                                  <td className="py-1.5 text-right">
                                    {es.scoringMode === 'NUMERIC' ? (
                                      <input
                                        type="number"
                                        min={0}
                                        max={es.maxScore}
                                        className="h-8 w-20 rounded-md border border-slate-300 px-2 text-xs"
                                        value={draftMarks[s.id]?.score ?? ''}
                                        onChange={(e) =>
                                          setDraftMarks((d) => ({ ...d, [s.id]: { ...d[s.id], score: e.target.value } }))
                                        }
                                      />
                                    ) : (
                                      <select
                                        className="h-8 rounded-md border border-slate-300 px-2 text-xs"
                                        value={draftMarks[s.id]?.rubricLevel ?? ''}
                                        onChange={(e) =>
                                          setDraftMarks((d) => ({
                                            ...d,
                                            [s.id]: { ...d[s.id], rubricLevel: e.target.value },
                                          }))
                                        }
                                      >
                                        <option value="">-</option>
                                        {RUBRIC_LEVELS.map((r) => (
                                          <option key={r} value={r}>
                                            {r}
                                          </option>
                                        ))}
                                      </select>
                                    )}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                          <div className="mt-3 flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={saveMarks.isPending}
                              onClick={() =>
                                saveMarks.mutate({
                                  examSubjectId: es.id,
                                  entries: classStudents.map((s) => ({
                                    studentId: s.id,
                                    score:
                                      es.scoringMode === 'NUMERIC' && draftMarks[s.id]?.score
                                        ? Number(draftMarks[s.id].score)
                                        : undefined,
                                    rubricLevel: es.scoringMode === 'RUBRIC' ? draftMarks[s.id]?.rubricLevel : undefined,
                                  })),
                                })
                              }
                            >
                              Save marks
                            </Button>
                            <Button
                              size="sm"
                              disabled={workflow.isPending}
                              onClick={() => workflow.mutate({ examSubjectId: es.id, action: 'submit' })}
                            >
                              Submit for approval
                            </Button>
                          </div>
                        </>
                      )}

                      {es.status === 'SUBMITTED' && canApprove && (
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            disabled={workflow.isPending}
                            onClick={() => workflow.mutate({ examSubjectId: es.id, action: 'approve' })}
                          >
                            Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={workflow.isPending}
                            onClick={() => workflow.mutate({ examSubjectId: es.id, action: 'reject' })}
                          >
                            Reject / return for correction
                          </Button>
                        </div>
                      )}
                      {es.status === 'SUBMITTED' && !canApprove && (
                        <p className="text-xs text-slate-500">Waiting for School Administrator approval.</p>
                      )}

                      {es.status === 'APPROVED' && canReopen && (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={workflow.isPending}
                          onClick={() => workflow.mutate({ examSubjectId: es.id, action: 'reopen' })}
                        >
                          Reopen for correction
                        </Button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {selectedExamId && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Report card</CardTitle>
            {reportCardStudentId && reportCard && reportCard.length > 0 && (
              <Button
                size="sm"
                variant="outline"
                disabled={downloadingPdf}
                onClick={() => downloadReportCardPdf(selectedExamId, reportCardStudentId)}
              >
                {downloadingPdf ? 'Preparing...' : 'Download PDF'}
              </Button>
            )}
          </CardHeader>
          <CardContent>
            <select
              value={reportCardStudentId}
              onChange={(e) => setReportCardStudentId(e.target.value)}
              className="mb-4 h-10 w-full rounded-md border border-slate-300 px-3 text-sm"
            >
              <option value="">Select student</option>
              {myStudents.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.firstName} {s.lastName}
                </option>
              ))}
            </select>

            {!reportCardStudentId ? (
              <p className="text-sm text-slate-500">Select a student to view their report card for this exam.</p>
            ) : !reportCard || reportCard.length === 0 ? (
              <p className="text-sm text-slate-500">No approved marks yet for this exam.</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-slate-500">
                    <th className="py-2 font-medium">Subject</th>
                    <th className="py-2 font-medium">Score</th>
                    <th className="py-2 font-medium">Comment</th>
                  </tr>
                </thead>
                <tbody>
                  {reportCard.map((line, i) => (
                    <tr key={i} className="border-b border-slate-100">
                      <td className="py-2 font-medium text-slate-900">{line.subject}</td>
                      <td className="py-2 text-slate-500">
                        {line.rubricLevel ?? `${line.score ?? '-'} / ${line.maxScore}`}
                      </td>
                      <td className="py-2 text-slate-500">{line.comment ?? '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>
      )}
    </>
  );
}

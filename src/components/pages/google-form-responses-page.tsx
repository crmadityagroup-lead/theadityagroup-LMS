'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { useAuth } from '@/lib/auth-context';
import { ChevronLeft, ChevronRight, FileText, RefreshCw, Trash2 } from 'lucide-react';

interface FormAnswer {
  question: string;
  answer: string | string[];
}

interface FormResponse {
  id: number;
  responseId: string;
  respondentEmail: string | null;
  submittedAt: string;
  answers: FormAnswer[];
}

const LIMIT = 50;

function getResponseEmail(response: FormResponse): string {
  const storedEmail = response.respondentEmail?.trim();
  if (storedEmail) return storedEmail;

  const emailAnswer = response.answers.find((answer) =>
    /email|e-mail/i.test(answer.question) &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(Array.isArray(answer.answer) ? answer.answer[0] : answer.answer || '').trim())
  );
  return emailAnswer
    ? String(Array.isArray(emailAnswer.answer) ? emailAnswer.answer[0] : emailAnswer.answer).trim()
    : '';
}

export function GoogleFormResponsesPage() {
  const { user } = useAuth();
  const canDelete = ['super_admin', 'admin', 'admin_2'].includes(user?.role || '');
  const [responses, setResponses] = useState<FormResponse[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setError('');
    try {
      const data = await api.get<{ responses: FormResponse[]; total: number }>(`/google-form-responses?limit=${LIMIT}&offset=${offset}`);
      setResponses(data.responses);
      setTotal(data.total);
      setSelectedIds((current) => current.filter((id) => data.responses.some((response) => response.id === id)));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to load Google Form responses.');
    } finally {
      setLoading(false);
    }
  }, [offset]);

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(), 30_000);
    return () => window.clearInterval(timer);
  }, [load]);

  const questions = useMemo(() => [...new Set(responses.flatMap((response) => response.answers.map((answer) => answer.question)))], [responses]);
  const missingEmailCount = responses.filter((response) => !getResponseEmail(response)).length;
  const allVisibleSelected = responses.length > 0 && responses.every((response) => selectedIds.includes(response.id));

  function toggleSelected(id: number, checked: boolean | 'indeterminate') {
    setSelectedIds((current) => checked ? [...new Set([...current, id])] : current.filter((selectedId) => selectedId !== id));
  }

  async function deleteSelected() {
    if (!selectedIds.length || deleting) return;
    if (!window.confirm(`Permanently delete ${selectedIds.length} selected form response(s)? This cannot be undone.`)) return;
    setDeleting(true);
    setError('');
    try {
      await api.delete('/google-form-responses', { ids: selectedIds });
      setSelectedIds([]);
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to delete selected responses.');
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold">Google Form Responses</h2>
          <p className="text-sm text-muted-foreground">Responses delivered directly from Google Forms · {total.toLocaleString()} total</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {selectedIds.length > 0 && <Button variant="destructive" onClick={() => void deleteSelected()} disabled={deleting}>
            <Trash2 className="h-4 w-4" /> {deleting ? 'Deleting…' : `Delete selected (${selectedIds.length})`}
          </Button>}
          <Button variant="outline" onClick={() => { setLoading(true); void load(); }} aria-label="Refresh responses">
            <RefreshCw className="h-4 w-4" /> Refresh
          </Button>
        </div>
      </div>

      {error && <p role="alert" className="rounded-md border border-destructive/40 p-3 text-sm text-destructive">{error}</p>}
      {!loading && responses.length > 0 && missingEmailCount > 0 && <p className="rounded-md border border-amber-500/40 bg-amber-500/5 p-3 text-sm">
        {missingEmailCount} response(s) on this page have no email in the data received from Google Forms. Update the Form Apps Script, then run <code>syncAllExistingFormResponses</code> to backfill them.
      </p>}

      {loading ? <Card><CardContent className="p-6 text-sm text-muted-foreground">Loading responses…</CardContent></Card> : responses.length === 0 ? (
        <Card><CardContent className="p-10 text-center">
          <FileText className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
          <p className="font-medium">No direct Google Form responses synced yet</p>
          <p className="mt-1 text-sm text-muted-foreground">Run the Form Apps Script backfill or submit a new response.</p>
        </CardContent></Card>
      ) : (
        <Card><CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b bg-muted/30 text-left">
                {canDelete && <th className="w-12 p-3"><Checkbox aria-label="Select all responses on this page" checked={allVisibleSelected} onCheckedChange={(checked) => setSelectedIds(checked ? responses.map((response) => response.id) : [])} /></th>}
                <th className="min-w-48 p-3 font-medium">Submitted</th>
                <th className="min-w-56 p-3 font-medium">Email</th>
                {questions.map((question) => <th key={question} className="min-w-40 p-3 font-medium">{question}</th>)}
              </tr></thead>
              <tbody>{responses.map((response) => (
                <tr key={response.id} className="border-b last:border-0">
                  {canDelete && <td className="p-3"><Checkbox aria-label={`Select response submitted ${new Date(response.submittedAt).toLocaleString('en-IN')}`} checked={selectedIds.includes(response.id)} onCheckedChange={(checked) => toggleSelected(response.id, checked)} disabled={deleting} /></td>}
                  <td className="whitespace-nowrap p-3">{new Date(response.submittedAt).toLocaleString('en-IN')}</td>
                  <td className="p-3">{getResponseEmail(response) || <span className="text-muted-foreground">Not provided by Google Forms</span>}</td>
                  {questions.map((question) => {
                    const answer = response.answers.find((item) => item.question === question)?.answer;
                    return <td key={question} className="max-w-80 whitespace-pre-wrap break-words p-3 align-top">{Array.isArray(answer) ? answer.join(', ') || '—' : answer || '—'}</td>;
                  })}
                </tr>
              ))}</tbody>
            </table>
          </div>
        </CardContent></Card>
      )}

      {total > LIMIT && <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">Showing {offset + 1}–{Math.min(offset + responses.length, total)} of {total}</span>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" disabled={offset === 0} onClick={() => setOffset((value) => Math.max(0, value - LIMIT))}><ChevronLeft className="h-4 w-4" /> Previous</Button>
          <Button variant="outline" size="sm" disabled={offset + LIMIT >= total} onClick={() => setOffset((value) => value + LIMIT)}>Next <ChevronRight className="h-4 w-4" /></Button>
        </div>
      </div>}
    </div>
  );
}

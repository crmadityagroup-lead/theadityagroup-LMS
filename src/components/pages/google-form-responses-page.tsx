'use client';

import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ChevronLeft, ChevronRight, FileText, RefreshCw } from 'lucide-react';

interface FormAnswer {
  question: string;
  answer: string | string[];
}

interface FormResponse {
  id: number;
  responseId: string;
  submittedAt: string;
  answers: FormAnswer[];
}

const LIMIT = 50;

export function GoogleFormResponsesPage() {
  const [responses, setResponses] = useState<FormResponse[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setError('');
    try {
      const data = await api.get<{ responses: FormResponse[]; total: number }>(`/google-form-responses?limit=${LIMIT}&offset=${offset}`);
      setResponses(data.responses);
      setTotal(data.total);
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

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold">Google Form Responses</h2>
          <p className="text-sm text-muted-foreground">Responses delivered directly from Google Forms · {total.toLocaleString()} total</p>
        </div>
        <Button variant="outline" onClick={() => { setLoading(true); void load(); }} aria-label="Refresh responses">
          <RefreshCw className="h-4 w-4" /> Refresh
        </Button>
      </div>

      {error && <p role="alert" className="rounded-md border border-destructive/40 p-3 text-sm text-destructive">{error}</p>}

      {loading ? <Card><CardContent className="p-6 text-sm text-muted-foreground">Loading responses…</CardContent></Card> : responses.length === 0 ? (
        <Card><CardContent className="p-10 text-center">
          <FileText className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
          <p className="font-medium">No direct Google Form responses synced yet</p>
          <p className="mt-1 text-sm text-muted-foreground">Run the Form Apps Script backfill or submit a new response.</p>
        </CardContent></Card>
      ) : (
        <div className="space-y-3">
          {responses.map((response) => (
            <Card key={response.id}>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Submitted {new Date(response.submittedAt).toLocaleString('en-IN')}</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {response.answers.map((answer, index) => (
                  <div key={`${answer.question}-${index}`} className="min-w-0">
                    <p className="text-xs font-medium text-muted-foreground">{answer.question}</p>
                    <p className="mt-1 whitespace-pre-wrap break-words text-sm">
                      {Array.isArray(answer.answer) ? answer.answer.join(', ') || '—' : answer.answer || '—'}
                    </p>
                  </div>
                ))}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {total > LIMIT && <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">Showing {offset + 1}–{Math.min(offset + responses.length, total)} of {total}</span>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" disabled={offset === 0} onClick={() => setOffset((value) => Math.max(0, value - LIMIT))}>
            <ChevronLeft className="h-4 w-4" /> Previous
          </Button>
          <Button variant="outline" size="sm" disabled={offset + LIMIT >= total} onClick={() => setOffset((value) => value + LIMIT)}>
            Next <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>}
    </div>
  );
}

'use client';

import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ChevronLeft, ChevronRight, RefreshCw, Sheet } from 'lucide-react';

interface SheetResponse {
  id: number;
  sheetName: string;
  rowNumber: number;
  response: { headers: string[]; values: string[] };
  createdAt: string;
  updatedAt: string;
}

const LIMIT = 100;

export function GoogleSheetResponsesPage() {
  const [responses, setResponses] = useState<SheetResponse[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setError('');
    try {
      const data = await api.get<{ responses: SheetResponse[]; total: number }>(`/sheet-responses?limit=${LIMIT}&offset=${offset}`);
      setResponses(data.responses);
      setTotal(data.total);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to load spreadsheet responses.');
    } finally {
      setLoading(false);
    }
  }, [offset]);

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(), 30_000);
    return () => window.clearInterval(timer);
  }, [load]);

  const columns = responses[0]?.response.headers || [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h2 className="text-2xl font-bold">Google Sheet Responses</h2><p className="text-sm text-muted-foreground">Form responses synced from your Google Sheet · {total.toLocaleString()} total</p></div>
        <Button variant="outline" onClick={() => { setLoading(true); void load(); }} aria-label="Refresh responses"><RefreshCw className="h-4 w-4" /> Refresh</Button>
      </div>
      {error && <p role="alert" className="rounded-md border border-destructive/40 p-3 text-sm text-destructive">{error}</p>}
      <Card><CardContent className="p-0">
        {loading ? <p className="p-6 text-sm text-muted-foreground">Loading responses…</p> : responses.length === 0 ? (
          <div className="p-10 text-center"><Sheet className="mx-auto mb-3 h-8 w-8 text-muted-foreground" /><p className="font-medium">No spreadsheet responses synced yet</p><p className="mt-1 text-sm text-muted-foreground">Submit a test response in the linked Google Form. New rows will appear here automatically.</p></div>
        ) : (
          <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b bg-muted/30 text-left"><th className="sticky left-0 bg-card p-3 font-medium">Sheet row</th>{columns.map((column, index) => <th key={`${column}-${index}`} className="min-w-36 whitespace-nowrap p-3 font-medium">{column || `Column ${index + 1}`}</th>)}</tr></thead><tbody>
            {responses.map((item) => <tr key={item.id} className="border-b last:border-0"><td className="sticky left-0 whitespace-nowrap bg-card p-3 text-xs text-muted-foreground">{item.sheetName} · {item.rowNumber}<div>{new Date(item.createdAt).toLocaleString('en-IN')}</div></td>{columns.map((_, index) => <td key={index} className="max-w-72 whitespace-pre-wrap p-3 align-top">{item.response.values[index] || '—'}</td>)}</tr>)}
          </tbody></table></div>
        )}
      </CardContent></Card>
      {total > LIMIT && <div className="flex items-center justify-between text-sm"><span className="text-muted-foreground">Showing {offset + 1}–{Math.min(offset + responses.length, total)} of {total}</span><div className="flex gap-2"><Button variant="outline" size="sm" disabled={offset === 0} onClick={() => setOffset((value) => Math.max(0, value - LIMIT))}><ChevronLeft className="h-4 w-4" /> Previous</Button><Button variant="outline" size="sm" disabled={offset + LIMIT >= total} onClick={() => setOffset((value) => value + LIMIT)}>Next <ChevronRight className="h-4 w-4" /></Button></div></div>}
    </div>
  );
}

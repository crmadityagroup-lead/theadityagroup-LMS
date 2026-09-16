'use client';
/* Search requests are intentionally stateful and debounced in this component. */
/* eslint-disable react-hooks/set-state-in-effect */
import { useEffect, useRef, useState } from 'react';
import { FileText, Loader2, Search, UserRound } from 'lucide-react';
import { api } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';

interface SearchResult {
  route: string;
  arg?: string;
  title: string;
  subtitle: string;
  meta: string;
}

export function UniversalSearch({ navigate }: { navigate: (route: string, arg?: any) => void }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<{ leads: SearchResult[]; users: SearchResult[] }>({ leads: [], users: [] });
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(() => inputRef.current?.focus(), 50);
    return () => window.clearTimeout(timer);
  }, [open]);

  useEffect(() => {
    if (!open || query.trim().length < 2) {
      setResults({ leads: [], users: [] });
      setLoading(false);
      return;
    }
    const timer = window.setTimeout(async () => {
      setLoading(true);
      try {
        const data = await api.get<{ leads: SearchResult[]; users: SearchResult[] }>(`/search?q=${encodeURIComponent(query.trim())}`);
        setResults(data);
      } catch {
        setResults({ leads: [], users: [] });
      } finally {
        setLoading(false);
      }
    }, 180);
    return () => window.clearTimeout(timer);
  }, [open, query]);

  function choose(result: SearchResult) {
    setOpen(false);
    setQuery('');
    navigate(result.route, result.arg);
  }

  return (
    <>
      <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => setOpen(true)} title="Search">
        <Search className="h-4 w-4" />
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-xl gap-4">
          <DialogHeader>
            <DialogTitle>Universal Search</DialogTitle>
          </DialogHeader>
          <div className="relative">
            <Search className="text-muted-foreground absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" />
            <Input ref={inputRef} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search leads, customers, mobile, email..." className="pl-9" />
          </div>
          <div className="max-h-[55vh] space-y-1 overflow-y-auto">
            {loading && <div className="flex items-center justify-center gap-2 p-6 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Searching...</div>}
            {!loading && query.trim().length < 2 && <p className="p-6 text-center text-sm text-muted-foreground">Type at least 2 characters to search.</p>}
            {!loading && query.trim().length >= 2 && results.leads.length === 0 && results.users.length === 0 && <p className="p-6 text-center text-sm text-muted-foreground">No matching records found.</p>}
            {!loading && results.leads.length > 0 && <div className="pb-2"><p className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Leads</p>{results.leads.map((result) => <button key={`${result.route}-${result.arg}`} type="button" onClick={() => choose(result)} className="flex w-full cursor-pointer items-start gap-3 rounded-lg px-3 py-2 text-left hover:bg-muted"><FileText className="mt-0.5 h-4 w-4 shrink-0 text-primary" /><span className="min-w-0"><span className="block truncate text-sm font-medium">{result.title} - {result.subtitle}</span><span className="block truncate text-xs text-muted-foreground">{result.meta}</span></span></button>)}</div>}
            {!loading && results.users.length > 0 && <div><p className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Users</p>{results.users.map((result) => <button key={`${result.route}-${result.title}`} type="button" onClick={() => choose(result)} className="flex w-full cursor-pointer items-start gap-3 rounded-lg px-3 py-2 text-left hover:bg-muted"><UserRound className="mt-0.5 h-4 w-4 shrink-0 text-primary" /><span className="min-w-0"><span className="block truncate text-sm font-medium">{result.title}</span><span className="block truncate text-xs text-muted-foreground">{result.subtitle} - {result.meta}</span></span></button>)}</div>}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

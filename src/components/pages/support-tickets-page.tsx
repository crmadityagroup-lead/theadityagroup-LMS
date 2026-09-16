'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle, Clock, Ticket } from 'lucide-react';
import { api } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { EmptyState, formatDate } from '@/components/ui-shared';

interface SupportTicket { id: number; token: string; subject: string; description: string; route?: string | null; status: string; created_at: string; user?: { name?: string; email?: string; role?: string; dealer?: { name?: string } | null } | null; }

export function SupportTicketsPage() {
  const { isSuperAdmin } = useAuth();
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [closingId, setClosingId] = useState<number | null>(null);
  useEffect(() => { if (!isSuperAdmin()) return; void api.get<{ tickets: SupportTicket[] }>('/notifications?support=1').then((result) => setTickets(result.tickets || [])).catch((reason: any) => setError(reason.message || 'Unable to load support requests')).finally(() => setLoading(false)); }, [isSuperAdmin]);
  async function closeTicket(id: number) {
    if (closingId) return;
    setClosingId(id);
    try {
      await api.patch('/notifications', { kind: 'support_close', id });
      setTickets((current) => current.map((ticket) => ticket.id === id ? { ...ticket, status: 'closed' } : ticket));
    } catch (reason: any) { setError(reason.message || 'Unable to close ticket'); }
    finally { setClosingId(null); }
  }
  if (!isSuperAdmin()) return <div className="p-8 text-center text-muted-foreground">Access denied</div>;
  if (error) return <div className="p-8 text-center"><AlertTriangle className="mx-auto mb-2 h-8 w-8 text-red-500" /><p>{error}</p></div>;
  return <div className="space-y-4"><div><h2 className="text-2xl font-bold">Help Requests</h2><p className="text-sm text-muted-foreground">Issues submitted by users</p></div><Card><CardContent className="p-0">{loading ? <div className="p-8 text-center text-muted-foreground">Loading requests...</div> : tickets.length === 0 ? <EmptyState icon={Ticket} title="No help requests" message="User-submitted issues will appear here" /> : <div className="divide-y">{tickets.map((ticket) => <article key={ticket.id} className="space-y-2 p-4"><div className="flex flex-wrap items-center justify-between gap-2"><div className="flex items-center gap-2 font-semibold"><Ticket className="h-4 w-4" />{ticket.subject}</div><div className="flex items-center gap-2"><span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-1 text-xs"><Clock className="h-3 w-3" />{ticket.status}</span>{ticket.status !== 'closed' && <Button size="sm" variant="outline" disabled={closingId === ticket.id} onClick={() => void closeTicket(ticket.id)}>{closingId === ticket.id ? 'Closing...' : 'Close ticket'}</Button>}</div></div><div className="text-xs text-muted-foreground"><code>{ticket.token}</code> · {ticket.user?.name || 'Unknown'} · {ticket.user?.email || '-'} · {ticket.user?.dealer?.name || 'All dealers'} · {formatDate(ticket.created_at, true)}</div><p className="whitespace-pre-wrap text-sm">{ticket.description}</p>{ticket.route && <p className="text-xs text-muted-foreground">Page: {ticket.route}</p>}</article>)}</div>}</CardContent></Card></div>;
}

'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle, Clock, Ticket } from 'lucide-react';
import { api } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { EmptyState, formatDate } from '@/components/ui-shared';
import { GeneratedAvatar } from '@/components/generated-avatar';

interface SupportTicket {
  id: number; token: string; subject: string; description: string; route?: string | null; status: string; created_at: string;
  user?: { id?: number; name?: string; email?: string; avatar_data?: string | null; dealer?: { name?: string } | null } | null;
}

export function SupportTicketsPage() {
  const { isSuperAdmin } = useAuth();
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [closingId, setClosingId] = useState<number | null>(null);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!isSuperAdmin()) return;
    void api.get<{ tickets: SupportTicket[] }>('/notifications?support=1').then((result) => setTickets(result.tickets || [])).catch((reason: any) => setError(reason.message || 'Unable to load support requests')).finally(() => setLoading(false));
  }, [isSuperAdmin]);

  async function closeTicket(id: number) {
    if (closingId) return;
    setClosingId(id);
    try {
      await api.patch('/notifications', { kind: 'support_close', id });
      setTickets((current) => current.map((ticket) => ticket.id === id ? { ...ticket, status: 'closed' } : ticket));
    } catch (reason: any) { setError(reason.message || 'Unable to close ticket'); }
    finally { setClosingId(null); }
  }

  async function deleteSelected() {
    if (!selectedIds.length || deleting) return;
    setDeleting(true);
    const ids = [...selectedIds];
    try {
      await api.delete('/notifications', { kind: 'support', ids });
      setTickets((current) => current.filter((ticket) => !ids.includes(ticket.id)));
      setSelectedIds([]);
    } catch (reason: any) { setError(reason.message || 'Unable to delete help requests'); }
    finally { setDeleting(false); }
  }

  if (!isSuperAdmin()) return <div className="p-8 text-center text-muted-foreground">Access denied</div>;
  if (error) return <div className="p-8 text-center"><AlertTriangle className="mx-auto mb-2 h-8 w-8 text-red-500" /><p>{error}</p></div>;

  return <div className="space-y-4">
    <div><h2 className="text-2xl font-bold">Help Requests</h2><p className="text-sm text-muted-foreground">Issues submitted by users</p></div>
    <Card><CardContent className="p-0">
      {selectedIds.length > 0 && <div className="flex items-center justify-between gap-3 border-b px-4 py-2"><span className="text-sm font-medium">{selectedIds.length} selected</span><Button variant="destructive" size="sm" disabled={deleting} onClick={() => setDeleteOpen(true)}>{deleting ? 'Deleting...' : `Delete ${selectedIds.length}`}</Button></div>}
      {loading ? <div className="p-8 text-center text-muted-foreground">Loading requests...</div> : tickets.length === 0 ? <EmptyState icon={Ticket} title="No help requests" message="User-submitted issues will appear here" /> : <div className="divide-y">
        {tickets.map((ticket) => <article key={ticket.id} className="space-y-2 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2 font-semibold"><Checkbox aria-label={`Select ${ticket.subject}`} checked={selectedIds.includes(ticket.id)} onCheckedChange={(checked) => setSelectedIds((current) => checked ? [...current, ticket.id] : current.filter((id) => id !== ticket.id))} /><Ticket className="h-4 w-4 shrink-0" />{ticket.subject}</div>
            <div className="flex items-center gap-2"><span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-1 text-xs"><Clock className="h-3 w-3" />{ticket.status}</span>{ticket.status !== 'closed' && <Button size="sm" variant="outline" disabled={closingId === ticket.id} onClick={() => void closeTicket(ticket.id)}>{closingId === ticket.id ? 'Closing...' : 'Close ticket'}</Button>}</div>
          </div>
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 shrink-0 overflow-hidden rounded-full border border-border bg-muted">{ticket.user?.avatar_data ? <img src={ticket.user.avatar_data} alt={`${ticket.user.name || 'User'} profile`} className="block h-full w-full rounded-full object-cover object-center" /> : <GeneratedAvatar seed={`${ticket.user?.id || 'unknown'}:${ticket.user?.email || ''}`} name={ticket.user?.name || ticket.user?.email || 'Unknown'} size={36} />}</div>
            <div className="min-w-0 text-xs text-muted-foreground"><code>{ticket.token}</code> · {ticket.user?.name || 'Unknown'} · {ticket.user?.email || '-'} · {ticket.user?.dealer?.name || 'All dealers'} · {formatDate(ticket.created_at, true)}</div>
          </div>
          <p className="whitespace-pre-wrap text-sm">{ticket.description}</p>{ticket.route && <p className="text-xs text-muted-foreground">Page: {ticket.route}</p>}
        </article>)}
      </div>}
    </CardContent></Card>
    {tickets.length > 0 && <div className="flex items-center gap-2"><Checkbox aria-label="Select all help requests" checked={selectedIds.length === tickets.length} onCheckedChange={(checked) => setSelectedIds(checked ? tickets.map((ticket) => ticket.id) : [])} /><span className="text-sm text-muted-foreground">Select all help requests</span></div>}
    <ConfirmDialog open={deleteOpen} onOpenChange={setDeleteOpen} title={`Move ${selectedIds.length} help request${selectedIds.length === 1 ? '' : 's'} to Recycle Bin?`} description="The selected requests can be restored or permanently deleted later from Recycle Bin." confirmLabel="Move to Recycle Bin" destructive onConfirm={deleteSelected} />
  </div>;
}

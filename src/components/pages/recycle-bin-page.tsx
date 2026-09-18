'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { RoleBadge, EmptyState } from '@/components/ui-shared';
import { toast } from 'sonner';
import { Recycle, ClipboardList, Users, Car, RotateCcw, Trash2, AlertTriangle, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';

export function RecycleBinPage() {
  const { isSuperAdmin, isAdmin } = useAuth();
  const [tab, setTab] = useState('leads');
  const [search, setSearch] = useState('');
  const [items, setItems] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [processing, setProcessing] = useState(false);
  const [warning, setWarning] = useState<{ title: string; description: string; destructive?: boolean; action: () => Promise<void> } | null>(null);
  const limit = 50;

  async function load() {
    setLoading(true); setError(null);
    try {
      if (tab === 'users') {
        const r = await api.get<{ users: any[] }>('/users/recycled/list');
        const list = (r.users || []).filter((u) => !search || u.name?.toLowerCase().includes(search.toLowerCase()) || u.email?.toLowerCase().includes(search.toLowerCase()));
        setItems(list); setTotal(list.length);
      } else if (tab === 'models') {
        const r = await api.get<{ models: any[] }>('/master/models/recycled/list');
        setItems(r.models || []); setTotal((r.models || []).length);
      } else if (tab === 'support') {
        const r = await api.get<{ tickets: any[] }>('/notifications?support=recycled');
        const list = (r.tickets || []).filter((ticket) => !search || ticket.subject?.toLowerCase().includes(search.toLowerCase()) || ticket.user?.name?.toLowerCase().includes(search.toLowerCase()) || ticket.user?.email?.toLowerCase().includes(search.toLowerCase()));
        setItems(list); setTotal(list.length);
      } else {
        const params = new URLSearchParams({ status: 'recycled', limit: String(limit), offset: String(offset) });
        if (search) params.set('search', search);
        const r = await api.get<{ leads: any[]; total: number }>(`/leads?${params.toString()}`);
        setItems(r.leads || []); setTotal(r.total);
      }
    } catch (e: any) { setError(e.message); } finally { setLoading(false); }
  }

  // Fetch the currently selected recycle-bin page whenever its filters change.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setSelectedIds([]); load(); }, [tab, search, offset]);
  function ask(title: string, description: string, action: () => Promise<void>, destructive = false) { setWarning({ title, description, action, destructive }); }
  const endpoint = tab === 'leads' ? '/leads' : tab === 'users' ? '/users' : '/master/models';
  const restorePath = (id: number) => `${endpoint}/${id}/restore`;
  const permanentPath = (id: number) => `${endpoint}/${id}/permanent`;
  function toggleSelected(id: number) {
    setSelectedIds((current) => current.includes(id) ? current.filter((value) => value !== id) : [...current, id]);
  }
  function toggleAllSelected() {
    setSelectedIds((current) => current.length === items.length ? [] : items.map((item) => item.id));
  }
  async function restoreSelected() {
    const ids = [...selectedIds];
    setProcessing(true);
    try {
      const results = await Promise.allSettled(ids.map((id) => tab === 'support' ? api.patch('/notifications', { kind: 'support_restore', id }) : api.post(restorePath(id))));
      const failed = results.filter((result) => result.status === 'rejected');
      await load();
      setSelectedIds([]);
      if (failed.length) throw new Error(`${failed.length} item${failed.length === 1 ? '' : 's'} could not be restored.`);
      toast.success(`${ids.length} item${ids.length === 1 ? '' : 's'} restored.`);
    } catch (e: any) { toast.error(e.message); }
    finally { setProcessing(false); }
  }
  async function permanentlyDeleteSelected() {
    const ids = [...selectedIds];
    setItems((current) => current.filter((item) => !ids.includes(item.id)));
    setTotal((current) => Math.max(0, current - ids.length));
    setProcessing(true);
    try {
      const results = await Promise.allSettled(ids.map((id) => tab === 'support' ? api.delete('/notifications', { kind: 'support_permanent', ids: [id] }) : api.delete(permanentPath(id))));
      const failed = results.filter((result) => result.status === 'rejected');
      if (failed.length) {
        await load();
        throw new Error(`${failed.length} item${failed.length === 1 ? '' : 's'} could not be permanently deleted.`);
      }
      setSelectedIds([]);
      toast.success(`${ids.length} item${ids.length === 1 ? '' : 's'} permanently deleted.`);
    } catch (e: any) { toast.error(e.message); }
    finally { setProcessing(false); }
  }
  async function restoreOne(id: number) {
    setItems((current) => current.filter((item) => item.id !== id));
    setTotal((current) => Math.max(0, current - 1));
    try { if (tab === 'support') await api.patch('/notifications', { kind: 'support_restore', id }); else await api.post(restorePath(id)); toast.success('Restored'); }
    catch (e: any) { await load(); toast.error(e.message); }
  }
  async function permanentlyDeleteOne(id: number) {
    setItems((current) => current.filter((item) => item.id !== id));
    setTotal((current) => Math.max(0, current - 1));
    try { if (tab === 'support') await api.delete('/notifications', { kind: 'support_permanent', ids: [id] }); else await api.delete(permanentPath(id)); toast.success('Permanently deleted'); }
    catch (e: any) { await load(); toast.error(e.message); }
  }

  if (!isAdmin()) return <div className="p-8 text-center text-muted-foreground">Access denied</div>;
  if (error) return <div className="p-8 text-center"><AlertTriangle className="mx-auto h-8 w-8 text-red-500 mb-2" /><p>{error}</p></div>;
  const tabs = [{ key: 'leads', label: 'Leads', icon: ClipboardList }, ...(isSuperAdmin() ? [{ key: 'users', label: 'Users', icon: Users }, { key: 'models', label: 'Models', icon: Car }, { key: 'support', label: 'Help Requests', icon: AlertTriangle }] : [])];

  return <div className="space-y-4">
    <div><h2 className="text-2xl font-bold">Recycle Bin</h2><p className="text-sm text-muted-foreground">Soft-deleted items - restore or permanently delete</p></div>
    <Tabs value={tab} onValueChange={(value) => { setTab(value); setOffset(0); setSelectedIds([]); }}><TabsList>{tabs.map((t) => <TabsTrigger key={t.key} value={t.key}><t.icon className="mr-2 h-4 w-4" />{t.label}</TabsTrigger>)}</TabsList></Tabs>
    <Card><CardContent className="p-3"><Input placeholder="Search..." value={search} onChange={(e) => { setSearch(e.target.value); setOffset(0); }} className="max-w-md" /></CardContent></Card>
    <Card><CardContent className="p-0">{loading ? <div className="p-8 text-center text-muted-foreground animate-pulse">Loading...</div> : items.length === 0 ? <EmptyState icon={Recycle} title={`No recycled ${tab}`} message={`Deleted ${tab} will appear here and can be restored.`} /> : <div className="overflow-x-auto">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b p-3">
        <label className="flex items-center gap-2 text-sm"><Checkbox checked={items.length > 0 && selectedIds.length === items.length} onCheckedChange={toggleAllSelected} disabled={processing} /> Select all</label>
        {selectedIds.length > 0 && <div className="flex gap-2"><Button size="sm" variant="outline" disabled={processing} onClick={() => ask(`Restore ${selectedIds.length} item${selectedIds.length === 1 ? '' : 's'}?`, 'Selected records will return to the active tables.', restoreSelected)}>{processing ? <Loader2 className="h-3 w-3 animate-spin" /> : <RotateCcw className="h-3 w-3" />} Restore</Button><Button size="sm" variant="destructive" disabled={processing} onClick={() => ask(`Permanently delete ${selectedIds.length} item${selectedIds.length === 1 ? '' : 's'}?`, 'This action cannot be undone and will delete the records from the database.', permanentlyDeleteSelected, true)}>{processing ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />} Delete permanently</Button></div>}
      </div>
      <table className="mx-auto min-w-[760px] w-full text-sm"><tbody>
      {tab === 'leads' && items.map((l: any) => <tr key={l.id} className="border-b"><td className="p-3"><Checkbox checked={selectedIds.includes(l.id)} onCheckedChange={() => toggleSelected(l.id)} disabled={processing} /></td><td className="p-3 font-medium">{l.lead_code}<br /><span className="text-xs text-muted-foreground">{l.customer_name}</span></td><td className="p-3">{l.dealer_name}<br /><span className="text-xs text-muted-foreground">{l.brand_name} {l.model_name}</span></td><td className="p-3 text-right"><div className="flex items-center justify-end gap-2"><Button size="sm" variant="outline" disabled={processing} onClick={() => ask('Restore this lead?', 'The lead will be returned to the active leads list.', () => restoreOne(l.id))}><RotateCcw className="h-3 w-3" /></Button><Button size="sm" variant="ghost" className="text-red-600" disabled={processing} onClick={() => ask('Permanently delete this lead?', 'This action cannot be undone.', () => permanentlyDeleteOne(l.id), true)}><Trash2 className="h-3 w-3" /></Button></div></td></tr>)}
      {tab === 'users' && items.map((u: any) => <tr key={u.id} className="border-b"><td className="p-3"><Checkbox checked={selectedIds.includes(u.id)} onCheckedChange={() => toggleSelected(u.id)} disabled={processing} /></td><td className="p-3 font-medium">{u.name}<br /><span className="text-xs text-muted-foreground">{u.email}</span></td><td className="p-3"><RoleBadge role={u.role} /></td><td className="p-3 text-right"><div className="flex items-center justify-end gap-2"><Button size="sm" variant="outline" disabled={processing} onClick={() => ask(`Restore ${u.name}?`, 'The user will be returned to the active users list.', () => restoreOne(u.id))}><RotateCcw className="h-3 w-3" /></Button><Button size="sm" variant="ghost" className="text-red-600" disabled={processing} onClick={() => ask(`Permanently delete ${u.name}?`, 'This action cannot be undone.', () => permanentlyDeleteOne(u.id), true)}><Trash2 className="h-3 w-3" /></Button></div></td></tr>)}
      {tab === 'models' && items.map((m: any) => <tr key={m.id} className="border-b"><td className="p-3"><Checkbox checked={selectedIds.includes(m.id)} onCheckedChange={() => toggleSelected(m.id)} disabled={processing} /></td><td className="p-3 font-medium">{m.name}<br /><span className="text-xs text-muted-foreground">{m.brand_name || '-'}</span></td><td className="p-3 text-right"><div className="flex items-center justify-end gap-2"><Button size="sm" variant="outline" disabled={processing} onClick={() => ask(`Restore model ${m.name}?`, 'The model will be returned to the active models list.', () => restoreOne(m.id))}><RotateCcw className="h-3 w-3" /></Button><Button size="sm" variant="ghost" className="text-red-600" disabled={processing} onClick={() => ask(`Permanently delete model ${m.name}?`, 'This action cannot be undone.', () => permanentlyDeleteOne(m.id), true)}><Trash2 className="h-3 w-3" /></Button></div></td></tr>)}
      {tab === 'support' && items.map((ticket: any) => <tr key={ticket.id} className="border-b"><td className="p-3"><Checkbox checked={selectedIds.includes(ticket.id)} onCheckedChange={() => toggleSelected(ticket.id)} disabled={processing} /></td><td className="p-3 font-medium">{ticket.subject}<br /><span className="text-xs text-muted-foreground">{ticket.user?.name || 'Unknown'} · {ticket.user?.email || '-'}</span></td><td className="p-3 text-right"><div className="flex items-center justify-end gap-2"><Button size="sm" variant="outline" disabled={processing} onClick={() => ask('Restore this help request?', 'The request will return to Help Requests.', () => restoreOne(ticket.id))}><RotateCcw className="h-3 w-3" /></Button><Button size="sm" variant="ghost" className="text-red-600" disabled={processing} onClick={() => ask('Permanently delete this help request?', 'This action cannot be undone.', () => permanentlyDeleteOne(ticket.id), true)}><Trash2 className="h-3 w-3" /></Button></div></td></tr>)}
    </tbody></table>{tab === 'leads' && <div className="flex justify-between p-3 text-xs text-muted-foreground border-t"><span>Showing {items.length} of {total}</span><div className="flex gap-2"><Button size="sm" variant="outline" disabled={offset === 0 || processing} onClick={() => setOffset(Math.max(0, offset - limit))}><ChevronLeft className="h-3 w-3" /></Button><Button size="sm" variant="outline" disabled={offset + limit >= total || processing} onClick={() => setOffset(offset + limit)}><ChevronRight className="h-3 w-3" /></Button></div></div>}</div>}</CardContent></Card>
    {warning && <ConfirmDialog open onOpenChange={(open) => { if (!open) setWarning(null); }} title={warning.title} description={warning.description} destructive={warning.destructive} confirmLabel={warning.destructive ? 'Delete Permanently' : 'Continue'} onConfirm={warning.action} />}
  </div>;
}

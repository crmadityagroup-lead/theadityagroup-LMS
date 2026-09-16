'use client';
import { useEffect, useState, useCallback } from 'react';
import { api } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { StatusBadge, PriorityBadge, timeAgo, EmptyState } from '@/components/ui-shared';
import { ClipboardList, ChevronLeft, ChevronRight, Plus, AlertTriangle, Trash2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { DEPARTMENTS } from '@/lib/department-constants';

interface NavigateFn { (route: string, arg?: any): void; }
interface Lead { id: number; lead_code: string; customer_name: string; mobile: string; dealer_name: string; brand_name: string; model_name: string; enquiry_type_name: string; department: string; priority: string; status: string; assigned_user_name: string; created_by_name: string; created_at: string; }

export function LeadsPage({ navigate, highlightId }: { navigate: NavigateFn; highlightId?: number }) {
  const { user, isAdmin, isOperator } = useAuth();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [priority, setPriority] = useState('');
  const [department, setDepartment] = useState('');
  const [offset, setOffset] = useState(0);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const limit = 50;

  const load = useCallback(async () => {
    if (leads.length === 0) setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (status) params.set('status', status);
      if (priority) params.set('priority', priority);
      if (department) params.set('department', department);
      params.set('limit', String(limit));
      params.set('offset', String(offset));
      const data = await api.get<{ leads: Lead[]; total: number }>(`/leads?${params.toString()}`);
      setLeads(data.leads);
      setTotal(data.total);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [search, status, priority, department, offset]);

  // Avoid a request for every keystroke while keeping filters responsive.
  useEffect(() => {
    const timer = window.setTimeout(load, 180);
    return () => window.clearTimeout(timer);
  }, [load]);

  function applyFilters() { setOffset(0); }
  function resetFilters() { setSearch(''); setStatus(''); setPriority(''); setDepartment(''); setOffset(0); }
  function toggleLead(id: number) {
    setSelectedIds((current) => current.includes(id) ? current.filter((value) => value !== id) : [...current, id]);
  }
  function toggleAllLeads() {
    setSelectedIds((current) => current.length === leads.length ? [] : leads.map((lead) => lead.id));
  }
  async function bulkRecycleLeads() {
    const ids = [...selectedIds];
    setDeleting(true);
    setLeads((current) => current.filter((lead) => !ids.includes(lead.id)));
    setTotal((current) => Math.max(0, current - ids.length));
    setSelectedIds([]);
    try {
      const results = await Promise.allSettled(ids.map((id) => api.delete(`/leads/${id}`)));
      const failed = results.filter((result) => result.status === 'rejected');
      if (failed.length > 0) {
        await load();
        throw new Error(`${failed.length} lead${failed.length === 1 ? '' : 's'} could not be moved to the recycle bin.`);
      }
      toast.success(`${ids.length} leads moved to recycle bin.`);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-2xl font-bold">Leads</h2>
          <p className="text-sm text-muted-foreground">All leads within your scope</p>
        </div>
        <div className="flex gap-2">
          {['data_operator_1', 'data_operator_2'].includes(user?.role || '') && (
            <Button className="btn-gold" onClick={() => navigate('leads-new')}><Plus className="h-4 w-4" /> Add New Lead</Button>
          )}
          {user?.role !== 'department_user' && <Button variant="outline" onClick={() => navigate('reports')}>Reports</Button>}
        </div>
      </div>

      <Card>
        <CardContent className="grid grid-cols-1 gap-2 p-3 sm:grid-cols-2 md:flex md:flex-wrap md:items-center lg:flex-nowrap">
          <Input placeholder="Search by code, name, mobile, email…" value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') applyFilters(); }} className="w-full sm:col-span-2 md:flex-1 md:min-w-[220px] md:max-w-md" />
          <Select value={status} onValueChange={setStatus}><SelectTrigger className="w-full md:w-[140px]"><SelectValue placeholder="All Status" /></SelectTrigger><SelectContent>
            {['new','in_progress','follow_up','converted','closed','lost','recycled'].map(s => <SelectItem key={s} value={s}>{s.replace('_', ' ')}</SelectItem>)}
          </SelectContent></Select>
          <Select value={priority} onValueChange={setPriority}><SelectTrigger className="w-full md:w-[130px]"><SelectValue placeholder="All Priority" /></SelectTrigger><SelectContent>
            {['Low','Medium','High','Critical'].map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
          </SelectContent></Select>
          {(isOperator() || isAdmin()) && (
            <Select value={department} onValueChange={setDepartment}><SelectTrigger className="w-full md:w-[170px]"><SelectValue placeholder="All Departments" /></SelectTrigger><SelectContent>
              {DEPARTMENTS.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
            </SelectContent></Select>
          )}
          {isAdmin() && selectedIds.length > 0 && <Button variant="destructive" size="sm" className="w-full sm:w-auto" disabled={deleting} onClick={() => setBulkDeleteOpen(true)}>{deleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />} {deleting ? 'Deleting...' : `Delete ${selectedIds.length}`}</Button>}
          <Button onClick={applyFilters} size="sm" className="w-full sm:w-auto">Apply</Button>
          <Button variant="ghost" onClick={resetFilters} size="sm" className="w-full sm:w-auto">Reset</Button>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {loading ? <div className="p-8 text-center text-muted-foreground animate-pulse">Loading leads…</div> :
           error ? <div className="p-8 text-center"><AlertTriangle className="h-8 w-8 mx-auto text-red-500 mb-2" /><p className="text-sm">{error}</p></div> :
           leads.length === 0 ? <EmptyState icon={ClipboardList} title="No leads found" message="Try adjusting filters or create a new lead." /> :
           <div className="overflow-x-auto">
             <table className="mx-auto min-w-[980px] w-full text-sm">
               <thead className="border-b text-muted-foreground">
                 <tr>
                   {isAdmin() && <th className="w-10 py-2 px-3"><Checkbox checked={leads.length > 0 && selectedIds.length === leads.length} onCheckedChange={toggleAllLeads} aria-label="Select all leads" /></th>}
                   <th className="text-left py-2 px-3 font-medium">Code</th>
                   <th className="text-left py-2 px-3 font-medium">Customer</th>
                   <th className="text-left py-2 px-3 font-medium">Dealer / Vehicle</th>
                   <th className="text-left py-2 px-3 font-medium">Enquiry</th>
                   <th className="text-left py-2 px-3 font-medium">Priority</th>
                   <th className="text-left py-2 px-3 font-medium">Status</th>
                   <th className="text-left py-2 px-3 font-medium">Assigned To</th>
                   {user?.role === 'super_admin' || user?.role === 'admin' ? <th className="text-left py-2 px-3 font-medium">Created By</th> : null}
                 </tr>
               </thead>
               <tbody>
                 {leads.map(l => (
                   <tr key={l.id} className={`border-b last:border-b-0 cursor-pointer ${highlightId === l.id ? 'bg-amber-200 text-amber-950 ring-1 ring-inset ring-amber-400 hover:!bg-amber-200 dark:bg-amber-800/70 dark:text-amber-50 dark:ring-amber-500 dark:hover:!bg-amber-800/70' : 'hover:bg-muted/50'}`} onClick={() => navigate('lead-detail', l.id)}>
                     {isAdmin() && <td className="py-2 px-3" onClick={(e) => e.stopPropagation()}><Checkbox checked={selectedIds.includes(l.id)} onCheckedChange={() => toggleLead(l.id)} aria-label={`Select ${l.lead_code}`} /></td>}
                     <td className="py-2 px-3 font-medium">{l.lead_code}<br /><span className="text-xs text-muted-foreground">{timeAgo(l.created_at)}</span></td>
                     <td className="py-2 px-3">{l.customer_name}<br /><span className="text-xs text-muted-foreground">{l.mobile}</span></td>
                     <td className="py-2 px-3">{l.dealer_name}<br /><span className="text-xs text-muted-foreground">{l.brand_name} {l.model_name}</span></td>
                     <td className="py-2 px-3">{l.enquiry_type_name}<br /><span className="text-xs text-muted-foreground">{l.department}</span></td>
                     <td className="py-2 px-3"><PriorityBadge priority={l.priority} /></td>
                     <td className="py-2 px-3"><StatusBadge status={l.status} /></td>
                     <td className="py-2 px-3 text-xs">{l.assigned_user_name || '—'}</td>
                     {user?.role === 'super_admin' || user?.role === 'admin' ? <td className="py-2 px-3 text-xs text-muted-foreground">{l.created_by_name || '—'}</td> : null}
                   </tr>
                 ))}
               </tbody>
             </table>
             <div className="flex items-center justify-between p-3 text-xs text-muted-foreground border-t">
               <span>Showing {leads.length} of {total} leads</span>
               <div className="flex gap-2">
                 <Button variant="outline" size="sm" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - limit))}><ChevronLeft className="h-3 w-3" /> Prev</Button>
                 <Button variant="outline" size="sm" disabled={offset + limit >= total} onClick={() => setOffset(offset + limit)}>Next <ChevronRight className="h-3 w-3" /></Button>
               </div>
             </div>
           </div>}
        </CardContent>
      </Card>

      <ConfirmDialog open={bulkDeleteOpen} onOpenChange={setBulkDeleteOpen} title={`Move ${selectedIds.length} leads to recycle bin?`} description="The selected leads will be removed from this list and can be restored from Recycle Bin." confirmLabel="Move to Recycle" destructive onConfirm={bulkRecycleLeads} />
    </div>
  );
}

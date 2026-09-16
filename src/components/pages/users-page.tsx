'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { RoleBadge, timeAgo, EmptyState } from '@/components/ui-shared';
import { toast } from 'sonner';
import { DEPARTMENTS } from '@/lib/department-constants';
import { normalizeEnquiryCategories, normalizeEnquiryTypes } from '@/lib/enquiry-vocabulary';
import { getCachedMaster } from '@/lib/master-options-cache';
import { UserPlus, Users as UsersIcon, Trash2, PenSquare, AlertTriangle, Loader2 } from 'lucide-react';

export function UsersPage() {
  const { isSuperAdmin } = useAuth();
  const [users, setUsers] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editLoading, setEditLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [accessSaving, setAccessSaving] = useState(false);
  const [accessOpen, setAccessOpen] = useState(false);
  const [accessUserId, setAccessUserId] = useState<number | null>(null);
  const [editing, setEditing] = useState<any>(null);
  const [dealers, setDealers] = useState<any[]>([]);
  const [allTypes, setAllTypes] = useState<any[]>([]);
  const [cats, setCats] = useState<any[]>([]);
  const [existingTypeIds, setExistingTypeIds] = useState<number[]>([]);
  const [form, setForm] = useState<any>({ name: '', email: '', phone: '', role: 'department_user', dealer_id: '', department: '' });
  const [typeIds, setTypeIds] = useState<number[]>([]);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [recycleTarget, setRecycleTarget] = useState<{ id: number; name: string } | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const isDealerScoped = ['data_operator_2', 'department_user'].includes(form.role);

  async function load() {
    setLoading(true);
    try {
      const data = await api.get<{ users: any[] }>('/users');
      let list = data.users.filter((u: any) => u.active !== false);
      if (search) list = list.filter(u => u.name?.toLowerCase().includes(search.toLowerCase()) || u.email?.toLowerCase().includes(search.toLowerCase()));
      setUsers(list);
    } catch (e: any) { setError(e.message); } finally { setLoading(false); }
  }
  // Debounce search so typing does not create a request per character.
  useEffect(() => {
    const timer = window.setTimeout(load, 180);
    return () => window.clearTimeout(timer);
  }, [search]);

  function toggleUser(id: number) {
    setSelectedIds((current) => current.includes(id) ? current.filter((value) => value !== id) : [...current, id]);
  }
  function toggleAllUsers() {
    setSelectedIds((current) => current.length === users.length ? [] : users.map((user) => user.id));
  }
  async function bulkRecycleUsers() {
    const ids = [...selectedIds];
    setDeleting(true);
    setUsers((current) => current.filter((user) => !ids.includes(user.id)));
    setSelectedIds([]);
    try {
      const results = await Promise.allSettled(ids.map((id) => api.delete(`/users/${id}`)));
      const failed = results.filter((result) => result.status === 'rejected');
      if (failed.length > 0) {
        await load();
        throw new Error(`${failed.length} user${failed.length === 1 ? '' : 's'} could not be moved to the recycle bin.`);
      }
      toast.success(`${ids.length} users moved to recycle bin.`);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setDeleting(false);
    }
  }

  async function openCreate() {
    setEditing(null);
    setForm({ name: '', email: '', phone: '', role: 'department_user', dealer_id: '', department: '' });
    setTypeIds([]);
    setModalOpen(true);
    const [d, t, c] = await Promise.all([getCachedMaster('/master/all-dealers'), getCachedMaster('/master/enquiry-types'), getCachedMaster('/master/enquiry-categories')]);
    setDealers(d.dealers || []); setAllTypes(normalizeEnquiryTypes(t.enquiry_types || [])); setCats(normalizeEnquiryCategories(c.categories || []));
  }
  async function openEdit(summary: any) {
    if (editLoading) return;
    const id = typeof summary === 'number' ? summary : summary.id;
    setEditLoading(true);
    setEditing(typeof summary === 'number' ? { id } : summary);
    setForm(typeof summary === 'number' ? { name: '', email: '', phone: '', role: 'department_user', dealer_id: '', department: '' } : {
      name: summary.name || '',
      email: summary.email || '',
      phone: summary.phone || '',
      role: summary.role || 'department_user',
      dealer_id: summary.dealer_id || '',
      department: summary.department || '',
    });
    setExistingTypeIds([]);
    setTypeIds([]);
    setModalOpen(true);
    try {
      const [r, d, t, c] = await Promise.all([
        api.get<{ user: any; enquiry_types: any[] }>(`/users/${id}`),
        getCachedMaster('/master/all-dealers'),
        getCachedMaster('/master/enquiry-types'),
        getCachedMaster('/master/enquiry-categories'),
      ]);
      setEditing(r.user);
      setForm({ name: r.user.name, email: r.user.email, phone: r.user.phone || '', role: r.user.role, dealer_id: r.user.dealer_id || '', department: r.user.department || '' });
      setExistingTypeIds(r.enquiry_types.map((t: any) => t.id));
      setTypeIds(r.enquiry_types.map((t: any) => t.id));
      setDealers(d.dealers || []); setAllTypes(normalizeEnquiryTypes(t.enquiry_types || [])); setCats(normalizeEnquiryCategories(c.categories || []));
    } catch (e: any) {
      setModalOpen(false);
      toast.error('Unable to load user', { description: e.message });
    } finally {
      setEditLoading(false);
    }
  }
  async function save() {
    if (saving) return;
    if (!form.name || !form.email || !form.role) { toast.error('Name, email, role required'); return; }
    if (isDealerScoped && !form.dealer_id) { toast.error('Select a dealer for this role'); return; }
    if (form.role === 'department_user' && !form.department) { toast.error('Select a department for this role'); return; }
    setSaving(true);
    try {
      const body: any = { ...form, dealer_id: form.dealer_id ? parseInt(form.dealer_id, 10) : null };
      if (editing) {
        if (form.role === 'department_user') body.enquiry_type_ids = typeIds;
        await api.patch(`/users/${editing.id}`, body);
      } else {
        const created = await api.post<{ id: number }>('/users', body);
        setModalOpen(false);
        if (form.role === 'department_user') {
          setAccessUserId(created.id);
          setAccessOpen(true);
          return;
        }
      }
      toast.success(editing ? 'User updated' : 'User created', { description: editing ? 'Changes saved' : 'They can now sign in with OTP' });
      setModalOpen(false);
      await load();
    } catch (e: any) { toast.error(e.message); } finally { setSaving(false); }
  }
  async function saveAccess() {
    if (!accessUserId || accessSaving) return;
    setAccessSaving(true);
    try {
      await api.patch(`/users/${accessUserId}`, { enquiry_type_ids: typeIds });
      setAccessOpen(false);
      setAccessUserId(null);
      toast.success('User access saved');
      await load();
    } catch (e: any) { toast.error(e.message); } finally { setAccessSaving(false); }
  }
  async function recycle(id: number, name: string) {
    setDeletingId(id);
    setUsers((current) => current.filter((user) => user.id !== id));
    try {
      await api.delete(`/users/${id}`);
      toast.success('Recycled', { description: `${name} moved to recycle bin.` });
    }
    catch (e: any) { await load(); toast.error(e.message); }
    finally { setDeletingId(null); }
  }

  if (!isSuperAdmin()) return <div className="p-8 text-center text-muted-foreground">Access denied — Super Admin only</div>;
  if (error) return <div className="p-8 text-center"><AlertTriangle className="mx-auto h-8 w-8 text-red-500 mb-2" /><p>{error}</p></div>;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div><h2 className="text-2xl font-bold">Users</h2><p className="text-sm text-muted-foreground">Manage users, roles &amp; scope</p></div>
        <div className="flex items-center gap-2">
          {selectedIds.length > 0 && <Button variant="destructive" size="sm" disabled={deleting} onClick={() => setBulkDeleteOpen(true)}>{deleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />} {deleting ? 'Deleting...' : `Delete ${selectedIds.length}`}</Button>}
          <Button className="btn-gold" onClick={openCreate}><UserPlus className="h-4 w-4" /> Add User</Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-3"><Input placeholder="Search by name or email…" value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-md" /></CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {loading ? <div className="p-8 text-center text-muted-foreground animate-pulse">Loading…</div> :
           users.length === 0 ? <EmptyState icon={UsersIcon} title="No users found" /> :
           <div className="overflow-x-auto">
           <table className="mx-auto min-w-[980px] w-full text-sm">
               <thead className="border-b text-muted-foreground"><tr><th className="w-10 py-2 px-3"><Checkbox checked={users.length > 0 && selectedIds.length === users.length} onCheckedChange={toggleAllUsers} aria-label="Select all users" /></th><th className="text-left py-2 px-3">Name</th><th className="text-left py-2 px-3">Email</th><th className="text-left py-2 px-3">Role</th><th className="text-left py-2 px-3">Dealer</th><th className="text-left py-2 px-3">Department</th><th className="text-left py-2 px-3">Last Login</th><th className="text-left py-2 px-3">Actions</th></tr></thead>
               <tbody>
                 {users.map(u => (
                   <tr key={u.id} className="border-b last:border-b-0 hover:bg-muted/50">
                     <td className="py-2 px-3"><Checkbox checked={selectedIds.includes(u.id)} onCheckedChange={() => toggleUser(u.id)} aria-label={`Select ${u.name}`} /></td>
                     <td className="py-2 px-3 font-medium">{u.name}</td>
                     <td className="py-2 px-3 text-muted-foreground">{u.email}</td>
                     <td className="py-2 px-3"><RoleBadge role={u.role} /></td>
                     <td className="py-2 px-3">{u.dealer_name || '— (Group)'}</td>
                     <td className="py-2 px-3">{u.department || '—'}</td>
                     <td className="py-2 px-3 text-xs text-muted-foreground">{u.last_login_at ? timeAgo(u.last_login_at) : 'never'}</td>
                     <td className="py-2 px-3">
                       <div className="flex items-center gap-2">
                         <Button variant="ghost" size="sm" disabled={editLoading} onClick={() => void openEdit(u)}><PenSquare className="h-3 w-3" /></Button>
                         <Button variant="ghost" size="sm" className="text-red-600" disabled={deletingId === u.id || deleting} onClick={() => setRecycleTarget({ id: u.id, name: u.name })}>{deletingId === u.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}</Button>
                       </div>
                     </td>
                   </tr>
                 ))}
               </tbody>
             </table>
           </div>}
        </CardContent>
      </Card>

      <Dialog open={modalOpen} onOpenChange={(open) => { setModalOpen(open); if (!open) setEditLoading(false); }}>
        <DialogContent className="max-h-[90vh] w-[calc(100vw-2rem)] max-w-4xl overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? 'Edit User' : 'Add New User'}</DialogTitle></DialogHeader>
          {!editing && <p className="text-xs text-muted-foreground bg-muted/50 p-2 rounded">No password needed — the user signs in with an OTP sent to their email.</p>}
          <div className="grid sm:grid-cols-2 gap-3">
            <div><Label>Name *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div><Label>Email *</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} disabled={!!editing} />{editing && <p className="text-xs text-muted-foreground">Email cannot be changed</p>}</div>
            <div><Label>Phone</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
            <div><Label>Role *</Label><Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v, dealer_id: ['super_admin', 'admin', 'data_operator_1'].includes(v) ? '' : form.dealer_id, department: v === 'department_user' ? form.department : '' })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{['super_admin','admin','data_operator_1','data_operator_2','department_user'].map(r => <SelectItem key={r} value={r}>{r.replaceAll('_',' ')}</SelectItem>)}</SelectContent></Select></div>
            {isDealerScoped && <div><Label>Dealer *</Label><Select value={form.dealer_id ? String(form.dealer_id) : ''} onValueChange={(v) => setForm({ ...form, dealer_id: v })}><SelectTrigger><SelectValue placeholder="Select dealer" /></SelectTrigger><SelectContent>{dealers.map(d => <SelectItem key={d.id} value={String(d.id)}>{d.name}</SelectItem>)}</SelectContent></Select></div>}
            {form.role === 'department_user' && <div><Label>Department *</Label><Select value={form.department || ''} onValueChange={(v) => setForm({ ...form, department: v })}><SelectTrigger><SelectValue placeholder="Select department" /></SelectTrigger><SelectContent>{DEPARTMENTS.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent></Select></div>}
          </div>
          {editing && form.role === 'department_user' && (
            <div className="mt-3 border-t pt-3">
              <Label className="text-sm font-semibold">Permitted Enquiry Types</Label>
              <div className="mt-2 space-y-2 max-h-60 overflow-y-auto">
                {cats.map(c => {
                  const ts = allTypes.filter(t => t.categoryId === c.id);
                  if (ts.length === 0) return null;
                  return (
                    <div key={c.id}>
                      <div className="text-xs font-medium text-muted-foreground mb-1">{c.name}</div>
                      <div className="flex flex-wrap gap-2">
                        {ts.map(t => (
                          <label key={t.id} className="flex items-center gap-1 text-xs bg-muted px-2 py-1 rounded cursor-pointer">
                            <Checkbox checked={typeIds.includes(t.id)} onCheckedChange={(v) => { if (v) setTypeIds([...typeIds, t.id]); else setTypeIds(typeIds.filter(x => x !== t.id)); }} />
                            {t.name}
                          </label>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          <DialogFooter><Button variant="outline" onClick={() => setModalOpen(false)}>Cancel</Button><Button className="btn-gold" onClick={save} disabled={editLoading || saving}>{saving ? 'Saving...' : editLoading ? 'Loading options...' : editing ? 'Save Changes' : 'Create User'}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog open={bulkDeleteOpen} onOpenChange={setBulkDeleteOpen} title={`Move ${selectedIds.length} users to recycle bin?`} description="The selected users will be deactivated, removed from this list, and available in Recycle Bin." confirmLabel="Move to Recycle" destructive onConfirm={bulkRecycleUsers} />
      <ConfirmDialog open={!!recycleTarget} onOpenChange={(open) => { if (!open) setRecycleTarget(null); }} title={`Move ${recycleTarget?.name || 'this user'} to recycle bin?`} description="This user will be deactivated and can be restored from Recycle Bin." confirmLabel="Move to Recycle" destructive onConfirm={async () => { if (recycleTarget) { await recycle(recycleTarget.id, recycleTarget.name); setRecycleTarget(null); } }} />

      <Dialog open={accessOpen} onOpenChange={setAccessOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Set Access Permissions</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">Choose the enquiry types this department user can access.</p>
          <div className="space-y-3 max-h-[55vh] overflow-y-auto">
            {cats.map((c) => {
              const types = allTypes.filter((t) => t.categoryId === c.id);
              if (types.length === 0) return null;
              return <div key={c.id} className="rounded-lg border p-3"><div className="mb-2 text-sm font-semibold">{c.name}</div><div className="flex flex-wrap gap-2">{types.map((t) => <label key={t.id} className="flex cursor-pointer items-center gap-2 rounded-md bg-muted px-2.5 py-1.5 text-xs"><Checkbox checked={typeIds.includes(t.id)} onCheckedChange={(checked) => setTypeIds(checked ? [...new Set([...typeIds, t.id])] : typeIds.filter((id) => id !== t.id))} />{t.name}</label>)}</div></div>;
            })}
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setAccessOpen(false)}>Skip for now</Button><Button className="btn-gold" onClick={saveAccess} disabled={accessSaving}>{accessSaving ? 'Saving...' : 'Save Access'}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

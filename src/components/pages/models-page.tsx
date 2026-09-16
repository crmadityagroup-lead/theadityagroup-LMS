'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { toast } from 'sonner';
import { Plus, Car, Trash2, AlertTriangle, PenSquare, Loader2 } from 'lucide-react';
import { getCachedMaster } from '@/lib/master-options-cache';

export function ModelsPage() {
  const { isSuperAdmin } = useAuth();
  const [models, setModels] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editLoading, setEditLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingModel, setEditingModel] = useState<any>(null);
  const [dealers, setDealers] = useState<any[]>([]);
  const [brandOpts, setBrandOpts] = useState<{ id: number; label: string }[]>([]);
  const [brandId, setBrandId] = useState('');
  const [modelName, setModelName] = useState('');
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const r = await api.get<{ models: any[] }>('/master/all-models');
      let list = r.models || [];
      if (search) list = list.filter(m => m.name?.toLowerCase().includes(search.toLowerCase()) || m.brand_name?.toLowerCase().includes(search.toLowerCase()) || m.dealer_name?.toLowerCase().includes(search.toLowerCase()));
      setModels(list);
      setSelectedIds((current) => current.filter((id) => list.some((model) => model.id === id)));
    } catch (e: any) { setError(e.message); } finally { setLoading(false); }
  }
  // Refresh the list when the search filter changes.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); }, [search]);

  async function loadBrandOptions() {
    const response = await getCachedMaster('/master/all-dealers');
    const groups = await Promise.all((response.dealers || []).map(async (dealer: any) => {
      const brands = await getCachedMaster(`/master/brands?dealer_id=${dealer.id}`);
      return (brands.brands || []).map((brand: any) => ({
        id: brand.id,
        label: `${dealer.name} - ${brand.name}`,
      }));
    }));
    setDealers(response.dealers || []);
    setBrandOpts(groups.flat());
  }

  async function openAdd() {
    setEditingModel(null);
    setBrandId('');
    setModelName('');
    setEditLoading(true);
    setModalOpen(true);
    try {
      await loadBrandOptions();
    } catch (e: any) {
      setModalOpen(false);
      toast.error('Unable to load model options', { description: e.message });
    } finally {
      setEditLoading(false);
    }
  }
  async function openEdit(model: any) {
    if (editLoading) return;
    setEditLoading(true);
    setEditingModel(model);
    setBrandId(String(model.brand_id));
    setModelName(model.name || '');
    setBrandOpts([]);
    setModalOpen(true);
    try {
      await loadBrandOptions();
    } catch (e: any) {
      setModalOpen(false);
      toast.error('Unable to load model options', { description: e.message });
    } finally {
      setEditLoading(false);
    }
  }
  async function save() {
    if (saving) return;
    if (!brandId || !modelName) { toast.error('Brand and model name required'); return; }
    setSaving(true);
    try {
      if (editingModel) { await api.patch(`/master/models/${editingModel.id}`, { name: modelName, brand_id: parseInt(brandId, 10) }); toast.success('Model updated'); }
      else { await api.post('/master/models', { name: modelName, brand_id: parseInt(brandId, 10) }); toast.success('Model added'); }
      setModalOpen(false); setEditingModel(null); setBrandId(''); setModelName(''); await load();
    }
    catch (e: any) { toast.error(e.message); } finally { setSaving(false); }
  }
  async function recycle(id: number, name: string) {
    if (!confirm(`Recycle model "${name}"?`)) return;
    setDeletingId(id);
    setModels((current) => current.filter((model) => model.id !== id));
    setSelectedIds((current) => current.filter((selectedId) => selectedId !== id));
    try { await api.delete(`/master/models/${id}`); toast.success('Recycled'); }
    catch (e: any) { await load(); toast.error(e.message); }
    finally { setDeletingId(null); }
  }
  async function recycleSelected() {
    if (!selectedIds.length || bulkDeleting) return;
    setBulkDeleting(true);
    const ids = [...selectedIds];
    try {
      await Promise.all(ids.map((id) => api.delete(`/master/models/${id}`)));
      setModels((current) => current.filter((model) => !ids.includes(model.id)));
      setSelectedIds([]);
      toast.success(`${ids.length} models recycled`);
    } catch (e: any) {
      await load();
      toast.error(e.message || 'Unable to recycle selected models');
    } finally {
      setBulkDeleting(false);
    }
  }

  if (!isSuperAdmin()) return <div className="p-8 text-center text-muted-foreground">Access denied — Super Admin only</div>;
  if (error) return <div className="p-8 text-center"><AlertTriangle className="mx-auto h-8 w-8 text-red-500 mb-2" /><p>{error}</p></div>;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div><h2 className="text-2xl font-bold">Models</h2><p className="text-sm text-muted-foreground">Add &amp; recycle vehicle models (dealer-wise)</p></div>
        <Button className="btn-gold" onClick={openAdd}><Plus className="h-4 w-4" /> Add Model</Button>
      </div>
      <Card><CardContent className="p-3"><Input placeholder="Search models…" value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-md" /></CardContent></Card>
      <Card>
        <CardContent className="p-0">
          {selectedIds.length > 0 && <div className="flex items-center justify-between gap-3 border-b px-3 py-2"><span className="text-sm font-medium">{selectedIds.length} selected</span><Button variant="destructive" size="sm" disabled={bulkDeleting} onClick={() => setBulkDeleteOpen(true)}>{bulkDeleting && <Loader2 className="h-3 w-3 animate-spin" />} Recycle selected</Button></div>}
          {loading ? <div className="p-8 text-center text-muted-foreground animate-pulse">Loading…</div> :
           models.length === 0 ? <div className="p-12 text-center"><Car className="mx-auto h-10 w-10 text-muted-foreground mb-2" /><p>No models found</p></div> :
           <div className="overflow-x-auto"><table className="mx-auto min-w-[740px] w-full text-sm"><thead className="border-b text-muted-foreground"><tr><th className="w-10 py-2 px-3"><Checkbox aria-label="Select all models" checked={models.length > 0 && selectedIds.length === models.length} onCheckedChange={(checked) => setSelectedIds(checked ? models.map((model) => model.id) : [])} /></th><th className="text-left py-2 px-3">Model</th><th className="text-left py-2 px-3">Brand</th><th className="text-left py-2 px-3">Dealer</th><th className="text-left py-2 px-3">Actions</th></tr></thead><tbody>
             {models.map(m => <tr key={m.id} className="border-b last:border-b-0 hover:bg-muted/50"><td className="py-2 px-3"><Checkbox aria-label={`Select ${m.name}`} checked={selectedIds.includes(m.id)} onCheckedChange={(checked) => setSelectedIds((current) => checked ? [...current, m.id] : current.filter((id) => id !== m.id))} /></td><td className="py-2 px-3 font-medium">{m.name}</td><td className="py-2 px-3">{m.brand_name || '—'}</td><td className="py-2 px-3">{m.dealer_name || '—'}</td><td className="w-[140px] whitespace-nowrap py-2 px-3"><div className="flex items-center gap-2"><Button variant="ghost" size="sm" disabled={editLoading || deletingId !== null || bulkDeleting} onClick={() => void openEdit(m)} aria-label={`Edit ${m.name}`}><PenSquare className="h-3 w-3" /></Button><Button variant="ghost" size="sm" className="text-red-600" disabled={deletingId === m.id || bulkDeleting} onClick={() => recycle(m.id, m.name)} aria-label={`Recycle ${m.name}`}>{deletingId === m.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}</Button></div></td></tr>)}
           </tbody></table></div>}
        </CardContent>
      </Card>

      <Dialog open={modalOpen} onOpenChange={(open) => { setModalOpen(open); if (!open) setEditLoading(false); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editingModel ? 'Edit Model' : 'Add Model'}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Brand *</Label>
              <select className="w-full border rounded p-2 text-sm" value={brandId} onChange={(e) => setBrandId(e.target.value)}>
                <option value="">Select brand (dealer-wise)</option>
                {brandOpts.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
              </select>
            </div>
            <div><Label>Model Name *</Label><Input value={modelName} onChange={(e) => setModelName(e.target.value)} placeholder="e.g. XUV700" /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setModalOpen(false)}>Cancel</Button><Button className="btn-gold" onClick={save} disabled={editLoading || saving}>{saving ? 'Saving...' : editLoading ? 'Loading options...' : editingModel ? 'Save Changes' : 'Add Model'}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
      <ConfirmDialog open={bulkDeleteOpen} onOpenChange={setBulkDeleteOpen} title={`Recycle ${selectedIds.length} models?`} description="The selected models will move to the recycle bin." confirmLabel="Recycle models" destructive onConfirm={recycleSelected} />
    </div>
  );
}

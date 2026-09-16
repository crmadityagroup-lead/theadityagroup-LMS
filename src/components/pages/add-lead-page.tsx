'use client';
/* eslint-disable react-hooks/set-state-in-effect */
import { useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { toast } from 'sonner';
import { ArrowLeft, ChevronRight } from 'lucide-react';
import { LEAD_SOURCES } from '@/lib/lead-constants';
import { normalizeEnquiryCategories, normalizeEnquiryTypes } from '@/lib/enquiry-vocabulary';
import { getCachedEligibleUsers, getCachedEnquiryTypes, getCachedMaster } from '@/lib/master-options-cache';

interface NavigateFn { (route: string, arg?: any): void; }

export function AddLeadPage({ navigate }: { navigate: NavigateFn }) {
  const { user } = useAuth();
  const [dealers, setDealers] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [brands, setBrands] = useState<any[]>([]);
  const [models, setModels] = useState<any[]>([]);
  const [types, setTypes] = useState<any[]>([]);
  const [eligibleUsers, setEligibleUsers] = useState<any[]>([]);
  const [dealerId, setDealerId] = useState<string>('');
  const [brandId, setBrandId] = useState<string>('');
  const [modelId, setModelId] = useState<string>('');
  const [categoryId, setCategoryId] = useState<string>('');
  const [typeId, setTypeId] = useState<string>('');
  const [derivedDept, setDerivedDept] = useState<string>('');
  const [assignedUserIds, setAssignedUserIds] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);
  const [masterError, setMasterError] = useState<string | null>(null);
  const [form, setForm] = useState({ customer_name: '', mobile: '', secondary_number: '', email: '', location: '', variant: '', registration_number: '', source: '', referral_customer_name: '', priority: 'Medium', initial_remarks: '', assigned_user_id: '', next_followup_date: '' });

  useEffect(() => {
    setMasterError(null);
    Promise.all([getCachedMaster('/master/dealers'), getCachedMaster('/master/enquiry-categories')]).then(([dealerResponse, categoryResponse]: any[]) => {
      setDealers(dealerResponse.dealers || []);
      const nextCategories = normalizeEnquiryCategories(categoryResponse.categories || []);
      setCategories(nextCategories);
      // Warm the dependent lists while the user fills the first fields.
      void Promise.all(nextCategories.map((category) => getCachedEnquiryTypes(String(category.id)).catch(() => null)));
      if (user?.role === 'data_operator_2' && user?.dealer_id && dealerResponse.dealers?.length === 1) setDealerId(String(dealerResponse.dealers[0].id));
    }).catch((error: any) => setMasterError(error.message || 'Unable to load form options'));
  }, [user]);

  useEffect(() => {
    if (!dealerId) { setBrands([]); setModels([]); return; }
    getCachedMaster(`/master/brands?dealer_id=${dealerId}`).then((r: any) => {
      const dealer = dealers.find((item) => String(item.id) === dealerId);
      const availableBrands = r.brands || [];
      const matchingBrand = dealer?.brand
        ? availableBrands.find((brand: any) => brand.name.trim().toLowerCase() === dealer.brand.trim().toLowerCase())
        : null;
      setBrands(availableBrands);
      setBrandId(matchingBrand ? String(matchingBrand.id) : '');
      setModels([]);
      setModelId('');
    });
  }, [dealerId, dealers]);
  useEffect(() => {
    if (!brandId) { setModels([]); return; }
    getCachedMaster(`/master/models?brand_id=${brandId}`).then((r: any) => { setModels(r.models || []); setModelId(''); });
  }, [brandId]);
  useEffect(() => {
    if (!categoryId) { setTypes([]); return; }
    getCachedEnquiryTypes(categoryId).then((r: any) => { setTypes(normalizeEnquiryTypes(r.enquiry_types || [])); setTypeId(''); setDerivedDept(''); }).catch(() => setTypes([]));
  }, [categoryId]);
  useEffect(() => {
    if (!typeId) return;
    const t = types.find(x => String(x.id) === typeId);
    if (t) setDerivedDept(t.department);
    if (!dealerId || !t?.department) { setEligibleUsers([]); return; }
    setAssignedUserIds([]);
    setForm((current) => ({ ...current, assigned_user_id: '' }));
    getCachedEligibleUsers(dealerId, t.department, typeId).then((r: any) => setEligibleUsers(r.users || [])).catch(() => setEligibleUsers([]));
  }, [typeId, types, dealerId]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (submittingRef.current) return;
    if (!form.customer_name.trim() || !form.mobile.trim() || !dealerId || !brandId || !modelId || !form.location.trim() || !form.source || !categoryId || !typeId || assignedUserIds.length === 0 || (form.source === 'Reference' && !form.referral_customer_name.trim())) {
      toast.error('Please complete all required fields'); return;
    }
    submittingRef.current = true;
    setSubmitting(true);
    try {
      const body: any = { ...form, dealer_id: parseInt(dealerId, 10), enquiry_category_id: parseInt(categoryId, 10), enquiry_type_id: parseInt(typeId, 10) };
      body.assigned_user_id = parseInt(assignedUserIds[0], 10);
      body.assigned_user_ids = assignedUserIds.map((id) => parseInt(id, 10));
      if (brandId) body.brand_id = parseInt(brandId, 10);
      if (modelId) body.model_id = parseInt(modelId, 10);
      const res = await api.post<{ lead: { id: number; lead_code: string } }>('/leads', body);
      toast.success('Lead Created', { description: `${res.lead.lead_code} has been assigned` });
      navigate('lead-detail', res.lead.id);
    } catch (e: any) {
      toast.error('Failed to create lead', { description: e.message + (e.data?.details ? ': ' + e.data.details.join(', ') : '') });
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }

  const fixedDealer = user?.role === 'data_operator_2' && user?.dealer_id && dealers.length === 1;

  return (
    <div className="flex-1 p-4 sm:p-6 lg:p-8 max-w-[1440px] mx-auto w-full space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Add New Lead</h2>
          <p className="text-sm text-muted-foreground">Dealer → Brand → Model → Enquiry → Department → Assign</p>
        </div>
        <Button variant="outline" onClick={() => navigate('leads')}><ArrowLeft className="h-4 w-4" /> Back to Leads</Button>
      </div>

      {/* Cascade flow */}
      <Card>
        <CardContent className="p-3 flex flex-wrap items-center gap-1 text-xs">
          <span className="px-2 py-1 rounded bg-[var(--gold)]/20 font-medium">{user?.name}</span>
          <ChevronRight className="h-3 w-3 text-muted-foreground" />
          <span className="px-2 py-1 rounded bg-muted">{fixedDealer ? dealers[0]?.name : (dealers.find(d => String(d.id) === dealerId)?.name || 'Dealer')}</span>
          <ChevronRight className="h-3 w-3 text-muted-foreground" />
          <span className="px-2 py-1 rounded bg-muted">{brands.find(b => String(b.id) === brandId)?.name || 'Brand'}</span>
          <ChevronRight className="h-3 w-3 text-muted-foreground" />
          <span className="px-2 py-1 rounded bg-muted">{models.find(m => String(m.id) === modelId)?.name || 'Model'}</span>
          <ChevronRight className="h-3 w-3 text-muted-foreground" />
          <span className="px-2 py-1 rounded bg-muted">{categories.find(c => String(c.id) === categoryId)?.name || 'Category'}</span>
          <ChevronRight className="h-3 w-3 text-muted-foreground" />
          <span className="px-2 py-1 rounded bg-muted">{types.find(t => String(t.id) === typeId)?.name || 'Type'}</span>
          <ChevronRight className="h-3 w-3 text-muted-foreground" />
          <span className="px-2 py-1 rounded bg-muted">{derivedDept || 'Department'}</span>
          <ChevronRight className="h-3 w-3 text-muted-foreground" />
          <span className="px-2 py-1 rounded bg-muted">{eligibleUsers.find(u => String(u.id) === form.assigned_user_id)?.name || 'User'}</span>
        </CardContent>
      </Card>

      {masterError && <p className="rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-600">{masterError}. Refresh and try again.</p>}
      <form onSubmit={submit} className="space-y-4">
        <Card>
          <CardHeader><CardTitle className="text-base">Customer Information</CardTitle></CardHeader>
          <CardContent className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div><Label>Customer Name *</Label><Input value={form.customer_name} onChange={(e) => setForm({ ...form, customer_name: e.target.value.replace(/[^a-zA-Z .'-]/g, '') })} required pattern="[A-Za-z .'\-]{2,}" /></div>
            <div><Label>Mobile Number *</Label><Input type="tel" inputMode="numeric" maxLength={10} value={form.mobile} onChange={(e) => setForm({ ...form, mobile: e.target.value.replace(/\D/g, '').slice(0, 10) })} required pattern="[6-9][0-9]{9}" /></div>
            <div><Label>Secondary Number</Label><Input value={form.secondary_number} onChange={(e) => setForm({ ...form, secondary_number: e.target.value })} /></div>
            <div><Label>Email</Label><Input type="text" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value.trim() })} /></div>
            <div><Label>Location *</Label><Input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} required /></div>
            <div>
              <Label>Source *</Label>
              <Select value={form.source} onValueChange={(value) => setForm({ ...form, source: value, referral_customer_name: value === 'Reference' ? form.referral_customer_name : '' })}>
                <SelectTrigger><SelectValue placeholder="Select source" /></SelectTrigger>
                <SelectContent>{LEAD_SOURCES.map((source) => <SelectItem key={source} value={source}>{source}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            {form.source === 'Reference' && <div><Label>Reference Customer Name *</Label><Input value={form.referral_customer_name} onChange={(e) => setForm({ ...form, referral_customer_name: e.target.value })} placeholder="Enter reference customer name" required /></div>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Dealer &amp; Vehicle</CardTitle></CardHeader>
          <CardContent className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <Label>Dealer *</Label>
              {fixedDealer ? <Input value={`${dealers[0]?.name} (${dealers[0]?.brand})`} disabled /> :
                <Select value={dealerId} onValueChange={setDealerId}><SelectTrigger><SelectValue placeholder="Select dealer" /></SelectTrigger><SelectContent>{dealers.map(d => <SelectItem key={d.id} value={String(d.id)}>{d.name}</SelectItem>)}</SelectContent></Select>}
            </div>
            <div>
              <Label>Brand</Label>
              {dealers.find((d) => String(d.id) === dealerId)?.brand
                ? <Input value={dealers.find((d) => String(d.id) === dealerId)?.brand || ''} disabled />
                : <Select value={brandId} onValueChange={setBrandId} disabled={!dealerId}><SelectTrigger><SelectValue placeholder="Select dealer first" /></SelectTrigger><SelectContent>{brands.map(b => <SelectItem key={b.id} value={String(b.id)}>{b.name}</SelectItem>)}</SelectContent></Select>}
            </div>
            <div><Label>Model *</Label><Select value={modelId} onValueChange={setModelId} disabled={!brandId}><SelectTrigger><SelectValue placeholder="Choose model" /></SelectTrigger><SelectContent>{models.map(m => <SelectItem key={m.id} value={String(m.id)}>{m.name}</SelectItem>)}</SelectContent></Select></div>
            <div><Label>Variant</Label><Input value={form.variant} onChange={(e) => setForm({ ...form, variant: e.target.value })} /></div>
            <div><Label>Registration Number</Label><Input value={form.registration_number} onChange={(e) => setForm({ ...form, registration_number: e.target.value })} /></div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Enquiry</CardTitle></CardHeader>
          <CardContent className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div><Label>Enquiry Category *</Label><Select value={categoryId} onValueChange={setCategoryId}><SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger><SelectContent>{categories.map(c => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}</SelectContent></Select></div>
            <div><Label>Enquiry Type *</Label><Select value={typeId} onValueChange={setTypeId} disabled={!categoryId}><SelectTrigger><SelectValue placeholder="Select category first" /></SelectTrigger><SelectContent>{types.map(t => <SelectItem key={t.id} value={String(t.id)}>{t.name}</SelectItem>)}</SelectContent></Select></div>
            <div><Label>Department (auto)</Label><Input value={derivedDept} disabled placeholder="Auto from enquiry type" /></div>
            <div><Label>Assigned Users *</Label><Popover><PopoverTrigger asChild><Button type="button" variant="outline" className="w-full justify-between" disabled={eligibleUsers.length === 0}>{assignedUserIds.length ? `${assignedUserIds.length} user${assignedUserIds.length === 1 ? '' : 's'} selected` : 'Select assigned users'}<ChevronRight className="h-4 w-4 rotate-90" /></Button></PopoverTrigger><PopoverContent align="start" className="w-[--radix-popover-trigger-width] p-2"><div className="max-h-56 space-y-1 overflow-y-auto">{eligibleUsers.map((u) => <label key={u.id} className="flex cursor-pointer items-center gap-2 rounded px-2 py-2 text-sm hover:bg-muted"><Checkbox checked={assignedUserIds.includes(String(u.id))} onCheckedChange={(checked) => { const id = String(u.id); const next = checked ? [...new Set([...assignedUserIds, id])] : assignedUserIds.filter((value) => value !== id); setAssignedUserIds(next); setForm((current) => ({ ...current, assigned_user_id: next[0] || '' })); }} />{u.name}</label>)}</div></PopoverContent></Popover></div>
            <div><Label>Priority</Label><Select value={form.priority} onValueChange={(v) => setForm({ ...form, priority: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{['Low','Medium','High','Critical'].map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent></Select></div>
            <div><Label>Next Follow-up Date</Label><Input type="date" value={form.next_followup_date} onChange={(e) => setForm({ ...form, next_followup_date: e.target.value })} /></div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Remarks</CardTitle></CardHeader>
          <CardContent><Textarea value={form.initial_remarks} onChange={(e) => setForm({ ...form, initial_remarks: e.target.value })} placeholder="Initial notes about this lead…" rows={3} /></CardContent>
        </Card>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => navigate('leads')}>Cancel</Button>
          <Button type="submit" className="btn-gold" disabled={submitting}>{submitting ? 'Creating…' : 'Create & Assign Lead'}</Button>
        </div>
      </form>
    </div>
  );
}

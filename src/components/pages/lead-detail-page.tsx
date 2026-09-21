'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { StatusBadge, PriorityBadge, formatDate } from '@/components/ui-shared';
import { toast } from 'sonner';
import { ArrowLeft, Phone, Mail, MapPin, Store, Car, Ticket, Flag, UserCog, CalendarPlus, PenSquare, Trash2, ChevronRight } from 'lucide-react';
import { WhatsAppIcon } from '@/components/whatsapp-icon';
import { LEAD_SOURCES } from '@/lib/lead-constants';
import { normalizeEnquiryCategories, normalizeEnquiryTypes } from '@/lib/enquiry-vocabulary';
import { getCachedEligibleUsers, getCachedEnquiryTypes, getCachedMaster } from '@/lib/master-options-cache';
import { GeneratedAvatar } from '@/components/generated-avatar';

interface NavigateFn { (route: string, arg?: any): void; }

const EDITABLE_STATUSES = [
  { value: 'in_progress', label: 'In Progress' },
  { value: 'follow_up', label: 'Follow Up' },
  { value: 'converted', label: 'Converted / Closed' },
  { value: 'lost', label: 'Lost' },
];
const DEPT_FIELDS: Record<string, string[]> = {
  'Sales (Personal)': ['Budget','Purchase Timeline','Test Drive Details','Quotation Amount','Exchange Value','Booking Amount','Expected Delivery Date','Customer Interest'],
  'Sales (Commercial)': ['Organization','Fleet Size','Quantity','Use Case','Commercial Value','Demo','Expected Purchase Date','Order Details'],
  'Service': ['Job Card','Service Type','Advisor','Diagnosis','Estimated Cost','Final Cost','Parts Required','Repair Details','Expected Delivery'],
  'Spare Parts': ['Part/Accessory','Part Number','Availability','Quantity','Price','Order Required','Expected Availability'],
  Accessories: ['Part/Accessory','Part Number','Availability','Quantity','Price','Order Required','Expected Availability'],
  'Finance': ['Finance Company','Loan Amount','Down Payment','EMI','Tenure','Application No.','Approval','Disbursement'],
  'Insurance': ['Insurance Company','Policy No.','Policy Type','Start Date','Expiry Date','Premium','IDV','Renewal/Claim Details'],
  Bodyshop: ['Job Card','Service Type','Advisor','Diagnosis','Estimated Cost','Final Cost','Parts Required','Repair Details','Expected Delivery'],
  'Used Manager': ['Vehicle Make','Vehicle Model','Year','KMs','Condition','Expected Price','Offer Price','Customer Decision'],
  'Emergency Breakdown': ['Job Card','Service Type','Advisor','Diagnosis','Estimated Cost','Final Cost','Repair Details','Expected Delivery'],
};
const DEPT_FIELD_OPTIONS: Record<string, string[]> = {
  Budget: ['Below 5 lakh', '5-10 lakh', '10-20 lakh', 'Above 20 lakh'],
  'Purchase Timeline': ['Immediate', 'Within 1 month', '1-3 months', 'After 3 months'],
  'Test Drive Details': ['Requested', 'Completed', 'Not interested', 'Pending'],
  'Quotation Amount': ['Not quoted', 'Below 5 lakh', '5-10 lakh', 'Above 10 lakh'],
  'Exchange Value': ['No exchange', 'Below 2 lakh', '2-5 lakh', 'Above 5 lakh'],
  'Booking Amount': ['Not booked', 'Below 50,000', '50,000-1 lakh', 'Above 1 lakh'],
  'Expected Delivery Date': ['To be confirmed', 'Within 7 days', 'Within 30 days', 'After 30 days'],
  'Customer Interest': ['Hot', 'Warm', 'Cold', 'Not interested'],
  Organization: ['Individual', 'Company', 'Government', 'Fleet'],
  'Fleet Size': ['1-5', '6-20', '21-50', 'More than 50'],
  Quantity: ['1', '2-5', '6-20', 'More than 20'],
  'Use Case': ['Personal', 'Business', 'Commercial', 'Government'],
  'Commercial Value': ['To be confirmed', 'Below 10 lakh', '10-50 lakh', 'Above 50 lakh'],
  Demo: ['Requested', 'Completed', 'Pending', 'Not required'],
  'Expected Purchase Date': ['Immediate', 'Within 1 month', '1-3 months', 'After 3 months'],
  'Order Details': ['Draft', 'Quotation sent', 'Order confirmed', 'Delivered'],
  'Service Type': ['General service', 'Repair', 'Warranty', 'Periodic maintenance'],
  Advisor: ['Assigned', 'Pending', 'Completed'],
  Diagnosis: ['Pending', 'In progress', 'Completed'],
  'Estimated Cost': ['To be confirmed', 'Below 10,000', '10,000-50,000', 'Above 50,000'],
  'Final Cost': ['Pending', 'Below 10,000', '10,000-50,000', 'Above 50,000'],
  'Parts Required': ['None', 'Pending', 'Available', 'Ordered'],
  'Repair Details': ['Pending', 'In progress', 'Completed'],
  'Expected Delivery': ['Today', 'Within 3 days', 'Within 7 days', 'To be confirmed'],
  'Part/Accessory': ['Accessory', 'Spare part', 'Tyre', 'Battery'],
  'Part Number': ['Available', 'To be confirmed', 'Not applicable'],
  Availability: ['Available', 'Limited stock', 'On order', 'Unavailable'],
  Price: ['To be confirmed', 'Below 5,000', '5,000-25,000', 'Above 25,000'],
  'Order Required': ['Yes', 'No', 'Pending'],
  'Expected Availability': ['Today', 'Within 7 days', 'Within 30 days', 'To be confirmed'],
  'Finance Company': ['HDFC', 'ICICI', 'SBI', 'Other'],
  'Loan Amount': ['Below 5 lakh', '5-10 lakh', '10-20 lakh', 'Above 20 lakh'],
  'Down Payment': ['Below 1 lakh', '1-3 lakh', '3-5 lakh', 'Above 5 lakh'],
  EMI: ['To be calculated', 'Below 10,000', '10,000-25,000', 'Above 25,000'],
  Tenure: ['12 months', '24 months', '36 months', '48 months', '60 months'],
  'Application No.': ['Not applied', 'Submitted', 'Approved', 'Rejected'],
  Approval: ['Pending', 'Approved', 'Rejected'],
  Disbursement: ['Pending', 'Processing', 'Completed'],
  'Insurance Company': ['HDFC Ergo', 'ICICI Lombard', 'Bajaj Allianz', 'Other'],
  'Policy No.': ['Not issued', 'Active', 'Expired'],
  'Policy Type': ['Comprehensive', 'Third party', 'Zero depreciation'],
  'Start Date': ['Today', 'Within 7 days', 'To be confirmed'],
  'Expiry Date': ['Within 30 days', '1-3 months', 'More than 3 months'],
  Premium: ['To be calculated', 'Below 10,000', '10,000-25,000', 'Above 25,000'],
  IDV: ['To be calculated', 'Below 5 lakh', '5-10 lakh', 'Above 10 lakh'],
  'Renewal/Claim Details': ['No claim', 'Renewal due', 'Claim in progress', 'Claim completed'],
  RTO: ['Cuttack', 'Bhubaneswar', 'Puri', 'Other'],
  'RC No.': ['Pending', 'Applied', 'Issued'],
  HSRP: ['Pending', 'Applied', 'Fitted'],
  'Documents Pending': ['None', 'Customer documents', 'Dealer documents', 'RTO documents'],
  Charges: ['To be confirmed', 'Paid', 'Pending'],
  'Expected Completion': ['Within 7 days', 'Within 30 days', 'To be confirmed'],
  'Feedback/Complaint Type': ['Feedback', 'Complaint', 'Suggestion', 'Appreciation'],
  Rating: ['1', '2', '3', '4', '5'],
  'Related Department': ['Sales', 'Service', 'Finance', 'Insurance', 'Registration'],
  Escalation: ['No', 'Low', 'Medium', 'High'],
  Resolution: ['Pending', 'In progress', 'Resolved', 'Closed'],
  'Customer Confirmation': ['Pending', 'Confirmed', 'Not confirmed'],
  'Vehicle Make': ['Mahindra', 'Hyundai', 'Honda', 'Other'],
  'Vehicle Model': ['To be confirmed', 'Available', 'Not available'],
  Year: ['2026', '2025', '2024', '2023', '2022 or older'],
  KMs: ['Below 10,000', '10,000-30,000', '30,000-60,000', 'Above 60,000'],
  Condition: ['Excellent', 'Good', 'Average', 'Needs repair'],
  'Expected Price': ['Below 3 lakh', '3-6 lakh', '6-10 lakh', 'Above 10 lakh'],
  'Offer Price': ['To be evaluated', 'Below expected', 'Matches expected', 'Above expected'],
  'Customer Decision': ['Interested', 'Negotiating', 'Accepted', 'Declined'],
};

function formatActivityDetails(action: string, details: any) {
  if (!details || typeof details !== 'object') return '';
  const assignedNames = Array.isArray(details.assigned_to_names) ? details.assigned_to_names : [];
  if (action === 'assigned') {
    const parts = [assignedNames.length ? `Assigned to ${assignedNames.join(', ')}` : 'Lead assignment updated'];
    if (details.department) parts.push(`Department: ${details.department}`);
    if (details.reassigned) parts.push('Reassigned');
    return parts.join(' · ');
  }
  if (action === 'created') {
    const parts = ['Lead created'];
    if (assignedNames.length) parts.push(`Assigned to ${assignedNames.join(', ')}`);
    if (details.priority) parts.push(`Priority: ${details.priority}`);
    return parts.join(' · ');
  }
  if (action === 'status_changed') return `Status changed from ${String(details.from || 'new').replaceAll('_', ' ')} to ${String(details.to || '-').replaceAll('_', ' ')}`;
  if (action === 'remark_added') return details.remark ? `Remark: ${details.remark}` : 'Remark updated';
  const entries = Object.entries(details).filter(([key]) => !['assigned_to', 'assigned_to_names', 'message'].includes(key));
  return entries.map(([key, value]) => `${key.replaceAll('_', ' ')}: ${Array.isArray(value) ? value.join(', ') : String(value)}`).join(' · ') || details.message || '';
}

export function LeadDetailPage({ leadId, navigate }: { leadId: number; navigate: NavigateFn }) {
  const { user } = useAuth();
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [statusOpen, setStatusOpen] = useState(false);
  const [reassignOpen, setReassignOpen] = useState(false);
  const [followupOpen, setFollowupOpen] = useState(false);
  const [updateOpen, setUpdateOpen] = useState(false);
  const [eligibleUsers, setEligibleUsers] = useState<any[]>([]);
  const [statusVal, setStatusVal] = useState('');
  const [reassignUser, setReassignUser] = useState('');
  const [reassignUsers, setReassignUsers] = useState<string[]>([]);
  const [followupRemarks, setFollowupRemarks] = useState('');
  const [followupDate, setFollowupDate] = useState('');
  const [followupOutcome, setFollowupOutcome] = useState('pending');
  const [deptData, setDeptData] = useState<Record<string, string>>({});
  const [deptStatus, setDeptStatus] = useState('');
  const [deptRemark, setDeptRemark] = useState('');
  const [deptFollowup, setDeptFollowup] = useState('');
  const [recycleWarningOpen, setRecycleWarningOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editLoading, setEditLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editForm, setEditForm] = useState({ customer_name: '', mobile: '', secondary_number: '', email: '', location: '', source: '', referral_customer_name: '', variant: '', registration_number: '', priority: 'Medium', initial_remarks: '', next_followup_date: '' });
  const [editDealers, setEditDealers] = useState<any[]>([]);
  const [editBrands, setEditBrands] = useState<any[]>([]);
  const [editModels, setEditModels] = useState<any[]>([]);
  const [editCategories, setEditCategories] = useState<any[]>([]);
  const [editTypes, setEditTypes] = useState<any[]>([]);
  const [editEligibleUsers, setEditEligibleUsers] = useState<any[]>([]);
  const [editDealerId, setEditDealerId] = useState('');
  const [editBrandId, setEditBrandId] = useState('');
  const [editModelId, setEditModelId] = useState('');
  const [editCategoryId, setEditCategoryId] = useState('');
  const [editTypeId, setEditTypeId] = useState('');
  const [editDepartment, setEditDepartment] = useState('');
  const [editAssignedUserIds, setEditAssignedUserIds] = useState<string[]>([]);

  useEffect(() => {
    if (!leadId) return;
    api.get(`/leads/${leadId}`).then(d => setData(d)).catch(e => setError(e.message));
  }, [leadId]);

  async function refresh() {
    const d = await api.get(`/leads/${leadId}`);
    setData(d);
  }

  async function changeStatus() {
    if (saving) return;
    setSaving(true);
    try {
      await api.patch(`/leads/${leadId}`, { status: statusVal });
      toast.success('Status updated');
      setStatusOpen(false);
      setStatusVal('');
      await refresh();
    } catch (e: any) { toast.error(e.message); } finally { setSaving(false); }
  }
  async function loadEligible() {
    const l = data?.lead;
    if (!l) return;
    const r = await api.get(`/master/eligible-users?dealer_id=${l.dealer_id}&department=${encodeURIComponent(l.department)}&enquiry_type_id=${l.enquiry_type_id}`);
    setEligibleUsers(r.users || []);
  }
  async function reassign() {
    if (saving) return;
    setSaving(true);
    try {
      await api.patch(`/leads/${leadId}`, { assigned_user_id: parseInt(reassignUsers[0] || reassignUser, 10), assigned_user_ids: reassignUsers.length ? reassignUsers.map((id) => parseInt(id, 10)) : [parseInt(reassignUser, 10)] });
      toast.success('Lead reassigned');
      setReassignOpen(false);
      setReassignUser('');
      setReassignUsers([]);
      await refresh();
    } catch (e: any) { toast.error(e.message); } finally { setSaving(false); }
  }
  async function addFollowup() {
    if (saving) return;
    setSaving(true);
    try {
      await api.post(`/leads/${leadId}/followups`, { remarks: followupRemarks, next_followup_date: followupDate, outcome: followupOutcome });
      toast.success('Follow-up added');
      setFollowupOpen(false);
      setFollowupRemarks(''); setFollowupDate(''); setFollowupOutcome('pending');
      await refresh();
    } catch (e: any) { toast.error(e.message); } finally { setSaving(false); }
  }
  async function recycle() {
    try {
      await api.delete(`/leads/${leadId}`);
      toast.success('Moved to recycle bin');
      navigate('leads');
    } catch (e: any) { toast.error(e.message); }
  }
  async function openEdit() {
    const lead = data?.lead;
    if (!lead || editLoading) return;
    setEditLoading(true);
    setEditForm({ customer_name: lead?.customer_name || '', mobile: lead?.mobile || '', secondary_number: lead?.secondary_number || '', email: lead?.email || '', location: lead?.location || '', source: lead?.source || '', referral_customer_name: lead?.referral_customer_name || '', variant: lead?.variant || '', registration_number: lead?.registration_number || '', priority: lead?.priority || 'Medium', initial_remarks: lead?.initial_remarks || '', next_followup_date: lead?.next_followup_date ? String(lead.next_followup_date).slice(0, 10) : '' });
    setEditDealerId(String(lead?.dealer_id || '')); setEditBrandId(String(lead?.brand_id || '')); setEditModelId(String(lead?.model_id || ''));
    setEditCategoryId(String(lead?.enquiry_category_id || '')); setEditTypeId(String(lead?.enquiry_type_id || '')); setEditDepartment(lead?.department || '');
    setEditAssignedUserIds((lead?.assigned_users || []).map((assigned: any) => String(assigned.id)).filter(Boolean));
    setEditOpen(true);
    void loadEditOptions(lead).catch(() => {
      setEditOpen(false);
    }).finally(() => {
      setEditLoading(false);
    });
  }
  async function loadEditOptions(lead: any) {
    try {
      const [dealerResponse, categoryResponse] = await Promise.all([getCachedMaster('/master/dealers'), getCachedMaster('/master/enquiry-categories')]);
      setEditDealers(dealerResponse.dealers || []); setEditCategories(normalizeEnquiryCategories(categoryResponse.categories || []));
      const [brandResponse, modelResponse, typeResponse, usersResponse] = await Promise.all([
        getCachedMaster(`/master/brands?dealer_id=${lead.dealer_id}`),
        getCachedMaster(`/master/models?brand_id=${lead.brand_id}`),
        getCachedEnquiryTypes(String(lead.enquiry_category_id)),
        getCachedEligibleUsers(lead.dealer_id, lead.department, String(lead.enquiry_type_id)),
      ]);
      setEditBrands(brandResponse.brands || []); setEditModels(modelResponse.models || []); setEditTypes(normalizeEnquiryTypes(typeResponse.enquiry_types || [])); setEditEligibleUsers(usersResponse.users || []);
    } catch (error: any) {
      toast.error('Unable to load edit options', { description: error.message });
      throw error;
    }
  }
  async function changeEditDealer(value: string) {
    setEditDealerId(value); setEditBrandId(''); setEditModelId('');
    const response = await getCachedMaster(`/master/brands?dealer_id=${value}`); setEditBrands(response.brands || []); setEditModels([]);
  }
  async function changeEditBrand(value: string) {
    setEditBrandId(value); setEditModelId('');
    const response = await getCachedMaster(`/master/models?brand_id=${value}`); setEditModels(response.models || []);
  }
  async function changeEditCategory(value: string) {
    setEditCategoryId(value); setEditTypeId(''); setEditDepartment(''); setEditTypes([]); setEditEligibleUsers([]);
    const response = await getCachedEnquiryTypes(value); setEditTypes(normalizeEnquiryTypes(response.enquiry_types || []));
  }
  async function changeEditType(value: string) {
    setEditTypeId(value);
    const selected = editTypes.find((type) => String(type.id) === value);
    setEditDepartment(selected?.department || ''); setEditAssignedUserIds([]);
    if (selected?.department && editDealerId) {
      const response = await getCachedEligibleUsers(editDealerId, selected.department, value); setEditEligibleUsers(response.users || []);
    }
  }
  async function saveEdit() {
    if (saving) return;
    setSaving(true);
    try {
      if (!editDealerId || !editBrandId || !editModelId || !editCategoryId || !editTypeId || !editAssignedUserIds.length) { toast.error('Please complete all required edit fields'); return; }
      const response = await api.patch<{ lead?: any }>(`/leads/${leadId}`, { ...editForm, dealer_id: Number(editDealerId), brand_id: Number(editBrandId), model_id: Number(editModelId), enquiry_category_id: Number(editCategoryId), enquiry_type_id: Number(editTypeId), assigned_user_id: Number(editAssignedUserIds[0]), assigned_user_ids: editAssignedUserIds.map(Number) });
      toast.success('Lead updated');
      setEditOpen(false);
      if (response.lead) setData((current: any) => current ? { ...current, lead: response.lead } : current);
      void refresh();
    } catch (e: any) { toast.error(e.message); } finally { setSaving(false); }
  }
  async function submitDeptUpdate() {
    if (saving) return;
    if (!deptStatus) { toast.error('Please select a status'); return; }
    setSaving(true);
    try {
      const data = Object.fromEntries(Object.entries(deptData).filter(([, v]) => v));
      await api.post(`/leads/${leadId}/dept-update`, { data, status: deptStatus || undefined, remark: deptRemark.trim() || undefined, next_followup_date: deptFollowup || undefined });
      const savedStatus = deptStatus;
      const savedRemark = deptRemark.trim();
      const savedFollowup = deptFollowup;
      setData((current: any) => {
        if (!current?.lead) return current;
        const optimisticActivities = [
          ...(savedStatus && savedStatus !== current.lead.status ? [{ id: `local-status-${Date.now()}`, action: 'status_changed', details: { from: current.lead.status, to: savedStatus }, created_at: new Date().toISOString(), user_name: user?.name }] : []),
          ...(savedRemark ? [{ id: `local-remark-${Date.now()}`, action: 'remark_added', details: { remark: savedRemark }, created_at: new Date().toISOString(), user_name: user?.name }] : []),
        ];
        return {
          ...current,
          lead: { ...current.lead, status: savedStatus, next_followup_date: savedFollowup || current.lead.next_followup_date },
          activities: [...(current.activities || []), ...optimisticActivities],
        };
      });
      toast.success('Department update saved');
      setUpdateOpen(false);
      setDeptData({}); setDeptStatus(''); setDeptRemark(''); setDeptFollowup('');
      void refresh();
    } catch (e: any) { toast.error(e.message); } finally { setSaving(false); }
  }
  function toggleDepartmentUpdate(open: boolean) {
    setUpdateOpen(open);
    if (open) {
      setDeptStatus(EDITABLE_STATUSES.some((status) => status.value === l.status) ? l.status : '');
      setDeptRemark('');
      setDeptFollowup('');
      setDeptData({});
    }
  }
  function sendViaWhatsApp() {
    const primaryAssignee = l.assigned_users?.[0];
    const recipientPhone = user?.role === 'department_user'
      ? l.created_by_phone
      : (primaryAssignee?.phone || l.assigned_user_phone);
    const rawMobile = String(recipientPhone || '').replace(/\D/g, '');
    const mobile = rawMobile.length === 10 ? `91${rawMobile}` : rawMobile;
    if (!mobile) {
      toast.error(user?.role === 'department_user'
        ? 'The data operator who assigned this lead does not have a phone number'
        : 'The primary assigned user does not have a phone number');
      return;
    }
    const latestRemark = [...(data.activities || [])].reverse().find((activity: any) => activity.action === 'remark_added')?.details?.remark || l.initial_remarks || '-';
    const message = user?.role === 'department_user'
      ? [
        `Lead Code: ${l.lead_code || '-'} | Customer Name: ${l.customer_name || '-'} | Mobile: ${l.mobile || '-'}`,
        `Remarks: ${latestRemark} | Status: ${l.status || '-'}`,
      ].join('\n')
      : [
        `New Lead | Lead Code: ${l.lead_code || '-'} | Name: ${l.customer_name || '-'} | Number: ${l.mobile || '-'}`,
        `Enquiry Category: ${l.enquiry_category_name || '-'} | Enquiry Type: ${l.enquiry_type_name || '-'} | Model: ${l.model_name || '-'} | Remark: ${latestRemark}`,
      ].join('\n');
    window.open(`https://wa.me/${mobile}?text=${encodeURIComponent(message)}`, '_blank', 'noopener,noreferrer');
  }

  if (error) return (
    <div className="text-center py-12">
      <p className="text-red-500 mb-3">{error}</p>
      <Button variant="outline" onClick={() => navigate('leads')}><ArrowLeft className="h-4 w-4" /> Back to Leads</Button>
    </div>
  );
  if (!data) return <div className="py-12 text-center text-muted-foreground animate-pulse">Loading lead…</div>;

  const l = data.lead;
  const canEdit = ['super_admin', 'admin'].includes(user?.role || '') ||
    (['data_operator_1', 'data_operator_2'].includes(user?.role || '') && l.created_by === user?.id);
  const canRecycle = ['super_admin', 'admin'].includes(user?.role || '');
  const canUpdate = user?.role === 'department_user' &&
    (l.assigned_user_id === user.id || l.assigned_users?.some((assigned: any) => assigned.id === user.id));

  return (
    <div className="space-y-4 max-w-6xl">
      <Button variant="outline" onClick={() => navigate('leads')}><ArrowLeft className="h-4 w-4" /> Back to Leads</Button>

      <Card>
        <CardContent className="p-4 sm:p-6">
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <span className="text-xs font-mono bg-muted px-2 py-1 rounded">{l.lead_code}</span>
            <StatusBadge status={l.status} />
            <PriorityBadge priority={l.priority} />
          </div>
          <h2 className="text-2xl font-bold">{l.customer_name}</h2>
          <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-sm text-muted-foreground">
            <span><Phone className="inline h-3 w-3" /> {l.mobile}</span>
            {l.secondary_number && <span>{l.secondary_number}</span>}
            {l.email && <span><Mail className="inline h-3 w-3" /> {l.email}</span>}
            {l.location && <span><MapPin className="inline h-3 w-3" /> {l.location}</span>}
            <span><Store className="inline h-3 w-3" /> {l.dealer_name}</span>
            <span><Car className="inline h-3 w-3" /> {l.brand_name} {l.model_name}</span>
            <span><Ticket className="inline h-3 w-3" /> {l.enquiry_type_name}</span>
          </div>
          <div className="flex flex-wrap gap-2 mt-4">
            {(user?.role === 'department_user' ? l.created_by_phone : (l.assigned_users?.some((assigned: any) => assigned.phone) || l.assigned_user_phone)) && <Button variant="outline" size="sm" onClick={sendViaWhatsApp}><WhatsAppIcon /> {user?.role === 'department_user' ? 'Send Update via WhatsApp' : 'Send via WhatsApp'}</Button>}
            {canEdit && <Dialog open={editOpen} onOpenChange={(open) => { setEditOpen(open); if (!open) setEditLoading(false); }}><Button variant="outline" size="sm" onClick={() => void openEdit()} disabled={editLoading}><PenSquare className="h-4 w-4" /> {editLoading ? 'Loading…' : 'Edit Lead'}</Button>
              <DialogContent className="max-h-[90vh] w-[calc(100vw-1.5rem)] sm:max-w-3xl max-w-7xl overflow-y-auto"><DialogHeader><DialogTitle>Edit Lead</DialogTitle></DialogHeader>
                <div className="space-y-4">
                  <div><CardTitle className="mb-3 text-sm">Customer Information</CardTitle><div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    <div><Label>Customer Name *</Label><Input value={editForm.customer_name} onChange={(e) => setEditForm((current) => ({ ...current, customer_name: e.target.value.replace(/[^a-zA-Z .'-]/g, '') }))} /></div>
                    <div><Label>Mobile Number *</Label><Input inputMode="numeric" maxLength={10} value={editForm.mobile} onChange={(e) => setEditForm((current) => ({ ...current, mobile: e.target.value.replace(/\D/g, '').slice(0, 10) }))} /></div>
                    <div><Label>Secondary Number</Label><Input value={editForm.secondary_number} onChange={(e) => setEditForm((current) => ({ ...current, secondary_number: e.target.value }))} /></div>
                    <div><Label>Email</Label><Input type="email" value={editForm.email} onChange={(e) => setEditForm((current) => ({ ...current, email: e.target.value }))} /></div>
                    <div><Label>Location *</Label><Input value={editForm.location} onChange={(e) => setEditForm((current) => ({ ...current, location: e.target.value }))} /></div>
                    <div><Label>Source *</Label><Select value={editForm.source} onValueChange={(value) => setEditForm((current) => ({ ...current, source: value, referral_customer_name: value === 'Reference' ? current.referral_customer_name : '' }))}><SelectTrigger><SelectValue placeholder="Select source" /></SelectTrigger><SelectContent>{LEAD_SOURCES.map((source) => <SelectItem key={source} value={source}>{source}</SelectItem>)}</SelectContent></Select></div>
                    {editForm.source === 'Reference' && <div><Label>Reference Customer Name *</Label><Input value={editForm.referral_customer_name} onChange={(e) => setEditForm((current) => ({ ...current, referral_customer_name: e.target.value }))} required /></div>}
                  </div></div>
                  <div><CardTitle className="mb-3 text-sm">Dealer &amp; Vehicle</CardTitle><div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    <div><Label>Dealer *</Label><Select value={editDealerId} onValueChange={changeEditDealer}><SelectTrigger><SelectValue placeholder="Select dealer" /></SelectTrigger><SelectContent>{editDealers.map((dealer) => <SelectItem key={dealer.id} value={String(dealer.id)}>{dealer.name}</SelectItem>)}</SelectContent></Select></div>
                    <div><Label>Brand *</Label><Select value={editBrandId} onValueChange={changeEditBrand} disabled={!editDealerId}><SelectTrigger><SelectValue placeholder="Select brand" /></SelectTrigger><SelectContent>{editBrands.map((brand) => <SelectItem key={brand.id} value={String(brand.id)}>{brand.name}</SelectItem>)}</SelectContent></Select></div>
                    <div><Label>Model *</Label><Select value={editModelId} onValueChange={setEditModelId} disabled={!editBrandId}><SelectTrigger><SelectValue placeholder="Select model" /></SelectTrigger><SelectContent>{editModels.map((model) => <SelectItem key={model.id} value={String(model.id)}>{model.name}</SelectItem>)}</SelectContent></Select></div>
                    <div><Label>Variant</Label><Input value={editForm.variant} onChange={(e) => setEditForm((current) => ({ ...current, variant: e.target.value }))} /></div>
                    <div><Label>Registration Number</Label><Input value={editForm.registration_number} onChange={(e) => setEditForm((current) => ({ ...current, registration_number: e.target.value }))} /></div>
                  </div></div>
                  <div><CardTitle className="mb-3 text-sm">Enquiry &amp; Assignment</CardTitle><div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    <div><Label>Enquiry Category *</Label><Select value={editCategoryId} onValueChange={changeEditCategory}><SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger><SelectContent>{editCategories.map((category) => <SelectItem key={category.id} value={String(category.id)}>{category.name}</SelectItem>)}</SelectContent></Select></div>
                    <div><Label>Enquiry Type *</Label><Select value={editTypeId} onValueChange={changeEditType} disabled={!editCategoryId}><SelectTrigger><SelectValue placeholder="Select category first" /></SelectTrigger><SelectContent>{editTypes.map((type) => <SelectItem key={type.id} value={String(type.id)}>{type.name}</SelectItem>)}</SelectContent></Select></div>
                    <div><Label>Department (auto)</Label><Input value={editDepartment} disabled /></div>
                    <div><Label>Assigned Users *</Label><Popover><PopoverTrigger asChild><Button type="button" variant="outline" className="w-full justify-between" disabled={!editEligibleUsers.length}>{editAssignedUserIds.length ? `${editAssignedUserIds.length} user${editAssignedUserIds.length === 1 ? '' : 's'} selected` : 'Select assigned users'}<ChevronRight className="h-4 w-4 rotate-90" /></Button></PopoverTrigger><PopoverContent align="start" className="w-[--radix-popover-trigger-width] p-2"><div className="max-h-56 space-y-1 overflow-y-auto">{editEligibleUsers.map((assigned) => <label key={assigned.id} className="flex cursor-pointer items-center gap-2 rounded px-2 py-2 text-sm hover:bg-muted"><Checkbox checked={editAssignedUserIds.includes(String(assigned.id))} onCheckedChange={(checked) => setEditAssignedUserIds((current) => checked ? [...new Set([...current, String(assigned.id)])] : current.filter((id) => id !== String(assigned.id)))} />{assigned.name}</label>)}</div></PopoverContent></Popover></div>
                    <div><Label>Priority</Label><Select value={editForm.priority} onValueChange={(value) => setEditForm((current) => ({ ...current, priority: value }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{['Low', 'Medium', 'High', 'Critical'].map((priority) => <SelectItem key={priority} value={priority}>{priority}</SelectItem>)}</SelectContent></Select></div>
                    <div><Label>Next Follow-up Date</Label><Input type="date" value={editForm.next_followup_date} onChange={(e) => setEditForm((current) => ({ ...current, next_followup_date: e.target.value }))} /></div>
                  </div></div>
                  <div><Label>Initial Remarks</Label><Textarea value={editForm.initial_remarks} onChange={(e) => setEditForm((current) => ({ ...current, initial_remarks: e.target.value }))} rows={3} /></div>
                </div>
                <DialogFooter><Button onClick={saveEdit} disabled={editLoading || saving}>{saving ? 'Saving...' : editLoading ? 'Loading options...' : 'Save Changes'}</Button></DialogFooter>
              </DialogContent></Dialog>}
            {canEdit && <Dialog open={statusOpen} onOpenChange={setStatusOpen}><DialogTrigger asChild><Button variant="outline" size="sm"><Flag className="h-4 w-4" /> Change Status</Button></DialogTrigger>
              <DialogContent><DialogHeader><DialogTitle>Change Status</DialogTitle></DialogHeader>
                <Select value={statusVal} onValueChange={setStatusVal}><SelectTrigger><SelectValue placeholder="Select status" /></SelectTrigger><SelectContent>{EDITABLE_STATUSES.map((status) => <SelectItem key={status.value} value={status.value}>{status.label}</SelectItem>)}</SelectContent></Select>
                <DialogFooter><Button onClick={changeStatus} disabled={!statusVal || saving}>{saving ? 'Updating...' : 'Update'}</Button></DialogFooter>
              </DialogContent></Dialog>}
            {canEdit && <Dialog open={reassignOpen} onOpenChange={(o) => { setReassignOpen(o); if (o) loadEligible(); }}><DialogTrigger asChild><Button variant="outline" size="sm"><UserCog className="h-4 w-4" /> Reassign</Button></DialogTrigger>
              <DialogContent><DialogHeader><DialogTitle>Reassign Lead</DialogTitle></DialogHeader>
                <div className="space-y-2 rounded-md border-2 border-border p-2">{eligibleUsers.map((u) => <label key={u.id} className="flex cursor-pointer items-center gap-2 text-sm"><input type="checkbox" checked={reassignUsers.includes(String(u.id))} onChange={(event) => { const id = String(u.id); const next = event.target.checked ? [...reassignUsers, id] : reassignUsers.filter((value) => value !== id); setReassignUsers(next); setReassignUser(next[0] || ''); }} />{u.name}</label>)}</div>
                <DialogFooter><Button onClick={reassign} disabled={saving || (!reassignUsers.length && !reassignUser)}>{saving ? 'Saving...' : 'Reassign'}</Button></DialogFooter>
              </DialogContent></Dialog>}
            {canEdit && <Dialog open={followupOpen} onOpenChange={setFollowupOpen}><DialogTrigger asChild><Button variant="outline" size="sm"><CalendarPlus className="h-4 w-4" /> Add Follow-up</Button></DialogTrigger>
              <DialogContent><DialogHeader><DialogTitle>Add Follow-up</DialogTitle></DialogHeader>
                <div className="space-y-3"><Textarea placeholder="Remarks…" value={followupRemarks} onChange={(e) => setFollowupRemarks(e.target.value)} />
                <div><Label>Next Follow-up Date</Label><Input type="date" value={followupDate} onChange={(e) => setFollowupDate(e.target.value)} /></div>
                <Select value={followupOutcome} onValueChange={setFollowupOutcome}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{['pending','completed','rescheduled','no_response'].map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent></Select></div>
                <DialogFooter><Button onClick={addFollowup} disabled={saving || (!followupRemarks && !followupDate)}>{saving ? 'Saving...' : 'Add'}</Button></DialogFooter>
              </DialogContent></Dialog>}
            {canUpdate && <Dialog open={updateOpen} onOpenChange={toggleDepartmentUpdate}><DialogTrigger asChild><Button className="btn-gold" size="sm"><PenSquare className="h-4 w-4" /> Department Update</Button></DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto"><DialogHeader><DialogTitle>Department Update — {l.department}</DialogTitle></DialogHeader>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2"><div><Label className="py-1">Status *</Label><Select value={deptStatus} onValueChange={setDeptStatus}><SelectTrigger><SelectValue placeholder="Select status" /></SelectTrigger><SelectContent>{EDITABLE_STATUSES.map((status) => <SelectItem key={status.value} value={status.value}>{status.label}</SelectItem>)}</SelectContent></Select></div>
                  <div><Label className="py-1">Next Follow-up (optional)</Label><Input className="w-full" type="date" value={deptFollowup} onChange={(e) => setDeptFollowup(e.target.value)} /></div>
                  <div className="sm:col-span-2"><Label className="py-1">Remark (optional)</Label><Textarea className="w-full" rows={3} value={deptRemark} onChange={(e) => setDeptRemark(e.target.value)} placeholder="Add an update remark..." /></div></div>
                <DialogFooter><Button onClick={submitDeptUpdate} className="btn-gold" disabled={saving || !deptStatus}>{saving ? 'Saving...' : 'Save Update'}</Button></DialogFooter>
              </DialogContent></Dialog>}
            {canRecycle && <Button variant="destructive" size="sm" onClick={() => setRecycleWarningOpen(true)}><Trash2 className="h-4 w-4" /> Move to Recycle</Button>}
          </div>
        </CardContent>
      </Card>

      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle className="text-base">Lead Information</CardTitle></CardHeader>
          <CardContent className="text-sm space-y-1">
            <div className="flex justify-between"><span className="text-muted-foreground">Department</span><span>{l.department}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Dealer</span><span>{l.dealer_name} ({l.dealer_brand})</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Brand / Model</span><span>{l.brand_name} {l.model_name} {l.variant}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Enquiry</span><span>{l.enquiry_category_name} → {l.enquiry_type_name}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Source</span><span>{l.source || '—'}</span></div>
            {l.referral_customer_name && <div className="flex justify-between"><span className="text-muted-foreground">Reference Customer</span><span>{l.referral_customer_name}</span></div>}
            <div className="flex justify-between gap-4"><span className="text-muted-foreground">Assigned To</span><span className="text-right">{(l.assigned_users?.length ? l.assigned_users.map((assigned: any) => assigned.name).join(', ') : l.assigned_user_name) || '—'}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Created By</span><span>{l.created_by_name}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Created</span><span>{formatDate(l.created_at, true)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Next Follow-up</span><span>{l.next_followup_date ? formatDate(l.next_followup_date, true) : '—'}</span></div>
            {l.initial_remarks && <div className="pt-2 border-t"><span className="text-muted-foreground">Initial Remarks</span><p className="mt-1">{l.initial_remarks}</p></div>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Activities</CardTitle></CardHeader>
          <CardContent className="text-sm">
            {data.activities.length === 0 ? <p className="text-muted-foreground">No activity yet</p> :
              <div className="space-y-2 max-h-72 overflow-y-auto">
                {data.activities.map((a: any) => (
                  <div key={a.id} className="border-l-2 border-[var(--gold)] pl-3 py-1">
                    <div className="font-medium capitalize">{a.action.replace('_',' ')}</div>
                    <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground"><div className="h-6 w-6 shrink-0 overflow-hidden rounded-full border border-border bg-muted">{a.user_avatar_data ? <img src={a.user_avatar_data} alt={`${a.user_name || 'User'} profile`} className="block h-full w-full rounded-full object-cover object-center" /> : <GeneratedAvatar seed={`${a.user_id || 'system'}:${a.user_name || ''}`} name={a.user_name || 'System'} size={24} />}</div><span>{a.user_name || 'System'} · {formatDate(a.created_at, true, true)}</span></div>
                    {a.details && <div className="text-xs text-muted-foreground">{formatActivityDetails(a.action, a.details)}</div>}
                  </div>
                ))}
              </div>}
          </CardContent>
        </Card>
      </div>

      {data.followups.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Follow-ups ({data.followups.length})</CardTitle></CardHeader>
          <CardContent className="text-sm">
            <div className="space-y-2 max-h-72 overflow-y-auto">
              {data.followups.map((f: any) => (
                <div key={f.id} className="border rounded-md p-3">
                  <div className="flex justify-between items-center mb-1"><span className="font-medium">{f.user_name || '—'}</span><span className="text-xs text-muted-foreground">{formatDate(f.followup_date, true)}</span></div>
                  {f.remarks && <p>{f.remarks}</p>}
                  <div className="text-xs text-muted-foreground mt-1">Outcome: {f.outcome} · Next: {f.next_followup_date ? formatDate(f.next_followup_date, true) : '—'}</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {data.department_updates.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Department Updates ({data.department_updates.length})</CardTitle></CardHeader>
          <CardContent className="text-sm">
            <div className="space-y-2 max-h-72 overflow-y-auto">
                {data.department_updates.map((d: any) => (
                  <div key={d.id} className="border rounded-md p-3">
                    <div className="flex justify-between items-center mb-1"><span className="font-medium">{d.user_name || '—'}</span><span className="text-xs text-muted-foreground">{formatDate(d.created_at, true)}</span></div>
                    {d.data && Object.keys(d.data).length > 0 ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2 text-xs bg-muted p-2 rounded">
                        {Object.entries(d.data).map(([field, value]) => (
                          <div key={field} className="min-w-0">
                            <div className="font-medium text-muted-foreground">{field}</div>
                            <div className="break-words">{String(value)}</div>
                          </div>
                        ))}
                      </div>
                    ) : <p className="text-xs text-muted-foreground">No department fields were provided.</p>}
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      )}

      <ConfirmDialog
        open={recycleWarningOpen}
        onOpenChange={setRecycleWarningOpen}
        title="Move lead to recycle bin?"
        description="This lead will be moved to the recycle bin and can be restored later."
        confirmLabel="Move to Recycle"
        destructive
        onConfirm={recycle}
      />
    </div>
  );
}

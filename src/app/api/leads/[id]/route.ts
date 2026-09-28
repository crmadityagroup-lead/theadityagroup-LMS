import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { db } from '@/lib/db';
import { getCurrentUser, canManageLeads, canCreateLead, authorizeLeadAction } from '@/lib/auth';
import { LEAD_SOURCES, normalizeMobile } from '@/lib/lead-filters';
import { validateLeadCascade } from '@/lib/cascade';
import { fetchLeadDetail } from '@/lib/lead-detail';
import { setLeadAssignees } from '@/lib/lead-assignees';
import { sendPushToLeadUsers } from '@/lib/push';

// Helper: visibility check
// GET /api/leads/[id] — lead detail + activities + followups + dept updates
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  const { id } = await params;
  const leadId = parseInt(id, 10);
  const [lead, accessLead, activityData] = await Promise.all([
    fetchLeadDetail(leadId),
    db.crmLead.findUnique({ where: { id: leadId }, select: { id: true, dealerId: true, department: true, assignedUserId: true, createdBy: true } }),
    Promise.all([
      db.crmLeadActivity.findMany({ where: { leadId }, orderBy: { createdAt: 'asc' }, select: { id: true, userId: true, action: true, details: true, createdAt: true, user: { select: { name: true } } } }),
      db.crmLeadFollowup.findMany({ where: { leadId }, orderBy: { followupDate: 'desc' }, select: { id: true, remarks: true, nextFollowupDate: true, outcome: true, followupDate: true, createdAt: true, user: { select: { name: true } } } }),
      db.crmDepartmentUpdate.findMany({ where: { leadId }, orderBy: { createdAt: 'desc' }, select: { id: true, department: true, data: true, createdAt: true, user: { select: { name: true } } } }),
    ]),
  ]);
  if (!lead) return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
  if (!accessLead || !authorizeLeadAction(user, accessLead, 'VIEW')) return NextResponse.json({ error: 'No access to this lead' }, { status: 403 });

  const [activities, followups, deptUpdates] = activityData;
  const assignedUserIds = [...new Set(activities.flatMap((activity: any) => Array.isArray(activity.details?.assigned_to) ? activity.details.assigned_to.map(Number).filter(Number.isInteger) : []))];
  const activityUserIds = [...new Set(activities.map((activity: any) => activity.userId).filter((id): id is number => Number.isInteger(id)))];
  const [assignedUsers, activityAvatarRows] = await Promise.all([
    assignedUserIds.length ? db.crmUser.findMany({ where: { id: { in: assignedUserIds } }, select: { id: true, name: true } }) : [],
    activityUserIds.length ? db.$queryRaw<Array<{ id: number; avatar_data: string | null }>>`SELECT id, avatar_data FROM crm_users WHERE id IN (${Prisma.join(activityUserIds)})` : [],
  ]);
  const assignedUserNames = new Map<number, string>(assignedUsers.map((assignedUser) => [assignedUser.id, assignedUser.name] as [number, string]));
  const activityAvatars = new Map<number, string | null>(activityAvatarRows.map((avatar) => [avatar.id, avatar.avatar_data] as [number, string | null]));

  return NextResponse.json({
    lead,
    activities: activities.map((a: any) => {
      const details = a.details && typeof a.details === 'object' ? { ...a.details } : a.details;
      if (details && Array.isArray(details.assigned_to)) details.assigned_to_names = details.assigned_to.map((id: unknown) => assignedUserNames.get(Number(id))).filter(Boolean);
      return { id: a.id, action: a.action, details, created_at: a.createdAt, user_id: a.userId, user_name: a.user?.name || null, user_avatar_data: a.userId ? activityAvatars.get(a.userId) || null : null };
    }),
    followups: followups.map((f: any) => ({ id: f.id, remarks: f.remarks, next_followup_date: f.nextFollowupDate, outcome: f.outcome, followup_date: f.followupDate, created_at: f.createdAt, user_name: f.user?.name || null })),
    department_updates: deptUpdates.map((d: any) => ({ id: d.id, department: d.department, data: d.data, created_at: d.createdAt, user_name: d.user?.name || null })),
  });
}

// PATCH /api/leads/[id] — update lead status / priority / reassign
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  const { id } = await params;
  const leadId = parseInt(id, 10);
  const lead = await fetchLeadDetail(leadId);
  if (!lead) return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
  const target = { dealerId: lead.dealer_id, department: lead.department, assignedUserId: lead.assigned_user_id, createdBy: lead.created_by };
  if (!authorizeLeadAction(user, target, 'UPDATE')) return NextResponse.json({ error: 'No access to update this lead' }, { status: 403 });

  const b = await req.json();
  if (b.source !== undefined && b.source !== lead.source && user.role !== 'super_admin') {
    return NextResponse.json({ error: 'Only super admins can change a lead source' }, { status: 403 });
  }
  const updates: any = {};
  const allowed = ['customer_name', 'mobile', 'priority', 'status', 'initial_remarks', 'next_followup_date', 'source', 'referral_customer_name', 'variant', 'registration_number', 'location', 'secondary_number', 'email'];
  for (const k of allowed) {
    if (b[k] !== undefined) {
      if (k === 'next_followup_date') updates.nextFollowupDate = b[k] ? new Date(b[k]) : null;
      else if (k === 'initial_remarks') updates.initialRemarks = b[k];
      else if (k === 'customer_name') {
        const customerName = String(b[k]).trim();
        if (!/^[A-Za-z .'-]{2,100}$/.test(customerName)) return NextResponse.json({ error: 'customer_name must contain text only' }, { status: 422 });
        updates.customerName = customerName;
      } else if (k === 'mobile') {
        const mobile = normalizeMobile(b[k]);
        if (!/^[6-9]\d{9}$/.test(mobile)) return NextResponse.json({ error: 'mobile must contain exactly 10 digits and start with 6-9' }, { status: 422 });
        updates.mobile = mobile;
      }
      else if (k === 'registration_number') updates.registrationNumber = b[k];
      else if (k === 'secondary_number') updates.secondaryNumber = b[k];
      else if (k === 'referral_customer_name') updates.referralCustomerName = b[k];
      else (updates as any)[k] = b[k];
    }
  }

  const effectiveDealerId = Number(b.dealer_id ?? lead.dealer_id);
  const effectiveBrandId = Number(b.brand_id ?? lead.brand_id);
  const effectiveModelId = Number(b.model_id ?? lead.model_id);
  const effectiveEnquiryCategoryId = Number(b.enquiry_category_id ?? lead.enquiry_category_id);
  const effectiveEnquiryTypeId = Number(b.enquiry_type_id ?? lead.enquiry_type_id);
  const cascadeChanged = [b.dealer_id, b.brand_id, b.model_id, b.enquiry_category_id, b.enquiry_type_id].some((value) => value !== undefined);
  const requestedEditAssignees: number[] = Array.isArray(b.assigned_user_ids)
    ? [...new Set(b.assigned_user_ids.map((value: any) => parseInt(value, 10)).filter(Number.isInteger))] as number[]
    : b.assigned_user_id !== undefined ? [parseInt(b.assigned_user_id, 10)] : [];
  if (cascadeChanged || requestedEditAssignees.length > 0) {
    const primaryAssigneeId = requestedEditAssignees[0] || lead.assigned_user_id;
    if (!effectiveDealerId || !effectiveBrandId || !effectiveModelId || !effectiveEnquiryTypeId || !primaryAssigneeId) {
      return NextResponse.json({ error: 'Dealer, brand, model, enquiry type, and assigned user are required' }, { status: 400 });
    }
    const validation = await validateLeadCascade({ dealerId: effectiveDealerId, brandId: effectiveBrandId, modelId: effectiveModelId, enquiryTypeId: effectiveEnquiryTypeId, assignedUserId: primaryAssigneeId, operator: user });
    if (!validation.valid) return NextResponse.json({ error: 'Cascade validation failed', details: validation.errors }, { status: 400 });
    updates.dealerId = effectiveDealerId; updates.brandId = effectiveBrandId; updates.modelId = effectiveModelId;
    if (b.enquiry_category_id !== undefined) updates.enquiryCategoryId = effectiveEnquiryCategoryId;
    updates.enquiryTypeId = effectiveEnquiryTypeId; updates.department = validation.derivedDepartment;
  }

  if (b.initial_remarks !== undefined && b.initial_remarks !== lead.initial_remarks) {
    await db.crmLeadActivity.create({
      data: {
        leadId,
        userId: user.id,
        action: 'remark_added',
        details: { previous: lead.initial_remarks || null, remark: b.initial_remarks || null },
      },
    });
  }

  // Reassign to one or more eligible users. The first user remains primary
  // for legacy reports and permission checks.
  const requestedAssignees: number[] = Array.isArray(b.assigned_user_ids)
    ? ([...new Set(b.assigned_user_ids.map((value: any) => parseInt(value, 10)).filter(Number.isInteger))] as number[])
    : b.assigned_user_id !== undefined ? [parseInt(b.assigned_user_id, 10)] : [];
  if (requestedAssignees.length > 0) {
    const validations = await Promise.all(requestedAssignees.map((assignedUserId) => validateLeadCascade({
      dealerId: effectiveDealerId, brandId: effectiveBrandId || null, modelId: effectiveModelId || null,
      enquiryTypeId: effectiveEnquiryTypeId, assignedUserId, operator: user,
    })));
    const failed = validations.find((validation) => !validation.valid);
    if (failed) return NextResponse.json({ error: 'Reassignment validation failed', details: failed.errors }, { status: 400 });
    if (requestedAssignees[0] !== lead.assigned_user_id) updates.assignedUserId = requestedAssignees[0];
    await db.crmLeadActivity.create({ data: { leadId, userId: user.id, action: 'assigned', details: { assigned_to: requestedAssignees, reassigned: true } } });
  }

  if (b.status !== undefined && !['new', 'in_progress', 'follow_up', 'converted', 'closed', 'lost', 'recycled'].includes(b.status)) {
    return NextResponse.json({ error: 'Invalid lead status' }, { status: 422 });
  }
  if (b.source !== undefined && b.source && !(LEAD_SOURCES as readonly string[]).includes(b.source)) return NextResponse.json({ error: 'Invalid source' }, { status: 422 });
  const effectiveSource = b.source !== undefined ? b.source : lead.source;
  const effectiveReferral = b.referral_customer_name !== undefined ? String(b.referral_customer_name).trim() : (lead.referral_customer_name || '');
  if (effectiveSource === 'Reference' && !effectiveReferral) return NextResponse.json({ error: 'reference_customer_name is required when source is Reference' }, { status: 422 });
  if (effectiveSource !== 'Reference') updates.referralCustomerName = null;
  if (b.status && b.status !== lead.status) {
    await db.crmLeadActivity.create({ data: { leadId, userId: user.id, action: 'status_changed', details: { from: lead.status, to: b.status } } });
    if (['converted', 'closed', 'lost', 'recycled'].includes(b.status)) updates.closedAt = new Date();
  }

  if (Object.keys(updates).length > 0) {
    updates.updatedAt = new Date();
    await db.crmLead.update({ where: { id: leadId }, data: updates });
  }
  if (requestedAssignees.length > 0) await setLeadAssignees(leadId, requestedAssignees);
  if (Object.keys(updates).length > 0 || requestedAssignees.length > 0) {
    try {
      await sendPushToLeadUsers(leadId, user.id, {
        title: requestedAssignees.length > 0 ? 'CRM Lead Assigned' : 'CRM Lead Updated',
        body: requestedAssignees.length > 0 ? 'A lead was assigned to your team.' : 'A lead assigned to your team was updated.',
        assignment: requestedAssignees.length > 0,
      });
    } catch (error) {
      console.error('Push delivery failed after lead update:', error);
    }
  }
  const updated = await fetchLeadDetail(leadId);
  return NextResponse.json({ lead: updated, message: 'Lead updated' });
}

// DELETE /api/leads/[id] — soft delete (move to recycle bin)
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  if (!canManageLeads(user)) return NextResponse.json({ error: 'Only admins can recycle leads' }, { status: 403 });
  const { id } = await params;
  const leadId = parseInt(id, 10);
  // Delete only needs authorization fields, not the full detail graph.
  const lead = await db.crmLead.findUnique({
    where: { id: leadId },
    select: { id: true, status: true, dealerId: true, department: true, assignedUserId: true, createdBy: true },
  });
  if (!lead) return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
  if (!authorizeLeadAction(user, { dealerId: lead.dealerId, department: lead.department, assignedUserId: lead.assignedUserId, createdBy: lead.createdBy }, 'DELETE')) {
    return NextResponse.json({ error: 'No access to recycle this lead' }, { status: 403 });
  }
  await db.crmLead.update({ where: { id: leadId }, data: { status: 'recycled', closedAt: new Date(), updatedAt: new Date() } });
  void db.crmLeadActivity.create({ data: { leadId, userId: user.id, action: 'status_changed', details: { from: lead.status, to: 'recycled', reason: 'moved to recycle bin' } } }).catch((error) => {
    console.error('Recycle activity write failed:', error);
  });
  return NextResponse.json({ message: 'Lead moved to recycle bin' });
}

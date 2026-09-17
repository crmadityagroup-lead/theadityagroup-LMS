import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getCurrentUser, authorizeLeadAction } from '@/lib/auth';
import { sendPushToLeadUsers } from '@/lib/push';

// POST /api/leads/[id]/dept-update — department-specific update form
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  const { id } = await params;
  const leadId = parseInt(id, 10);
  const lead = await db.crmLead.findUnique({ where: { id: leadId }, select: { id: true, dealerId: true, department: true, status: true, assignedUserId: true, createdBy: true } });
  if (!lead) return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
  if (!authorizeLeadAction(user, lead, 'UPDATE_DEPARTMENT')) return NextResponse.json({ error: 'No access to update this lead department' }, { status: 403 });

  const b = await req.json();
  if (!b.data || typeof b.data !== 'object') return NextResponse.json({ error: 'data object required' }, { status: 400 });
  if (!b.status) return NextResponse.json({ error: 'status is required' }, { status: 400 });
  if (!['new', 'in_progress', 'follow_up', 'converted', 'closed', 'lost', 'recycled'].includes(b.status)) {
    return NextResponse.json({ error: 'Invalid lead status' }, { status: 422 });
  }
  if (b.remark !== undefined && (typeof b.remark !== 'string' || b.remark.length > 5000)) {
    return NextResponse.json({ error: 'Remark must be text up to 5000 characters' }, { status: 422 });
  }

  // A department update may also carry a status/follow-up-only change. Do not
  // create a misleading empty department record in that case.
  const departmentFields = Object.fromEntries(
    Object.entries(b.data as Record<string, unknown>)
      .filter(([, value]) => value !== null && value !== undefined && String(value).trim() !== '')
  );
  let update: { id: number } | null = null;
  if (Object.keys(departmentFields).length > 0) {
    const [created] = await Promise.all([
      db.crmDepartmentUpdate.create({
        data: { leadId, userId: user.id, department: lead.department!, data: departmentFields as any },
        select: { id: true },
      }),
      db.crmLeadActivity.create({ data: { leadId, userId: user.id, action: 'department_update', details: { department: lead.department, fields: Object.keys(departmentFields) } } }),
    ]);
    update = created;
  }

  const leadUpdates: Record<string, unknown> = {};
  const activityWrites: Promise<unknown>[] = [];
  if (b.status && b.status !== lead.status) {
    leadUpdates.status = b.status;
    leadUpdates.updatedAt = new Date();
    activityWrites.push(db.crmLeadActivity.create({ data: { leadId, userId: user.id, action: 'status_changed', details: { from: lead.status, to: b.status } } }));
  }
  if (b.next_followup_date) {
    if (Number.isNaN(new Date(b.next_followup_date).getTime())) return NextResponse.json({ error: 'Invalid next_followup_date' }, { status: 422 });
    leadUpdates.nextFollowupDate = new Date(b.next_followup_date);
    leadUpdates.updatedAt = new Date();
  }
  if (typeof b.remark === 'string' && b.remark.trim()) {
    activityWrites.push(db.crmLeadActivity.create({ data: { leadId, userId: user.id, action: 'remark_added', details: { remark: b.remark.trim() } } }));
  }
  await Promise.all([
    Object.keys(leadUpdates).length > 0
      ? db.crmLead.update({ where: { id: leadId }, data: leadUpdates })
      : Promise.resolve(),
    activityWrites.length > 0 ? Promise.all(activityWrites) : Promise.resolve(),
  ]);
  try {
    await sendPushToLeadUsers(leadId, user.id, { title: 'CRM Activity Updated', body: 'A department update was added to a lead.' });
  } catch (error) {
    console.error('Push delivery failed after department update:', error);
  }
  return NextResponse.json({ update: update ? { id: update.id } : null, message: 'Department update saved' }, { status: 201 });
}

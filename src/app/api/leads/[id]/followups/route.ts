import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getCurrentUser, authorizeLeadAction } from '@/lib/auth';
import { sendPushToLeadUsers } from '@/lib/push';

// POST /api/leads/[id]/followups — add a follow-up
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  const { id } = await params;
  const leadId = parseInt(id, 10);
  const lead = await db.crmLead.findUnique({ where: { id: leadId }, select: { id: true, dealerId: true, department: true, assignedUserId: true, status: true, createdBy: true } });
  if (!lead) return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
  if (!authorizeLeadAction(user, lead, 'ADD_FOLLOWUP')) return NextResponse.json({ error: 'No access to add a follow-up for this lead' }, { status: 403 });

  const b = await req.json();
  if (!b.remarks && !b.next_followup_date) return NextResponse.json({ error: 'remarks or next_followup_date required' }, { status: 400 });
  if (b.next_followup_date && Number.isNaN(new Date(b.next_followup_date).getTime())) return NextResponse.json({ error: 'Invalid next_followup_date' }, { status: 422 });

  const followup = await db.crmLeadFollowup.create({
    data: {
      leadId, userId: user.id,
      remarks: b.remarks || null,
      nextFollowupDate: b.next_followup_date ? new Date(b.next_followup_date) : null,
      outcome: b.outcome || 'pending',
    },
    select: { id: true },
  });
  await db.crmLeadActivity.create({ data: { leadId, userId: user.id, action: 'follow_up', details: { remarks: b.remarks, next_followup_date: b.next_followup_date, outcome: b.outcome } } });

  if (b.next_followup_date) {
    const newStatus = ['new', 'in_progress'].includes(lead.status) ? 'follow_up' : lead.status;
    await db.crmLead.update({ where: { id: leadId }, data: { nextFollowupDate: new Date(b.next_followup_date), status: newStatus, updatedAt: new Date() } });
  }
  try {
    await sendPushToLeadUsers(leadId, user.id, { title: 'Follow-up Added', body: 'A new follow-up was added to a lead.' });
  } catch (error) {
    console.error('Push delivery failed after follow-up:', error);
  }
  return NextResponse.json({ followup: { id: followup.id }, message: 'Follow-up added' }, { status: 201 });
}

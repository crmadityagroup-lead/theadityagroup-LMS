import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getCurrentUser, canManageLeads, authorizeLeadAction } from '@/lib/auth';

// DELETE /api/leads/[id]/permanent — permanently delete a recycled lead
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  if (!canManageLeads(user)) return NextResponse.json({ error: 'Only admins can permanently delete leads' }, { status: 403 });
  const { id } = await params;
  const leadId = parseInt(id, 10);
  const lead = await db.crmLead.findUnique({ where: { id: leadId }, select: { status: true, dealerId: true, department: true, assignedUserId: true, createdBy: true } });
  if (!lead) return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
  if (!authorizeLeadAction(user, lead, 'PERMANENT_DELETE')) return NextResponse.json({ error: 'No access to permanently delete this lead' }, { status: 403 });
  if (lead.status !== 'recycled') return NextResponse.json({ error: 'Lead must be recycled first' }, { status: 400 });
  await db.crmLeadActivity.deleteMany({ where: { leadId } });
  await db.crmLeadFollowup.deleteMany({ where: { leadId } });
  await db.crmDepartmentUpdate.deleteMany({ where: { leadId } });
  await db.crmLead.delete({ where: { id: leadId } });
  return NextResponse.json({ message: 'Lead permanently deleted' });
}

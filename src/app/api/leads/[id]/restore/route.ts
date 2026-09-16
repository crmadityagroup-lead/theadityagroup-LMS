import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getCurrentUser, canManageLeads, authorizeLeadAction } from '@/lib/auth';

// POST /api/leads/[id]/restore — restore a recycled lead
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  if (!canManageLeads(user)) return NextResponse.json({ error: 'Only admins can restore leads' }, { status: 403 });
  const { id } = await params;
  const leadId = parseInt(id, 10);
  const lead = await db.crmLead.findUnique({ where: { id: leadId }, select: { dealerId: true, department: true, assignedUserId: true, status: true, createdBy: true } });
  if (!lead) return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
  if (!authorizeLeadAction(user, lead, 'RESTORE')) return NextResponse.json({ error: 'No access to restore this lead' }, { status: 403 });
  if (lead.status !== 'recycled') return NextResponse.json({ error: 'Lead is not in the recycle bin' }, { status: 400 });
  await db.crmLead.update({ where: { id: leadId }, data: { status: 'new', closedAt: null, updatedAt: new Date() } });
  await db.crmLeadActivity.create({ data: { leadId, userId: user.id, action: 'status_changed', details: { to: 'new', reason: 'restored from recycle bin' } } });
  return NextResponse.json({ message: 'Lead restored' });
}

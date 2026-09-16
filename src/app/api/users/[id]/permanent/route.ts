import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getCurrentUser, isSuperAdmin } from '@/lib/auth';

// DELETE /api/users/[id]/permanent — permanently delete a recycled user
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  if (!isSuperAdmin(user)) return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
  const { id } = await params;
  const uid = parseInt(id, 10);
  if (uid === user.id) return NextResponse.json({ error: 'Cannot delete yourself' }, { status: 400 });
  const target = await db.crmUser.findUnique({ where: { id: uid }, select: { id: true, recycledAt: true, email: true } });
  if (!target) return NextResponse.json({ error: 'User not found' }, { status: 404 });
  if (!target.recycledAt) return NextResponse.json({ error: 'User must be recycled first before permanent deletion' }, { status: 400 });

  // Reassign/null references to avoid FK violations
  await db.crmLead.updateMany({ where: { createdBy: uid }, data: { createdBy: user.id } });
  await db.crmLead.updateMany({ where: { assignedUserId: uid }, data: { assignedUserId: null } });
  await db.crmLeadFollowup.deleteMany({ where: { userId: uid } });
  await db.crmDepartmentUpdate.deleteMany({ where: { userId: uid } });
  await db.crmLeadActivity.updateMany({ where: { userId: uid }, data: { userId: null } });
  await db.crmUserEnquiryType.deleteMany({ where: { userId: uid } });
  await db.crmLoginHistory.deleteMany({ where: { userId: uid } });
  await db.crmOtpCode.deleteMany({ where: { email: target.email } });
  await db.crmUser.delete({ where: { id: uid } });
  return NextResponse.json({ message: 'User permanently deleted' });
}

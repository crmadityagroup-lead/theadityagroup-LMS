import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getCurrentUser, isSuperAdmin } from '@/lib/auth';

// POST /api/users/[id]/restore
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  if (!isSuperAdmin(user)) return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
  const { id } = await params;
  const uid = parseInt(id, 10);
  const target = await db.crmUser.findUnique({ where: { id: uid }, select: { email: true } });
  if (!target) return NextResponse.json({ error: 'User not found' }, { status: 404 });
  await db.crmUser.update({ where: { id: uid }, data: { active: true, recycledAt: null } });
  await db.crmLoginHistory.create({ data: { userId: uid, email: target.email, action: 'user_restored', userAgent: `Restored by ${user.email}` } });
  return NextResponse.json({ message: 'User restored' });
}

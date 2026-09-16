import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getCurrentUser, isSuperAdmin } from '@/lib/auth';

// GET /api/users/recycled/list — recycled users (super admin only)
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  if (!isSuperAdmin(user)) return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
  const users = await db.crmUser.findMany({
    where: { recycledAt: { not: null } },
    select: { id: true, name: true, email: true, role: true, department: true, recycledAt: true, createdAt: true, dealer: { select: { name: true } } },
    orderBy: { recycledAt: 'desc' },
  });
  const out = users.map((u: any) => ({ ...u, dealer_name: u.dealer?.name || null, dealer: undefined }));
  return NextResponse.json({ users: out });
}

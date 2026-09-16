import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getCurrentUser, isSuperAdmin } from '@/lib/auth';

// GET /api/master/all-dealers — all dealers (admin+super only)
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  // All admin-level users can list all dealers for filters
  if (!['super_admin', 'admin'].includes(user.role)) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
  }
  const dealers = await db.crmDealer.findMany({ where: { active: true }, orderBy: { id: 'asc' } });
  return NextResponse.json({ dealers });
}

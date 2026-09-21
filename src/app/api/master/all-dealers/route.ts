import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getCurrentUser, visibleDealerIds } from '@/lib/auth';

// GET /api/master/all-dealers — all dealers (admin+super only)
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  if (!['super_admin', 'admin', 'admin_2'].includes(user.role)) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
  }
  const visibleIds = visibleDealerIds(user);
  const dealers = await db.crmDealer.findMany({
    where: { active: true, ...(visibleIds === null ? {} : { id: { in: visibleIds } }) },
    orderBy: { id: 'asc' },
  });
  return NextResponse.json({ dealers });
}

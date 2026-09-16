import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getCurrentUser, isSuperAdmin } from '@/lib/auth';

// GET /api/master/models/recycled/list  (super admin — list recycled models)
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  if (!isSuperAdmin(user)) return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
  const models = await db.crmModel.findMany({
    where: { active: false, NOT: { recycledAt: null } },
    select: { id: true, name: true, recycledAt: true, brand: { select: { name: true, dealer: { select: { name: true } } } } },
    orderBy: { recycledAt: 'desc' },
  });
  const out = models.map(m => ({
    id: m.id, name: m.name, recycled_at: m.recycledAt,
    brand_name: m.brand?.name || null,
    dealer_name: m.brand?.dealer?.name || null,
  }));
  return NextResponse.json({ models: out });
}

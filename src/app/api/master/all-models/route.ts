import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getCurrentUser, isSuperAdmin } from '@/lib/auth';

// GET /api/master/all-models  (all active + recycled, super admin only)
// POST /api/master/all-models  (create a new model — super admin only, moved here for cascade)
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  if (!isSuperAdmin(user)) return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
  const models = await db.crmModel.findMany({
    where: { active: true },
    select: { id: true, name: true, active: true, recycledAt: true, brand: { select: { id: true, name: true, dealer: { select: { id: true, name: true } } } } },
    orderBy: { name: 'asc' },
  });
  const out = models.map(m => ({
    id: m.id, name: m.name, active: m.active, recycled_at: m.recycledAt,
    brand_id: m.brand.id, brand_name: m.brand.name,
    dealer_id: m.brand.dealer.id, dealer_name: m.brand.dealer.name,
  }));
  return NextResponse.json({ models: out });
}

// POST — add a new model (super admin only)
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  if (!isSuperAdmin(user)) return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
  const { name, brand_id } = await req.json();
  if (!name || !brand_id) return NextResponse.json({ error: 'name and brand_id required' }, { status: 400 });
  const model = await db.crmModel.create({ data: { name, brandId: parseInt(brand_id, 10) } });
  return NextResponse.json({ model }, { status: 201 });
}

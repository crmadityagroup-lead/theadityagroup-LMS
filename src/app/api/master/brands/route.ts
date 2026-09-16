import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

// GET /api/master/brands?dealer_id=123
export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  const dealerId = parseInt(req.nextUrl.searchParams.get('dealer_id') || '0', 10);
  if (!dealerId) return NextResponse.json({ brands: [] });
  const brands = await db.crmBrand.findMany({ where: { dealerId, active: true }, select: { id: true, name: true }, orderBy: { name: 'asc' } });
  return NextResponse.json({ brands });
}

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getCurrentUser, isSuperAdmin } from '@/lib/auth';

// GET /api/master/models?brand_id=123 — active models for a brand
export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  const brandId = parseInt(req.nextUrl.searchParams.get('brand_id') || '0', 10);
  if (!brandId) return NextResponse.json({ models: [] });
  const models = await db.crmModel.findMany({ where: { brandId, active: true }, select: { id: true, name: true }, orderBy: { name: 'asc' } });
  return NextResponse.json({ models });
}

// POST /api/master/models  (super admin — add a model to a brand)
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  if (!isSuperAdmin(user)) return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
  const { name, brand_id } = await req.json();
  if (!name || !brand_id) return NextResponse.json({ error: 'name and brand_id required' }, { status: 400 });
  const model = await db.crmModel.create({ data: { name, brandId: parseInt(brand_id, 10) } });
  return NextResponse.json({ model }, { status: 201 });
}

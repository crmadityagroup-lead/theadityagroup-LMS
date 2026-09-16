import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getCurrentUser, isSuperAdmin } from '@/lib/auth';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  if (!isSuperAdmin(user)) return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
  const { id } = await params;
  const { name, brand_id } = await req.json();
  if (!String(name || '').trim() || !brand_id) return NextResponse.json({ error: 'name and brand_id required' }, { status: 400 });
  const model = await db.crmModel.update({ where: { id: parseInt(id, 10) }, data: { name: String(name).trim(), brandId: parseInt(brand_id, 10) } });
  return NextResponse.json({ model });
}

// DELETE /api/master/models/[id]  (super admin — recycle a model)
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  if (!isSuperAdmin(user)) return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
  const { id } = await params;
  const modelId = parseInt(id, 10);
  await db.crmModel.update({ where: { id: modelId }, data: { active: false, recycledAt: new Date() } });
  return NextResponse.json({ message: 'Model moved to recycle bin' });
}

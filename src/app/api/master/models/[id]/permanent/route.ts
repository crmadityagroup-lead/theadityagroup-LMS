import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getCurrentUser, isSuperAdmin } from '@/lib/auth';

// DELETE /api/master/models/[id]/permanent
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  if (!isSuperAdmin(user)) return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
  const { id } = await params;
  const modelId = parseInt(id, 10);
  await db.crmModel.delete({ where: { id: modelId } });
  return NextResponse.json({ message: 'Model permanently deleted' });
}

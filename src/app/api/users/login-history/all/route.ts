import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getCurrentUser, isSuperAdmin } from '@/lib/auth';

// GET /api/users/login-history/all - recent login activity (Super Admin only)
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  if (!isSuperAdmin(user)) return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
  const history = await db.crmLoginHistory.findMany({
    take: 200,
    orderBy: { createdAt: 'desc' },
    select: { id: true, userId: true, email: true, action: true, userAgent: true, createdAt: true, user: { select: { name: true, email: true } } },
  });
  const out = history.map((h: any) => ({
    id: h.id, user_id: h.userId, email: h.email, action: h.action, user_agent: h.userAgent, created_at: h.createdAt,
    user_name: h.user?.name || null, user_email: h.user?.email || null,
  }));
  return NextResponse.json({ history: out });
}

// DELETE /api/users/login-history/all - permanently remove selected records (Super Admin only)
export async function DELETE(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  if (!isSuperAdmin(user)) return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const ids: number[] = Array.isArray(body.ids)
    ? [...new Set(body.ids.map((id: unknown) => Number(id)).filter((id: number) => Number.isInteger(id) && id > 0))] as number[]
    : [];
  if (!ids.length) return NextResponse.json({ error: 'At least one login history record is required' }, { status: 400 });

  const result = await db.crmLoginHistory.deleteMany({ where: { id: { in: ids } } });
  return NextResponse.json({ deleted: result.count });
}

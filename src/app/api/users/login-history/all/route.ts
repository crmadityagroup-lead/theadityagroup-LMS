import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { db } from '@/lib/db';
import { getCurrentUser, isSuperAdmin } from '@/lib/auth';

// GET /api/users/login-history/all - recent login activity (Super Admin only)
export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  if (!isSuperAdmin(user)) return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
  const from = /^\d{4}-\d{2}-\d{2}$/.test(req.nextUrl.searchParams.get('from') || '') ? req.nextUrl.searchParams.get('from') : null;
  const to = /^\d{4}-\d{2}-\d{2}$/.test(req.nextUrl.searchParams.get('to') || '') ? req.nextUrl.searchParams.get('to') : null;
  const parsedUserId = Number.parseInt(req.nextUrl.searchParams.get('user_id') || '', 10);
  const userId = Number.isInteger(parsedUserId) && parsedUserId > 0 ? parsedUserId : null;
  const createdAt = from || to ? { ...(from ? { gte: new Date(`${from}T00:00:00`) } : {}), ...(to ? { lt: new Date(`${to}T00:00:00`).getTime() ? new Date(new Date(`${to}T00:00:00`).getTime() + 86400000) : undefined } : {}) } : undefined;
  const history = await db.crmLoginHistory.findMany({
    take: 1000,
    orderBy: { createdAt: 'desc' },
    where: { ...(userId ? { userId } : {}), ...(createdAt ? { createdAt } : {}) },
    select: { id: true, userId: true, email: true, action: true, ip: true, userAgent: true, createdAt: true, user: { select: { name: true, email: true } } },
  });
  const userIds = [...new Set(history.map((item) => item.userId).filter((id): id is number => Number.isInteger(id)))];
  const avatarRows = userIds.length
    ? await db.$queryRaw<Array<{ id: number; avatar_data: string | null }>>(Prisma.sql`SELECT id, avatar_data FROM crm_users WHERE id IN (${Prisma.join(userIds)})`)
    : [];
  const avatarsByUserId = new Map(avatarRows.map((avatar) => [avatar.id, avatar.avatar_data]));
  const out = history.map((h: any) => ({
    id: h.id, user_id: h.userId, email: h.email, action: h.action, ip: h.ip, user_agent: h.userAgent, created_at: h.createdAt, avatar_data: h.userId ? avatarsByUserId.get(h.userId) || null : null,
    user_name: h.user?.name || null, user_email: h.user?.email || null,
  }));
  await db.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS crm_user_presence_daily (user_id INTEGER NOT NULL REFERENCES crm_users(id) ON DELETE CASCADE, work_date DATE NOT NULL, first_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), active_seconds BIGINT NOT NULL DEFAULT 0, PRIMARY KEY (user_id, work_date))`);
  const workRows = await db.$queryRaw<Array<{ user_id: number; active_seconds: bigint }>>`
    SELECT user_id, COALESCE(SUM(active_seconds), 0) AS active_seconds FROM crm_user_presence_daily
    WHERE work_date >= COALESCE(CAST(${from} AS DATE), DATE '1970-01-01') AND work_date <= COALESCE(CAST(${to} AS DATE), CURRENT_DATE)
      AND (${userId}::INTEGER IS NULL OR user_id = ${userId}) GROUP BY user_id
  `;
  const workByUser = new Map(workRows.map((row) => [row.user_id, Number(row.active_seconds)]));
  const users = await db.crmUser.findMany({ where: { recycledAt: null }, orderBy: { name: 'asc' }, select: { id: true, name: true, email: true } });
  return NextResponse.json({ history: out.map((row) => ({ ...row, work_seconds: row.user_id ? workByUser.get(row.user_id) || 0 : 0 })), users });
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

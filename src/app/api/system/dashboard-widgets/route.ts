import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { db } from '@/lib/db';
import { getCurrentUser, isAdmin } from '@/lib/auth';

const DEFAULT_WIDGETS = { stats: true, 'dealer-chart': true, 'status-chart': true, 'department-chart': true, 'recent-leads': true };

async function ensureTable() {
  await db.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS crm_dashboard_widget_settings (id INTEGER PRIMARY KEY DEFAULT 1, widgets JSONB NOT NULL, updated_by INTEGER, updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`);
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  await ensureTable();
  const rows = await db.$queryRaw<{ widgets: Record<string, boolean> }[]>(Prisma.sql`SELECT widgets FROM crm_dashboard_widget_settings WHERE id = 1`);
  return NextResponse.json({ widgets: { ...DEFAULT_WIDGETS, ...(rows[0]?.widgets || {}) } });
}

export async function PATCH(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  if (!isAdmin(user)) return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  const body = await request.json();
  const widgets = Object.fromEntries(Object.keys(DEFAULT_WIDGETS).map((key) => [key, body?.widgets?.[key] !== false]));
  await ensureTable();
  await db.$executeRaw(Prisma.sql`INSERT INTO crm_dashboard_widget_settings (id, widgets, updated_by, updated_at) VALUES (1, ${JSON.stringify(widgets)}::jsonb, ${user.id}, NOW()) ON CONFLICT (id) DO UPDATE SET widgets = EXCLUDED.widgets, updated_by = EXCLUDED.updated_by, updated_at = NOW()`);
  return NextResponse.json({ widgets });
}



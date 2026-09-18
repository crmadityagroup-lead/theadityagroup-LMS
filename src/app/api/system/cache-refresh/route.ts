import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getCurrentUser, isAdmin } from '@/lib/auth';

async function ensureCacheRefreshTable() {
  await db.$executeRawUnsafe('CREATE TABLE IF NOT EXISTS crm_cache_refresh (id INTEGER PRIMARY KEY, version INTEGER NOT NULL DEFAULT 0, updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_by INTEGER)');
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  await ensureCacheRefreshTable();
  const rows = await db.$queryRawUnsafe<Array<{ version: number }>>('SELECT version FROM crm_cache_refresh WHERE id = 1');
  return NextResponse.json({ version: rows[0]?.version || 0 });
}

export async function POST() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  if (!isAdmin(user)) return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  await ensureCacheRefreshTable();
  const rows = await db.$queryRawUnsafe<Array<{ version: number }>>('INSERT INTO crm_cache_refresh (id, version, updated_at, updated_by) VALUES (1, 1, NOW(), $1) ON CONFLICT (id) DO UPDATE SET version = crm_cache_refresh.version + 1, updated_at = NOW(), updated_by = EXCLUDED.updated_by RETURNING version', user.id);
  return NextResponse.json({ version: rows[0]?.version || 0 });
}

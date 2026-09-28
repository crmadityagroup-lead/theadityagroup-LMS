import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getCurrentUser, isSuperAdmin } from '@/lib/auth';

const PAGE_LABELS: Record<string, string> = {
  dashboard: 'Dashboard', leads: 'Leads', 'leads-new': 'Add Entry', 'lead-detail': 'Lead Detail',
  models: 'Models', users: 'Users', reports: 'Reports', performance: 'Performance',
  'login-history': 'Login History', 'recycle-bin': 'Recycle Bin', theme: 'Theme Settings',
  backup: 'Backup & Restore', 'support-tickets': 'Help Requests', 'database-health': 'Database Health', profile: 'Profile',
};

async function ensurePresenceTable() {
  await db.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS crm_user_presence (
    user_id INTEGER PRIMARY KEY REFERENCES crm_users(id) ON DELETE CASCADE,
    page TEXT NOT NULL DEFAULT 'dashboard',
    route_arg TEXT,
    last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`);
  await db.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS crm_user_presence_daily (
    user_id INTEGER NOT NULL REFERENCES crm_users(id) ON DELETE CASCADE,
    work_date DATE NOT NULL,
    first_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    active_seconds BIGINT NOT NULL DEFAULT 0,
    PRIMARY KEY (user_id, work_date)
  )`);
}

// POST /api/users/presence — heartbeat from the signed-in app shell.
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const page = typeof body.page === 'string' && PAGE_LABELS[body.page] ? body.page : 'dashboard';
  const routeArg = body.route_arg === null || body.route_arg === undefined ? null : String(body.route_arg).slice(0, 100);
  await ensurePresenceTable();
  await db.$executeRaw`
    INSERT INTO crm_user_presence (user_id, page, route_arg, last_seen_at, updated_at)
    VALUES (${user.id}, ${page}, ${routeArg}, NOW(), NOW())
    ON CONFLICT (user_id) DO UPDATE SET page = EXCLUDED.page, route_arg = EXCLUDED.route_arg, last_seen_at = NOW(), updated_at = NOW()
  `;
  // Count only the time between recent heartbeats. The 60-second cap prevents
  // an inactive/background tab from being counted as a full work session.
  await db.$executeRaw`
    INSERT INTO crm_user_presence_daily (user_id, work_date, first_seen_at, last_seen_at, active_seconds)
    VALUES (${user.id}, CURRENT_DATE, NOW(), NOW(), 0)
    ON CONFLICT (user_id, work_date) DO UPDATE SET
      last_seen_at = NOW(),
      active_seconds = crm_user_presence_daily.active_seconds + LEAST(60, GREATEST(0, FLOOR(EXTRACT(EPOCH FROM NOW() - crm_user_presence_daily.last_seen_at))::BIGINT))
  `;
  return NextResponse.json({ ok: true });
}

// GET /api/users/presence — active users, visible to Super Admin only.
export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  if (!isSuperAdmin(user)) return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });

  await ensurePresenceTable();
  const from = /^\d{4}-\d{2}-\d{2}$/.test(req.nextUrl.searchParams.get('from') || '') ? req.nextUrl.searchParams.get('from') : null;
  const to = /^\d{4}-\d{2}-\d{2}$/.test(req.nextUrl.searchParams.get('to') || '') ? req.nextUrl.searchParams.get('to') : null;
  const userId = Number.parseInt(req.nextUrl.searchParams.get('user_id') || '', 10);
  const selectedUserId = Number.isInteger(userId) && userId > 0 ? userId : null;
  const rows = await db.$queryRaw<Array<{ user_id: number; name: string; email: string; role: string; department: string | null; dealer_name: string | null; avatar_data: string | null; page: string; route_arg: string | null; last_seen_at: Date }>>`
    SELECT p.user_id, u.name, u.email, u.role, u.department, d.name AS dealer_name, u.avatar_data, p.page, p.route_arg, p.last_seen_at
    FROM crm_user_presence p
    JOIN crm_users u ON u.id = p.user_id
    LEFT JOIN crm_dealers d ON d.id = u.dealer_id
    WHERE u.active = TRUE AND u.recycled_at IS NULL AND p.last_seen_at > NOW() - INTERVAL '90 seconds' AND (${selectedUserId}::INTEGER IS NULL OR p.user_id = ${selectedUserId})
    ORDER BY p.last_seen_at DESC
  `;
  const summaries = await db.$queryRaw<Array<{ user_id: number; name: string; email: string; role: string; department: string | null; dealer_name: string | null; active_days: bigint; active_seconds: bigint; first_seen_at: Date; last_seen_at: Date }>>`
    SELECT d.user_id, u.name, u.email, u.role, u.department, dealer.name AS dealer_name,
      COUNT(*) AS active_days, COALESCE(SUM(d.active_seconds), 0) AS active_seconds,
      MIN(d.first_seen_at) AS first_seen_at, MAX(d.last_seen_at) AS last_seen_at
    FROM crm_user_presence_daily d
    JOIN crm_users u ON u.id = d.user_id
    LEFT JOIN crm_dealers dealer ON dealer.id = u.dealer_id
    WHERE u.recycled_at IS NULL
      AND d.work_date >= COALESCE(CAST(${from} AS DATE), DATE '1970-01-01')
      AND d.work_date <= COALESCE(CAST(${to} AS DATE), CURRENT_DATE)
      AND (${selectedUserId}::INTEGER IS NULL OR d.user_id = ${selectedUserId})
    GROUP BY d.user_id, u.name, u.email, u.role, u.department, dealer.name
    ORDER BY active_seconds DESC, last_seen_at DESC
  `;
  return NextResponse.json({ users: rows.map((row) => ({ ...row, page_label: PAGE_LABELS[row.page] || row.page })), summaries: summaries.map((summary) => ({ ...summary, active_days: Number(summary.active_days), active_seconds: Number(summary.active_seconds) })) });
}

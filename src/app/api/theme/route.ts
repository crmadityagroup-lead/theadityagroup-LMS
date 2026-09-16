import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getCurrentUser, ROLES } from '@/lib/auth';

const DEFAULT_COLORS = {
  background: '#ffffff', foreground: '#000000', primary: '#000000', primaryForeground: '#ffffff',
  accent: '#d89b27', accentForeground: '#000000', card: '#ffffff', cardForeground: '#000000',
  muted: '#f4f4f5', mutedForeground: '#52525b', border: '#000000', sidebar: '#ffffff',
  sidebarForeground: '#000000', sidebarAccent: '#d89b27', sidebarAccentForeground: '#000000',
  chart1: '#3B82F6', chart2: '#8B5CF6', chart3: '#F97316', chart4: '#22C55E', chart5: '#EF4444',
};

async function ensureThemeTable() {
  await db.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS crm_theme_settings (id integer PRIMARY KEY, colors jsonb NOT NULL, updated_at timestamptz NOT NULL DEFAULT now())`);
}

export async function GET() {
  try {
    await ensureThemeTable();
    const rows = await db.$queryRawUnsafe<Array<{ colors: Record<string, string> }>>('SELECT colors FROM crm_theme_settings WHERE id = 1 LIMIT 1');
    return NextResponse.json({ colors: { ...DEFAULT_COLORS, ...(rows[0]?.colors || {}) } });
  } catch (error) {
    console.error('[theme] read failed', error);
    return NextResponse.json({ colors: DEFAULT_COLORS });
  }
}

export async function PUT(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  if (user.role !== ROLES.SUPER_ADMIN) return NextResponse.json({ error: 'Only Super Admin can change the global theme' }, { status: 403 });

  try {
    const body = await req.json();
    const colors = { ...DEFAULT_COLORS, ...(body.colors || {}) };
    if (Object.values(colors).some((value) => typeof value !== 'string' || !/^#[0-9a-f]{6}$/i.test(value))) {
      return NextResponse.json({ error: 'Theme colors must be six-digit hex values' }, { status: 400 });
    }
    await ensureThemeTable();
    const json = JSON.stringify(colors);
    await db.$executeRawUnsafe('INSERT INTO crm_theme_settings (id, colors) VALUES (1, $1::jsonb) ON CONFLICT (id) DO UPDATE SET colors = EXCLUDED.colors, updated_at = now()', json);
    return NextResponse.json({ colors });
  } catch (error) {
    console.error('[theme] save failed', error);
    return NextResponse.json({ error: 'Failed to save global theme' }, { status: 500 });
  }
}

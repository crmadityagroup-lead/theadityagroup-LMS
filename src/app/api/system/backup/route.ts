import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getCurrentUser, isSuperAdmin } from '@/lib/auth';

export const dynamic = 'force-dynamic';

const backupModels = {
  dealers: 'crmDealer',
  brands: 'crmBrand',
  models: 'crmModel',
  enquiry_categories: 'crmEnquiryCategory',
  enquiry_types: 'crmEnquiryType',
  users: 'crmUser',
  user_enquiry_types: 'crmUserEnquiryType',
  leads: 'crmLead',
  lead_activities: 'crmLeadActivity',
  lead_followups: 'crmLeadFollowup',
  department_updates: 'crmDepartmentUpdate',
  login_history: 'crmLoginHistory',
} as const;

function serialize(value: any): any {
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(serialize);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, serialize(item)]));
  return value;
}

function date(value: any) {
  return value ? new Date(value) : value;
}

function normalizeRows(key: string, rows: any[]) {
  const dateFields: Record<string, string[]> = {
    dealers: ['createdAt'], brands: ['createdAt'], models: ['createdAt', 'recycledAt'],
    enquiry_categories: ['createdAt'], enquiry_types: ['createdAt'],
    users: ['recycledAt', 'lastLoginAt', 'lastActiveAt', 'createdAt', 'updatedAt'],
    leads: ['nextFollowupDate', 'createdAt', 'updatedAt', 'closedAt'],
    lead_activities: ['createdAt'], lead_followups: ['followupDate', 'nextFollowupDate', 'createdAt'],
    department_updates: ['createdAt'], login_history: ['createdAt'],
  };
  return rows.map((row) => {
    const copy = { ...row };
    for (const field of dateFields[key] || []) if (field in copy) copy[field] = date(copy[field]);
    return copy;
  });
}

async function readBackup() {
  const client: any = db;
  const entries = await Promise.all(Object.entries(backupModels).map(async ([key, model]) => {
    const rows = await client[model].findMany({ orderBy: { id: 'asc' } });
    return [key, serialize(rows)] as const;
  }));
  return {
    format: 'aditya-group-crm-backup',
    version: 1,
    generated_at: new Date().toISOString(),
    tables: Object.fromEntries(entries),
  };
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  if (!isSuperAdmin(user)) return NextResponse.json({ error: 'Super Admin access required' }, { status: 403 });
  const backup = await readBackup();
  return new NextResponse(JSON.stringify(backup, null, 2), {
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': `attachment; filename="aditya-crm-backup-${new Date().toISOString().slice(0, 10)}.json"`,
      'Cache-Control': 'no-store',
    },
  });
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  if (!isSuperAdmin(user)) return NextResponse.json({ error: 'Super Admin access required' }, { status: 403 });

  let backup: any;
  try { backup = await request.json(); } catch { return NextResponse.json({ error: 'Invalid backup JSON' }, { status: 400 }); }
  if (backup?.format !== 'aditya-group-crm-backup' || !backup.tables) return NextResponse.json({ error: 'Unsupported backup file' }, { status: 400 });

  const client: any = db;
  try {
    await client.$transaction(async (tx: any) => {
      const tables = backup.tables;
      const insert = async (key: string, model: string) => {
        const rows = Array.isArray(tables[key]) ? normalizeRows(key, tables[key]) : [];
        if (rows.length) await tx[model].createMany({ data: rows, skipDuplicates: true });
      };
      await insert('dealers', 'crmDealer');
      await insert('brands', 'crmBrand');
      await insert('models', 'crmModel');
      await insert('enquiry_categories', 'crmEnquiryCategory');
      await insert('enquiry_types', 'crmEnquiryType');
      await insert('users', 'crmUser');
      await insert('user_enquiry_types', 'crmUserEnquiryType');
      await insert('leads', 'crmLead');
      await insert('lead_activities', 'crmLeadActivity');
      await insert('lead_followups', 'crmLeadFollowup');
      await insert('department_updates', 'crmDepartmentUpdate');
      await insert('login_history', 'crmLoginHistory');
    }, { timeout: 60000 });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Restore failed' }, { status: 500 });
  }
  return NextResponse.json({ restored: true, message: 'Backup data restored. Existing records were preserved.' });
}



import { timingSafeEqual } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { db } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

export const runtime = 'nodejs';

const VIEW_ROLES = ['super_admin', 'admin', 'admin_2', 'data_operator_1', 'data_operator_2'];

function hasValidSecret(req: NextRequest) {
  const configured = process.env.SHEETS_SYNC_SECRET || '';
  const supplied = req.headers.get('authorization') || '';
  const expected = `Bearer ${configured}`;
  if (!configured || supplied.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(supplied), Buffer.from(expected));
}

export async function POST(req: NextRequest) {
  if (!hasValidSecret(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const raw = await req.text();
  if (raw.length > 256_000) return NextResponse.json({ error: 'Submission is too large' }, { status: 413 });

  let body: any;
  try { body = JSON.parse(raw); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }
  const expectedSheetId = process.env.GOOGLE_SHEET_ID;
  const sheetId = String(body?.sheet_id || '');
  if (!expectedSheetId || sheetId !== expectedSheetId) return NextResponse.json({ error: 'This spreadsheet is not configured' }, { status: 403 });
  const rows = Array.isArray(body?.rows) ? body.rows : [body];
  if (!rows.length || rows.length > 100) return NextResponse.json({ error: 'Send between 1 and 100 rows per request' }, { status: 400 });

  const upserts = [];
  for (const row of rows) {
    const sheetName = String(row?.sheet_name || '').trim();
    const rowNumber = Number(row?.row_number);
    const headers = row?.headers;
    const values = row?.values;
    if (!sheetName || sheetName.length > 200 || !Number.isInteger(rowNumber) || rowNumber < 2) {
      return NextResponse.json({ error: 'Invalid sheet row information' }, { status: 400 });
    }
    if (!Array.isArray(headers) || !Array.isArray(values) || !headers.length || headers.length !== values.length || headers.length > 200) {
      return NextResponse.json({ error: 'Header and value columns do not match' }, { status: 400 });
    }
    const response = {
      headers: headers.map((value: unknown) => String(value ?? '').slice(0, 200)),
      values: values.map((value: unknown) => String(value ?? '').slice(0, 10_000)),
    };
    upserts.push(db.crmGoogleSheetResponse.upsert({
      where: { sheetId_sheetName_rowNumber: { sheetId, sheetName, rowNumber } },
      create: { sheetId, sheetName, rowNumber, response: response as Prisma.InputJsonValue },
      update: { response: response as Prisma.InputJsonValue, updatedAt: new Date() },
    }));
  }
  await db.$transaction(upserts);
  return NextResponse.json({ ok: true, synced: upserts.length });
}

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  if (!VIEW_ROLES.includes(user.role)) return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });

  const limit = Math.min(Math.max(Number.parseInt(req.nextUrl.searchParams.get('limit') || '100', 10) || 100, 1), 500);
  const offset = Math.max(Number.parseInt(req.nextUrl.searchParams.get('offset') || '0', 10) || 0, 0);
  const [responses, total] = await Promise.all([
    db.crmGoogleSheetResponse.findMany({ orderBy: { createdAt: 'desc' }, take: limit, skip: offset }),
    db.crmGoogleSheetResponse.count(),
  ]);
  return NextResponse.json({ responses, total, limit, offset });
}

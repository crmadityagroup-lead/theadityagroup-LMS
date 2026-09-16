import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { DEPARTMENTS } from '@/lib/department-constants';
import { syncEnquiryMasters } from '@/lib/enquiry-masters';

export const dynamic = 'force-dynamic';

// GET /api/master/enquiry-categories
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  await syncEnquiryMasters();
  const categories = await db.crmEnquiryCategory.findMany({ where: { name: { in: [...DEPARTMENTS] } }, orderBy: { name: 'asc' } });
  return NextResponse.json({ categories }, { headers: { 'Cache-Control': 'no-store, max-age=0' } });
}

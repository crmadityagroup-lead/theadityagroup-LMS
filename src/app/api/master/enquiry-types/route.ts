import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { canonicalDepartment, ENQUIRY_TYPES } from '@/lib/department-constants';
import { syncEnquiryMasters } from '@/lib/enquiry-masters';

export const dynamic = 'force-dynamic';

// GET /api/master/enquiry-types?category_id=123
export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  await syncEnquiryMasters();
  const categoryId = parseInt(req.nextUrl.searchParams.get('category_id') || '0', 10);
  const where = categoryId ? { categoryId } : {};
  const enquiry_types = await db.crmEnquiryType.findMany({
    where,
    select: { id: true, name: true, categoryId: true, department: true },
    orderBy: { name: 'asc' },
  });
  return NextResponse.json({ enquiry_types: enquiry_types.filter((type) => ENQUIRY_TYPES.includes(type.name as typeof ENQUIRY_TYPES[number])).map((type) => ({ ...type, department: canonicalDepartment(type.department) })) }, { headers: { 'Cache-Control': 'no-store, max-age=0' } });
}

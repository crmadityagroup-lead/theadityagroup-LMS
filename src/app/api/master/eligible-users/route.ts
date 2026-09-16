import { NextRequest, NextResponse } from 'next/server';
import { getEligibleUsers } from '@/lib/cascade';
import { getCurrentUser } from '@/lib/auth';

// GET /api/master/eligible-users?dealer_id=&department=&enquiry_type_id=
export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  const sp = req.nextUrl.searchParams;
  const dealerId = parseInt(sp.get('dealer_id') || '0', 10);
  const department = sp.get('department') || '';
  const enquiryTypeId = parseInt(sp.get('enquiry_type_id') || '0', 10);
  if (!dealerId || !department || !enquiryTypeId) {
    return NextResponse.json({ users: [] });
  }
  const users = await getEligibleUsers({ dealerId, department, enquiryTypeId });
  return NextResponse.json({ users });
}

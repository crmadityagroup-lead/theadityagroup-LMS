import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { getOperatorDealers } from '@/lib/cascade';

// GET /api/master/dealers — dealers the current user can operate on
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  const dealers = await getOperatorDealers(user);
  return NextResponse.json({ dealers });
}

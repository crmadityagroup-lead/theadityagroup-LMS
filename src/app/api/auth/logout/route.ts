import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { db } from '@/lib/db';
import { getCurrentUser, clearAuthCookie } from '@/lib/auth';

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (user) {
    const ip = req.headers.get('x-forwarded-for') || '';
    const ua = req.headers.get('user-agent') || '';
    await db.crmLoginHistory.create({ data: { userId: user.id, email: user.email, action: 'logout', ip, userAgent: ua } });
  }
  const store = await cookies();
  store.set(clearAuthCookie());
  return NextResponse.json({ message: 'Logged out' });
}

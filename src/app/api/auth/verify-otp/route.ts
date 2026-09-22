import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { db } from '@/lib/db';
import { signToken, setAuthCookie } from '@/lib/auth';

export async function POST(req: NextRequest) {
  try {
    const { email, code } = await req.json();
    if (!email || !code) return NextResponse.json({ error: 'Email and OTP code required' }, { status: 400 });
    const ip = req.headers.get('x-forwarded-for') || '';
    const ua = req.headers.get('user-agent') || '';

    const user = await db.crmUser.findUnique({ where: { email }, include: { dealer: { select: { name: true } } } });
    if (!user) {
      await db.crmLoginHistory.create({ data: { email, action: 'failed_no_user', ip, userAgent: ua } });
      return NextResponse.json({ error: 'Email not registered' }, { status: 404 });
    }
    if (user.recycledAt) {
      await db.crmLoginHistory.create({ data: { userId: user.id, email, action: 'failed_recycled', ip, userAgent: ua } });
      return NextResponse.json({ error: 'This account has been recycled.' }, { status: 403 });
    }
    if (!user.active) {
      await db.crmLoginHistory.create({ data: { userId: user.id, email, action: 'failed_inactive', ip, userAgent: ua } });
      return NextResponse.json({ error: 'Account is inactive' }, { status: 403 });
    }

    const otp = await db.crmOtpCode.findFirst({
      where: { email, code, purpose: 'login', used: false, expiresAt: { gt: new Date() } },
      orderBy: { id: 'desc' },
    });
    if (!otp) {
      await db.crmLoginHistory.create({ data: { userId: user.id, email, action: 'failed_bad_otp', ip, userAgent: ua } });
      return NextResponse.json({ error: 'Invalid or expired OTP. Please request a new code.' }, { status: 401 });
    }
    await db.crmOtpCode.update({ where: { id: otp.id }, data: { used: true } });
    await db.crmUser.update({ where: { id: user.id }, data: { emailVerified: true, lastLoginAt: new Date(), lastActiveAt: new Date() } });
    await db.crmLoginHistory.create({ data: { userId: user.id, email, action: 'login', ip, userAgent: ua } });

    const token = signToken({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      dealer_id: user.dealerId,
      department: user.department,
      departments: user.departments,
    });
    const store = await cookies();
    store.set(setAuthCookie(token));

    return NextResponse.json({
      token,
      user: {
        id: user.id, name: user.name, email: user.email, role: user.role,
        dealer_id: user.dealerId, dealer_name: user.dealer?.name || null, department: user.department, departments: user.departments, email_verified: true,
      },
    });
  } catch (err: any) {
    console.error('[auth] verify-otp error', err);
    return NextResponse.json({ error: 'OTP verification failed' }, { status: 500 });
  }
}

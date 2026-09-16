import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { sendOtpEmail } from '@/lib/mail';

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json();
    if (!email) return NextResponse.json({ error: 'Email required' }, { status: 400 });
    const ip = req.headers.get('x-forwarded-for') || '';
    const ua = req.headers.get('user-agent') || '';

    const user = await db.crmUser.findUnique({ where: { email } });
    if (!user) {
      await db.crmLoginHistory.create({ data: { email, action: 'failed_no_user', ip, userAgent: ua } });
      return NextResponse.json({ error: 'This email is not registered in the system. Please contact your administrator to be added.' }, { status: 404 });
    }
    if (user.recycledAt) {
      await db.crmLoginHistory.create({ data: { userId: user.id, email, action: 'failed_recycled', ip, userAgent: ua } });
      return NextResponse.json({ error: 'This account has been recycled. Please contact your administrator.' }, { status: 403 });
    }
    if (!user.active) {
      await db.crmLoginHistory.create({ data: { userId: user.id, email, action: 'failed_inactive', ip, userAgent: ua } });
      return NextResponse.json({ error: 'Your account is inactive. Please contact your administrator.' }, { status: 403 });
    }

    const code = String(Math.floor(100000 + Math.random() * 900000));
    const ttl = 2;
    await db.crmOtpCode.deleteMany({ where: { email } });
    await db.crmOtpCode.create({ data: { email, code, purpose: 'login', expiresAt: new Date(Date.now() + ttl * 60 * 1000) } });

    // Do not report success until the mail provider has accepted the message.
    // A background send made the UI show a false "OTP sent" message when both
    // SMTP mailboxes were unavailable in production.
    try {
      await sendOtpEmail(email, code, user.name);
    } catch (mailError: any) {
      await db.crmOtpCode.deleteMany({ where: { email, code, purpose: 'login' } });
      console.error('[auth] otp email failed', {
        code: mailError?.code,
        command: mailError?.command,
        message: mailError?.message,
      });
      return NextResponse.json(
        { error: 'We could not send the OTP right now. Please try again shortly.' },
        { status: 502 },
      );
    }
    return NextResponse.json({ message: `OTP sent to ${email}. Valid for ${ttl} minutes.`, ttl_minutes: ttl });
  } catch (err: any) {
    console.error('[auth] send-otp error', err);
    return NextResponse.json({ error: 'Failed to send OTP' }, { status: 500 });
  }
}

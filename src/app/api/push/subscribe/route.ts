import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { db } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { ensurePushTable } from '@/lib/push';

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  await ensurePushTable();
  const body = await request.json();
  const subscription = body?.subscription;
  if (!subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) return NextResponse.json({ error: 'Invalid push subscription' }, { status: 400 });
  await db.$executeRaw(Prisma.sql`INSERT INTO crm_push_subscriptions (user_id, endpoint, p256dh, auth) VALUES (${user.id}, ${subscription.endpoint}, ${subscription.keys.p256dh}, ${subscription.keys.auth}) ON CONFLICT (endpoint) DO UPDATE SET user_id = EXCLUDED.user_id, p256dh = EXCLUDED.p256dh, auth = EXCLUDED.auth, updated_at = NOW()`);
  return NextResponse.json({ subscribed: true });
}

export async function DELETE(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  await ensurePushTable();
  const { endpoint } = await request.json();
  if (endpoint) await db.$executeRaw(Prisma.sql`DELETE FROM crm_push_subscriptions WHERE user_id = ${user.id} AND endpoint = ${endpoint}`);
  return NextResponse.json({ unsubscribed: true });
}



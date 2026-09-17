import webpush from 'web-push';
import { Prisma } from '@prisma/client';
import { db } from '@/lib/db';
import { getLeadAssignees } from '@/lib/lead-assignees';

export async function ensurePushTable() {
  await db.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS crm_push_subscriptions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES crm_users(id) ON DELETE CASCADE,
    endpoint TEXT NOT NULL UNIQUE,
    p256dh TEXT NOT NULL,
    auth TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`);
  await db.$executeRawUnsafe('CREATE INDEX IF NOT EXISTS crm_push_subscriptions_user_id_idx ON crm_push_subscriptions(user_id)');
}

let configured = false;
let configurationWarningLogged = false;
function configure() {
  if (configured) return true;
  const subject = process.env.VAPID_SUBJECT;
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!subject || !publicKey || !privateKey) {
    if (!configurationWarningLogged) {
      console.error('[push] VAPID_SUBJECT, VAPID_PUBLIC_KEY, and VAPID_PRIVATE_KEY must be configured.');
      configurationWarningLogged = true;
    }
    return false;
  }
  webpush.setVapidDetails(subject, publicKey, privateKey);
  configured = true;
  return true;
}

export async function sendPushToLeadUsers(leadId: number, actorId: number, payload: { title: string; body: string }) {
  if (!configure()) return;
  await ensurePushTable();
  const [lead, assignedUsers] = await Promise.all([
    db.crmLead.findUnique({ where: { id: leadId }, select: { assignedUserId: true, createdBy: true, dealerId: true } }),
    getLeadAssignees(leadId),
  ]);
  if (!lead) return;
  const admins = await db.crmUser.findMany({ where: { role: { in: ['admin', 'super_admin'] }, active: true }, select: { id: true } });
  const userIds = [...new Set([
    lead.assignedUserId,
    ...assignedUsers.map((assigned) => assigned.id),
    lead.createdBy,
    ...admins.map((item) => item.id),
  ].filter((id): id is number => !!id && id !== actorId))];
  if (!userIds.length) return;
  const subscriptions = await db.$queryRaw<{ id: number; endpoint: string; p256dh: string; auth: string }[]>(Prisma.sql`SELECT id, endpoint, p256dh, auth FROM crm_push_subscriptions WHERE user_id IN (${Prisma.join(userIds)})`);
  await Promise.all(subscriptions.map(async (subscription) => {
    try {
      await webpush.sendNotification({ endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth } }, JSON.stringify({ ...payload, url: '/' }));
    } catch (error: any) {
      if ([404, 410].includes(error?.statusCode)) await db.$executeRaw(Prisma.sql`DELETE FROM crm_push_subscriptions WHERE id = ${subscription.id}`).catch(() => {});
      else console.error('[push] Delivery failed:', { statusCode: error?.statusCode, message: error?.message });
    }
  }));
}

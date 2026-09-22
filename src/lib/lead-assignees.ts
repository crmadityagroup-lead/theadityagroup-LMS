import { db } from '@/lib/db';
import { Prisma } from '@prisma/client';

let assigneeTableReady: Promise<void> | null = null;

export async function ensureLeadAssigneeTable() {
  if (!assigneeTableReady) {
    assigneeTableReady = db.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS crm_lead_assignees (lead_id integer NOT NULL REFERENCES crm_leads(id) ON DELETE CASCADE, user_id integer NOT NULL REFERENCES crm_users(id) ON DELETE CASCADE, is_primary boolean NOT NULL DEFAULT false, created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY (lead_id, user_id))`).then(() => undefined).catch((error) => {
      assigneeTableReady = null;
      throw error;
    });
  }
  await assigneeTableReady;
}

export async function setLeadAssignees(leadId: number, userIds: number[]) {
  const uniqueIds = [...new Set(userIds)].filter(Number.isInteger);
  await ensureLeadAssigneeTable();
  await db.$executeRawUnsafe('DELETE FROM crm_lead_assignees WHERE lead_id = $1', leadId);
  if (!uniqueIds.length) return;
  await db.$executeRaw(Prisma.sql`
    INSERT INTO crm_lead_assignees (lead_id, user_id, is_primary)
    VALUES ${Prisma.join(uniqueIds.map((userId, index) => Prisma.sql`(${leadId}, ${userId}, ${index === 0})`))}
    ON CONFLICT (lead_id, user_id) DO UPDATE SET is_primary = EXCLUDED.is_primary
  `);
}

export async function getLeadAssignees(leadId: number) {
  await ensureLeadAssigneeTable();
  return db.$queryRawUnsafe<Array<{ id: number; name: string; email: string; phone: string | null; is_primary: boolean }>>(`SELECT u.id, u.name, u.email, u.phone, a.is_primary FROM crm_lead_assignees a JOIN crm_users u ON u.id = a.user_id WHERE a.lead_id = $1 ORDER BY a.is_primary DESC, u.name ASC`, leadId);
}

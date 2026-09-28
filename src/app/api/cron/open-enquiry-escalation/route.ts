import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { sendOpenEnquiryEscalationEmail } from '@/lib/mail';
import { Prisma } from '@prisma/client';

const ESCALATION_ACTION = 'open_enquiry_escalation_email_sent';
const ACTIVE_STATUSES = ['new', 'in_progress', 'follow_up'];

// GET /api/cron/open-enquiry-escalation — called hourly by the deployment scheduler.
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  await db.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS crm_lead_escalation_settings (id INTEGER PRIMARY KEY DEFAULT 1, settings JSONB NOT NULL, updated_by INTEGER, updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`);
  const settingRows = await db.$queryRaw<Array<{ settings: { enabled?: boolean; recipients?: string[]; departments?: string[]; threshold_hours?: number } }>>(Prisma.sql`SELECT settings FROM crm_lead_escalation_settings WHERE id = 1`);
  const settings = settingRows[0]?.settings;
  if (!settings?.enabled || !settings.recipients?.length) return NextResponse.json({ checked: 0, sent: 0, disabled: true });
  const thresholdHours = Math.min(24 * 90, Math.max(1, Number(settings.threshold_hours) || 48));
  const cutoff = new Date(Date.now() - thresholdHours * 60 * 60 * 1000);
  const leads = await db.crmLead.findMany({
    where: {
      status: { in: ACTIVE_STATUSES },
      createdAt: { lte: cutoff },
      ...(settings.departments?.length ? { department: { in: settings.departments } } : {}),
      activities: { none: { action: ESCALATION_ACTION } },
    },
    select: {
      id: true, leadCode: true, customerName: true, mobile: true, department: true, priority: true, status: true, createdAt: true,
      dealer: { select: { name: true } },
      enquiryCategory: { select: { name: true } },
      enquiryType: { select: { name: true } },
      assignedUser: { select: { name: true, email: true } },
    },
    orderBy: { createdAt: 'asc' },
    take: 200,
  });
  const recipients = settings.recipients;
  const results = await Promise.allSettled(leads.map(async (lead) => {
    await sendOpenEnquiryEscalationEmail({
      leadCode: lead.leadCode,
      recipients,
      fields: {
        'Lead code': lead.leadCode,
        Customer: lead.customerName,
        Mobile: lead.mobile,
        Dealer: lead.dealer?.name,
        'Enquiry category': lead.enquiryCategory?.name,
        'Enquiry type': lead.enquiryType?.name,
        Department: lead.department,
        'Assigned user': lead.assignedUser?.name || 'Unassigned',
        'Assigned user email': lead.assignedUser?.email || '—',
        Priority: lead.priority,
        Status: lead.status,
        'Open for at least': `${thresholdHours} hour(s)`,
        'Created at': lead.createdAt.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }),
      },
    });
    await db.crmLeadActivity.create({ data: { leadId: lead.id, action: ESCALATION_ACTION, details: { recipients, threshold_hours: thresholdHours, departments: settings.departments || [] } } });
  }));
  const sent = results.filter((result) => result.status === 'fulfilled').length;
  const failed = results.length - sent;
  if (failed) console.error(`Open-enquiry escalation: ${failed} delivery failure(s).`);
  return NextResponse.json({ checked: leads.length, sent, failed });
}
